import { Handler, HandlerEvent } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const stripeSecretKey = process.env.STRIPE_SECRET_KEY!
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

const supabase = createClient(supabaseUrl, supabaseServiceKey)
const stripe = new Stripe(stripeSecretKey)

export const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    }
  }

  const sig = event.headers['stripe-signature']
  let stripeEvent: Stripe.Event

  try {
    // Verify webhook signature
    stripeEvent = stripe.webhooks.constructEvent(
      event.body!,
      sig!,
      stripeWebhookSecret
    )
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Webhook signature verification failed' })
    }
  }

  try {
    // Handle the event
    switch (stripeEvent.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(stripeEvent.data.object as Stripe.Checkout.Session)
        break
      
      case 'customer.subscription.created':
        await handleSubscriptionCreated(stripeEvent.data.object as Stripe.Subscription)
        break
      
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(stripeEvent.data.object as Stripe.Subscription)
        break
      
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(stripeEvent.data.object as Stripe.Subscription)
        break
      
      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(stripeEvent.data.object as Stripe.Invoice)
        break
      
      case 'invoice.payment_failed':
        await handlePaymentFailed(stripeEvent.data.object as Stripe.Invoice)
        break
      
      default:
        console.log(`Unhandled event type: ${stripeEvent.type}`)
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ received: true })
    }

  } catch (error) {
    console.error('Webhook processing error:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Webhook processing failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const tenantId = session.metadata?.tenant_id
  const planKey = session.metadata?.plan_key

  if (!tenantId || !planKey) {
    console.error('Missing metadata in checkout session:', session.id)
    return
  }

  console.log(`Checkout completed for tenant ${tenantId}, plan ${planKey}`)
  
  // The subscription creation will be handled by subscription.created event
  // Here we just log the successful checkout
}

async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  const tenantId = subscription.metadata?.tenant_id
  const planKey = subscription.metadata?.plan_key

  if (!tenantId || !planKey) {
    console.error('Missing metadata in subscription:', subscription.id)
    return
  }

  console.log(`Creating subscription for tenant ${tenantId}`)

  // Upsert subscription record
  const { error } = await supabase
    .from('subscriptions')
    .upsert({
      tenant_id: tenantId,
      stripe_customer_id: subscription.customer as string,
      stripe_subscription_id: subscription.id,
      status: subscription.status as any,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      trial_end: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
      metadata: {
        plan_key: planKey,
        price_id: subscription.items.data[0]?.price.id
      }
    }, {
      onConflict: 'tenant_id'
    })

  if (error) {
    console.error('Error creating subscription record:', error)
    return
  }

  // Update tenant plan
  await supabase
    .from('tenants')
    .update({ plan: planKey })
    .eq('id', tenantId)

  console.log(`Subscription created successfully for tenant ${tenantId}`)
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const tenantId = subscription.metadata?.tenant_id

  if (!tenantId) {
    console.error('Missing tenant_id in subscription metadata:', subscription.id)
    return
  }

  console.log(`Updating subscription for tenant ${tenantId}`)

  const { error } = await supabase
    .from('subscriptions')
    .update({
      status: subscription.status as any,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      trial_end: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
      updated_at: new Date().toISOString()
    })
    .eq('stripe_subscription_id', subscription.id)

  if (error) {
    console.error('Error updating subscription:', error)
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const tenantId = subscription.metadata?.tenant_id

  if (!tenantId) {
    console.error('Missing tenant_id in subscription metadata:', subscription.id)
    return
  }

  console.log(`Subscription cancelled for tenant ${tenantId}`)

  // Update subscription status
  const { error } = await supabase
    .from('subscriptions')
    .update({
      status: 'canceled',
      updated_at: new Date().toISOString()
    })
    .eq('stripe_subscription_id', subscription.id)

  if (error) {
    console.error('Error updating cancelled subscription:', error)
    return
  }

  // Downgrade tenant to starter plan
  await supabase
    .from('tenants')
    .update({ plan: 'starter' })
    .eq('id', tenantId)
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  const subscriptionId = invoice.subscription as string
  
  if (!subscriptionId) return

  console.log(`Payment succeeded for subscription ${subscriptionId}`)
  
  // Update subscription status to active
  await supabase
    .from('subscriptions')
    .update({ 
      status: 'active',
      updated_at: new Date().toISOString()
    })
    .eq('stripe_subscription_id', subscriptionId)
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const subscriptionId = invoice.subscription as string
  
  if (!subscriptionId) return

  console.log(`Payment failed for subscription ${subscriptionId}`)
  
  // Update subscription status to past_due
  await supabase
    .from('subscriptions')
    .update({ 
      status: 'past_due',
      updated_at: new Date().toISOString()
    })
    .eq('stripe_subscription_id', subscriptionId)
}