import { Handler, HandlerEvent } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const stripeSecretKey = process.env.STRIPE_SECRET_KEY!
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

const supabase = createClient(supabaseUrl, supabaseServiceKey)
const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2023-10-16'
})

export const handler: Handler = async (event: HandlerEvent) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, stripe-signature',
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
    const signature = event.headers['stripe-signature']
    
    if (!signature) {
      console.error('Missing Stripe signature')
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing Stripe signature' })
      }
    }

    // Verify webhook signature
    let stripeEvent: Stripe.Event
    try {
      stripeEvent = stripe.webhooks.constructEvent(
        event.body!,
        signature,
        stripeWebhookSecret
      )
    } catch (err) {
      console.error('Webhook signature verification failed:', err)
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid signature' })
      }
    }

    console.log('Processing Stripe webhook event:', stripeEvent.type)

    // Handle different event types
    switch (stripeEvent.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(stripeEvent.data.object as Stripe.Checkout.Session)
        break

      case 'payment_intent.succeeded':
        await handlePaymentSucceeded(stripeEvent.data.object as Stripe.PaymentIntent)
        break

      case 'payment_intent.payment_failed':
        await handlePaymentFailed(stripeEvent.data.object as Stripe.PaymentIntent)
        break

      case 'charge.dispute.created':
        await handleChargeDispute(stripeEvent.data.object as Stripe.Dispute)
        break

      case 'invoice.payment_action_required':
        // Handle SCA authentication required
        await handlePaymentActionRequired(stripeEvent.data.object as Stripe.Invoice)
        break

      default:
        console.log('Unhandled event type:', stripeEvent.type)
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ received: true })
    }

  } catch (error) {
    console.error('Webhook error:', error)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Webhook processing failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
}

/**
 * Handle successful checkout completion
 */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  try {
    const tenantId = session.metadata?.tenant_id
    const templateId = session.metadata?.template_id
    const userId = session.metadata?.user_id

    if (!tenantId || !templateId || !userId) {
      console.error('Missing metadata in checkout session:', session.id)
      return
    }

    // Get the payment intent to get payment details
    const paymentIntent = await stripe.paymentIntents.retrieve(session.payment_intent as string)

    // Get template details
    const { data: template, error: templateError } = await supabase
      .from('templates')
      .select('name, price, category')
      .eq('id', templateId)
      .single()

    if (templateError || !template) {
      console.error('Template not found for purchase:', templateId)
      return
    }

    // Record the purchase
    const { error: purchaseError } = await supabase
      .from('template_purchases')
      .insert({
        tenant_id: tenantId,
        template_id: templateId,
        stripe_payment_intent_id: paymentIntent.id,
        amount_paid: (session.amount_total || 0) / 100, // Convert from cents
        purchased_at: new Date().toISOString(),
        metadata: {
          stripe_session_id: session.id,
          payment_method: paymentIntent.payment_method,
          receipt_url: session.payment_intent ? 
            `https://dashboard.stripe.com/payments/${paymentIntent.id}` : null,
          template_name: template.name,
          template_category: template.category
        }
      })

    if (purchaseError) {
      console.error('Error recording template purchase:', purchaseError)
      return
    }

    // Log successful purchase
    await supabase
      .from('audit_logs')
      .insert({
        tenant_id: tenantId,
        user_id: userId,
        action: 'template_purchased',
        resource: 'template',
        resource_id: templateId,
        details: {
          template_name: template.name,
          amount_paid: (session.amount_total || 0) / 100,
          stripe_session_id: session.id,
          stripe_payment_intent_id: paymentIntent.id,
          timestamp: new Date().toISOString()
        }
      })

    // Update template purchase count (for analytics)
    await supabase
      .rpc('increment_template_purchases', {
        template_id: templateId
      })

    console.log(`Template purchase recorded: ${templateId} for tenant ${tenantId}`)

  } catch (error) {
    console.error('Error handling checkout completion:', error)
  }
}

