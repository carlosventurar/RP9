import { Handler } from '@netlify/functions'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2023-10-16' })

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' }
  const body = JSON.parse(event.body || '{}')
  const { tenantId, plan, interval='month', addons=[] } = body

  const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = []

  const priceMap: Record<string, string> = {
    'starter:month': process.env.STRIPE_PRICE_STARTER!,
    'starter:year': process.env.STRIPE_PRICE_STARTER_YEARLY!,
    'pro:month': process.env.STRIPE_PRICE_PRO!,
    'pro:year': process.env.STRIPE_PRICE_PRO_YEARLY!,
  }

  const planKey = `${plan}:${interval === 'year' ? 'year' : 'month'}`
  if (!priceMap[planKey]) return { statusCode: 400, body: 'Invalid plan/interval' }
  line_items.push({ price: priceMap[planKey], quantity: 1 })

  const packs: Record<string,string> = {
    'pack_10k': process.env.STRIPE_PRICE_PACK_10K!,
    'pack_50k': process.env.STRIPE_PRICE_PACK_50K!,
    'pack_100k': process.env.STRIPE_PRICE_PACK_100K!,
  }
  addons.forEach((a:string)=> { if (packs[a]) line_items.push({ price: packs[a], quantity: 1 }) })

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items,
    success_url: `${event.headers.origin || 'https://app.rp9.io'}/billing?success=1`,
    cancel_url: `${event.headers.origin || 'https://app.rp9.io'}/billing?canceled=1`,
    metadata: { tenantId, plan, interval },
    allow_promotion_codes: true
  })

  return { statusCode: 200, body: JSON.stringify({ url: session.url }) }
}
