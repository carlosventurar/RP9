import { loadStripe } from '@stripe/stripe-js'

const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!

let stripePromise: Promise<typeof import('@stripe/stripe-js').Stripe | null>

export const getStripe = () => {
  if (!stripePromise) {
    stripePromise = loadStripe(stripePublishableKey)
  }
  return stripePromise
}

// Plan configurations (Phase 1 pricing)
export const PLAN_CONFIG = {
  starter: {
    key: 'starter',
    name: 'Starter',
    price: 0,
    executions: 1000,
    workflows: 10,
    storage: '500MB',
    features: [
      'Basic workflows',
      'Standard support', 
      '30-day history',
      'Email notifications',
      'Basic templates'
    ]
  },
  pro: {
    key: 'pro', 
    name: 'Pro',
    price: 29,
    executions: 10000,
    workflows: 100,
    storage: '2GB',
    features: [
      'Advanced workflows',
      'Priority support',
      '90-day history', 
      'Custom integrations',
      'Premium templates',
      'Usage analytics',
      'API access'
    ]
  },
  enterprise: {
    key: 'enterprise',
    name: 'Enterprise', 
    price: 99,
    executions: -1, // unlimited
    workflows: -1, // unlimited
    storage: '10GB',
    features: [
      'Unlimited workflows',
      '24/7 dedicated support',
      '1-year history',
      'SSO authentication',
      'Custom integrations',
      'White-label options',
      'SLA guarantees',
      'Advanced security'
    ]
  }
} as const

export type PlanKey = keyof typeof PLAN_CONFIG

export async function createCheckoutSession(planKey: PlanKey, token: string) {
  const response = await fetch('/.netlify/functions/billing-checkout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      planKey,
      billingCycle: 'monthly'
    })
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to create checkout session')
  }

  return response.json()
}