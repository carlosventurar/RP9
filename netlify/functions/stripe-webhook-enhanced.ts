import { Handler, HandlerEvent } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const stripeSecretKey = process.env.STRIPE_SECRET_KEY!
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

const supabase = createClient(supabaseUrl, supabaseServiceKey)
const stripe = new Stripe(stripeSecretKey, { apiVersion: '2023-10-16' })

export const handler: Handler = async (event: HandlerEvent) => {
  console.log('🔔 Stripe webhook received at:', new Date().toISOString())

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' }
  }

  const sig = event.headers['stripe-signature'] as string
  if (!sig) {
    return { statusCode: 400, body: 'Missing Stripe signature' }
  }

  let stripeEvent: Stripe.Event

  try {
    stripeEvent = stripe.webhooks.constructEvent(event.body!, sig, stripeWebhookSecret)
    console.log(`✅ Verified webhook event: ${stripeEvent.type}`)
  } catch (error) {
    console.error('❌ Webhook verification failed:', error)
    return { 
      statusCode: 400, 
      body: `Webhook Error: ${error instanceof Error ? error.message : 'Unknown error'}` 
    }
  }

  try {
    await handleWebhookEvent(stripeEvent)
    console.log(`✅ Successfully processed event: ${stripeEvent.type}`)
    
    return { 
      statusCode: 200, 
      body: JSON.stringify({ received: true, processed: stripeEvent.type }) 
    }

  } catch (error) {
    console.error(`❌ Error processing webhook event ${stripeEvent.type}:`, error)
    
    // Log the error to billing_events table
    await logBillingEvent(null, 'webhook_error', stripeEvent.id, {
      event_type: stripeEvent.type,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    })

    return { 
      statusCode: 500, 
      body: JSON.stringify({ 
        error: 'Webhook processing failed',
        event_type: stripeEvent.type,
        details: error instanceof Error ? error.message : 'Unknown error'
      }) 
    }
  }
}

async function handleWebhookEvent(event: Stripe.Event) {
  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutCompleted(event)
      break

    case 'invoice.paid':
      await handleInvoicePaid(event)
      break

    case 'invoice.payment_failed':
      await handlePaymentFailed(event)
      break

    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      await handleSubscriptionUpdated(event)
      break

    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(event)
      break

    default:
      console.log(`Unhandled event type: ${event.type}`)
      // Still log it for monitoring
      await logBillingEvent(null, 'webhook_unhandled', event.id, {
        event_type: event.type,
        data: event.data
      })
  }
}

async function handleCheckoutCompleted(event: Stripe.Event) {
  const session = event.data.object as Stripe.Checkout.Session
  
  if (!session.metadata?.tenant_id) {
    console.error('No tenant_id in checkout session metadata')
    return
  }

  const tenantId = session.metadata.tenant_id
  const planKey = session.metadata.plan_key

  console.log(`💰 Checkout completed for tenant ${tenantId}, plan: ${planKey}`)

  // Create or update subscription record
  const subscriptionData = {
    tenant_id: tenantId,
    stripe_customer_id: session.customer as string,
    stripe_subscription_id: session.subscription as string,
    status: 'active',
    current_period_end: null // Will be updated when subscription webhook fires
  }

  const { error } = await supabase
    .from('subscriptions')
    .upsert(subscriptionData, {
      onConflict: 'tenant_id'
    })

  if (error) {
    console.error('Error creating/updating subscription:', error)
    throw error
  }

  // Update tenant plan
  if (planKey) {
    await supabase
      .from('tenants')
      .update({ plan: planKey })
      .eq('id', tenantId)
  }

  // Log the event
  await logBillingEvent(tenantId, 'checkout.completed', session.id, {
    customer_id: session.customer,
    subscription_id: session.subscription,
    plan_key: planKey,
    amount_total: session.amount_total
  })
}

