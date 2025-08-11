import { Handler, HandlerEvent } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import { featureFlagService } from '../../src/lib/feature-flags'
import Stripe from 'stripe'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const stripeSecretKey = process.env.STRIPE_SECRET_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null

interface DunningNotification {
  tenant_id: string
  type: 'payment_failed' | 'payment_retry' | 'subscription_suspended' | 'final_notice'
  channel: 'email' | 'whatsapp'
  subject: string
  message: string
  attempt_number: number
  next_retry_date?: string
}

export const handler: Handler = async (event: HandlerEvent) => {
  console.log('💳 Dunning system started at:', new Date().toISOString())

  try {
    // Get all tenants with failed payments or past due subscriptions
    const { data: failedSubscriptions, error: subscriptionsError } = await supabase
      .from('subscriptions')
      .select(`
        id, 
        tenant_id, 
        status, 
        current_period_end,
        stripe_subscription_id,
        tenants!inner(id, name, owner_user_id, plan)
      `)
      .in('status', ['past_due', 'unpaid', 'incomplete'])

    if (subscriptionsError) {
      console.error('Error fetching failed subscriptions:', subscriptionsError)
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to fetch subscriptions' })
      }
    }

    if (!failedSubscriptions || failedSubscriptions.length === 0) {
      console.log('No failed subscriptions found')
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'No failed subscriptions to process' })
      }
    }

    const results = []

    for (const subscription of failedSubscriptions) {
      try {
        const result = await processDunning(subscription)
        results.push({
          tenant_id: subscription.tenant_id,
          subscription_id: subscription.id,
          status: subscription.status,
          ...result
        })
      } catch (error) {
        console.error(`Error processing subscription ${subscription.id}:`, error)
        results.push({
          tenant_id: subscription.tenant_id,
          subscription_id: subscription.id,
          error: error instanceof Error ? error.message : 'Unknown error',
          notifications_sent: 0
        })
      }
    }

    const totals = results.reduce((acc, result) => {
      acc.notifications_sent += result.notifications_sent || 0
      acc.subscriptions_suspended += result.action === 'suspend' ? 1 : 0
      acc.errors += result.error ? 1 : 0
      return acc
    }, { notifications_sent: 0, subscriptions_suspended: 0, errors: 0 })

    console.log('✅ Dunning processing completed:', totals)

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        timestamp: new Date().toISOString(),
        summary: totals,
        results: results
      })
    }

  } catch (error) {
    console.error('Fatal error in dunning system:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
}

async function processDunning(subscription: any) {
  const tenant = subscription.tenants
  const daysPastDue = calculateDaysPastDue(subscription.current_period_end)
  
  console.log(`Processing dunning for tenant ${tenant.name}: ${daysPastDue} days past due`)

  // Get dunning history for this subscription
  const { data: dunningHistory } = await supabase
    .from('audit_logs')
    .select('details')
    .eq('tenant_id', tenant.id)
    .eq('action', 'dunning_notification')
    .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()) // Last 30 days
    .order('created_at', { ascending: false })

  const previousAttempts = dunningHistory?.length || 0
  const notifications: DunningNotification[] = []

  // Dunning sequence based on days past due
  if (daysPastDue >= 1 && daysPastDue <= 3) {
    // Day 1-3: First gentle reminder
    notifications.push(await createDunningNotification(
      tenant,
      'payment_failed',
      'email',
      1,
      `Payment Failed - Please Update Your Payment Method`,
      `Hi ${tenant.name},\n\nWe couldn't process your payment. Please update your payment method to continue using RP9.`
    ))

  } else if (daysPastDue >= 4 && daysPastDue <= 7) {
    // Day 4-7: Second reminder with urgency
    notifications.push(await createDunningNotification(
      tenant,
      'payment_retry',
      'email',
      2,
      `Action Required - Payment Method Update Needed`,
      `Hi ${tenant.name},\n\nYour payment is now 4+ days overdue. Please update your payment method immediately to avoid service interruption.`
    ))

    // Add WhatsApp notification if enabled
    const whatsappEnabled = await featureFlagService.isEnabled('whatsapp_notifications', {
      tenantId: tenant.id,
      plan: tenant.plan
    })

    if (whatsappEnabled) {
      notifications.push(await createDunningNotification(
        tenant,
        'payment_retry',
        'whatsapp',
        2,
        `RP9 Payment Update Required`,
        `Your RP9 payment is overdue. Update your payment method: https://rp99.netlify.app/billing`
      ))
    }

  } else if (daysPastDue >= 8 && daysPastDue <= 14) {
    // Day 8-14: Service suspension warning
    notifications.push(await createDunningNotification(
      tenant,
      'subscription_suspended',
      'email',
      3,
      `Final Notice - Service Will Be Suspended`,
      `Hi ${tenant.name},\n\nYour RP9 service will be suspended in 48 hours if payment is not received. All workflows will be paused.`
    ))

  } else if (daysPastDue >= 15) {
    // Day 15+: Final notice and suspend service
    notifications.push(await createDunningNotification(
      tenant,
      'final_notice',
      'email',
      4,
      `Service Suspended - Immediate Action Required`,
      `Hi ${tenant.name},\n\nYour RP9 service has been suspended due to non-payment. Update your payment method to restore access.`
    ))

    // Suspend tenant workflows
    await suspendTenantService(tenant.id)
    
    return {
      action: 'suspend',
      notifications_sent: notifications.length,
      days_past_due: daysPastDue
    }
  }

  // Send notifications
  for (const notification of notifications) {
    await sendDunningNotification(notification)
    await logDunningNotification(notification)
  }

  return {
    action: 'notify',
    notifications_sent: notifications.length,
    days_past_due: daysPastDue,
    attempt_number: previousAttempts + 1
  }
}

