import { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

// Configuración Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Configuración externa
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL
const CALENDAR_PROVIDER = process.env.CALENDAR_PROVIDER || 'none' // 'calendly', 'zoom', 'google'
const QBR_AUTO_SCHEDULE = process.env.CS_QBR_AUTO_SCHEDULE === 'true'

// Schemas de validación
const scheduleQBRSchema = z.object({
  action: z.literal('schedule'),
  tenantId: z.string().uuid(),
  quarter: z.string().regex(/^\d{4}-Q[1-4]$/), // formato: 2024-Q1
  csm: z.string().optional(),
  scheduledDate: z.string().optional(),
  priority: z.enum(['high', 'medium', 'low']).default('medium')
})

const updateQBRSchema = z.object({
  action: z.literal('update'),
  qbrId: z.string().uuid(),
  status: z.enum(['scheduled', 'completed', 'cancelled', 'rescheduled']).optional(),
  actualDate: z.string().optional(),
  outcome: z.string().optional(),
  actionItems: z.array(z.string()).optional(),
  nextSteps: z.string().optional(),
  notes: z.string().max(2000).optional()
})

const listQBRsSchema = z.object({
  action: z.literal('list'),
  tenantId: z.string().uuid().optional(),
  quarter: z.string().optional(),
  status: z.string().optional(),
  csm: z.string().optional(),
  limit: z.number().min(1).max(100).default(50)
})

// Types
interface ScheduleQBRRequest {
  tenantId: string
  quarter: string
  csm?: string
  scheduledDate?: string
  priority: 'high' | 'medium' | 'low'
}

interface UpdateQBRRequest {
  qbrId: string
  status?: 'scheduled' | 'completed' | 'cancelled' | 'rescheduled'
  actualDate?: string
  outcome?: string
  actionItems?: string[]
  nextSteps?: string
  notes?: string
}

interface ListQBRsRequest {
  tenantId?: string
  quarter?: string
  status?: string
  csm?: string
  limit: number
}

// Funciones auxiliares
async function getTenantInfo(tenantId: string) {
  const { data: tenant, error } = await supabase
    .from('tenants')
    .select(`
      id, name, email, plan, 
      created_at, updated_at,
      metadata
    `)
    .eq('id', tenantId)
    .single()

  if (error) throw new Error(`Tenant not found: ${error.message}`)
  return tenant
}

async function getHealthScore(tenantId: string) {
  const { data: healthScore, error } = await supabase
    .from('cs_health_scores')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  return healthScore || null
}

async function getCSMForTenant(tenantId: string) {
  // TODO: Implementar lógica de asignación de CSM
  // Por ahora usar reglas simples basadas en plan y cuenta
  const tenant = await getTenantInfo(tenantId)
  
  if (tenant.plan === 'enterprise') {
    return 'maria.gonzalez@rp9.com' // CSM senior
  } else if (tenant.plan === 'pro') {
    return 'carlos.ruiz@rp9.com' // CSM regular
  }
  
  return 'ana.lopez@rp9.com' // CSM junior para starter
}

async function calculateQBRPriority(tenantId: string): Promise<'high' | 'medium' | 'low'> {
  const tenant = await getTenantInfo(tenantId)
  const healthScore = await getHealthScore(tenantId)
  
  // Reglas de priorización
  if (tenant.plan === 'enterprise') return 'high'
  if (healthScore && healthScore.score < 60) return 'high'
  if (tenant.plan === 'pro') return 'medium'
  
  return 'low'
}

async function generateQBRAgenda(tenantId: string, quarter: string) {
  const tenant = await getTenantInfo(tenantId)
  const healthScore = await getHealthScore(tenantId)
  
  // Obtener métricas del quarter
  const quarterStart = getQuarterStartDate(quarter)
  const quarterEnd = getQuarterEndDate(quarter)
  
  // Obtener tickets del quarter
  const { data: tickets } = await supabase
    .from('tickets')
    .select('severity, status, created_at')
    .eq('tenant_id', tenantId)
    .gte('created_at', quarterStart)
    .lte('created_at', quarterEnd)

  // Generar agenda personalizada
  const agenda = {
    quarterSummary: {
      healthScore: healthScore?.score || 'N/A',
      totalTickets: tickets?.length || 0,
      criticalTickets: tickets?.filter(t => t.severity === 'P1').length || 0,
      plan: tenant.plan
    },
    discussionTopics: [
      'Revisión de Health Score y métricas clave',
      'Análisis de tickets y resolución de issues',
      'Adopción de nuevas funcionalidades',
      'Roadmap y próximas releases',
      'Objetivos para el próximo quarter'
    ],
    preparationItems: [
      'Revisar métricas de uso del quarter',
      'Preparar casos de uso exitosos',
      'Identificar pain points y mejoras',
      'Definir KPIs para próximo quarter'
    ]
  }

  return agenda
}

function getQuarterStartDate(quarter: string): string {
  const [year, q] = quarter.split('-Q')
  const quarterNum = parseInt(q)
  const month = (quarterNum - 1) * 3 + 1 // Q1=1, Q2=4, Q3=7, Q4=10
  return new Date(parseInt(year), month - 1, 1).toISOString()
}

function getQuarterEndDate(quarter: string): string {
  const [year, q] = quarter.split('-Q')
  const quarterNum = parseInt(q)
  const month = quarterNum * 3 // Q1=3, Q2=6, Q3=9, Q4=12
  const lastDay = new Date(parseInt(year), month, 0).getDate()
  return new Date(parseInt(year), month - 1, lastDay, 23, 59, 59).toISOString()
}

function generateDefaultScheduleDate(quarter: string, priority: string): string {
  const quarterStart = new Date(getQuarterStartDate(quarter))
  const quarterEnd = new Date(getQuarterEndDate(quarter))
  
  // Calcular cuando programar según prioridad
  let targetWeek: number
  
  switch (priority) {
    case 'high':
      targetWeek = 10 // Semana 10 del quarter (temprano)
      break
    case 'medium':
      targetWeek = 11 // Semana 11 del quarter (medio)
      break
    case 'low':
      targetWeek = 12 // Semana 12 del quarter (tarde)
      break
    default:
      targetWeek = 11
  }
  
  const targetDate = new Date(quarterStart)
  targetDate.setDate(targetDate.getDate() + (targetWeek * 7))
  
  // Mover a próximo martes si cae en fin de semana
  while (targetDate.getDay() === 0 || targetDate.getDay() === 6) {
    targetDate.setDate(targetDate.getDate() + 1)
  }
  
  return targetDate.toISOString()
}

async function scheduleQBR(request: ScheduleQBRRequest) {
  // Verificar si ya existe QBR para este tenant/quarter
  const { data: existingQBR } = await supabase
    .from('qbrs')
    .select('id')
    .eq('tenant_id', request.tenantId)
    .eq('quarter', request.quarter)
    .single()

  if (existingQBR) {
    throw new Error(`QBR already exists for ${request.quarter}`)
  }

  const tenant = await getTenantInfo(request.tenantId)
  const csm = request.csm || await getCSMForTenant(request.tenantId)
  const priority = request.priority || await calculateQBRPriority(request.tenantId)
  const scheduledDate = request.scheduledDate || generateDefaultScheduleDate(request.quarter, priority)
  const agenda = await generateQBRAgenda(request.tenantId, request.quarter)

  // Crear QBR en la base de datos
  const { data: qbr, error } = await supabase
    .from('qbrs')
    .insert({
      tenant_id: request.tenantId,
      quarter: request.quarter,
      assigned_csm: csm,
      scheduled_date: scheduledDate,
      status: 'scheduled',
      priority,
      agenda,
      created_at: new Date().toISOString()
    })
    .select()
    .single()

  if (error) throw new Error(`Failed to create QBR: ${error.message}`)

  // Enviar notificación a Slack
  await notifyQBRScheduled(qbr, tenant)

  // TODO: Integrar con calendario (Calendly, Zoom, Google Calendar)
  if (CALENDAR_PROVIDER !== 'none') {
    await scheduleCalendarEvent(qbr, tenant)
  }

  return qbr
}

async function updateQBR(request: UpdateQBRRequest) {
  const { qbrId, ...updateData } = request

  // Verificar que el QBR existe
  const { data: existingQBR, error: fetchError } = await supabase
    .from('qbrs')
    .select('*, tenants(name)')
    .eq('id', qbrId)
    .single()

  if (fetchError || !existingQBR) {
    throw new Error('QBR not found')
  }

  // Preparar datos de actualización
  const dbUpdateData: any = {
    ...updateData,
    updated_at: new Date().toISOString()
  }

  // Si se marca como completado, agregar fecha de completado
  if (updateData.status === 'completed' && !existingQBR.completed_at) {
    dbUpdateData.completed_at = new Date().toISOString()
  }

  // Actualizar QBR
  const { data: updatedQBR, error } = await supabase
    .from('qbrs')
    .update(dbUpdateData)
    .eq('id', qbrId)
    .select()
    .single()

  if (error) throw new Error(`Failed to update QBR: ${error.message}`)

  // Notificar cambios importantes
  if (updateData.status === 'completed') {
    await notifyQBRCompleted(updatedQBR, existingQBR.tenants)
  } else if (updateData.status === 'cancelled') {
    await notifyQBRCancelled(updatedQBR, existingQBR.tenants)
  }

  return updatedQBR
}

async function listQBRs(request: ListQBRsRequest) {
  let query = supabase
    .from('qbrs')
    .select(`
      *,
      tenants!inner(name, plan, email)
    `)

  // Aplicar filtros
  if (request.tenantId) {
    query = query.eq('tenant_id', request.tenantId)
  }

  if (request.quarter) {
    query = query.eq('quarter', request.quarter)
  }

  if (request.status) {
    query = query.eq('status', request.status)
  }

  if (request.csm) {
    query = query.eq('assigned_csm', request.csm)
  }

  const { data: qbrs, error } = await query
    .order('scheduled_date', { ascending: true })
    .limit(request.limit)

  if (error) throw new Error(`Failed to fetch QBRs: ${error.message}`)

  return qbrs
}

// Funciones de notificación
async function notifyQBRScheduled(qbr: any, tenant: any) {
  if (!SLACK_WEBHOOK_URL) return

  const slackMessage = {
    text: `📅 New QBR scheduled for ${tenant.name}`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*📅 QBR Scheduled*\n\n*Cliente:* ${tenant.name}\n*Quarter:* ${qbr.quarter}\n*CSM:* ${qbr.assigned_csm}\n*Fecha:* ${new Date(qbr.scheduled_date).toLocaleDateString('es-MX')}\n*Prioridad:* ${qbr.priority.toUpperCase()}`
        }
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "View QBR Details"
            },
            url: `${process.env.FRONTEND_URL}/admin/cs/qbr/${qbr.id}`
          },
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "Contact Client"
            },
            url: `mailto:${tenant.email}`
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
    console.error('Error sending QBR scheduled notification:', error)
  }
}

async function notifyQBRCompleted(qbr: any, tenant: any) {
  if (!SLACK_WEBHOOK_URL) return

  const slackMessage = {
    text: `✅ QBR completed for ${tenant.name}`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*✅ QBR Completed*\n\n*Cliente:* ${tenant.name}\n*Quarter:* ${qbr.quarter}\n*CSM:* ${qbr.assigned_csm}\n*Outcome:* ${qbr.outcome || 'No outcome recorded'}`
        }
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Action Items:*\n${qbr.actionItems ? qbr.actionItems.map(item => `• ${item}`).join('\n') : 'No action items'}`
        }
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
    console.error('Error sending QBR completed notification:', error)
  }
}

async function notifyQBRCancelled(qbr: any, tenant: any) {
  if (!SLACK_WEBHOOK_URL) return

  const slackMessage = {
    text: `❌ QBR cancelled for ${tenant.name}`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*❌ QBR Cancelled*\n\n*Cliente:* ${tenant.name}\n*Quarter:* ${qbr.quarter}\n*CSM:* ${qbr.assigned_csm}\n*Notes:* ${qbr.notes || 'No reason provided'}`
        }
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
    console.error('Error sending QBR cancelled notification:', error)
  }
}

