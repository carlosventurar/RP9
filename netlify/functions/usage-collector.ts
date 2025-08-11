import { Handler, HandlerEvent } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import { N8nClient, N8nExecution } from '../../src/lib/n8n'
import Stripe from 'stripe'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const stripeSecretKey = process.env.STRIPE_SECRET_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null

// This function runs as a Netlify scheduled function every 10 minutes
export const handler: Handler = async (event: HandlerEvent) => {
  console.log('🔄 Usage collector started at:', new Date().toISOString())

  try {
    // Get all tenants that have n8n configuration
    const { data: tenants, error: tenantsError } = await supabase
      .from('tenants')
      .select('id, name, plan, n8n_base_url, n8n_api_key')
      .not('n8n_base_url', 'is', null)
      .not('n8n_api_key', 'is', null)

    if (tenantsError) {
      console.error('Error fetching tenants:', tenantsError)
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to fetch tenants' })
      }
    }

    if (!tenants || tenants.length === 0) {
      console.log('No tenants with n8n configuration found')
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'No tenants to process' })
      }
    }

    console.log(`Processing usage for ${tenants.length} tenants`)

    const results = []

    for (const tenant of tenants) {
      try {
        console.log(`Processing tenant: ${tenant.name} (${tenant.id})`)
        
        const result = await collectUsageForTenant(tenant)
        results.push({
          tenant_id: tenant.id,
          tenant_name: tenant.name,
          ...result
        })

      } catch (error) {
        console.error(`Error processing tenant ${tenant.id}:`, error)
        results.push({
          tenant_id: tenant.id,
          tenant_name: tenant.name,
          error: error instanceof Error ? error.message : 'Unknown error',
          executions_processed: 0
        })
      }
    }

    // Calculate totals
    const totals = results.reduce((acc, result) => {
      acc.executions_processed += result.executions_processed || 0
      acc.tenants_processed += result.error ? 0 : 1
      acc.errors += result.error ? 1 : 0
      return acc
    }, { executions_processed: 0, tenants_processed: 0, errors: 0 })

    console.log('✅ Usage collection completed:', totals)

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        timestamp: new Date().toISOString(),
        summary: totals,
        results: results
      })
    }

  } catch (error) {
    console.error('Fatal error in usage collector:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
}

async function collectUsageForTenant(tenant: any) {
  // Create n8n client for this tenant
  const n8nClient = new N8nClient({
    baseUrl: tenant.n8n_base_url,
    apiKey: tenant.n8n_api_key
  })

  // Get the last collection timestamp for this tenant
  const { data: lastCollection } = await supabase
    .from('usage_executions')
    .select('created_at')
    .eq('tenant_id', tenant.id)
    .order('created_at', { ascending: false })
    .limit(1)

  // Calculate the time window for incremental sync
  const lastCollectionTime = lastCollection?.[0]?.created_at
  const startTime = lastCollectionTime 
    ? new Date(lastCollectionTime)
    : new Date(Date.now() - 24 * 60 * 60 * 1000) // Default to last 24 hours

  const endTime = new Date()

  console.log(`Collecting executions for tenant ${tenant.id} from ${startTime.toISOString()} to ${endTime.toISOString()}`)

  // Fetch executions from n8n API
  const executions = await fetchExecutionsIncremental(n8nClient, startTime, endTime)
  
  console.log(`Found ${executions.length} new executions for tenant ${tenant.id}`)

  if (executions.length === 0) {
    return {
      executions_processed: 0,
      message: 'No new executions found'
    }
  }

  // Process and save executions
  const processedExecutions = executions.map(execution => ({
    tenant_id: tenant.id,
    workflow_id: execution.workflowId,
    execution_id: execution.id,
    workflow_name: `Workflow ${execution.workflowId}`, // We could fetch workflow name separately
    status: mapN8nStatus(execution.status),
    started_at: execution.startedAt ? new Date(execution.startedAt).toISOString() : null,
    stopped_at: execution.stoppedAt ? new Date(execution.stoppedAt).toISOString() : null,
    duration_ms: calculateDuration(execution.startedAt, execution.stoppedAt),
    node_count: execution.data?.resultData?.runData ? Object.keys(execution.data.resultData.runData).length : 1,
    error_message: execution.status === 'error' ? 'Execution failed' : null,
    metadata: {
      mode: execution.mode || 'manual',
      n8n_execution_id: execution.id
    }
  }))

  // Save to database (with upsert to handle duplicates)
  const { error: insertError } = await supabase
    .from('usage_executions')
    .upsert(processedExecutions, {
      onConflict: 'tenant_id,execution_id',
      ignoreDuplicates: true
    })

  if (insertError) {
    console.error('Error saving executions:', insertError)
    throw new Error('Failed to save executions to database')
  }

  // Calculate monthly usage for this tenant
  await updateMonthlyUsage(tenant.id)

  // Check if we need to send alerts
  await checkUsageLimits(tenant)

  // Report usage to Stripe (if configured)
  if (stripe && tenant.plan !== 'enterprise') {
    await reportUsageToStripe(tenant.id)
  }

  return {
    executions_processed: executions.length,
    time_window: {
      start: startTime.toISOString(),
      end: endTime.toISOString()
    }
  }
}

async function fetchExecutionsIncremental(n8nClient: N8nClient, startTime: Date, endTime: Date): Promise<N8nExecution[]> {
  try {
    // n8n API doesn't have direct date filtering, so we fetch recent executions and filter
    const executions = await n8nClient.getExecutions({
      limit: 100 // Adjust based on your needs
    })

    // Filter executions by time window
    return executions.filter(execution => {
      if (!execution.startedAt) return false
      
      const executionTime = new Date(execution.startedAt)
      return executionTime >= startTime && executionTime <= endTime
    })

  } catch (error) {
    console.error('Error fetching executions from n8n:', error)
    throw new Error('Failed to fetch executions from n8n API')
  }
}

function mapN8nStatus(n8nStatus: string): 'success' | 'error' | 'running' | 'waiting' | 'canceled' {
  switch (n8nStatus.toLowerCase()) {
    case 'success':
      return 'success'
    case 'error':
    case 'failed':
      return 'error'
    case 'running':
      return 'running'
    case 'waiting':
      return 'waiting'
    case 'canceled':
    case 'cancelled':
      return 'canceled'
    default:
      return 'error'
  }
}

function calculateDuration(startedAt?: string, stoppedAt?: string): number | null {
  if (!startedAt || !stoppedAt) return null
  
  const start = new Date(startedAt).getTime()
  const stop = new Date(stoppedAt).getTime()
  
  return stop - start
}

async function updateMonthlyUsage(tenantId: string) {
  // This will trigger the dashboard_metrics_24h view to recalculate
  // We could also create a separate monthly metrics view if needed
  console.log(`Updated monthly usage metrics for tenant ${tenantId}`)
}

async function checkUsageLimits(tenant: any) {
  try {
    // Get tenant's plan limits
    const { data: plan, error: planError } = await supabase
      .from('plans')
      .select('limits')
      .eq('key', tenant.plan)
      .single()

    if (planError || !plan) {
      console.log(`No plan limits found for tenant ${tenant.id} with plan ${tenant.plan}`)
      return
    }

    const limits = plan.limits as any
    if (!limits?.executions_per_month) {
      console.log(`No execution limits set for plan ${tenant.plan}`)
      return
    }

    // Get current month usage
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const { data: monthlyUsage, error: usageError } = await supabase
      .from('usage_executions')
      .select('id')
      .eq('tenant_id', tenant.id)
      .gte('created_at', startOfMonth.toISOString())
      .eq('status', 'success') // Only count successful executions

    if (usageError) {
      console.error('Error fetching monthly usage:', usageError)
      return
    }

    const executionsThisMonth = monthlyUsage?.length || 0
    const executionLimit = limits.executions_per_month
    const usagePercent = (executionsThisMonth / executionLimit) * 100

    console.log(`Tenant ${tenant.id}: ${executionsThisMonth}/${executionLimit} executions (${usagePercent.toFixed(1)}%)`)

    // Send alerts at 80% and 100%
    if (usagePercent >= 80) {
      await sendUsageAlert(tenant, executionsThisMonth, executionLimit, usagePercent)
    }

  } catch (error) {
    console.error('Error checking usage limits:', error)
  }
}

async function sendUsageAlert(tenant: any, currentUsage: number, limit: number, percentage: number) {
  // For now, just log the alert
  // In the future, integrate with email service or push notifications
  const alertType = percentage >= 100 ? 'LIMIT_EXCEEDED' : 'LIMIT_WARNING'
  
  console.log(`🚨 USAGE ALERT for tenant ${tenant.name}:`, {
    type: alertType,
    usage: currentUsage,
    limit: limit,
    percentage: `${percentage.toFixed(1)}%`
  })

  // Save alert to audit log
  await supabase
    .from('audit_logs')
    .insert({
      tenant_id: tenant.id,
      user_id: null,
      action: 'usage_alert',
      resource: 'billing',
      resource_id: tenant.id,
      details: {
        alert_type: alertType,
        current_usage: currentUsage,
        limit: limit,
        percentage: percentage
      }
    })
}

async function reportUsageToStripe(tenantId: string) {
  if (!stripe) {
    console.log('Stripe not configured, skipping usage reporting')
    return
  }

  try {
    // Get tenant's subscription
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('stripe_subscription_id')
      .eq('tenant_id', tenantId)
      .single()

    if (!subscription?.stripe_subscription_id) {
      console.log(`No Stripe subscription found for tenant ${tenantId}`)
      return
    }

    // Get current month usage
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const { data: monthlyUsage, error: usageError } = await supabase
      .from('usage_executions')
      .select('id')
      .eq('tenant_id', tenantId)
      .gte('created_at', startOfMonth.toISOString())
      .eq('status', 'success')

    if (usageError) {
      console.error('Error fetching usage for Stripe reporting:', usageError)
      return
    }

    const executionsThisMonth = monthlyUsage?.length || 0

    // Report usage to Stripe (this will be used for metered billing)
    // Note: This is a simplified version. In production, you'd need to:
    // 1. Get the correct subscription item ID for executions
    // 2. Use proper idempotency keys
    // 3. Handle Stripe API errors gracefully
    
    console.log(`Would report ${executionsThisMonth} executions to Stripe for tenant ${tenantId}`)
    
    // Uncomment when Stripe is properly configured:
    /*
    await stripe.subscriptionItems.createUsageRecord(subscriptionItemId, {
      quantity: executionsThisMonth,
      timestamp: Math.floor(Date.now() / 1000),
      action: 'set' // Use 'set' to replace the current usage, 'increment' to add
    })
    */

  } catch (error) {
    console.error('Error reporting usage to Stripe:', error)
  }
}