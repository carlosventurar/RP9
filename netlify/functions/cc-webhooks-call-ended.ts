import { Handler, HandlerEvent } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import { verifyWebhookSignature } from '../../src/lib/security/hmac'
import { rateLimitByIP, RATE_LIMIT_CONFIGS, getClientIP, getRateLimitHeaders } from '../../src/lib/security/rate-limit'
import { z } from 'zod'

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const hmacSecret = process.env.HMAC_SECRET

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase configuration for CC webhooks')
}

const supabase = supabaseUrl && supabaseServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null

// Validation schemas for different providers
const BaseCallEventSchema = z.object({
  call_id: z.string(),
  started_at: z.string(),
  ended_at: z.string(),
  duration_seconds: z.number().optional(),
  agent: z.object({
    id: z.string(),
    name: z.string().optional(),
    extension: z.string().optional()
  }).optional(),
  customer: z.object({
    phone: z.string().optional(),
    name: z.string().optional(),
    crm_id: z.string().optional()
  }).optional(),
  queue: z.string().optional(),
  status: z.enum(['completed', 'abandoned', 'transferred', 'error']).default('completed')
})

const ThreeCXWebhookSchema = z.object({
  event_type: z.string(),
  call_id: z.string(),
  from: z.string().optional(),
  to: z.string().optional(),
  start_time: z.string(),
  end_time: z.string(),
  duration: z.number().optional(),
  agent_extension: z.string().optional(),
  agent_name: z.string().optional(),
  queue_name: z.string().optional(),
  call_result: z.string().optional()
})

const GenesysWebhookSchema = z.object({
  eventType: z.string(),
  conversationId: z.string(),
  participants: z.array(z.object({
    participantId: z.string(),
    userId: z.string().optional(),
    name: z.string().optional(),
    purpose: z.string()
  })).optional(),
  startTime: z.string(),
  endTime: z.string(),
  direction: z.enum(['inbound', 'outbound']).optional(),
  ani: z.string().optional(),
  dnis: z.string().optional()
})

interface NormalizedCallEvent {
  type: 'call.ended'
  provider: '3cx' | 'genesys' | 'generic'
  call_id: string
  started_at: string
  ended_at: string
  duration_seconds?: number
  agent?: {
    id: string
    name?: string
    extension?: string
  }
  customer?: {
    phone?: string
    name?: string
    crm_id?: string
  }
  queue?: string
  status: 'completed' | 'abandoned' | 'transferred' | 'error'
  meta: Record<string, any>
}

