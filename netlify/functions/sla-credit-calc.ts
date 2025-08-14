import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'

// Initialize Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// SLA credit calculation function
function calculateSLACredit(uptimePercentage: number, targetSLA: number = 99.9): number {
  if (uptimePercentage >= targetSLA) {
    return 0 // No credit needed
  } else if (uptimePercentage >= 99.0) {
    return 5.0 // 5% credit
  } else if (uptimePercentage >= 98.0) {
    return 10.0 // 10% credit
  } else {
    return 20.0 // 20% credit for severe outages
  }
}

// Calculate monthly uptime from daily metrics
async function calculateMonthlyUptime(tenantId: string, year: number, month: number) {
  const startDate = new Date(year, month - 1, 1).toISOString().split('T')[0]
  const endDate = new Date(year, month, 0).toISOString().split('T')[0]

  const { data: metrics, error } = await supabase
    .from('sla_metrics')
    .select('*')
    .eq('tenant_id', tenantId)
    .gte('metric_date', startDate)
    .lte('metric_date', endDate)
    .order('metric_date')

  if (error) {
    throw new Error(`Failed to fetch SLA metrics: ${error.message}`)
  }

  if (!metrics || metrics.length === 0) {
    return null // No data available
  }

  // Calculate average uptime for the month
  const totalUptime = metrics.reduce((sum, metric) => sum + parseFloat(metric.uptime_percentage), 0)
  const averageUptime = totalUptime / metrics.length
  
  const totalDowntime = metrics.reduce((sum, metric) => sum + (metric.total_downtime_minutes || 0), 0)
  const totalIncidents = metrics.reduce((sum, metric) => sum + (metric.incident_count || 0), 0)

  return {
    average_uptime: averageUptime,
    total_downtime_minutes: totalDowntime,
    total_incidents: totalIncidents,
    days_measured: metrics.length,
    start_date: startDate,
    end_date: endDate
  }
}

// Get tenant billing information
async function getTenantBillingInfo(tenantId: string) {
  // This would integrate with your billing system
  // For now, return mock data
  return {
    monthly_revenue_cents: 199900, // $1,999 in cents
    currency: 'MXN',
    plan: 'pro'
  }
}

