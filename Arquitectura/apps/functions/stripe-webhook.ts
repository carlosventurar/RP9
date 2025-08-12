import { Handler } from '@netlify/functions'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2023-10-16' })

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' }
  const sig = event.headers['stripe-signature'] as string
  try {
    const evt = stripe.webhooks.constructEvent(event.body as any, sig, process.env.STRIPE_WEBHOOK_SECRET!)
    // TODO: persistir en Supabase 'billing_events' y actualizar 'subscriptions'
    switch (evt.type) {
      case 'checkout.session.completed':
      case 'invoice.paid':
      case 'invoice.payment_failed':
      case 'customer.subscription.updated':
        break;
    }
    return { statusCode: 200, body: JSON.stringify({ received: true }) }
  } catch (e:any) {
    return { statusCode: 400, body: `Webhook Error: ${e.message}` }
  }
}
