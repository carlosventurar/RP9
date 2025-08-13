import { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

// Configuración Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Email provider (configurar según proveedor)
const EMAIL_PROVIDER_API_KEY = process.env.EMAIL_PROVIDER_API_KEY
const WHATSAPP_PROVIDER_TOKEN = process.env.WHATSAPP_PROVIDER_TOKEN
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL

// Schemas de validación
const sendSurveySchema = z.object({
  action: z.literal('send'),
  tenantId: z.string().uuid(),
  type: z.enum(['nps', 'csat']),
  channel: z.enum(['email', 'whatsapp', 'slack']),
  triggerEvent: z.string().optional(),
  customMessage: z.string().optional()
})

const submitResponseSchema = z.object({
  action: z.literal('submit'),
  surveyId: z.string().uuid(),
  tenantId: z.string().uuid(),
  score: z.number().min(0).max(10),
  feedback: z.string().max(1000).optional(),
  contactInfo: z.string().email().optional()
})

const analyticsSchema = z.object({
  action: z.literal('analytics'),
  tenantId: z.string().uuid().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  type: z.enum(['nps', 'csat']).optional()
})

// Types
interface SurveyRequest {
  tenantId: string
  type: 'nps' | 'csat'
  channel: 'email' | 'whatsapp' | 'slack'
  triggerEvent?: string
  customMessage?: string
}

interface SurveyResponse {
  surveyId: string
  tenantId: string
  score: number
  feedback?: string
  contactInfo?: string
}

interface AnalyticsRequest {
  tenantId?: string
  dateFrom?: string
  dateTo?: string
  type?: 'nps' | 'csat'
}

// Funciones auxiliares
async function getTenantInfo(tenantId: string) {
  const { data: tenant, error } = await supabase
    .from('tenants')
    .select('name, email, plan, language, timezone')
    .eq('id', tenantId)
    .single()

  if (error) throw new Error(`Tenant not found: ${error.message}`)
  return tenant
}

async function createSurvey(request: SurveyRequest) {
  const tenant = await getTenantInfo(request.tenantId)
  
  // Crear survey en DB
  const { data: survey, error } = await supabase
    .from('surveys')
    .insert({
      tenant_id: request.tenantId,
      type: request.type,
      channel: request.channel,
      trigger_event: request.triggerEvent || 'manual',
      status: 'sent',
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 días
      metadata: {
        tenant_name: tenant.name,
        trigger_event: request.triggerEvent,
        custom_message: request.customMessage
      }
    })
    .select()
    .single()

  if (error) throw new Error(`Failed to create survey: ${error.message}`)

  // Enviar survey según canal
  switch (request.channel) {
    case 'email':
      await sendEmailSurvey(survey, tenant, request)
      break
    case 'whatsapp':
      await sendWhatsAppSurvey(survey, tenant, request)
      break
    case 'slack':
      await sendSlackSurvey(survey, tenant, request)
      break
  }

  return survey
}

async function sendEmailSurvey(survey: any, tenant: any, request: SurveyRequest) {
  // Stub - implementar con el proveedor de email elegido
  const surveyUrl = `${process.env.FRONTEND_URL}/survey/${survey.id}`
  
  const emailContent = generateEmailContent(survey, tenant, surveyUrl, request)
  
  // TODO: Integrar con proveedor de email (SendGrid, Mailgun, etc.)
  console.log('Enviando email NPS/CSAT:', {
    to: tenant.email,
    subject: emailContent.subject,
    url: surveyUrl
  })

  // Log del envío
  await supabase
    .from('survey_events')
    .insert({
      survey_id: survey.id,
      event_type: 'email_sent',
      event_data: { email: tenant.email, provider: 'email_provider' }
    })
}

async function sendWhatsAppSurvey(survey: any, tenant: any, request: SurveyRequest) {
  // Stub - implementar con WhatsApp Business API
  const surveyUrl = `${process.env.FRONTEND_URL}/survey/${survey.id}`
  
  const message = generateWhatsAppMessage(survey, tenant, surveyUrl, request)
  
  // TODO: Integrar con WhatsApp Business API
  console.log('Enviando WhatsApp NPS/CSAT:', {
    to: tenant.phone || tenant.email,
    message: message.text,
    url: surveyUrl
  })

  await supabase
    .from('survey_events')
    .insert({
      survey_id: survey.id,
      event_type: 'whatsapp_sent',
      event_data: { phone: tenant.phone, provider: 'whatsapp_provider' }
    })
}

async function sendSlackSurvey(survey: any, tenant: any, request: SurveyRequest) {
  if (!SLACK_WEBHOOK_URL) {
    console.warn('Slack webhook URL not configured')
    return
  }

  const surveyUrl = `${process.env.FRONTEND_URL}/survey/${survey.id}`
  
  const slackMessage = {
    text: `Nueva encuesta ${survey.type.toUpperCase()} para ${tenant.name}`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Encuesta ${survey.type.toUpperCase()}* para el cliente *${tenant.name}*`
        }
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: request.customMessage || getDefaultMessage(survey.type, tenant.language)
        }
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "Completar Encuesta"
            },
            url: surveyUrl,
            style: "primary"
          }
        ]
      }
    ]
  }

  try {
    const response = await fetch(SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(slackMessage)
    })

    if (!response.ok) {
      throw new Error(`Slack API error: ${response.statusText}`)
    }

    await supabase
      .from('survey_events')
      .insert({
        survey_id: survey.id,
        event_type: 'slack_sent',
        event_data: { webhook_url: SLACK_WEBHOOK_URL.substring(0, 50) + '...' }
      })
  } catch (error) {
    console.error('Error sending Slack survey:', error)
    throw error
  }
}

async function submitSurveyResponse(response: SurveyResponse) {
  // Validar que el survey existe y no ha expirado
  const { data: survey, error: surveyError } = await supabase
    .from('surveys')
    .select('*, tenants(name)')
    .eq('id', response.surveyId)
    .eq('tenant_id', response.tenantId)
    .single()

  if (surveyError || !survey) {
    throw new Error('Survey not found or invalid')
  }

  if (new Date(survey.expires_at) < new Date()) {
    throw new Error('Survey has expired')
  }

  if (survey.status === 'completed') {
    throw new Error('Survey already completed')
  }

  // Guardar respuesta
  const { data: surveyResponse, error } = await supabase
    .from('survey_responses')
    .insert({
      survey_id: response.surveyId,
      tenant_id: response.tenantId,
      score: response.score,
      feedback: response.feedback,
      contact_info: response.contactInfo,
      submitted_at: new Date().toISOString()
    })
    .select()
    .single()

  if (error) throw new Error(`Failed to save response: ${error.message}`)

  // Actualizar survey como completado
  await supabase
    .from('surveys')
    .update({ 
      status: 'completed',
      completed_at: new Date().toISOString()
    })
    .eq('id', response.surveyId)

  // Calcular NPS/CSAT score
  const category = calculateScoreCategory(survey.type, response.score)
  
  // Actualizar health score si es necesario
  if (survey.type === 'nps' && response.score <= 6) {
    await alertLowNPS(survey, response)
  }

  // Log evento
  await supabase
    .from('survey_events')
    .insert({
      survey_id: response.surveyId,
      event_type: 'response_submitted',
      event_data: { 
        score: response.score, 
        category,
        has_feedback: !!response.feedback 
      }
    })

  return {
    ...surveyResponse,
    category,
    survey: survey
  }
}

async function getAnalytics(request: AnalyticsRequest) {
  let query = supabase
    .from('survey_responses')
    .select(`
      *,
      surveys!inner(type, tenant_id, created_at),
      tenants!inner(name, plan)
    `)

  // Filtros
  if (request.tenantId) {
    query = query.eq('tenant_id', request.tenantId)
  }

  if (request.type) {
    query = query.eq('surveys.type', request.type)
  }

  if (request.dateFrom) {
    query = query.gte('surveys.created_at', request.dateFrom)
  }

  if (request.dateTo) {
    query = query.lte('surveys.created_at', request.dateTo)
  }

  const { data: responses, error } = await query.order('submitted_at', { ascending: false })

  if (error) throw new Error(`Failed to fetch analytics: ${error.message}`)

  // Calcular métricas
  const analytics = calculateAnalytics(responses)
  
  return analytics
}

// Funciones auxiliares de contenido
function generateEmailContent(survey: any, tenant: any, surveyUrl: string, request: SurveyRequest) {
  const isSpanish = tenant.language === 'es'
  
  if (survey.type === 'nps') {
    return {
      subject: isSpanish ? 
        `¿Recomendarías RP9 a un colega? - ${tenant.name}` :
        `Would you recommend RP9 to a colleague? - ${tenant.name}`,
      html: generateNPSEmailHTML(tenant, surveyUrl, request.customMessage, isSpanish)
    }
  } else {
    return {
      subject: isSpanish ?
        `¿Cómo calificas tu experiencia con RP9? - ${tenant.name}` :
        `How would you rate your RP9 experience? - ${tenant.name}`,
      html: generateCSATEmailHTML(tenant, surveyUrl, request.customMessage, isSpanish)
    }
  }
}

function generateWhatsAppMessage(survey: any, tenant: any, surveyUrl: string, request: SurveyRequest) {
  const isSpanish = tenant.language === 'es'
  
  if (survey.type === 'nps') {
    return {
      text: isSpanish ?
        `Hola ${tenant.name}! 👋\n\n¿Qué tan probable es que recomiendes RP9 a un colega? Tu opinión es muy valiosa para nosotros.\n\nCompleta nuestra breve encuesta: ${surveyUrl}` :
        `Hi ${tenant.name}! 👋\n\nHow likely are you to recommend RP9 to a colleague? Your feedback is valuable to us.\n\nComplete our brief survey: ${surveyUrl}`
    }
  } else {
    return {
      text: isSpanish ?
        `Hola ${tenant.name}! 👋\n\n¿Cómo calificas tu experiencia reciente con RP9? Nos ayuda mucho conocer tu opinión.\n\nEncuesta rápida: ${surveyUrl}` :
        `Hi ${tenant.name}! 👋\n\nHow would you rate your recent RP9 experience? Your feedback helps us improve.\n\nQuick survey: ${surveyUrl}`
    }
  }
}

function getDefaultMessage(type: 'nps' | 'csat', language: string = 'es') {
  const isSpanish = language === 'es'
  
  if (type === 'nps') {
    return isSpanish ?
      'Nos ayudarías mucho si pudieras completar esta breve encuesta sobre tu experiencia con RP9.' :
      'It would help us a lot if you could complete this brief survey about your RP9 experience.'
  } else {
    return isSpanish ?
      'Tu feedback sobre tu experiencia reciente es muy valioso para nosotros.' :
      'Your feedback about your recent experience is very valuable to us.'
  }
}

function generateNPSEmailHTML(tenant: any, surveyUrl: string, customMessage?: string, isSpanish: boolean = true) {
  const title = isSpanish ? '¿Recomendarías RP9?' : 'Would you recommend RP9?'
  const subtitle = isSpanish ? 
    'En una escala del 0 al 10, ¿qué tan probable es que recomiendes RP9 a un colega?' :
    'On a scale from 0 to 10, how likely are you to recommend RP9 to a colleague?'
  const buttonText = isSpanish ? 'Completar Encuesta' : 'Complete Survey'

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${title}</title>
    </head>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #333;">${title}</h1>
        <p style="color: #666; font-size: 16px;">${subtitle}</p>
      </div>
      
      ${customMessage ? `<div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
        <p style="margin: 0; font-style: italic;">${customMessage}</p>
      </div>` : ''}
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${surveyUrl}" style="background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
          ${buttonText}
        </a>
      </div>
      
      <div style="text-align: center; color: #999; font-size: 12px; margin-top: 30px;">
        <p>${isSpanish ? 'Gracias por tu tiempo' : 'Thank you for your time'} 🙏</p>
        <p>RP9 Team</p>
      </div>
    </body>
    </html>
  `
}

function generateCSATEmailHTML(tenant: any, surveyUrl: string, customMessage?: string, isSpanish: boolean = true) {
  const title = isSpanish ? '¿Cómo fue tu experiencia?' : 'How was your experience?'
  const subtitle = isSpanish ? 
    'Queremos conocer tu nivel de satisfacción con nuestro servicio' :
    'We want to know your satisfaction level with our service'
  const buttonText = isSpanish ? 'Dejar Feedback' : 'Leave Feedback'

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${title}</title>
    </head>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #333;">${title}</h1>
        <p style="color: #666; font-size: 16px;">${subtitle}</p>
      </div>
      
      ${customMessage ? `<div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
        <p style="margin: 0; font-style: italic;">${customMessage}</p>
      </div>` : ''}
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${surveyUrl}" style="background: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
          ${buttonText}
        </a>
      </div>
      
      <div style="text-align: center; color: #999; font-size: 12px; margin-top: 30px;">
        <p>${isSpanish ? 'Tu opinión nos ayuda a mejorar' : 'Your opinion helps us improve'} ✨</p>
        <p>RP9 Team</p>
      </div>
    </body>
    </html>
  `
}

function calculateScoreCategory(type: 'nps' | 'csat', score: number) {
  if (type === 'nps') {
    if (score >= 9) return 'promoter'
    if (score >= 7) return 'passive'
    return 'detractor'
  } else {
    if (score >= 8) return 'satisfied'
    if (score >= 6) return 'neutral'
    return 'dissatisfied'
  }
}

function calculateAnalytics(responses: any[]) {
  const npsResponses = responses.filter(r => r.surveys.type === 'nps')
  const csatResponses = responses.filter(r => r.surveys.type === 'csat')
  
  // Calcular NPS
  const promoters = npsResponses.filter(r => r.score >= 9).length
  const detractors = npsResponses.filter(r => r.score <= 6).length
  const npsScore = npsResponses.length > 0 ? 
    Math.round(((promoters - detractors) / npsResponses.length) * 100) : null

  // Calcular CSAT promedio
  const csatAverage = csatResponses.length > 0 ?
    Math.round(csatResponses.reduce((sum, r) => sum + r.score, 0) / csatResponses.length * 10) / 10 : null

  // Distribución por categoría
  const npsDistribution = {
    promoters,
    passives: npsResponses.filter(r => r.score >= 7 && r.score <= 8).length,
    detractors
  }

  const csatDistribution = {
    satisfied: csatResponses.filter(r => r.score >= 8).length,
    neutral: csatResponses.filter(r => r.score >= 6 && r.score <= 7).length,
    dissatisfied: csatResponses.filter(r => r.score <= 5).length
  }

  return {
    total_responses: responses.length,
    nps: {
      total_responses: npsResponses.length,
      score: npsScore,
      distribution: npsDistribution
    },
    csat: {
      total_responses: csatResponses.length,
      average_score: csatAverage,
      distribution: csatDistribution
    },
    response_rate: {
      // TODO: Calcular basado en surveys enviados vs respondidos
      estimated: '65%'
    },
    trends: {
      // TODO: Calcular tendencias temporales
      nps_trend: 'stable',
      csat_trend: 'improving'
    }
  }
}

async function alertLowNPS(survey: any, response: SurveyResponse) {
  if (!SLACK_WEBHOOK_URL) return

  const slackMessage = {
    text: `⚠️ Low NPS Alert: Score ${response.score} from ${survey.tenants.name}`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `🚨 *Low NPS Alert*\n\n*Cliente:* ${survey.tenants.name}\n*Score:* ${response.score}/10 (Detractor)\n*Feedback:* ${response.feedback || 'No feedback provided'}`
        }
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "View Health Score"
            },
            url: `${process.env.FRONTEND_URL}/admin/cs/health/${survey.tenant_id}`
          },
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "Contact Customer"
            },
            url: `${process.env.FRONTEND_URL}/admin/cs/playbooks?tenant=${survey.tenant_id}`
          }
        ]
      }
    ]
  }

  try {
    await fetch(SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(slackMessage)
    })
  } catch (error) {
    console.error('Error sending low NPS alert:', error)
  }
}

// Handler principal
export const handler: Handler = async (event) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
  }

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' }
  }

  try {
    if (!event.body) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Request body is required' })
      }
    }

    const requestData = JSON.parse(event.body)
    
    // Determinar acción
    switch (requestData.action) {
      case 'send': {
        const validatedData = sendSurveySchema.parse(requestData)
        const survey = await createSurvey(validatedData)
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            survey,
            message: `${validatedData.type.toUpperCase()} survey sent via ${validatedData.channel}`
          })
        }
      }

      case 'submit': {
        const validatedData = submitResponseSchema.parse(requestData)
        const response = await submitSurveyResponse(validatedData)
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            response,
            message: 'Survey response submitted successfully'
          })
        }
      }

      case 'analytics': {
        const validatedData = analyticsSchema.parse(requestData)
        const analytics = await getAnalytics(validatedData)
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            analytics
          })
        }
      }

      default:
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Invalid action. Must be: send, submit, or analytics' })
        }
    }

  } catch (error) {
    console.error('NPS/CSAT function error:', error)
    
    if (error instanceof z.ZodError) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Validation failed',
          details: error.errors
        })
      }
    }

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
}