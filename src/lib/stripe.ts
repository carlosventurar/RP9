import { loadStripe } from '@stripe/stripe-js'

const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!

let stripePromise: Promise<typeof import('@stripe/stripe-js').Stripe | null>

export const getStripe = () => {
  if (!stripePromise) {
    stripePromise = loadStripe(stripePublishableKey)
  }
  return stripePromise
}

// Plan configurations
export const PLAN_CONFIG = {
  starter: {
    key: 'starter',
    name: 'Inicial',
    price: 19,
    executions: 1000,
    workflows: 10,
    storage: '500MB',
    features: [
      '1,000 ejecuciones/mes',
      '10 workflows',
      '500MB storage',
      'Soporte por email'
    ]
  },
  pro: {
    key: 'pro', 
    name: 'Profesional',
    price: 49,
    executions: 10000,
    workflows: 50,
    storage: '1GB',
    features: [
      '10,000 ejecuciones/mes',
      '50 workflows', 
      '1GB storage',
      'Soporte prioritario'
    ]
  },
  enterprise: {
    key: 'enterprise',
    name: 'Empresarial', 
    price: 199,
    executions: -1, // unlimited
    workflows: -1, // unlimited
    storage: '10GB',
    features: [
      'Ejecuciones ilimitadas',
      'Workflows ilimitados',
      '10GB storage',
      'Soporte 24/7'
    ]
  }
} as const

export type PlanKey = keyof typeof PLAN_CONFIG

export async function createCheckoutSession(planKey: PlanKey, token: string) {
  const response = await fetch('/api/billing-checkout', {
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