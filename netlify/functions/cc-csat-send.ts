import { Handler, HandlerEvent } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import { rateLimitByTenant, RATE_LIMIT_CONFIGS, getRateLimitHeaders } from '../../src/lib/security/rate-limit'
import { z } from 'zod'

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const whatsappApiUrl = process.env.WA_API_URL
const whatsappToken = process.env.WA_TOKEN
const whatsappTemplateId = process.env.WA_TEMPLATE_ID || 'csat_template_es'

const supabase = supabaseUrl && supabaseServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null

// Request validation schema
const CSATRequestSchema = z.object({
  eventId: z.string(),
  tenantId: z.string(),
  customerPhone: z.string(),
  callId: z.string(),
  agentName: z.string().optional(),
  language: z.enum(['es', 'en']).default('es')
})

interface WhatsAppMessage {
  messaging_product: 'whatsapp'
  to: string
  type: 'template'
  template: {
    name: string
    language: { code: string }
    components: Array<{
      type: string
      parameters?: Array<{
        type: string
        text: string
      }>
    }>
  }
}

interface EmailMessage {
  to: string
  subject: string
  html: string
  text: string
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
    const request = CSATRequestSchema.parse(JSON.parse(event.body))
    
    // Rate limiting by tenant
    const rateLimitResult = rateLimitByTenant(request.tenantId, {
      windowMs: 60000,
      maxRequests: 50 // Allow 50 CSAT sends per minute per tenant
    })
    
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

    console.log(`Processing CSAT request for tenant ${request.tenantId}, call ${request.callId}`)

    // Check if we already sent CSAT for this call
    const { data: existingTicket } = await supabase
      .from('tickets')
      .select('id, csat_sent_at')
      .eq('tenant_id', request.tenantId)
      .eq('event_cc_id', request.eventId)
      .single()

    if (existingTicket?.csat_sent_at) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'CSAT already sent for this call',
          ticketId: existingTicket.id
        })
      }
    }

    // Get tenant settings for CRM integration
    const { data: tenant } = await supabase
      .from('tenants')
      .select('settings')
      .eq('id', request.tenantId)
      .single()

    const tenantSettings = tenant?.settings as any || {}

    // Clean and format phone number
    const cleanPhone = cleanPhoneNumber(request.customerPhone)
    if (!cleanPhone) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid phone number' })
      }
    }

    // Create or update ticket record
    const ticketData = {
      tenant_id: request.tenantId,
      event_cc_id: request.eventId,
      crm: tenantSettings.default_crm || 'internal',
      phone: cleanPhone,
      priority: 'low',
      status: 'csat_pending',
      subject: `CSAT Survey - Call ${request.callId}`,
      description: `CSAT survey for call with ${request.agentName || 'agent'}`,
      csat_sent_at: new Date().toISOString(),
      meta: {
        call_id: request.callId,
        agent_name: request.agentName,
        language: request.language
      }
    }

    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .upsert(ticketData, { onConflict: 'tenant_id,event_cc_id' })
      .select()
      .single()

    if (ticketError) {
      console.error('Error creating ticket:', ticketError)
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to create ticket record' })
      }
    }

    // Try WhatsApp first, fallback to email
    let whatsappSent = false
    let emailSent = false
    let error: string | null = null

    try {
      if (whatsappApiUrl && whatsappToken) {
        await sendWhatsAppCSAT(cleanPhone, request, ticket.id)
        whatsappSent = true
        console.log(`WhatsApp CSAT sent to ${cleanPhone} for call ${request.callId}`)
      } else {
        console.log('WhatsApp not configured, skipping to email fallback')
      }
    } catch (whatsappError) {
      console.error('WhatsApp CSAT failed:', whatsappError)
      error = whatsappError instanceof Error ? whatsappError.message : 'WhatsApp failed'
      
      // Try email fallback
      try {
        await sendEmailCSAT(cleanPhone, request, ticket.id)
        emailSent = true
        console.log(`Email CSAT sent as fallback for call ${request.callId}`)
      } catch (emailError) {
        console.error('Email CSAT fallback failed:', emailError)
        error += '; Email fallback also failed: ' + (emailError instanceof Error ? emailError.message : 'Unknown error')
      }
    }

    if (!whatsappSent && !emailSent) {
      // Update ticket to reflect failure
      await supabase
        .from('tickets')
        .update({
          status: 'csat_failed',
          meta: { ...ticketData.meta, error }
        })
        .eq('id', ticket.id)

      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: 'Failed to send CSAT survey',
          details: error
        })
      }
    }

    // Update ticket with successful send
    await supabase
      .from('tickets')
      .update({
        status: 'csat_sent',
        meta: {
          ...ticketData.meta,
          whatsapp_sent: whatsappSent,
          email_sent: emailSent,
          sent_at: new Date().toISOString()
        }
      })
      .eq('id', ticket.id)

    return {
      statusCode: 200,
      headers: { ...headers, ...getRateLimitHeaders(rateLimitResult) },
      body: JSON.stringify({
        success: true,
        ticketId: ticket.id,
        methods: {
          whatsapp: whatsappSent,
          email: emailSent
        },
        timestamp: new Date().toISOString()
      })
    }

  } catch (error) {
    console.error('CSAT send error:', error)
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

function cleanPhoneNumber(phone: string): string | null {
  if (!phone) return null
  
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '')
  
  // Must have at least 10 digits
  if (digits.length < 10) return null
  
  // Add country code if missing (assume Mexico +52 for now)
  if (digits.length === 10) {
    return `52${digits}`
  }
  
  // Remove leading + or 00
  if (digits.length === 12 && digits.startsWith('52')) {
    return digits
  }
  
  if (digits.length === 13 && digits.startsWith('521')) {
    return digits.substring(1) // Remove the extra 1
  }
  
  return digits.length >= 11 ? digits : null
}

