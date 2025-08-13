import { Handler, HandlerEvent } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-04-10'
})

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

export const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    }
  }

  let stripeEvent: Stripe.Event

  try {
    // Verificar webhook signature
    const signature = event.headers['stripe-signature']
    if (!signature) {
      console.error('Missing Stripe signature header')
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing signature' })
      }
    }

    stripeEvent = stripe.webhooks.constructEvent(
      event.body!,
      signature,
      webhookSecret
    )

  } catch (error) {
    console.error('Webhook signature verification failed:', error)
    return {
      statusCode: 400,
      body: JSON.stringify({ 
        error: 'Webhook signature verification failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  console.log(`Processing Stripe webhook: ${stripeEvent.type}`)

  try {
    switch (stripeEvent.type) {
      // Checkout completado (one-off payments)
      case 'checkout.session.completed':
        await handleCheckoutCompleted(stripeEvent.data.object as Stripe.Checkout.Session)
        break

      // Factura pagada (subscriptions)
      case 'invoice.paid':
        await handleInvoicePaid(stripeEvent.data.object as Stripe.Invoice)
        break

      // Factura falló (subscription payment failed)
      case 'invoice.payment_failed':
        await handleInvoiceFailed(stripeEvent.data.object as Stripe.Invoice)
        break

      // Suscripción actualizada
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(stripeEvent.data.object as Stripe.Subscription)
        break

      // Suscripción cancelada
      case 'customer.subscription.deleted':
        await handleSubscriptionCanceled(stripeEvent.data.object as Stripe.Subscription)
        break

      // Reembolso procesado
      case 'charge.dispute.created':
      case 'payment_intent.refunded':
        await handleRefundProcessed(stripeEvent.data.object as Stripe.PaymentIntent)
        break

      // Connect: Transfer creado (payout a creator)
      case 'transfer.created':
        await handleTransferCreated(stripeEvent.data.object as Stripe.Transfer)
        break

      // Connect: Transfer falló
      case 'transfer.failed':
        await handleTransferFailed(stripeEvent.data.object as Stripe.Transfer)
        break

      default:
        console.log(`Unhandled webhook event type: ${stripeEvent.type}`)
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ received: true, type: stripeEvent.type })
    }

  } catch (error) {
    console.error(`Error processing webhook ${stripeEvent.type}:`, error)
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Webhook processing failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
}

// Handler: Checkout Session Completed
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const { 
    id: sessionId,
    customer,
    payment_intent,
    subscription,
    amount_total,
    currency,
    metadata = {}
  } = session

  const {
    tenant_id,
    user_id,
    item_id,
    purchase_type,
    creator_id,
    revenue_share_bps
  } = metadata

  if (!tenant_id || !item_id || !purchase_type) {
    console.error('Missing required metadata in checkout session:', metadata)
    return
  }

  console.log(`Processing checkout completion for item ${item_id}, tenant ${tenant_id}`)

  // Actualizar o crear purchase record
  const purchaseData = {
    tenant_id,
    buyer_user: user_id,
    item_id,
    stripe_customer_id: customer as string,
    stripe_payment_intent_id: payment_intent as string,
    stripe_subscription_id: subscription as string || null,
    currency,
    amount_cents: amount_total || 0,
    kind: purchase_type,
    status: 'active',
    starts_at: new Date().toISOString(),
    expires_at: purchase_type === 'subscription' ? null : null,
    updated_at: new Date().toISOString()
  }

  const { data: purchase, error: purchaseError } = await supabase
    .from('purchases')
    .upsert(purchaseData, {
      onConflict: 'stripe_payment_intent_id',
      ignoreDuplicates: false
    })
    .select()
    .single()

  if (purchaseError) {
    console.error('Failed to update purchase:', purchaseError)
    throw new Error(`Purchase update failed: ${purchaseError.message}`)
  }

  // Crear earnings para creator si existe
  if (creator_id && revenue_share_bps && amount_total) {
    await createCreatorEarnings(
      creator_id,
      item_id,
      purchase.id,
      amount_total,
      parseInt(revenue_share_bps),
      currency
    )
  }

  console.log(`Successfully processed checkout for purchase ${purchase.id}`)
}

// Handler: Invoice Paid (recurring subscriptions)
async function handleInvoicePaid(invoice: Stripe.Invoice) {
  if (invoice.billing_reason === 'subscription_create') {
    // Primera factura ya manejada en checkout.session.completed
    return
  }

  const subscription = invoice.subscription as string
  if (!subscription) return

  // Buscar purchase por subscription_id
  const { data: purchase, error } = await supabase
    .from('purchases')
    .select('*')
    .eq('stripe_subscription_id', subscription)
    .single()

  if (error || !purchase) {
    console.error('Purchase not found for subscription:', subscription)
    return
  }

  // Crear earnings para creator si es renovación
  const { data: item } = await supabase
    .from('marketplace_items')
    .select('creators!marketplace_items_owner_creator_fkey(id), revenue_share_bps')
    .eq('id', purchase.item_id)
    .single()

  if (item?.creators?.id && item.revenue_share_bps && invoice.amount_paid) {
    await createCreatorEarnings(
      item.creators.id,
      purchase.item_id,
      purchase.id,
      invoice.amount_paid,
      item.revenue_share_bps,
      invoice.currency
    )
  }

  console.log(`Processed subscription renewal for purchase ${purchase.id}`)
}

// Handler: Invoice Payment Failed
async function handleInvoiceFailed(invoice: Stripe.Invoice) {
  const subscription = invoice.subscription as string
  if (!subscription) return

  // Actualizar status a failed (temporal)
  const { error } = await supabase
    .from('purchases')
    .update({ 
      status: 'payment_failed',
      updated_at: new Date().toISOString()
    })
    .eq('stripe_subscription_id', subscription)

  if (error) {
    console.error('Failed to update purchase status:', error)
  }

  console.log(`Marked subscription payment as failed: ${subscription}`)
}

// Handler: Subscription Updated
async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const { id, status, cancel_at_period_end, current_period_end } = subscription

  let purchaseStatus = 'active'
  if (status === 'canceled') purchaseStatus = 'canceled'
  else if (status === 'past_due') purchaseStatus = 'past_due'
  else if (cancel_at_period_end) purchaseStatus = 'canceling'

  const expiresAt = current_period_end 
    ? new Date(current_period_end * 1000).toISOString()
    : null

  const { error } = await supabase
    .from('purchases')
    .update({ 
      status: purchaseStatus,
      expires_at: expiresAt,
      updated_at: new Date().toISOString()
    })
    .eq('stripe_subscription_id', id)

  if (error) {
    console.error('Failed to update subscription status:', error)
  }

  console.log(`Updated subscription ${id} to status ${purchaseStatus}`)
}