/**
 * Handle successful payment
 */
async function handlePaymentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  try {
    const tenantId = paymentIntent.metadata?.tenant_id
    const templateId = paymentIntent.metadata?.template_id

    if (!tenantId || !templateId) {
      console.log('Payment not related to template purchase:', paymentIntent.id)
      return
    }

    // Update purchase record with payment confirmation
    const { error } = await supabase
      .from('template_purchases')
      .update({
        metadata: {
          payment_confirmed: true,
          payment_confirmed_at: new Date().toISOString(),
          stripe_payment_intent_id: paymentIntent.id
        }
      })
      .eq('stripe_payment_intent_id', paymentIntent.id)

    if (error) {
      console.error('Error updating purchase with payment confirmation:', error)
    }

    console.log(`Payment confirmed for template purchase: ${templateId}`)

  } catch (error) {
    console.error('Error handling payment success:', error)
  }
}

/**
 * Handle failed payment
 */
async function handlePaymentFailed(paymentIntent: Stripe.PaymentIntent) {
  try {
    const tenantId = paymentIntent.metadata?.tenant_id
    const templateId = paymentIntent.metadata?.template_id
    const userId = paymentIntent.metadata?.user_id

    if (!tenantId || !templateId) {
      console.log('Payment failure not related to template purchase:', paymentIntent.id)
      return
    }

    // Log failed payment attempt
    await supabase
      .from('audit_logs')
      .insert({
        tenant_id: tenantId,
        user_id: userId,
        action: 'template_purchase_failed',
        resource: 'template',
        resource_id: templateId,
        details: {
          stripe_payment_intent_id: paymentIntent.id,
          failure_reason: paymentIntent.last_payment_error?.message || 'Unknown error',
          timestamp: new Date().toISOString()
        }
      })

    console.log(`Payment failed for template purchase: ${templateId}, reason: ${paymentIntent.last_payment_error?.message}`)

  } catch (error) {
    console.error('Error handling payment failure:', error)
  }
}

/**
 * Handle charge disputes (chargebacks)
 */
async function handleChargeDispute(dispute: Stripe.Dispute) {
  try {
    const charge = await stripe.charges.retrieve(dispute.charge as string)
    const paymentIntent = await stripe.paymentIntents.retrieve(charge.payment_intent as string)
    
    const tenantId = paymentIntent.metadata?.tenant_id
    const templateId = paymentIntent.metadata?.template_id

    if (!tenantId || !templateId) {
      console.log('Dispute not related to template purchase:', dispute.id)
      return
    }

    // Revoke template access on dispute
    const { error } = await supabase
      .from('template_purchases')
      .update({
        metadata: {
          disputed: true,
          disputed_at: new Date().toISOString(),
          dispute_id: dispute.id,
          access_revoked: true
        }
      })
      .eq('stripe_payment_intent_id', paymentIntent.id)

    if (error) {
      console.error('Error revoking template access for dispute:', error)
      return
    }

    // Log dispute
    await supabase
      .from('audit_logs')
      .insert({
        tenant_id: tenantId,
        action: 'template_purchase_disputed',
        resource: 'template',
        resource_id: templateId,
        details: {
          dispute_id: dispute.id,
          dispute_reason: dispute.reason,
          stripe_payment_intent_id: paymentIntent.id,
          timestamp: new Date().toISOString()
        }
      })

    console.log(`Template access revoked due to dispute: ${templateId} for tenant ${tenantId}`)

  } catch (error) {
    console.error('Error handling charge dispute:', error)
  }
}

/**
 * Handle payment action required (SCA)
 */
async function handlePaymentActionRequired(invoice: Stripe.Invoice) {
  try {
    // For template purchases, we use one-time payments, so this shouldn't happen often
    // But we'll log it for monitoring
    console.log('Payment action required for invoice:', invoice.id)
    
    // Could send email to customer about authentication required
    // For now, just log the event
    
  } catch (error) {
    console.error('Error handling payment action required:', error)
  }
}