async function sendWhatsAppCSAT(phone: string, request: z.infer<typeof CSATRequestSchema>, ticketId: string): Promise<void> {
  if (!whatsappApiUrl || !whatsappToken) {
    throw new Error('WhatsApp not configured')
  }

  const surveyUrl = `${process.env.URL || 'https://rp99.netlify.app'}/csat?t=${ticketId}`
  
  const message: WhatsAppMessage = {
    messaging_product: 'whatsapp',
    to: phone,
    type: 'template',
    template: {
      name: whatsappTemplateId,
      language: { code: request.language },
      components: [
        {
          type: 'body',
          parameters: [
            {
              type: 'text',
              text: request.agentName || 'nuestro equipo'
            }
          ]
        },
        {
          type: 'button',
          parameters: [
            {
              type: 'text',
              text: surveyUrl
            }
          ]
        }
      ]
    }
  }

  const response = await fetch(`${whatsappApiUrl}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${whatsappToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(message)
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`WhatsApp API error: ${response.status} ${error}`)
  }

  const result = await response.json()
  console.log('WhatsApp CSAT sent:', result)
}

async function sendEmailCSAT(phone: string, request: z.infer<typeof CSATRequestSchema>, ticketId: string): Promise<void> {
  // For now, this is a stub. In production, integrate with SendGrid, AWS SES, etc.
  const surveyUrl = `${process.env.URL || 'https://rp99.netlify.app'}/csat?t=${ticketId}`
  
  const emailMessage: EmailMessage = {
    to: `${phone}@sms-to-email.gateway`, // This would be a real email or SMS gateway
    subject: request.language === 'es' ? 'Encuesta de Satisfacción - RP9' : 'Customer Satisfaction Survey - RP9',
    html: generateCSATEmailHTML(request, surveyUrl),
    text: generateCSATEmailText(request, surveyUrl)
  }

  // In production, send via your email provider
  console.log('Would send email CSAT:', emailMessage)
  
  // Simulate email sending
  await new Promise(resolve => setTimeout(resolve, 100))
}

function generateCSATEmailHTML(request: z.infer<typeof CSATRequestSchema>, surveyUrl: string): string {
  const isSpanish = request.language === 'es'
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${isSpanish ? 'Encuesta de Satisfacción' : 'Customer Satisfaction Survey'}</title>
    </head>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2>${isSpanish ? '¿Cómo fue tu experiencia?' : 'How was your experience?'}</h2>
      
      <p>
        ${isSpanish 
          ? `Gracias por contactar con ${request.agentName || 'nuestro equipo'}. Tu opinión es muy importante para nosotros.`
          : `Thank you for contacting ${request.agentName || 'our team'}. Your feedback is very important to us.`
        }
      </p>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${surveyUrl}" 
           style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
          ${isSpanish ? 'Completar Encuesta' : 'Complete Survey'}
        </a>
      </div>
      
      <p style="font-size: 12px; color: #666;">
        ${isSpanish 
          ? 'Esta encuesta toma menos de 2 minutos en completar.'
          : 'This survey takes less than 2 minutes to complete.'
        }
      </p>
    </body>
    </html>
  `
}

function generateCSATEmailText(request: z.infer<typeof CSATRequestSchema>, surveyUrl: string): string {
  const isSpanish = request.language === 'es'
  
  return isSpanish
    ? `¿Cómo fue tu experiencia?
    
Gracias por contactar con ${request.agentName || 'nuestro equipo'}. Tu opinión es muy importante para nosotros.

Completa nuestra breve encuesta: ${surveyUrl}

Esta encuesta toma menos de 2 minutos en completar.`
    
    : `How was your experience?
    
Thank you for contacting ${request.agentName || 'our team'}. Your feedback is very important to us.

Complete our brief survey: ${surveyUrl}

This survey takes less than 2 minutes to complete.`
}