export const handler: Handler = async (event: HandlerEvent) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-rp9-signature, x-3cx-signature, x-genesys-signature',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  }

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' }
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    }
  }

  try {
    // Rate limiting by IP
    const clientIP = getClientIP(event.headers)
    const rateLimitResult = rateLimitByIP(clientIP, RATE_LIMIT_CONFIGS.WEBHOOK)
    
    if (!rateLimitResult.allowed) {
      return {
        statusCode: 429,
        headers: { ...headers, ...getRateLimitHeaders(rateLimitResult) },
        body: JSON.stringify({ 
          error: 'Rate limit exceeded',
          remaining: rateLimitResult.remaining,
          resetTime: rateLimitResult.resetTime
        })
      }
    }

    // Verify HMAC signature if secret is configured
    if (hmacSecret && event.body) {
      const verification = verifyWebhookSignature(event.body, event.headers, hmacSecret)
      if (!verification.isValid) {
        console.warn('HMAC verification failed:', verification.error)
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({ error: 'Invalid signature' })
        }
      }
    }

    if (!supabase) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Service configuration error' })
      }
    }

    if (!event.body) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Request body is required' })
      }
    }

    // Parse and validate webhook payload
    const rawPayload = JSON.parse(event.body)
    const provider = detectProvider(rawPayload, event.headers)
    
    console.log(`Processing ${provider} webhook:`, {
      provider,
      eventType: rawPayload.event_type || rawPayload.eventType,
      callId: rawPayload.call_id || rawPayload.conversationId
    })

    // Normalize the event based on provider
    const normalizedEvent = normalizeCallEvent(rawPayload, provider)

    if (!normalizedEvent) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Event could not be normalized' })
      }
    }

    // Determine tenant ID from webhook (this might need enhancement)
    const tenantId = await resolveTenantId(rawPayload, event.headers)

    if (!tenantId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Could not determine tenant' })
      }
    }

    // Store the event in database
    const { data: eventRecord, error: insertError } = await supabase
      .from('events_cc')
      .insert({
        tenant_id: tenantId,
        type: normalizedEvent.type,
        provider: normalizedEvent.provider,
        payload: normalizedEvent,
        occurred_at: normalizedEvent.ended_at
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error inserting CC event:', insertError)
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to store event' })
      }
    }

    // Trigger CSAT workflow if applicable
    const shouldTriggerCSAT = await shouldSendCSAT(normalizedEvent, tenantId)
    if (shouldTriggerCSAT) {
      // Call CSAT function asynchronously (don't wait for response)
      triggerCSATWorkflow(eventRecord.id, normalizedEvent, tenantId).catch(error => {
        console.error('Error triggering CSAT workflow:', error)
      })
    }

    // Check for escalation conditions
    const shouldEscalate = await shouldCreateEscalation(normalizedEvent, tenantId)
    if (shouldEscalate) {
      // Call escalation function asynchronously
      triggerEscalationWorkflow(eventRecord.id, normalizedEvent, tenantId).catch(error => {
        console.error('Error triggering escalation workflow:', error)
      })
    }

    return {
      statusCode: 200,
      headers: { ...headers, ...getRateLimitHeaders(rateLimitResult) },
      body: JSON.stringify({
        success: true,
        eventId: eventRecord.id,
        timestamp: new Date().toISOString(),
        actions: {
          csat_triggered: shouldTriggerCSAT,
          escalation_triggered: shouldEscalate
        }
      })
    }

  } catch (error) {
    console.error('CC webhook error:', error)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
}

function detectProvider(payload: any, headers: Record<string, any>): '3cx' | 'genesys' | 'generic' {
  // Check user agent or specific headers
  const userAgent = headers['user-agent'] || ''
  
  if (userAgent.includes('3CX') || payload.event_type || headers['x-3cx-signature']) {
    return '3cx'
  }
  
  if (userAgent.includes('Genesys') || payload.eventType || headers['x-genesys-signature']) {
    return 'genesys'
  }
  
  return 'generic'
}

function normalizeCallEvent(payload: any, provider: '3cx' | 'genesys' | 'generic'): NormalizedCallEvent | null {
  try {
    switch (provider) {
      case '3cx':
        const threeCX = ThreeCXWebhookSchema.parse(payload)
        return {
          type: 'call.ended',
          provider: '3cx',
          call_id: threeCX.call_id,
          started_at: threeCX.start_time,
          ended_at: threeCX.end_time,
          duration_seconds: threeCX.duration,
          agent: threeCX.agent_extension ? {
            id: threeCX.agent_extension,
            name: threeCX.agent_name,
            extension: threeCX.agent_extension
          } : undefined,
          customer: threeCX.from ? {
            phone: threeCX.from
          } : undefined,
          queue: threeCX.queue_name,
          status: mapCallResult(threeCX.call_result) || 'completed',
          meta: { original: payload }
        }

      case 'genesys':
        const genesys = GenesysWebhookSchema.parse(payload)
        const agent = genesys.participants?.find(p => p.purpose === 'agent')
        const customer = genesys.participants?.find(p => p.purpose === 'customer')
        
        return {
          type: 'call.ended',
          provider: 'genesys',
          call_id: genesys.conversationId,
          started_at: genesys.startTime,
          ended_at: genesys.endTime,
          agent: agent ? {
            id: agent.userId || agent.participantId,
            name: agent.name
          } : undefined,
          customer: customer ? {
            phone: genesys.ani,
            crm_id: customer.userId
          } : undefined,
          status: 'completed',
          meta: { 
            direction: genesys.direction,
            dnis: genesys.dnis,
            original: payload 
          }
        }

      case 'generic':
      default:
        // Try to parse as generic format
        const genericEvent = BaseCallEventSchema.parse(payload)
        return {
          type: 'call.ended',
          provider: 'generic',
          call_id: genericEvent.call_id,
          started_at: genericEvent.started_at,
          ended_at: genericEvent.ended_at,
          duration_seconds: genericEvent.duration_seconds,
          agent: genericEvent.agent,
          customer: genericEvent.customer,
          queue: genericEvent.queue,
          status: genericEvent.status,
          meta: { original: payload }
        }
    }
  } catch (error) {
    console.error('Error normalizing call event:', error)
    return null
  }
}