// Create Stripe credit (placeholder)
async function createStripeCredit(tenantId: string, creditAmountCents: number, currency: string) {
  // In production, this would create actual Stripe credits/coupons
  // For now, return mock credit ID
  const creditId = `credit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  
  console.log(`Would create Stripe credit: ${creditAmountCents} ${currency} for tenant ${tenantId}`)
  
  return creditId
}

// Process SLA credits for a specific tenant and month
async function processTenantSLACredits(tenantId: string, year: number, month: number) {
  try {
    // Calculate monthly uptime
    const uptimeData = await calculateMonthlyUptime(tenantId, year, month)
    
    if (!uptimeData) {
      console.log(`No SLA metrics found for tenant ${tenantId} in ${year}-${month.toString().padStart(2, '0')}`)
      return null
    }

    const { average_uptime, start_date, end_date } = uptimeData
    const targetSLA = 99.9 // Default SLA target
    
    // Calculate credit percentage
    const creditPercentage = calculateSLACredit(average_uptime, targetSLA)
    
    if (creditPercentage === 0) {
      console.log(`No SLA credit needed for tenant ${tenantId} - uptime: ${average_uptime.toFixed(3)}%`)
      return null
    }

    // Get billing info
    const billingInfo = await getTenantBillingInfo(tenantId)
    const creditAmountCents = Math.floor((billingInfo.monthly_revenue_cents * creditPercentage) / 100)

    // Check if credit already exists for this period
    const { data: existingCredit } = await supabase
      .from('sla_credits')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('billing_period_start', start_date)
      .eq('billing_period_end', end_date)
      .single()

    if (existingCredit) {
      console.log(`SLA credit already exists for tenant ${tenantId} period ${start_date} to ${end_date}`)
      return existingCredit
    }

    // Create Stripe credit
    let stripeCreditId = null
    try {
      stripeCreditId = await createStripeCredit(tenantId, creditAmountCents, billingInfo.currency)
    } catch (error) {
      console.error(`Failed to create Stripe credit for tenant ${tenantId}:`, error)
    }

    // Record SLA credit in database
    const { data: slaCredit, error: creditError } = await supabase
      .from('sla_credits')
      .insert({
        tenant_id: tenantId,
        billing_period_start: start_date,
        billing_period_end: end_date,
        sla_percentage: average_uptime,
        target_sla: targetSLA,
        credit_percentage: creditPercentage,
        credit_amount_cents: creditAmountCents,
        currency: billingInfo.currency,
        status: stripeCreditId ? 'applied' : 'calculated',
        stripe_credit_id: stripeCreditId,
        applied_at: stripeCreditId ? new Date().toISOString() : null,
        expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 days
        memo: `SLA breach: ${average_uptime.toFixed(3)}% uptime (target: ${targetSLA}%) - ${creditPercentage}% credit applied`,
        created_at: new Date().toISOString()
      })
      .select()
      .single()

    if (creditError) {
      throw new Error(`Failed to record SLA credit: ${creditError.message}`)
    }

    console.log(`SLA credit created for tenant ${tenantId}: ${creditPercentage}% (${creditAmountCents} ${billingInfo.currency} cents)`)

    return slaCredit

  } catch (error) {
    console.error(`Error processing SLA credits for tenant ${tenantId}:`, error)
    throw error
  }
}

// Main handler (scheduled function)
export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  console.log('SLA Credit Calculation started:', new Date().toISOString())

  try {
    // Get current date for calculation (previous month)
    const now = new Date()
    const targetDate = new Date(now.getFullYear(), now.getMonth() - 1, 1) // Previous month
    const year = targetDate.getFullYear()
    const month = targetDate.getMonth() + 1

    console.log(`Calculating SLA credits for ${year}-${month.toString().padStart(2, '0')}`)

    // Get all active tenants
    const { data: tenants, error: tenantsError } = await supabase
      .from('tenants')
      .select('id, name, plan')
      .eq('status', 'active')

    if (tenantsError) {
      throw new Error(`Failed to fetch tenants: ${tenantsError.message}`)
    }

    if (!tenants || tenants.length === 0) {
      console.log('No active tenants found')
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          message: 'No active tenants to process',
          processed: 0
        })
      }
    }

    // Process SLA credits for each tenant
    const results = []
    let processed = 0
    let errors = 0

    for (const tenant of tenants) {
      try {
        const result = await processTenantSLACredits(tenant.id, year, month)
        if (result) {
          results.push({
            tenant_id: tenant.id,
            tenant_name: tenant.name,
            credit_applied: true,
            credit_percentage: result.credit_percentage,
            credit_amount_cents: result.credit_amount_cents,
            currency: result.currency
          })
          processed++
        } else {
          results.push({
            tenant_id: tenant.id,
            tenant_name: tenant.name,
            credit_applied: false,
            reason: 'No credit needed or no data available'
          })
        }
      } catch (error) {
        console.error(`Error processing tenant ${tenant.id}:`, error)
        results.push({
          tenant_id: tenant.id,
          tenant_name: tenant.name,
          credit_applied: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
        errors++
      }
    }

    // Summary
    const summary = {
      total_tenants: tenants.length,
      credits_applied: processed,
      errors: errors,
      period: `${year}-${month.toString().padStart(2, '0')}`,
      processed_at: new Date().toISOString()
    }

    console.log('SLA Credit Calculation completed:', summary)

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        summary,
        results
      })
    }

  } catch (error) {
    console.error('SLA Credit Calculation failed:', error)
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      })
    }
  }
}

// Export for testing
export { 
  calculateSLACredit, 
  calculateMonthlyUptime, 
  processTenantSLACredits 
}