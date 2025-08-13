import { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

// Configuración Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Configuración externa
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL
const RENEWAL_REMINDER_DAYS = process.env.CS_RENEWAL_REMINDER_DAYS?.split(',').map(d => parseInt(d)) || [60, 30, 15, 7]
const DUNNING_ATTEMPT_LIMIT = parseInt(process.env.CS_DUNNING_ATTEMPT_LIMIT || '3')
const EMAIL_PROVIDER_API_KEY = process.env.EMAIL_PROVIDER_API_KEY

// Schemas de validación
const processRenewalsSchema = z.object({
  action: z.literal('process'),
  tenantId: z.string().uuid().optional(),
  dryRun: z.boolean().default(false)
})

const updateRenewalSchema = z.object({
  action: z.literal('update'),
  renewalId: z.string().uuid(),
  status: z.enum(['pending', 'contacted', 'negotiating', 'renewed', 'churned', 'cancelled']),
  notes: z.string().max(1000).optional(),
  amount: z.number().positive().optional(),
  renewalDate: z.string().optional(),
  churnReason: z.string().optional()
})

const getRenewalsSchema = z.object({
  action: z.literal('list'),
  status: z.enum(['pending', 'contacted', 'negotiating', 'renewed', 'churned']).optional(),
  daysToRenewal: z.number().optional(),
  riskLevel: z.enum(['high', 'medium', 'low']).optional(),
  limit: z.number().min(1).max(100).default(50)
})

// Types
interface ProcessRenewalsRequest {
  tenantId?: string
  dryRun: boolean
}

interface UpdateRenewalRequest {
  renewalId: string
  status: 'pending' | 'contacted' | 'negotiating' | 'renewed' | 'churned' | 'cancelled'
  notes?: string
  amount?: number
  renewalDate?: string
  churnReason?: string
}

interface GetRenewalsRequest {
  status?: 'pending' | 'contacted' | 'negotiating' | 'renewed' | 'churned'
  daysToRenewal?: number
  riskLevel?: 'high' | 'medium' | 'low'
  limit: number
}

interface RenewalRecord {
  id: string
  tenant_id: string
  renewal_date: string
  current_plan: string
  current_amount: number
  status: string
  risk_level: string
  last_contact: string | null
  contact_attempts: number
  health_score: number | null
  notes: string | null
}

// Funciones auxiliares
async function getTenantInfo(tenantId: string) {
  const { data: tenant, error } = await supabase
    .from('tenants')
    .select(`
      id, name, email, plan, 
      created_at, subscription_end_date,
      billing_email, contact_email,
      metadata
    `)
    .eq('id', tenantId)
    .single()

  if (error) throw new Error(`Tenant not found: ${error.message}`)
  return tenant
}

async function getTenantsForRenewal(daysAhead: number = 90) {
  const targetDate = new Date()
  targetDate.setDate(targetDate.getDate() + daysAhead)

  const { data: tenants, error } = await supabase
    .from('tenants')
    .select(`
      id, name, email, plan,
      subscription_end_date, billing_email,
      metadata
    `)
    .eq('status', 'active')
    .not('subscription_end_date', 'is', null)
    .lte('subscription_end_date', targetDate.toISOString())

  if (error) throw new Error(`Failed to fetch tenants: ${error.message}`)
  return tenants
}

async function getHealthScore(tenantId: string) {
  const { data: healthScore, error } = await supabase
    .from('cs_health_scores')
    .select('score, risk_level')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  return healthScore || { score: null, risk_level: 'medium' }
}

async function calculateRenewalRisk(tenant: any, healthScore: any): Promise<'high' | 'medium' | 'low'> {
  let riskScore = 0

  // Health score factor (40% weight)
  if (healthScore.score !== null) {
    if (healthScore.score < 60) riskScore += 40
    else if (healthScore.score < 80) riskScore += 20
    else riskScore += 0
  } else {
    riskScore += 30 // Unknown health = medium risk
  }

  // Plan factor (20% weight)
  if (tenant.plan === 'starter') riskScore += 20
  else if (tenant.plan === 'pro') riskScore += 10
  // Enterprise = 0

  // Time to renewal factor (20% weight)
  const daysToRenewal = Math.ceil((new Date(tenant.subscription_end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  if (daysToRenewal <= 7) riskScore += 20
  else if (daysToRenewal <= 30) riskScore += 10

  // Recent support activity factor (10% weight)
  const { data: recentTickets } = await supabase
    .from('tickets')
    .select('severity')
    .eq('tenant_id', tenant.id)
    .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())

  if (recentTickets && recentTickets.length > 0) {
    const hasP1 = recentTickets.some(t => t.severity === 'P1')
    if (hasP1) riskScore += 10
    else if (recentTickets.length > 3) riskScore += 5
  }

  // Usage trend factor (10% weight)
  // TODO: Implementar basado en métricas de n8n
  // Por ahora usar metadata si existe
  const usageTrend = tenant.metadata?.usage_trend || 'stable'
  if (usageTrend === 'declining') riskScore += 10
  else if (usageTrend === 'stable') riskScore += 5

  // Clasificar según score total
  if (riskScore >= 70) return 'high'
  if (riskScore >= 40) return 'medium'
  return 'low'
}

async function createOrUpdateRenewal(tenant: any, healthScore: any): Promise<RenewalRecord> {
  const daysToRenewal = Math.ceil((new Date(tenant.subscription_end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  const riskLevel = await calculateRenewalRisk(tenant, healthScore)

  // Verificar si ya existe registro de renovación
  const { data: existingRenewal } = await supabase
    .from('renewals')
    .select('*')
    .eq('tenant_id', tenant.id)
    .eq('renewal_date', tenant.subscription_end_date)
    .single()

  if (existingRenewal) {
    // Actualizar risk level si cambió
    if (existingRenewal.risk_level !== riskLevel) {
      const { data: updatedRenewal, error } = await supabase
        .from('renewals')
        .update({
          risk_level: riskLevel,
          health_score: healthScore.score,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingRenewal.id)
        .select()
        .single()

      if (error) throw new Error(`Failed to update renewal: ${error.message}`)
      return updatedRenewal
    }
    return existingRenewal
  }

  // Crear nuevo registro de renovación
  const { data: newRenewal, error } = await supabase
    .from('renewals')
    .insert({
      tenant_id: tenant.id,
      renewal_date: tenant.subscription_end_date,
      current_plan: tenant.plan,
      current_amount: getPlanAmount(tenant.plan),
      status: daysToRenewal <= 30 ? 'pending' : 'tracked',
      risk_level: riskLevel,
      health_score: healthScore.score,
      contact_attempts: 0,
      created_at: new Date().toISOString()
    })
    .select()
    .single()

  if (error) throw new Error(`Failed to create renewal: ${error.message}`)
  return newRenewal
}

function getPlanAmount(plan: string): number {
  // TODO: Obtener de configuración o billing system
  switch (plan) {
    case 'starter': return 29
    case 'pro': return 99
    case 'enterprise': return 299
    default: return 0
  }
}

async function shouldSendReminder(renewal: RenewalRecord): Promise<boolean> {
  const daysToRenewal = Math.ceil((new Date(renewal.renewal_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  
  // Verificar si está en uno de los días de recordatorio
  if (!RENEWAL_REMINDER_DAYS.includes(daysToRenewal)) {
    return false
  }

  // Verificar límite de intentos
  if (renewal.contact_attempts >= DUNNING_ATTEMPT_LIMIT) {
    return false
  }

  // Verificar si ya se envió recordatorio hoy
  if (renewal.last_contact) {
    const lastContact = new Date(renewal.last_contact)
    const today = new Date()
    if (lastContact.toDateString() === today.toDateString()) {
      return false
    }
  }

  return true
}

async function sendRenewalReminder(renewal: RenewalRecord, tenant: any, dryRun: boolean = false) {
  const daysToRenewal = Math.ceil((new Date(renewal.renewal_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  
  if (dryRun) {
    console.log(`[DRY RUN] Would send renewal reminder to ${tenant.name} (${daysToRenewal} days)`)
    return { sent: false, reason: 'dry_run' }
  }

  const emailContent = generateRenewalEmail(tenant, renewal, daysToRenewal)
  
  // TODO: Integrar con proveedor de email
  if (EMAIL_PROVIDER_API_KEY) {
    await sendEmail(tenant.billing_email || tenant.email, emailContent)
  } else {
    console.log('Email provider not configured - would send:', emailContent.subject)
  }

  // Actualizar contador de intentos
  await supabase
    .from('renewals')
    .update({
      contact_attempts: renewal.contact_attempts + 1,
      last_contact: new Date().toISOString(),
      status: daysToRenewal <= 7 ? 'contacted' : renewal.status,
      updated_at: new Date().toISOString()
    })
    .eq('id', renewal.id)

  // Notificar a CS team si es alta prioridad
  if (renewal.risk_level === 'high' || daysToRenewal <= 7) {
    await notifyCSTeam(renewal, tenant, daysToRenewal)
  }

  return { sent: true, daysToRenewal, attempts: renewal.contact_attempts + 1 }
}

function generateRenewalEmail(tenant: any, renewal: RenewalRecord, daysToRenewal: number) {
  const isSpanish = tenant.metadata?.language === 'es' || true
  const urgencyLevel = daysToRenewal <= 7 ? 'urgent' : daysToRenewal <= 30 ? 'medium' : 'early'

  if (isSpanish) {
    const subjects = {
      urgent: `🚨 Tu suscripción de RP9 vence en ${daysToRenewal} días`,
      medium: `📅 Recordatorio: Tu suscripción de RP9 vence el ${new Date(renewal.renewal_date).toLocaleDateString('es-MX')}`,
      early: `🔔 Tu suscripción de RP9 se renueva pronto - ${tenant.name}`
    }

    return {
      subject: subjects[urgencyLevel],
      html: generateSpanishRenewalHTML(tenant, renewal, daysToRenewal, urgencyLevel),
      text: generateSpanishRenewalText(tenant, renewal, daysToRenewal)
    }
  } else {
    const subjects = {
      urgent: `🚨 Your RP9 subscription expires in ${daysToRenewal} days`,
      medium: `📅 Reminder: Your RP9 subscription expires on ${new Date(renewal.renewal_date).toLocaleDateString()}`,
      early: `🔔 Your RP9 subscription is up for renewal soon - ${tenant.name}`
    }

    return {
      subject: subjects[urgencyLevel],
      html: generateEnglishRenewalHTML(tenant, renewal, daysToRenewal, urgencyLevel),
      text: generateEnglishRenewalText(tenant, renewal, daysToRenewal)
    }
  }
}

function generateSpanishRenewalHTML(tenant: any, renewal: RenewalRecord, daysToRenewal: number, urgencyLevel: string) {
  const renewalUrl = `${process.env.FRONTEND_URL}/billing/renewal?token=${generateRenewalToken(renewal)}`
  const contactUrl = `${process.env.FRONTEND_URL}/support/new?subject=Renovacion`

  const urgencyColors = {
    urgent: '#dc3545',
    medium: '#fd7e14',
    early: '#28a745'
  }

  const urgencyMessages = {
    urgent: '¡Acción requerida inmediatamente!',
    medium: 'Te recomendamos renovar pronto',
    early: 'Planifica tu renovación con tiempo'
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Renovación RP9 - ${tenant.name}</title>
    </head>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: ${urgencyColors[urgencyLevel]};">Renovación de Suscripción RP9</h1>
        <p style="color: #666; font-size: 18px; font-weight: bold;">
          ${urgencyMessages[urgencyLevel]}
        </p>
      </div>
      
      <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
        <h2 style="margin-top: 0; color: #333;">Hola ${tenant.name} 👋</h2>
        <p>Tu suscripción al plan <strong>${renewal.current_plan.toUpperCase()}</strong> vence en <strong style="color: ${urgencyColors[urgencyLevel]};">${daysToRenewal} días</strong>.</p>
        
        <div style="background: white; padding: 15px; border-radius: 6px; margin: 15px 0;">
          <h3 style="margin: 0 0 10px 0; color: #333;">Detalles de tu suscripción:</h3>
          <ul style="margin: 0; padding-left: 20px;">
            <li><strong>Plan actual:</strong> ${renewal.current_plan.charAt(0).toUpperCase() + renewal.current_plan.slice(1)}</li>
            <li><strong>Fecha de vencimiento:</strong> ${new Date(renewal.renewal_date).toLocaleDateString('es-MX')}</li>
            <li><strong>Monto mensual:</strong> $${renewal.current_amount} USD</li>
          </ul>
        </div>
      </div>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${renewalUrl}" style="background: ${urgencyColors[urgencyLevel]}; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px; display: inline-block;">
          Renovar Ahora
        </a>
      </div>
      
      <div style="background: #e7f3ff; padding: 15px; border-radius: 6px; margin: 20px 0;">
        <h4 style="margin: 0 0 10px 0; color: #0066cc;">¿Por qué renovar con RP9?</h4>
        <ul style="margin: 0; padding-left: 20px; color: #333;">
          <li>Automatización sin interrupciones</li>
          <li>Soporte técnico especializado</li>
          <li>Nuevas integraciones cada mes</li>
          <li>Actualizaciones automáticas</li>
        </ul>
      </div>
      
      <div style="text-align: center; margin: 20px 0;">
        <p>¿Tienes preguntas? <a href="${contactUrl}" style="color: #007bff;">Contáctanos</a></p>
      </div>
      
      <div style="text-align: center; color: #999; font-size: 12px; margin-top: 30px;">
        <p>Gracias por confiar en RP9 🙏</p>
        <p>El equipo de RP9</p>
      </div>
    </body>
    </html>
  `
}

function generateSpanishRenewalText(tenant: any, renewal: RenewalRecord, daysToRenewal: number) {
  return `
Hola ${tenant.name},

Tu suscripción al plan ${renewal.current_plan.toUpperCase()} de RP9 vence en ${daysToRenewal} días.

Detalles:
- Plan: ${renewal.current_plan.charAt(0).toUpperCase() + renewal.current_plan.slice(1)}
- Vencimiento: ${new Date(renewal.renewal_date).toLocaleDateString('es-MX')}
- Monto: $${renewal.current_amount} USD/mes

Para renovar: ${process.env.FRONTEND_URL}/billing/renewal?token=${generateRenewalToken(renewal)}

¿Preguntas? Contacta a nuestro equipo: ${process.env.FRONTEND_URL}/support/new

Gracias por confiar en RP9.

El equipo de RP9
  `.trim()
}

function generateEnglishRenewalHTML(tenant: any, renewal: RenewalRecord, daysToRenewal: number, urgencyLevel: string) {
  // Similar structure to Spanish but in English
  // Simplified for brevity
  return `<html><body><h1>RP9 Renewal Notice</h1><p>Your ${renewal.current_plan} plan expires in ${daysToRenewal} days.</p></body></html>`
}

function generateEnglishRenewalText(tenant: any, renewal: RenewalRecord, daysToRenewal: number) {
  return `Your RP9 ${renewal.current_plan} plan expires in ${daysToRenewal} days. Please renew to continue service.`
}

function generateRenewalToken(renewal: RenewalRecord): string {
  // TODO: Implementar token seguro para renovación
  return Buffer.from(`${renewal.id}:${renewal.tenant_id}:${Date.now()}`).toString('base64')
}

async function sendEmail(to: string, content: any) {
  // TODO: Implementar con proveedor de email real
  console.log(`Would send email to ${to}:`, content.subject)
}

async function notifyCSTeam(renewal: RenewalRecord, tenant: any, daysToRenewal: number) {
  if (!SLACK_WEBHOOK_URL) return

  const riskEmojis = {
    high: '🚨',
    medium: '⚠️',
    low: '📅'
  }

  const slackMessage = {
    text: `${riskEmojis[renewal.risk_level]} Renewal Alert: ${tenant.name} (${daysToRenewal} days)`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*${riskEmojis[renewal.risk_level]} Renewal Alert*\n\n*Cliente:* ${tenant.name}\n*Plan:* ${renewal.current_plan.toUpperCase()}\n*Días restantes:* ${daysToRenewal}\n*Risk Level:* ${renewal.risk_level.toUpperCase()}\n*Health Score:* ${renewal.health_score || 'N/A'}\n*Intentos contacto:* ${renewal.contact_attempts}`
        }
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "View Renewal Details"
            },
            url: `${process.env.FRONTEND_URL}/admin/cs/renewals/${renewal.id}`
          },
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "Contact Customer"
            },
            url: `mailto:${tenant.billing_email || tenant.email}`
          },
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "Health Score"
            },
            url: `${process.env.FRONTEND_URL}/admin/cs/health/${tenant.id}`
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
    console.error('Error sending renewal notification:', error)
  }
}

// Funciones principales
async function processRenewals(request: ProcessRenewalsRequest) {
  const { tenantId, dryRun } = request
  let tenantsToProcess

  if (tenantId) {
    const tenant = await getTenantInfo(tenantId)
    tenantsToProcess = [tenant]
  } else {
    tenantsToProcess = await getTenantsForRenewal(90) // Próximos 90 días
  }

  const results = {
    processed: 0,
    reminders_sent: 0,
    skipped: 0,
    renewals_created: 0,
    errors: [] as string[]
  }

  for (const tenant of tenantsToProcess) {
    try {
      results.processed++

      // Obtener health score
      const healthScore = await getHealthScore(tenant.id)

      // Crear o actualizar registro de renovación
      const renewal = await createOrUpdateRenewal(tenant, healthScore)
      if (renewal.created_at === renewal.updated_at) {
        results.renewals_created++
      }

      // Verificar si debe enviar recordatorio
      if (await shouldSendReminder(renewal)) {
        const reminderResult = await sendRenewalReminder(renewal, tenant, dryRun)
        if (reminderResult.sent) {
          results.reminders_sent++
        }
      } else {
        results.skipped++
      }

    } catch (error) {
      console.error(`Error processing renewal for tenant ${tenant.id}:`, error)
      results.errors.push(`${tenant.name}: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  return results
}

async function updateRenewal(request: UpdateRenewalRequest) {
  const { renewalId, ...updateData } = request

  // Verificar que existe
  const { data: existingRenewal, error: fetchError } = await supabase
    .from('renewals')
    .select('*, tenants(name)')
    .eq('id', renewalId)
    .single()

  if (fetchError || !existingRenewal) {
    throw new Error('Renewal not found')
  }

  // Actualizar
  const { data: updatedRenewal, error } = await supabase
    .from('renewals')
    .update({
      ...updateData,
      updated_at: new Date().toISOString()
    })
    .eq('id', renewalId)
    .select()
    .single()

  if (error) throw new Error(`Failed to update renewal: ${error.message}`)

  // Notificar cambios importantes
  if (updateData.status === 'renewed') {
    await notifyRenewalSuccess(updatedRenewal, existingRenewal.tenants)
  } else if (updateData.status === 'churned') {
    await notifyChurn(updatedRenewal, existingRenewal.tenants, updateData.churnReason)
  }

  return updatedRenewal
}

async function getRenewals(request: GetRenewalsRequest) {
  let query = supabase
    .from('renewals')
    .select(`
      *,
      tenants!inner(name, plan, email)
    `)

  if (request.status) {
    query = query.eq('status', request.status)
  }

  if (request.riskLevel) {
    query = query.eq('risk_level', request.riskLevel)
  }

  if (request.daysToRenewal) {
    const targetDate = new Date()
    targetDate.setDate(targetDate.getDate() + request.daysToRenewal)
    query = query.lte('renewal_date', targetDate.toISOString())
  }

  const { data: renewals, error } = await query
    .order('renewal_date', { ascending: true })
    .limit(request.limit)

  if (error) throw new Error(`Failed to fetch renewals: ${error.message}`)

  return renewals
}

async function notifyRenewalSuccess(renewal: any, tenant: any) {
  if (!SLACK_WEBHOOK_URL) return

  const slackMessage = {
    text: `🎉 Renewal Success: ${tenant.name}`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*🎉 Successful Renewal*\n\n*Cliente:* ${tenant.name}\n*Plan:* ${renewal.current_plan.toUpperCase()}\n*Amount:* $${renewal.amount || renewal.current_amount}\n*New Renewal Date:* ${renewal.renewalDate ? new Date(renewal.renewalDate).toLocaleDateString('es-MX') : 'TBD'}`
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
    console.error('Error sending renewal success notification:', error)
  }
}

async function notifyChurn(renewal: any, tenant: any, churnReason?: string) {
  if (!SLACK_WEBHOOK_URL) return

  const slackMessage = {
    text: `😢 Customer Churned: ${tenant.name}`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*😢 Customer Churn*\n\n*Cliente:* ${tenant.name}\n*Plan:* ${renewal.current_plan.toUpperCase()}\n*Churn Reason:* ${churnReason || 'No reason provided'}\n*Health Score:* ${renewal.health_score || 'N/A'}`
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
    console.error('Error sending churn notification:', error)
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
    // Si es scheduled function (sin body), procesar renovaciones automáticamente
    if (!event.body) {
      console.log('Running scheduled renewal processing...')
      const results = await processRenewals({ dryRun: false })
      
      // Notificar resultados si hay actividad
      if (SLACK_WEBHOOK_URL && (results.reminders_sent > 0 || results.renewals_created > 0)) {
        const slackMessage = {
          text: `🤖 Renewal Dunning Summary: ${results.reminders_sent} reminders sent`,
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `*🤖 Daily Renewal Processing*\n\n*Processed:* ${results.processed} tenants\n*Reminders sent:* ${results.reminders_sent}\n*New renewals tracked:* ${results.renewals_created}\n*Skipped:* ${results.skipped}\n*Errors:* ${results.errors.length}`
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
          message: 'Scheduled renewal processing completed',
          results
        })
      }
    }

    const requestData = JSON.parse(event.body)
    
    // Determinar acción
    switch (requestData.action) {
      case 'process': {
        const validatedData = processRenewalsSchema.parse(requestData)
        const results = await processRenewals(validatedData)
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            results,
            message: `Processed ${results.processed} renewals, sent ${results.reminders_sent} reminders`
          })
        }
      }

      case 'update': {
        const validatedData = updateRenewalSchema.parse(requestData)
        const renewal = await updateRenewal(validatedData)
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            renewal,
            message: 'Renewal updated successfully'
          })
        }
      }

      case 'list': {
        const validatedData = getRenewalsSchema.parse(requestData)
        const renewals = await getRenewals(validatedData)
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            renewals,
            total: renewals.length
          })
        }
      }

      default:
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Invalid action. Must be: process, update, or list' })
        }
    }

  } catch (error) {
    console.error('Renewal dunning function error:', error)
    
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