// Handler: Subscription Canceled
async function handleSubscriptionCanceled(subscription: Stripe.Subscription) {
  const { id } = subscription

  const { error } = await supabase
    .from('purchases')
    .update({ 
      status: 'canceled',
      expires_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('stripe_subscription_id', id)

  if (error) {
    console.error('Failed to cancel purchase:', error)
  }

  console.log(`Canceled subscription purchase: ${id}`)
}

// Handler: Refund Processed
async function handleRefundProcessed(paymentIntent: Stripe.PaymentIntent) {
  const { id, charges } = paymentIntent

  // Obtener el charge refunded
  const refundedCharge = charges.data.find(charge => charge.refunded)
  if (!refundedCharge) return

  // Actualizar purchase status
  const { error } = await supabase
    .from('purchases')
    .update({ 
      status: 'refunded',
      updated_at: new Date().toISOString()
    })
    .eq('stripe_payment_intent_id', id)

  if (error) {
    console.error('Failed to update refunded purchase:', error)
  }

  // Marcar earnings como no pagados si aún no se procesó payout
  await supabase
    .from('creator_earnings')
    .update({ paid_out: false })
    .eq('purchase_id', 'id')
    .eq('paid_out', false)

  console.log(`Processed refund for payment intent: ${id}`)
}

// Handler: Transfer Created (Payout exitoso)
async function handleTransferCreated(transfer: Stripe.Transfer) {
  const { id, destination, metadata = {} } = transfer
  const { payout_id } = metadata

  if (!payout_id) {
    console.warn('Transfer missing payout_id metadata:', id)
    return
  }

  // Actualizar status del payout
  const { error } = await supabase
    .from('payouts')
    .update({ 
      status: 'paid',
      stripe_transfer_id: id,
      paid_at: new Date().toISOString()
    })
    .eq('id', payout_id)

  if (error) {
    console.error('Failed to update payout status:', error)
  }

  console.log(`Transfer completed for payout ${payout_id}: ${id}`)
}

// Handler: Transfer Failed
async function handleTransferFailed(transfer: Stripe.Transfer) {
  const { id, metadata = {}, failure_message } = transfer
  const { payout_id } = metadata

  if (!payout_id) return

  // Actualizar status del payout a failed
  const { error } = await supabase
    .from('payouts')
    .update({ 
      status: 'failed',
      failure_reason: failure_message,
      stripe_transfer_id: id
    })
    .eq('id', payout_id)

  if (error) {
    console.error('Failed to update payout status:', error)
  }

  // Marcar earnings como no pagados para retry
  await supabase
    .from('creator_earnings')
    .update({ 
      paid_out: false,
      payout_id: null 
    })
    .eq('payout_id', payout_id)

  console.log(`Transfer failed for payout ${payout_id}: ${failure_message}`)
}

// Helper: Crear earnings para creator
async function createCreatorEarnings(
  creatorId: string,
  itemId: string,
  purchaseId: string,
  grossAmountCents: number,
  revenueShareBps: number,
  currency: string
) {
  try {
    // Calcular split usando función SQL
    const { data: split, error: splitError } = await supabase
      .rpc('calculate_earnings_split', {
        gross_cents: grossAmountCents,
        revenue_share_bps: revenueShareBps
      })
      .single()

    if (splitError || !split) {
      console.error('Failed to calculate earnings split:', splitError)
      return
    }

    // Crear registro de earnings
    const { error: earningsError } = await supabase
      .from('creator_earnings')
      .insert({
        creator_id: creatorId,
        item_id: itemId,
        purchase_id: purchaseId,
        gross_amount_cents: split.gross_amount_cents,
        fee_amount_cents: split.fee_amount_cents,
        net_amount_cents: split.net_amount_cents,
        currency,
        paid_out: false,
        earned_at: new Date().toISOString()
      })

    if (earningsError) {
      console.error('Failed to create creator earnings:', earningsError)
      return
    }

    // Actualizar total earnings del creator
    await supabase
      .rpc('update_creator_total_earnings', { 
        creator_uuid: creatorId 
      })

    console.log(`Created earnings for creator ${creatorId}: ${split.net_amount_cents} ${currency}`)

  } catch (error) {
    console.error('Error creating creator earnings:', error)
  }
}

// SQL Functions necesarias (agregar a migración):
/* 
create or replace function update_creator_total_earnings(creator_uuid uuid)
returns void as $$
begin
  update creators 
  set total_earnings_cents = (
    select coalesce(sum(net_amount_cents), 0)
    from creator_earnings 
    where creator_id = creator_uuid
  )
  where id = creator_uuid;
end;
$$ language plpgsql;
*/