import Stripe from 'stripe'

const stripeSecretKey = process.env.STRIPE_SECRET_KEY!
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null

export interface UsageReportData {
  tenant_id: string
  subscription_id: string
  executions: number
  duration_seconds: number
  period_start: Date
  period_end: Date
}

/**
 * Report usage to Stripe for metered billing
 * This function should be called periodically (e.g., daily or monthly)
 */
export async function reportUsageToStripe(usageData: UsageReportData): Promise<boolean> {
  if (!stripe) {
    console.warn('Stripe not configured, skipping usage reporting')
    return false
  }

  try {
    // Get subscription details from Stripe
    const subscription = await stripe.subscriptions.retrieve(usageData.subscription_id)
    
    if (!subscription || subscription.status !== 'active') {
      console.warn(`Subscription ${usageData.subscription_id} not active, skipping usage report`)
      return false
    }

    // Find the subscription items for metered products
    const executionItem = subscription.items.data.find(item => 
      item.price.metadata?.metric_type === 'executions'
    )
    
    const durationItem = subscription.items.data.find(item => 
      item.price.metadata?.metric_type === 'duration'
    )

    const results = []

    // Report execution usage
    if (executionItem && usageData.executions > 0) {
      try {
        const usageRecord = await stripe.subscriptionItems.createUsageRecord(
          executionItem.id,
          {
            quantity: usageData.executions,
            timestamp: Math.floor(usageData.period_end.getTime() / 1000),
            action: 'set' // Use 'set' to replace current usage, 'increment' to add
          },
          {
            idempotencyKey: `${usageData.tenant_id}-exec-${usageData.period_end.toISOString().slice(0, 10)}`
          }
        )
        
        console.log(`✅ Reported ${usageData.executions} executions to Stripe for tenant ${usageData.tenant_id}`)
        results.push({ metric: 'executions', success: true, quantity: usageData.executions })
        
      } catch (error) {
        console.error('Error reporting execution usage to Stripe:', error)
        results.push({ metric: 'executions', success: false, error: error })
      }
    }

    // Report duration usage (if configured)
    if (durationItem && usageData.duration_seconds > 0) {
      try {
        const usageRecord = await stripe.subscriptionItems.createUsageRecord(
          durationItem.id,
          {
            quantity: Math.ceil(usageData.duration_seconds), // Round up to nearest second
            timestamp: Math.floor(usageData.period_end.getTime() / 1000),
            action: 'set'
          },
          {
            idempotencyKey: `${usageData.tenant_id}-dur-${usageData.period_end.toISOString().slice(0, 10)}`
          }
        )
        
        console.log(`✅ Reported ${usageData.duration_seconds} seconds to Stripe for tenant ${usageData.tenant_id}`)
        results.push({ metric: 'duration', success: true, quantity: usageData.duration_seconds })
        
      } catch (error) {
        console.error('Error reporting duration usage to Stripe:', error)
        results.push({ metric: 'duration', success: false, error: error })
      }
    }

    // Return true if at least one metric was reported successfully
    return results.some(result => result.success)

  } catch (error) {
    console.error('Error in reportUsageToStripe:', error)
    return false
  }
}

/**
 * Get current usage from Stripe for a subscription
 */
export async function getStripeUsage(subscriptionId: string, periodStart: Date, periodEnd: Date) {
  if (!stripe) {
    throw new Error('Stripe not configured')
  }

  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId)
    const usageData: Record<string, number> = {}

    for (const item of subscription.items.data) {
      if (item.price.recurring?.usage_type === 'metered') {
        const usageRecords = await stripe.subscriptionItems.listUsageRecordSummaries(
          item.id,
          {
            limit: 100
          }
        )

        const metricType = item.price.metadata?.metric_type || 'unknown'
        const totalUsage = usageRecords.data.reduce((sum, record) => sum + record.total_usage, 0)
        
        usageData[metricType] = totalUsage
      }
    }

    return usageData

  } catch (error) {
    console.error('Error fetching Stripe usage:', error)
    throw error
  }
}

