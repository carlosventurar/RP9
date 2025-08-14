import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

// Types
interface LegalAcceptanceRequest {
  document_type: 'tos' | 'privacy' | 'dpa' | 'msa'
  version: string
  tenant_id: string
  user_id: string
  language: 'es' | 'en'
}

// Validation schema
const acceptanceSchema = z.object({
  document_type: z.enum(['tos', 'privacy', 'dpa', 'msa']),
  version: z.string().min(1),
  tenant_id: z.string().uuid(),
  user_id: z.string().uuid(),
  language: z.enum(['es', 'en']).default('es')
})

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Rate limiting store (in production, use Redis or similar)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

// Rate limiting function
function checkRateLimit(clientId: string, maxRequests = 10, windowMs = 60000): boolean {
  const now = Date.now()
  const clientData = rateLimitStore.get(clientId)
  
  if (!clientData || now > clientData.resetTime) {
    rateLimitStore.set(clientId, { count: 1, resetTime: now + windowMs })
    return true
  }
  
  if (clientData.count >= maxRequests) {
    return false
  }
  
  clientData.count++
  return true
}

// Get client IP from event
function getClientIP(event: HandlerEvent): string {
  return event.headers['x-forwarded-for']?.split(',')[0] || 
         event.headers['x-real-ip'] || 
         '127.0.0.1'
}

// HMAC verification (optional security layer)
async function verifyHMAC(body: string, signature: string): Promise<boolean> {
  if (!process.env.HMAC_SECRET || !signature) {
    return true // Skip if not configured
  }
  
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(process.env.HMAC_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  )
  
  const expectedSignature = signature.replace('sha256=', '')
  const actualSignature = await crypto.subtle.sign('HMAC', key, encoder.encode(body))
  const actualHex = Array.from(new Uint8Array(actualSignature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
  
  return expectedSignature === actualHex
}

// Main handler
export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': process.env.NODE_ENV === 'production' 
      ? 'https://rp9portal.com' 
      : '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-hmac-signature',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  }

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    }
  }

  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ 
        error: 'Method not allowed',
        message: 'Only POST requests are accepted' 
      })
    }
  }

  try {
    // Rate limiting
    const clientIP = getClientIP(event)
    if (!checkRateLimit(clientIP)) {
      return {
        statusCode: 429,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'Rate limit exceeded',
          message: 'Too many requests. Please try again later.'
        })
      }
    }

    // Parse and validate request body
    if (!event.body) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'Missing request body',
          message: 'Request body is required'
        })
      }
    }

    // HMAC verification (optional)
    const hmacSignature = event.headers['x-hmac-signature']
    if (hmacSignature && !await verifyHMAC(event.body, hmacSignature)) {
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'Invalid signature',
          message: 'HMAC signature verification failed'
        })
      }
    }

    let requestData: LegalAcceptanceRequest
    try {
      requestData = JSON.parse(event.body)
    } catch (error) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'Invalid JSON',
          message: 'Request body must be valid JSON'
        })
      }
    }

    // Validate request data
    const validation = acceptanceSchema.safeParse(requestData)
    if (!validation.success) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'Validation failed',
          message: 'Invalid request data',
          details: validation.error.issues
        })
      }
    }

    const { document_type, version, tenant_id, user_id, language } = validation.data

    // Check if document exists and is active
    const { data: document, error: docError } = await supabase
      .from('legal_documents')
      .select('id, version, effective_date')
      .eq('document_type', document_type)
      .eq('version', version)
      .eq('language', language)
      .eq('status', 'active')
      .single()

    if (docError || !document) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'Document not found',
          message: `Legal document ${document_type} v${version} in ${language} not found or not active`
        })
      }
    }

    // Check if user has already accepted this version
    const { data: existingAcceptance } = await supabase
      .from('legal_acceptances')
      .select('id, accepted_at')
      .eq('user_id', user_id)
      .eq('tenant_id', tenant_id)
      .eq('document_type', document_type)
      .eq('document_version', version)
      .eq('language', language)
      .single()

    if (existingAcceptance) {
      return {
        statusCode: 409,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'Already accepted',
          message: 'User has already accepted this document version',
          data: {
            acceptance_id: existingAcceptance.id,
            accepted_at: existingAcceptance.accepted_at
          }
        })
      }
    }

    // Record the acceptance
    const { data: acceptance, error: acceptError } = await supabase
      .from('legal_acceptances')
      .insert({
        user_id,
        tenant_id,
        document_type,
        document_version: version,
        language,
        ip_address: clientIP,
        user_agent: event.headers['user-agent'] || 'Unknown',
        accepted_at: new Date().toISOString(),
        metadata: {
          document_id: document.id,
          effective_date: document.effective_date,
          client_timestamp: new Date().toISOString()
        }
      })
      .select()
      .single()

    if (acceptError) {
      console.error('Database error:', acceptError)
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'Database error',
          message: 'Failed to record legal acceptance'
        })
      }
    }

    // Log the acceptance for audit trail
    console.log(`Legal acceptance recorded: ${user_id} accepted ${document_type} v${version} (${language}) from ${clientIP}`)

    // Success response
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        message: 'Legal document acceptance recorded successfully',
        data: {
          acceptance_id: acceptance.id,
          document_type,
          version,
          language,
          accepted_at: acceptance.accepted_at,
          ip_address: acceptance.ip_address
        }
      })
    }

  } catch (error) {
    console.error('Unexpected error in legal-accept:', error)
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: 'Internal server error',
        message: 'An unexpected error occurred',
        ...(process.env.NODE_ENV === 'development' && { 
          details: error instanceof Error ? error.message : String(error) 
        })
      })
    }
  }
}

// Export for testing
export { acceptanceSchema, checkRateLimit, getClientIP }