function calculateDaysPastDue(currentPeriodEnd: string): number {
  const endDate = new Date(currentPeriodEnd)
  const now = new Date()
  const diffTime = now.getTime() - endDate.getTime()
  return Math.floor(diffTime / (1000 * 60 * 60 * 24))
}

async function createDunningNotification(
  tenant: any,
  type: DunningNotification['type'],
  channel: DunningNotification['channel'],
  attemptNumber: number,
  subject: string,
  message: string
): Promise<DunningNotification> {
  return {
    tenant_id: tenant.id,
    type,
    channel,
    subject,
    message,
    attempt_number: attemptNumber,
    next_retry_date: calculateNextRetryDate(attemptNumber)
  }
}

function calculateNextRetryDate(attemptNumber: number): string {
  const daysToAdd = [0, 3, 4, 7, 15][Math.min(attemptNumber - 1, 4)] || 15
  const nextDate = new Date()
  nextDate.setDate(nextDate.getDate() + daysToAdd)
  return nextDate.toISOString()
}

async function sendDunningNotification(notification: DunningNotification) {
  console.log(`📧 DUNNING NOTIFICATION for tenant ${notification.tenant_id}:`, {
    type: notification.type,
    channel: notification.channel,
    attempt: notification.attempt_number,
    subject: notification.subject
  })

  // Get tenant user email for notifications
  const { data: tenant } = await supabase
    .from('tenants')
    .select(`
      owner_user_id,
      auth.users!inner(email)
    `)
    .eq('id', notification.tenant_id)
    .single()

  if (!tenant) {
    console.error(`Tenant ${notification.tenant_id} not found for notification`)
    return
  }

  if (notification.channel === 'email') {
    await sendEmailNotification(notification, tenant.users?.email)
  } else if (notification.channel === 'whatsapp') {
    await sendWhatsAppNotification(notification)
  }
}

async function sendEmailNotification(notification: DunningNotification, userEmail: string) {
  // In production, integrate with email service (SendGrid, AWS SES, etc.)
  console.log(`📧 EMAIL: ${notification.subject} to ${userEmail}`)
  
  // For now, just log. In production:
  /*
  await emailService.send({
    to: userEmail,
    subject: notification.subject,
    html: generateEmailTemplate(notification),
    tags: ['dunning', notification.type]
  })
  */
}

async function sendWhatsAppNotification(notification: DunningNotification) {
  // In production, integrate with WhatsApp Business API
  console.log(`💬 WHATSAPP: ${notification.message}`)
  
  // For now, just log. In production:
  /*
  await whatsappService.send({
    to: tenantPhoneNumber,
    message: notification.message,
    type: 'text'
  })
  */
}

async function suspendTenantService(tenantId: string) {
  // Suspend tenant's workflows and API access
  await supabase
    .from('tenants')
    .update({
      settings: {
        service_suspended: true,
        suspended_at: new Date().toISOString(),
        suspension_reason: 'payment_failure',
        throttle_enabled: true,
        rate_limit_per_minute: 0 // Completely block API access
      }
    })
    .eq('id', tenantId)

  console.log(`🔴 SUSPENDED tenant service: ${tenantId}`)

  // Log suspension action
  await supabase
    .from('audit_logs')
    .insert({
      tenant_id: tenantId,
      user_id: null,
      action: 'service_suspension',
      resource: 'billing',
      resource_id: tenantId,
      details: {
        reason: 'payment_failure',
        suspended_at: new Date().toISOString(),
        automatic: true
      }
    })
}

async function logDunningNotification(notification: DunningNotification) {
  await supabase
    .from('audit_logs')
    .insert({
      tenant_id: notification.tenant_id,
      user_id: null,
      action: 'dunning_notification',
      resource: 'billing',
      resource_id: notification.tenant_id,
      details: {
        notification_type: notification.type,
        channel: notification.channel,
        attempt_number: notification.attempt_number,
        subject: notification.subject,
        next_retry_date: notification.next_retry_date,
        sent_at: new Date().toISOString()
      }
    })
}

// Utility function to restore service when payment is successful
export async function restoreTenantService(tenantId: string) {
  await supabase
    .from('tenants')
    .update({
      settings: {
        service_suspended: false,
        suspended_at: null,
        suspension_reason: null,
        throttle_enabled: false,
        rate_limit_per_minute: null
      }
    })
    .eq('id', tenantId)

  // Log restoration
  await supabase
    .from('audit_logs')
    .insert({
      tenant_id: tenantId,
      user_id: null,
      action: 'service_restoration',
      resource: 'billing',
      resource_id: tenantId,
      details: {
        restored_at: new Date().toISOString(),
        reason: 'payment_successful'
      }
    })

  console.log(`✅ RESTORED tenant service: ${tenantId}`)
}