/**
 * Create metered price in Stripe
 * This is a utility function for setting up metered billing
 */
export async function createMeteredPrice(productId: string, unitAmount: number, metricType: 'executions' | 'duration') {
  if (!stripe) {
    throw new Error('Stripe not configured')
  }

  try {
    const price = await stripe.prices.create({
      currency: 'usd',
      unit_amount: unitAmount, // in cents
      recurring: {
        interval: 'month',
        usage_type: 'metered',
        aggregate_usage: 'sum'
      },
      product: productId,
      metadata: {
        metric_type: metricType
      }
    })

    console.log(`Created metered price for ${metricType}: ${price.id}`)
    return price

  } catch (error) {
    console.error('Error creating metered price:', error)
    throw error
  }
}

/**
 * Setup metered billing for a tenant
 * This adds metered items to their existing subscription
 */
export async function setupMeteredBilling(subscriptionId: string, executionPriceId?: string, durationPriceId?: string) {
  if (!stripe) {
    throw new Error('Stripe not configured')
  }

  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId)
    const updates: any = {
      items: [...subscription.items.data.map(item => ({ id: item.id }))]
    }

    // Add execution metering if price ID provided
    if (executionPriceId) {
      updates.items.push({
        price: executionPriceId,
        metadata: { metric_type: 'executions' }
      })
    }

    // Add duration metering if price ID provided
    if (durationPriceId) {
      updates.items.push({
        price: durationPriceId,
        metadata: { metric_type: 'duration' }
      })
    }

    const updatedSubscription = await stripe.subscriptions.update(subscriptionId, updates)
    
    console.log(`✅ Setup metered billing for subscription ${subscriptionId}`)
    return updatedSubscription

  } catch (error) {
    console.error('Error setting up metered billing:', error)
    throw error
  }
}

/**
 * Generate usage invoice preview
 */
export async function previewUsageInvoice(subscriptionId: string) {
  if (!stripe) {
    throw new Error('Stripe not configured')
  }

  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId)
    
    const invoicePreview = await stripe.invoices.retrieveUpcoming({
      customer: subscription.customer as string,
      subscription: subscriptionId
    })

    // Extract usage-based line items
    const usageItems = invoicePreview.lines.data.filter(line => 
      line.price?.recurring?.usage_type === 'metered'
    )

    return {
      subscription_id: subscriptionId,
      period_start: new Date(invoicePreview.period_start * 1000),
      period_end: new Date(invoicePreview.period_end * 1000),
      subtotal: invoicePreview.subtotal / 100,
      total: invoicePreview.total / 100,
      usage_items: usageItems.map(item => ({
        description: item.description,
        quantity: item.quantity,
        unit_amount: item.price?.unit_amount ? item.price.unit_amount / 100 : 0,
        amount: item.amount / 100,
        metric_type: item.price?.metadata?.metric_type
      }))
    }

  } catch (error) {
    console.error('Error previewing usage invoice:', error)
    throw error
  }
}

/**
 * Reset usage for a subscription (useful for testing)
 */
export async function resetUsageForSubscription(subscriptionId: string) {
  if (!stripe) {
    throw new Error('Stripe not configured')
  }

  console.warn('⚠️  Resetting usage data - this should only be used for testing!')

  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId)
    const results = []

    for (const item of subscription.items.data) {
      if (item.price.recurring?.usage_type === 'metered') {
        try {
          // Set usage to 0
          await stripe.subscriptionItems.createUsageRecord(
            item.id,
            {
              quantity: 0,
              timestamp: Math.floor(Date.now() / 1000),
              action: 'set'
            }
          )
          
          results.push({
            item_id: item.id,
            metric_type: item.price.metadata?.metric_type,
            success: true
          })
          
        } catch (error) {
          results.push({
            item_id: item.id,
            metric_type: item.price.metadata?.metric_type,
            success: false,
            error: error
          })
        }
      }
    }

    return results

  } catch (error) {
    console.error('Error resetting usage:', error)
    throw error
  }
}