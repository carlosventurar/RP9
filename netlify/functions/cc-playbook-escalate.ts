import { Handler, HandlerEvent } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import { rateLimitByTenant, RATE_LIMIT_CONFIGS, getRateLimitHeaders } from '../../src/lib/security/rate-limit'
import { z } from 'zod'

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = supabaseUrl && supabaseServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null

// Request validation schema
const EscalationRequestSchema = z.object({
  eventId: z.string(),
  tenantId: z.string(),
  event: z.object({
    type: z.string(),
    provider: z.string(),
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
    status: z.enum(['completed', 'abandoned', 'transferred', 'error']),
    meta: z.record(z.any()).optional()
  }),
  escalationReason: z.enum(['call_abandoned', 'long_duration', 'keyword_detected', 'sla_breach']),
  keywords: z.array(z.string()).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('high')
})

interface EscalationRule {
  id: string
  tenant_id: string
  name: string
  trigger_type: 'keywords' | 'duration' | 'status' | 'sla'
  trigger_conditions: {
    keywords?: string[]
    duration_threshold_seconds?: number
    statuses?: string[]
    sla_threshold_minutes?: number
  }
  action: {
    create_ticket: boolean
    crm_provider: string
    priority: string
    assign_to?: string
    template?: string
  }
  active: boolean
  created_at: string
}

