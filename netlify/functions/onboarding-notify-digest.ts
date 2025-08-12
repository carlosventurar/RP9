import type { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface NotificationDigest {
  tenant_id: string
  user_id: string
  email: string
  tenant_name: string
  progress: {
    completed_tasks: number
    total_tasks: number
    percentage: number
    critical_pending: number
  }
  health_score: number
  is_activated: boolean
  next_steps: string[]
  days_since_signup: number
}

export const handler: Handler = async (event) => {
  try {
    // This function is typically called via scheduled function or webhook
    // For now, we'll handle manual triggers and scheduled runs
    
    const method = event.httpMethod || 'GET'
    
    if (method === 'POST') {
      // Manual trigger for specific tenant
      const { tenant_id } = JSON.parse(event.body || '{}')
      if (tenant_id) {
        const result = await sendDigestForTenant(tenant_id)
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(result)
        }
      }
    }

    // Scheduled run - find tenants that need digest notifications
    const tenantsToNotify = await findTenantsForDigest()
    
    const results = []
    for (const tenant of tenantsToNotify) {
      try {
        const result = await sendDigestForTenant(tenant.id)
        results.push({ tenant_id: tenant.id, ...result })
      } catch (error) {
        console.error(`Error sending digest to tenant ${tenant.id}:`, error)
        results.push({ 
          tenant_id: tenant.id, 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        })
      }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ok: true,
        processed: results.length,
        successful: results.filter(r => r.success).length,
        results: results
      })
    }

  } catch (error) {
    console.error('Error in notify-digest:', error)
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
}

async function findTenantsForDigest(): Promise<{id: string}[]> {
  // Find tenants that:
  // 1. Are not yet activated
  // 2. Signed up within the last 14 days
  // 3. Haven't received a digest in the last 24 hours
  
  const { data, error } = await supabase
    .rpc('get_tenants_for_digest', {
      days_since_signup: 14,
      hours_since_last_notification: 24
    })
    .limit(50) // Process max 50 tenants per run

  if (error) {
    console.error('Error finding tenants for digest:', error)
    return []
  }

  return data || []
}