function mapCallResult(result?: string): 'completed' | 'abandoned' | 'transferred' | 'error' | undefined {
  if (!result) return undefined
  
  const lowerResult = result.toLowerCase()
  if (lowerResult.includes('completed') || lowerResult.includes('answered')) return 'completed'
  if (lowerResult.includes('abandoned') || lowerResult.includes('missed')) return 'abandoned'
  if (lowerResult.includes('transferred') || lowerResult.includes('transfer')) return 'transferred'
  if (lowerResult.includes('error') || lowerResult.includes('failed')) return 'error'
  
  return 'completed' // Default
}

async function resolveTenantId(payload: any, headers: Record<string, any>): Promise<string | null> {
  // For now, use a header-based approach
  // In production, you might map this based on the webhook URL or API key
  const tenantId = headers['x-tenant-id'] || headers['x-rp9-tenant']
  
  if (tenantId) {
    return Array.isArray(tenantId) ? tenantId[0] : tenantId
  }

  // Fallback: try to determine from payload or use default
  // This would need to be enhanced based on your tenant identification strategy
  return null
}

async function shouldSendCSAT(event: NormalizedCallEvent, tenantId: string): Promise<boolean> {
  // Send CSAT for completed calls that lasted more than 30 seconds
  return event.status === 'completed' && 
         (event.duration_seconds || 0) > 30 &&
         !!event.customer?.phone
}

async function shouldCreateEscalation(event: NormalizedCallEvent, tenantId: string): Promise<boolean> {
  // Create escalation for abandoned calls or very long calls
  return event.status === 'abandoned' ||
         (event.duration_seconds || 0) > 1800 // 30 minutes
}

async function triggerCSATWorkflow(eventId: string, event: NormalizedCallEvent, tenantId: string): Promise<void> {
  // Make async call to CSAT function
  try {
    const response = await fetch(`${process.env.URL}/.netlify/functions/cc-csat-send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.INTERNAL_API_KEY || 'internal'}`
      },
      body: JSON.stringify({
        eventId,
        tenantId,
        customerPhone: event.customer?.phone,
        callId: event.call_id,
        agentName: event.agent?.name
      })
    })
    
    if (!response.ok) {
      throw new Error(`CSAT trigger failed: ${response.statusText}`)
    }
  } catch (error) {
    console.error('Failed to trigger CSAT workflow:', error)
    throw error
  }
}

async function triggerEscalationWorkflow(eventId: string, event: NormalizedCallEvent, tenantId: string): Promise<void> {
  // Make async call to escalation function
  try {
    const response = await fetch(`${process.env.URL}/.netlify/functions/cc-playbook-escalate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.INTERNAL_API_KEY || 'internal'}`
      },
      body: JSON.stringify({
        eventId,
        tenantId,
        event,
        escalationReason: event.status === 'abandoned' ? 'call_abandoned' : 'long_duration'
      })
    })
    
    if (!response.ok) {
      throw new Error(`Escalation trigger failed: ${response.statusText}`)
    }
  } catch (error) {
    console.error('Failed to trigger escalation workflow:', error)
    throw error
  }
}