export const handler: Handler = async (event: HandlerEvent) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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

    // Validate request
    const request = EscalationRequestSchema.parse(JSON.parse(event.body))
    
    // Rate limiting by tenant
    const rateLimitResult = rateLimitByTenant(request.tenantId, RATE_LIMIT_CONFIGS.NORMAL)
    
    if (!rateLimitResult.allowed) {
      return {
        statusCode: 429,
        headers: { ...headers, ...getRateLimitHeaders(rateLimitResult) },
        body: JSON.stringify({ 
          error: 'Rate limit exceeded',
          remaining: rateLimitResult.remaining 
        })
      }
    }

    console.log(`Processing escalation for tenant ${request.tenantId}, call ${request.event.call_id}, reason: ${request.escalationReason}`)

    // Get escalation rules for tenant
    const { data: rules, error: rulesError } = await supabase
      .from('escalation_rules')
      .select('*')
      .eq('tenant_id', request.tenantId)
      .eq('active', true)

    if (rulesError) {
      console.error('Error fetching escalation rules:', rulesError)
      // Continue with default escalation if rules fetch fails
    }

    // Determine applicable rules
    const applicableRules = findApplicableRules(rules || [], request)
    
    // If no specific rules, create default escalation
    if (applicableRules.length === 0) {
      applicableRules.push(createDefaultEscalationRule(request))
    }

    const results = []

    // Execute each applicable rule
    for (const rule of applicableRules) {
      try {
        const result = await executeEscalationRule(rule, request)
        results.push(result)
        
        // Log successful escalation
        await logEscalation(request.tenantId, request.eventId, rule, result, 'success')
        
      } catch (error) {
        console.error(`Error executing escalation rule ${rule.id}:`, error)
        
        // Log failed escalation
        await logEscalation(
          request.tenantId, 
          request.eventId, 
          rule, 
          null, 
          'error',
          error instanceof Error ? error.message : 'Unknown error'
        )
        
        results.push({
          rule_id: rule.id,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    return {
      statusCode: 200,
      headers: { ...headers, ...getRateLimitHeaders(rateLimitResult) },
      body: JSON.stringify({
        success: true,
        eventId: request.eventId,
        escalationReason: request.escalationReason,
        rulesExecuted: results.length,
        results,
        timestamp: new Date().toISOString()
      })
    }

  } catch (error) {
    console.error('Escalation error:', error)
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

function findApplicableRules(rules: EscalationRule[], request: z.infer<typeof EscalationRequestSchema>): EscalationRule[] {
  return rules.filter(rule => {
    const conditions = rule.trigger_conditions
    const { event, escalationReason, keywords = [] } = request

    switch (rule.trigger_type) {
      case 'keywords':
        return keywords.some(keyword => 
          conditions.keywords?.some(ruleKeyword => 
            keyword.toLowerCase().includes(ruleKeyword.toLowerCase())
          )
        )

      case 'duration':
        return escalationReason === 'long_duration' && 
               event.duration_seconds && 
               conditions.duration_threshold_seconds &&
               event.duration_seconds >= conditions.duration_threshold_seconds

      case 'status':
        return conditions.statuses?.includes(event.status)

      case 'sla':
        return escalationReason === 'sla_breach'

      default:
        return false
    }
  })
}

function createDefaultEscalationRule(request: z.infer<typeof EscalationRequestSchema>): EscalationRule {
  return {
    id: 'default',
    tenant_id: request.tenantId,
    name: 'Default Escalation',
    trigger_type: 'status',
    trigger_conditions: {},
    action: {
      create_ticket: true,
      crm_provider: 'internal',
      priority: request.priority,
      template: 'default_escalation'
    },
    active: true,
    created_at: new Date().toISOString()
  }
}

async function executeEscalationRule(rule: EscalationRule, request: z.infer<typeof EscalationRequestSchema>) {
  const { action } = rule
  const { event, escalationReason } = request

  if (!action.create_ticket) {
    return { rule_id: rule.id, success: true, action: 'no_ticket_creation' }
  }

  // Create ticket based on CRM provider
  const ticketData = {
    tenant_id: request.tenantId,
    event_cc_id: request.eventId,
    crm: action.crm_provider,
    contact_id: event.customer?.crm_id || null,
    ticket_id: null, // Will be set after creation
    priority: action.priority,
    status: 'escalated',
    subject: generateTicketSubject(event, escalationReason),
    description: generateTicketDescription(event, escalationReason, rule),
    meta: {
      escalation_reason: escalationReason,
      rule_id: rule.id,
      rule_name: rule.name,
      call_id: event.call_id,
      agent: event.agent,
      customer: event.customer,
      original_event: event
    }
  }

  // Store escalation ticket in database
  const { data: ticket, error: ticketError } = await supabase!
    .from('tickets')
    .insert(ticketData)
    .select()
    .single()

  if (ticketError) {
    throw new Error(`Failed to create escalation ticket: ${ticketError.message}`)
  }

  // If using external CRM, create ticket there too
  let externalTicketId = null
  if (action.crm_provider !== 'internal') {
    try {
      externalTicketId = await createExternalTicket(action.crm_provider, ticketData, rule)
      
      // Update ticket with external ID
      await supabase!
        .from('tickets')
        .update({ ticket_id: externalTicketId })
        .eq('id', ticket.id)
        
    } catch (error) {
      console.error(`Failed to create external ticket in ${action.crm_provider}:`, error)
      // Don't fail the entire escalation if external creation fails
    }
  }

  return {
    rule_id: rule.id,
    success: true,
    ticket_id: ticket.id,
    external_ticket_id: externalTicketId,
    crm_provider: action.crm_provider,
    priority: action.priority
  }
}

async function createExternalTicket(provider: string, ticketData: any, rule: EscalationRule): Promise<string | null> {
  // Import CRM client dynamically to avoid circular dependencies
  const { createCRMClient } = await import('../../src/lib/crm')
  
  try {
    const client = createCRMClient(provider as any)
    
    const result = await client.createTicket({
      subject: ticketData.subject,
      description: ticketData.description,
      priority: ticketData.priority,
      customerEmail: ticketData.meta?.customer?.email,
      customerPhone: ticketData.meta?.customer?.phone,
      customerName: ticketData.meta?.customer?.name,
      tags: ['escalation', 'contact-center', rule.name.toLowerCase().replace(/\s+/g, '-')],
      customFields: {
        escalation_reason: ticketData.meta?.escalation_reason,
        call_id: ticketData.meta?.call_id,
        agent_name: ticketData.meta?.agent?.name,
        rule_id: rule.id
      }
    })
    
    console.log(`Created ticket in ${provider}:`, {
      ticketId: result.ticketId,
      contactId: result.contactId,
      externalUrl: result.externalUrl
    })
    
    return String(result.ticketId)
    
  } catch (error) {
    console.error(`Failed to create ticket in ${provider}:`, error)
    throw error
  }
}

function generateTicketSubject(event: any, escalationReason: string): string {
  const reasonMap = {
    call_abandoned: 'Abandoned Call',
    long_duration: 'Long Duration Call', 
    keyword_detected: 'Keywords Detected',
    sla_breach: 'SLA Breach'
  }
  
  const reasonText = reasonMap[escalationReason as keyof typeof reasonMap] || 'Escalation'
  return `${reasonText} - Call ${event.call_id} - ${event.agent?.name || 'Agent'}`
}

function generateTicketDescription(event: any, escalationReason: string, rule: EscalationRule): string {
  const startTime = new Date(event.started_at).toLocaleString()
  const endTime = new Date(event.ended_at).toLocaleString()
  const duration = event.duration_seconds ? `${Math.floor(event.duration_seconds / 60)}m ${event.duration_seconds % 60}s` : 'Unknown'

  return `
**Escalation Details:**
- Reason: ${escalationReason}
- Rule: ${rule.name}
- Call ID: ${event.call_id}
- Provider: ${event.provider}

**Call Information:**
- Agent: ${event.agent?.name || 'Unknown'} (${event.agent?.extension || 'N/A'})
- Customer: ${event.customer?.phone || 'Unknown'}
- Queue: ${event.queue || 'N/A'}
- Status: ${event.status}
- Started: ${startTime}
- Ended: ${endTime}
- Duration: ${duration}

**Action Required:**
Please review this escalated call and take appropriate action according to your escalation procedures.
`.trim()
}

async function logEscalation(
  tenantId: string,
  eventId: string,
  rule: EscalationRule,
  result: any,
  status: 'success' | 'error',
  error?: string
) {
  try {
    await supabase!
      .from('escalation_logs')
      .insert({
        tenant_id: tenantId,
        event_cc_id: eventId,
        rule_id: rule.id,
        rule_name: rule.name,
        status,
        result: result || {},
        error_message: error || null,
        created_at: new Date().toISOString()
      })
  } catch (logError) {
    console.error('Failed to log escalation:', logError)
    // Don't throw - logging failures shouldn't break escalation
  }
}