async function sendDigestForTenant(tenantId: string): Promise<{success: boolean, channels: string[], error?: string}> {
  try {
    // Get tenant and user information
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select(`
        id, name, owner_user,
        created_at,
        users:auth.users!inner(email, created_at)
      `)
      .eq('id', tenantId)
      .single()

    if (tenantError || !tenant) {
      throw new Error('Tenant not found')
    }

    // Get onboarding progress
    const { data: progress } = await supabase
      .from('onboarding_progress')
      .select('task_key, status, onboarding_tasks(title, critical)')
      .eq('tenant_id', tenantId)

    const { data: allTasks } = await supabase
      .from('onboarding_tasks')
      .select('key, title, critical')

    // Calculate progress metrics
    const totalTasks = allTasks?.length || 0
    const completedTasks = progress?.filter(p => p.status === 'done').length || 0
    const criticalPending = progress?.filter(p => 
      p.status === 'pending' && p.onboarding_tasks?.critical
    ).length || 0

    // Get health score
    const { data: healthData } = await supabase
      .from('health_snapshots')
      .select('score')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(1)

    // Check activation status
    const isActivated = await checkActivationStatus(tenantId)

    // Calculate days since signup
    const daysSinceSignup = Math.floor(
      (new Date().getTime() - new Date(tenant.created_at).getTime()) / (1000 * 60 * 60 * 24)
    )

    // Generate personalized next steps
    const nextSteps = generateNextSteps(progress, isActivated, daysSinceSignup)

    const digestData: NotificationDigest = {
      tenant_id: tenantId,
      user_id: tenant.owner_user,
      email: tenant.users.email,
      tenant_name: tenant.name,
      progress: {
        completed_tasks: completedTasks,
        total_tasks: totalTasks,
        percentage: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
        critical_pending: criticalPending
      },
      health_score: healthData?.[0]?.score || 0,
      is_activated: isActivated,
      next_steps: nextSteps,
      days_since_signup: daysSinceSignup
    }

    // Send notifications through different channels
    const channels = []
    
    // In-app notification
    try {
      await createInAppNotification(digestData)
      channels.push('in-app')
    } catch (error) {
      console.error('Error creating in-app notification:', error)
    }

    // Email notification (placeholder - would integrate with email service)
    if (shouldSendEmail(digestData)) {
      try {
        await sendEmailDigest(digestData)
        channels.push('email')
      } catch (error) {
        console.error('Error sending email:', error)
      }
    }

    // WhatsApp notification (placeholder - would integrate with WA Business API)
    if (shouldSendWhatsApp(digestData)) {
      try {
        await sendWhatsAppDigest(digestData)
        channels.push('whatsapp')
      } catch (error) {
        console.error('Error sending WhatsApp:', error)
      }
    }

    return { success: true, channels }

  } catch (error) {
    return { 
      success: false, 
      channels: [], 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}

async function createInAppNotification(digest: NotificationDigest) {
  let message = ''
  let priority = 'normal'

  if (digest.progress.critical_pending > 0) {
    message = `Tienes ${digest.progress.critical_pending} tareas críticas pendientes para activar tu cuenta`
    priority = 'high'
  } else if (!digest.is_activated) {
    message = `Ya completaste ${digest.progress.completed_tasks}/${digest.progress.total_tasks} tareas. ¡Solo faltan unos pasos para activar tu cuenta!`
  } else {
    message = `¡Tu cuenta está activada! Health Score: ${digest.health_score}. Sigue explorando nuevas automatizaciones.`
  }

  await supabase
    .from('onboarding_notifications')
    .insert({
      tenant_id: digest.tenant_id,
      user_id: digest.user_id,
      type: 'digest',
      channel: 'in-app',
      meta: {
        message,
        priority,
        progress: digest.progress,
        health_score: digest.health_score,
        next_steps: digest.next_steps,
        days_since_signup: digest.days_since_signup
      }
    })
}

async function sendEmailDigest(digest: NotificationDigest): Promise<void> {
  // Placeholder for email service integration (SendGrid, Mailgun, etc.)
  console.log(`Would send email digest to ${digest.email}`, {
    subject: `Tu progreso en RP9: ${digest.progress.percentage}% completado`,
    template: 'onboarding_digest',
    data: digest
  })
  
  // In a real implementation, you would:
  // 1. Use an email service provider API
  // 2. Load email template
  // 3. Personalize with digest data
  // 4. Send email
  // 5. Track delivery status
}

async function sendWhatsAppDigest(digest: NotificationDigest): Promise<void> {
  // Placeholder for WhatsApp Business API integration
  console.log(`Would send WhatsApp digest to tenant ${digest.tenant_id}`, {
    template: 'onboarding_digest_wa',
    data: digest
  })
  
  // In a real implementation, you would:
  // 1. Use WhatsApp Business API
  // 2. Load approved message template
  // 3. Send structured message
  // 4. Track delivery status
}

function shouldSendEmail(digest: NotificationDigest): boolean {
  // Send email for:
  // - Day 1, 3, 7, 14 if not activated
  // - Critical tasks pending
  return (
    !digest.is_activated && 
    ([1, 3, 7, 14].includes(digest.days_since_signup) || digest.progress.critical_pending > 0)
  )
}

function shouldSendWhatsApp(digest: NotificationDigest): boolean {
  // Send WhatsApp for:
  // - Day 7 if not activated
  // - High value accounts with critical tasks
  return (
    !digest.is_activated && 
    (digest.days_since_signup === 7 || digest.progress.critical_pending >= 2)
  )
}

function generateNextSteps(progress: any[], isActivated: boolean, daysSince: number): string[] {
  if (isActivated) {
    return [
      'Explora el catálogo de templates para más automatizaciones',
      'Revisa las métricas en tu dashboard',
      'Configura alertas para tus workflows críticos'
    ]
  }

  const steps = []
  const pendingTasks = progress?.filter(p => p.status === 'pending').map(p => p.task_key) || []

  if (pendingTasks.includes('execute_mock')) {
    steps.push('Ejecuta la plantilla demo para ver resultados inmediatos')
  }
  
  if (pendingTasks.includes('configure_real')) {
    steps.push('Configura tus credenciales en la plantilla de producción')
  }

  if (pendingTasks.includes('first_business_outcome')) {
    steps.push('Genera tu primer resultado de negocio')
  }

  if (steps.length === 0) {
    steps.push('Completa las tareas restantes para activar tu cuenta')
  }

  if (daysSince >= 7) {
    steps.push('¿Necesitas ayuda? Agenda una llamada de 15 minutos con nuestro equipo')
  }

  return steps
}

async function checkActivationStatus(tenantId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .rpc('is_tenant_activated', { p_tenant_id: tenantId })

    if (error) {
      console.error('Error checking activation status:', error)
      return false
    }

    return data || false
  } catch (error) {
    console.error('Error in activation check:', error)
    return false
  }
}