import type { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface WebhookRequest {
  tenant_id: string
  workflow_id: string
  execution_id: string
  status: 'success' | 'error' | 'running' | 'waiting'
  started_at: string
  stopped_at?: string
  execution_time_ms?: number
  node_failures?: string[]
  payload: any
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' })
    }
  }

  try {
    const clientIP = event.headers['x-forwarded-for']?.split(',')[0] || 
                     event.headers['x-real-ip'] || 
                     'unknown'

    // Verificar rate limiting
    const rateLimitResult = await checkRateLimit(clientIP, event.headers['x-api-key'])
    if (!rateLimitResult.allowed) {
      return {
        statusCode: 429,
        headers: { 
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': rateLimitResult.limit.toString(),
          'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
          'X-RateLimit-Reset': rateLimitResult.resetTime.toString()
        },
        body: JSON.stringify({ 
          error: 'Rate limit exceeded',
          details: `Limit: ${rateLimitResult.limit} requests per ${rateLimitResult.window}s`
        })
      }
    }

    // Verificar signature HMAC
    const signature = event.headers['x-webhook-signature'] || event.headers['x-hub-signature-256']
    if (!signature) {
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing webhook signature' })
      }
    }

    const isValidSignature = await verifyHMACSignature(event.body || '', signature)
    if (!isValidSignature) {
      // Log intento de acceso no autorizado
      await logSecurityEvent({
        type: 'invalid_webhook_signature',
        ip: clientIP,
        user_agent: event.headers['user-agent'],
        signature,
        timestamp: new Date().toISOString()
      })

      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Invalid webhook signature' })
      }
    }

    // Procesar webhook
    const webhookData: WebhookRequest = JSON.parse(event.body || '{}')
    
    // Validar estructura del webhook
    if (!webhookData.tenant_id || !webhookData.workflow_id || !webhookData.execution_id) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          error: 'Missing required fields', 
          required: ['tenant_id', 'workflow_id', 'execution_id']
        })
      }
    }

    // Guardar en usage_executions
    await saveExecutionData(webhookData)

    // Log successful webhook
    await logSecurityEvent({
      type: 'webhook_success',
      tenant_id: webhookData.tenant_id,
      workflow_id: webhookData.workflow_id,
      execution_id: webhookData.execution_id,
      ip: clientIP,
      timestamp: new Date().toISOString()
    })

    return {
      statusCode: 200,
      headers: { 
        'Content-Type': 'application/json',
        'X-RateLimit-Remaining': rateLimitResult.remaining.toString()
      },
      body: JSON.stringify({ 
        ok: true, 
        message: 'Webhook processed successfully',
        execution_id: webhookData.execution_id
      })
    }

  } catch (error) {
    console.error('Webhook processing error:', error)
    
    await logSecurityEvent({
      type: 'webhook_error',
      error: error instanceof Error ? error.message : 'Unknown error',
      ip: event.headers['x-forwarded-for']?.split(',')[0] || 'unknown',
      timestamp: new Date().toISOString()
    })

    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        ok: false,
        error: 'Internal server error' 
      })
    }
  }
}

async function verifyHMACSignature(payload: string, signature: string): Promise<boolean> {
  const secret = process.env.WEBHOOK_SECRET
  if (!secret) {
    console.error('WEBHOOK_SECRET environment variable not set')
    return false
  }

  try {
    // Soportar tanto formato GitHub (sha256=) como formato personalizado
    const providedHash = signature.startsWith('sha256=') 
      ? signature.slice(7) 
      : signature

    const expectedHash = crypto
      .createHmac('sha256', secret)
      .update(payload, 'utf8')
      .digest('hex')

    // Comparación segura contra timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(providedHash, 'hex'),
      Buffer.from(expectedHash, 'hex')
    )
  } catch (error) {
    console.error('HMAC verification error:', error)
    return false
  }
}

interface RateLimitResult {
  allowed: boolean
  limit: number
  remaining: number
  resetTime: number
  window: number
}

async function checkRateLimit(ip: string, apiKey?: string): Promise<RateLimitResult> {
  const window = 3600 // 1 hora en segundos
  const limit = apiKey ? 1000 : 100 // 1000 req/h con API key, 100 sin key
  const key = apiKey || ip
  const now = Math.floor(Date.now() / 1000)
  const windowStart = Math.floor(now / window) * window

  try {
    // Verificar rate limit en Supabase (usar Redis en producción)
    const { data: rateLimitData, error } = await supabase
      .from('rate_limits')
      .select('requests, window_start')
      .eq('key', key)
      .eq('window_start', windowStart)
      .single()

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
      console.error('Rate limit check error:', error)
      // En caso de error, permitir la request pero con límite bajo
      return { allowed: true, limit: 10, remaining: 9, resetTime: windowStart + window, window }
    }

    const currentRequests = rateLimitData?.requests || 0

    if (currentRequests >= limit) {
      return {
        allowed: false,
        limit,
        remaining: 0,
        resetTime: windowStart + window,
        window
      }
    }

    // Incrementar contador
    await supabase
      .from('rate_limits')
      .upsert({
        key,
        requests: currentRequests + 1,
        window_start: windowStart,
        updated_at: new Date().toISOString()
      })

    return {
      allowed: true,
      limit,
      remaining: limit - currentRequests - 1,
      resetTime: windowStart + window,
      window
    }

  } catch (error) {
    console.error('Rate limiting error:', error)
    // En caso de error, permitir pero con límite muy bajo
    return { allowed: true, limit: 5, remaining: 4, resetTime: windowStart + window, window }
  }
}

async function saveExecutionData(data: WebhookRequest) {
  const executionTime = data.stopped_at && data.started_at
    ? new Date(data.stopped_at).getTime() - new Date(data.started_at).getTime()
    : data.execution_time_ms || 0

  await supabase
    .from('usage_executions')
    .upsert({
      tenant_id: data.tenant_id,
      workflow_id: data.workflow_id,
      execution_id: data.execution_id,
      status: data.status,
      execution_time_ms: executionTime,
      node_failures: data.node_failures || [],
      started_at: data.started_at,
      stopped_at: data.stopped_at,
      payload: data.payload,
      created_at: new Date().toISOString()
    }, {
      onConflict: 'execution_id'
    })
}

async function logSecurityEvent(event: any) {
  try {
    await supabase
      .from('security_logs')
      .insert({
        event_type: event.type,
        tenant_id: event.tenant_id,
        ip_address: event.ip,
        user_agent: event.user_agent,
        details: {
          workflow_id: event.workflow_id,
          execution_id: event.execution_id,
          error: event.error,
          signature: event.signature
        },
        created_at: event.timestamp
      })
  } catch (error) {
    console.error('Failed to log security event:', error)
  }
}