async function scheduleCalendarEvent(qbr: any, tenant: any) {
  // TODO: Implementar integración con calendario
  console.log('Calendar integration not implemented yet:', {
    provider: CALENDAR_PROVIDER,
    qbr: qbr.id,
    tenant: tenant.name,
    date: qbr.scheduled_date
  })
}

// Función para auto-programar QBRs (llamada desde scheduled function)
async function autoScheduleQBRs() {
  if (!QBR_AUTO_SCHEDULE) {
    console.log('Auto-scheduling disabled')
    return { scheduled: 0, skipped: 0 }
  }

  // Obtener quarter actual
  const now = new Date()
  const currentQuarter = `${now.getFullYear()}-Q${Math.ceil((now.getMonth() + 1) / 3)}`
  
  // Buscar tenants elegibles para QBR
  const { data: tenants, error } = await supabase
    .from('tenants')
    .select('id, name, plan, created_at')
    .eq('status', 'active')
    .in('plan', ['pro', 'enterprise']) // Solo planes con QBR incluido

  if (error) {
    console.error('Error fetching tenants:', error)
    return { scheduled: 0, skipped: 0, error: error.message }
  }

  let scheduled = 0
  let skipped = 0

  for (const tenant of tenants) {
    try {
      // Verificar si ya tiene QBR para este quarter
      const { data: existingQBR } = await supabase
        .from('qbrs')
        .select('id')
        .eq('tenant_id', tenant.id)
        .eq('quarter', currentQuarter)
        .single()

      if (existingQBR) {
        skipped++
        continue
      }

      // Verificar si es elegible (al menos 1 quarter activo)
      const accountAge = Date.now() - new Date(tenant.created_at).getTime()
      const quarterMs = 90 * 24 * 60 * 60 * 1000 // ~90 días
      
      if (accountAge < quarterMs) {
        skipped++
        continue
      }

      // Auto-programar QBR
      await scheduleQBR({
        tenantId: tenant.id,
        quarter: currentQuarter,
        priority: await calculateQBRPriority(tenant.id)
      })

      scheduled++
    } catch (error) {
      console.error(`Error scheduling QBR for tenant ${tenant.id}:`, error)
      skipped++
    }
  }

  return { scheduled, skipped, quarter: currentQuarter }
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
    // Si es scheduled function (sin body), ejecutar auto-scheduling
    if (!event.body) {
      console.log('Running auto QBR scheduling...')
      const result = await autoScheduleQBRs()
      
      // Notificar resultado
      if (SLACK_WEBHOOK_URL && result.scheduled > 0) {
        const slackMessage = {
          text: `🤖 Auto QBR Scheduler: ${result.scheduled} QBRs scheduled for ${result.quarter}`,
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `*🤖 Scheduled QBR Summary*\n\n*Quarter:* ${result.quarter}\n*Scheduled:* ${result.scheduled}\n*Skipped:* ${result.skipped}`
              }
            }
          ]
        }

        await fetch(SLACK_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(slackMessage)
        })
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'Auto QBR scheduling completed',
          result
        })
      }
    }

    const requestData = JSON.parse(event.body)
    
    // Determinar acción
    switch (requestData.action) {
      case 'schedule': {
        const validatedData = scheduleQBRSchema.parse(requestData)
        const qbr = await scheduleQBR(validatedData)
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            qbr,
            message: `QBR scheduled for ${validatedData.quarter}`
          })
        }
      }

      case 'update': {
        const validatedData = updateQBRSchema.parse(requestData)
        const qbr = await updateQBR(validatedData)
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            qbr,
            message: 'QBR updated successfully'
          })
        }
      }

      case 'list': {
        const validatedData = listQBRsSchema.parse(requestData)
        const qbrs = await listQBRs(validatedData)
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            qbrs,
            total: qbrs.length
          })
        }
      }

      default:
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Invalid action. Must be: schedule, update, or list' })
        }
    }

  } catch (error) {
    console.error('QBR scheduler function error:', error)
    
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