async function handleInvoicePaid(event: Stripe.Event) {
  const invoice = event.data.object as Stripe.Invoice
  
  const tenantId = await getTenantIdFromCustomer(invoice.customer as string)
  if (!tenantId) return

  console.log(`✅ Invoice paid for tenant ${tenantId}`)

  // Update subscription period if this is a subscription invoice
  if (invoice.subscription) {
    const { error } = await supabase
      .from('subscriptions')
      .update({
        status: 'active',
        current_period_end: new Date(invoice.period_end * 1000).toISOString()
      })
      .eq('stripe_subscription_id', invoice.subscription)

    if (error) {
      console.error('Error updating subscription period:', error)
    }
  }

  await logBillingEvent(tenantId, 'invoice.paid', invoice.id, {
    amount_paid: invoice.amount_paid,
    subscription_id: invoice.subscription,
    period_start: invoice.period_start,
    period_end: invoice.period_end
  })
}

async function handlePaymentFailed(event: Stripe.Event) {
  const invoice = event.data.object as Stripe.Invoice
  
  const tenantId = await getTenantIdFromCustomer(invoice.customer as string)
  if (!tenantId) return

  console.log(`❌ Payment failed for tenant ${tenantId}`)

  // Update subscription status
  if (invoice.subscription) {
    await supabase
      .from('subscriptions')
      .update({ status: 'past_due' })
      .eq('stripe_subscription_id', invoice.subscription)
  }

  await logBillingEvent(tenantId, 'invoice.payment_failed', invoice.id, {
    amount_due: invoice.amount_due,
    attempt_count: invoice.attempt_count,
    subscription_id: invoice.subscription
  })

  // Trigger dunning process
  await initiateDunningProcess(tenantId, invoice.id)
}

async function handleSubscriptionUpdated(event: Stripe.Event) {
  const subscription = event.data.object as Stripe.Subscription
  
  const tenantId = await getTenantIdFromCustomer(subscription.customer as string)
  if (!tenantId) return

  console.log(`📝 Subscription updated for tenant ${tenantId}`)

  const subscriptionData = {
    status: subscription.status,
    current_period_end: new Date(subscription.current_period_end * 1000).toISOString()
  }

  const { error } = await supabase
    .from('subscriptions')
    .update(subscriptionData)
    .eq('stripe_subscription_id', subscription.id)

  if (error) {
    console.error('Error updating subscription:', error)
    throw error
  }

  await logBillingEvent(tenantId, 'subscription.updated', subscription.id, {
    status: subscription.status,
    current_period_end: subscription.current_period_end
  })
}

async function handleSubscriptionDeleted(event: Stripe.Event) {
  const subscription = event.data.object as Stripe.Subscription
  
  const tenantId = await getTenantIdFromCustomer(subscription.customer as string)
  if (!tenantId) return

  console.log(`🗑️ Subscription deleted for tenant ${tenantId}`)

  // Update subscription status
  await supabase
    .from('subscriptions')
    .update({ status: 'canceled' })
    .eq('stripe_subscription_id', subscription.id)

  // Downgrade tenant to starter plan
  await supabase
    .from('tenants')
    .update({ plan: 'starter' })
    .eq('id', tenantId)

  await logBillingEvent(tenantId, 'subscription.deleted', subscription.id, {
    canceled_at: subscription.canceled_at,
    ended_at: subscription.ended_at
  })
}

async function getTenantIdFromCustomer(customerId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('tenant_id')
    .eq('stripe_customer_id', customerId)
    .single()

  if (error || !data) {
    console.error('Could not find tenant for customer:', customerId)
    return null
  }

  return data.tenant_id
}

async function logBillingEvent(tenantId: string | null, type: string, ref: string, payload: any) {
  const { error } = await supabase
    .from('billing_events')
    .insert({
      tenant_id: tenantId,
      type: type,
      ref: ref,
      payload: payload
    })

  if (error) {
    console.error('Error logging billing event:', error)
  }
}

async function initiateDunningProcess(tenantId: string, invoiceId: string) {
  // This would trigger the dunning process
  // For now, just log it - the actual dunning will be handled by the dunning-run function
  console.log(`🔔 Initiating dunning process for tenant ${tenantId}, invoice ${invoiceId}`)
  
  await logBillingEvent(tenantId, 'dunning.initiated', invoiceId, {
    initiated_at: new Date().toISOString()
  })
}