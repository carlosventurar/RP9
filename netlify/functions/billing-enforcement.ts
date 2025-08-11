import { Handler, HandlerEvent } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import { featureFlagService } from '../../src/lib/feature-flags'
import Stripe from 'stripe'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const stripeSecretKey = process.env.STRIPE_SECRET_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null

// Scheduled enforcement function (runs every hour)
export const handler: Handler = async (event: HandlerEvent) => {
  console.log('🛡️ Billing enforcement started at:', new Date().toISOString())

  try {
    // Get all tenants that need enforcement checks
    const { data: tenants, error: tenantsError } = await supabase
      .from('tenants')
      .select('id, name, plan, owner_user_id')

    if (tenantsError) {
      console.error('Error fetching tenants:', tenantsError)
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to fetch tenants' })
      }
    }

    if (!tenants || tenants.length === 0) {
      console.log('No tenants found')
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'No tenants to process' })
      }
    }

    const results = []

    for (const tenant of tenants) {
      try {
        const result = await enforceUsageLimits(tenant)
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
          action: 'none'
        })
      }
    }

    const totals = results.reduce((acc, result) => {
      if (result.action === 'alert') acc.alerts_sent += 1
      if (result.action === 'upgrade') acc.auto_upgrades += 1
      if (result.action === 'throttle') acc.throttled += 1
      if (result.error) acc.errors += 1
      return acc
    }, { alerts_sent: 0, auto_upgrades: 0, throttled: 0, errors: 0 })

    console.log('✅ Billing enforcement completed:', totals)

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
    console.error('Fatal error in billing enforcement:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
}

async function enforceUsageLimits(tenant: any) {
  // Get tenant's plan limits
  const { data: plan, error: planError } = await supabase
    .from('plans')
    .select('limits')
    .eq('key', tenant.plan)
    .single()

  if (planError || !plan) {
    return { action: 'none', message: 'No plan found' }
  }

  const limits = plan.limits as any
  if (!limits?.executions_per_month || limits.executions_per_month === -1) {
    return { action: 'none', message: 'No execution limits or unlimited plan' }
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
    .eq('status', 'success')

  if (usageError) {
    throw new Error('Failed to fetch monthly usage')
  }

  const executionsThisMonth = monthlyUsage?.length || 0
  const executionLimit = limits.executions_per_month
  const usagePercent = (executionsThisMonth / executionLimit) * 100

  console.log(`Tenant ${tenant.id}: ${executionsThisMonth}/${executionLimit} executions (${usagePercent.toFixed(1)}%)`)

  // Check if auto-upgrade is enabled
  const autoUpgradeEnabled = await featureFlagService.isEnabled('auto_upgrade', {
    tenantId: tenant.id,
    plan: tenant.plan
  })

  // Enforcement logic
  if (executionsThisMonth >= executionLimit * 1.2) {
    // 120% of limit - hard throttle
    await throttleTenant(tenant.id, 'hard')
    await logEnforcementAction(tenant.id, 'hard_throttle', {
      usage: executionsThisMonth,
      limit: executionLimit,
      percentage: usagePercent
    })
    return { action: 'throttle', type: 'hard', usage: executionsThisMonth, limit: executionLimit }

  } else if (executionsThisMonth >= executionLimit && autoUpgradeEnabled) {
    // Auto-upgrade at 100% if enabled
    const upgraded = await autoUpgradeTenant(tenant)
    if (upgraded) {
      await logEnforcementAction(tenant.id, 'auto_upgrade', {
        from_plan: tenant.plan,
        to_plan: upgraded.new_plan,
        usage: executionsThisMonth,
        limit: executionLimit
      })
      return { action: 'upgrade', from_plan: tenant.plan, to_plan: upgraded.new_plan }
    }

  } else if (executionsThisMonth >= executionLimit * 1.1) {
    // 110% of limit - soft throttle with warning
    await throttleTenant(tenant.id, 'soft')
    await sendEnforcementAlert(tenant, 'throttle_warning', {
      usage: executionsThisMonth,
      limit: executionLimit,
      percentage: usagePercent
    })
    await logEnforcementAction(tenant.id, 'soft_throttle', {
      usage: executionsThisMonth,
      limit: executionLimit,
      percentage: usagePercent
    })
    return { action: 'throttle', type: 'soft', usage: executionsThisMonth, limit: executionLimit }

  } else if (usagePercent >= 90) {
    // 90% usage - send alert
    await sendEnforcementAlert(tenant, 'usage_warning', {
      usage: executionsThisMonth,
      limit: executionLimit,
      percentage: usagePercent
    })
    return { action: 'alert', type: 'usage_warning', usage: executionsThisMonth, limit: executionLimit }
  }

  return { action: 'none', usage: executionsThisMonth, limit: executionLimit }
}

async function throttleTenant(tenantId: string, type: 'soft' | 'hard') {
  const throttleConfig = {
    soft: { rate_limit: 10, burst_limit: 50 }, // 10 req/min, 50 burst
    hard: { rate_limit: 1, burst_limit: 5 }    // 1 req/min, 5 burst
  }

  const config = throttleConfig[type]
  
  // Update tenant settings with throttle configuration
  await supabase
    .from('tenants')
    .update({
      settings: {
        throttle_enabled: true,
        throttle_type: type,
        rate_limit_per_minute: config.rate_limit,
        burst_limit: config.burst_limit,
        throttled_at: new Date().toISOString()
      }
    })
    .eq('id', tenantId)

  console.log(`🔴 THROTTLED tenant ${tenantId}: ${type} throttling enabled`)
}

async function autoUpgradeTenant(tenant: any): Promise<{ new_plan: string } | null> {
  // Define upgrade path
  const upgradePath: Record<string, string> = {
    'starter': 'pro',
    'pro': 'enterprise'
  }

  const newPlan = upgradePath[tenant.plan]
  if (!newPlan) {
    console.log(`No upgrade path for plan ${tenant.plan}`)
    return null
  }

  try {
    // Update tenant plan
    await supabase
      .from('tenants')
      .update({ plan: newPlan })
      .eq('id', tenant.id)

    // Create or update Stripe subscription if configured
    if (stripe) {
      await upgradeStripeSubscription(tenant.id, newPlan)
    }

    console.log(`🚀 AUTO-UPGRADED tenant ${tenant.id}: ${tenant.plan} → ${newPlan}`)
    
    // Send upgrade notification
    await sendEnforcementAlert(tenant, 'auto_upgrade', {
      from_plan: tenant.plan,
      to_plan: newPlan,
      reason: 'usage_limit_exceeded'
    })

    return { new_plan: newPlan }

  } catch (error) {
    console.error(`Failed to auto-upgrade tenant ${tenant.id}:`, error)
    return null
  }
}

async function upgradeStripeSubscription(tenantId: string, newPlan: string) {
  if (!stripe) return

  try {
    // Get current subscription
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('stripe_subscription_id')
      .eq('tenant_id', tenantId)
      .single()

    if (!subscription?.stripe_subscription_id) {
      console.log(`No Stripe subscription found for tenant ${tenantId}`)
      return
    }

    // Get new plan Stripe price
    const { data: planData } = await supabase
      .from('plans')
      .select('stripe_price_id')
      .eq('key', newPlan)
      .single()

    if (!planData?.stripe_price_id) {
      console.log(`No Stripe price ID found for plan ${newPlan}`)
      return
    }

    // Update subscription in Stripe
    console.log(`Would update Stripe subscription ${subscription.stripe_subscription_id} to ${planData.stripe_price_id}`)
    
    // Uncomment when Stripe is properly configured:
    /*
    await stripe.subscriptions.update(subscription.stripe_subscription_id, {
      items: [{
        price: planData.stripe_price_id
      }],
      proration_behavior: 'always_invoice'
    })
    */

  } catch (error) {
    console.error('Error upgrading Stripe subscription:', error)
  }
}

async function sendEnforcementAlert(tenant: any, type: string, details: any) {
  const alerts = {
    usage_warning: {
      subject: 'Usage Warning - Approaching Limit',
      message: `Your account is at ${details.percentage.toFixed(1)}% of your monthly execution limit.`
    },
    throttle_warning: {
      subject: 'Service Throttled - Usage Exceeded',
      message: `Your workflows are now throttled due to exceeding usage limits.`
    },
    auto_upgrade: {
      subject: 'Account Automatically Upgraded',
      message: `Your account has been upgraded from ${details.from_plan} to ${details.to_plan}.`
    }
  }

  const alert = alerts[type as keyof typeof alerts]
  if (!alert) return

  console.log(`📧 ENFORCEMENT ALERT for tenant ${tenant.name}:`, {
    type,
    subject: alert.subject,
    details
  })

  // Save alert to audit log
  await supabase
    .from('audit_logs')
    .insert({
      tenant_id: tenant.id,
      user_id: tenant.owner_user_id,
      action: 'enforcement_alert',
      resource: 'billing',
      resource_id: tenant.id,
      details: {
        alert_type: type,
        subject: alert.subject,
        message: alert.message,
        ...details
      }
    })

  // In production, integrate with email service
}

async function logEnforcementAction(tenantId: string, action: string, details: any) {
  await supabase
    .from('audit_logs')
    .insert({
      tenant_id: tenantId,
      user_id: null,
      action: 'enforcement_action',
      resource: 'billing',
      resource_id: tenantId,
      details: {
        enforcement_action: action,
        timestamp: new Date().toISOString(),
        ...details
      }
    })
}

// HTTP API for real-time enforcement checks
export const checkLimitsHandler: Handler = async (event: HandlerEvent) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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
    // Validate authentication
    const authHeader = event.headers.authorization || event.headers.Authorization
    if (!authHeader) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Authorization required' })
      }
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Invalid token' })
      }
    }

    // Parse request body
    const body = JSON.parse(event.body || '{}')
    const { action, workflowId, tenantId } = body

    if (!action || !tenantId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Action and tenantId are required' })
      }
    }

    // Get tenant
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', tenantId)
      .single()

    if (tenantError || !tenant) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Tenant not found' })
      }
    }

    // Verify user has access to tenant
    if (tenant.owner_user_id !== user.id) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: 'Access denied to tenant' })
      }
    }

    // Check enforcement based on action
    const enforcementResult = await checkLimitsForAction(tenant, action, workflowId)

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(enforcementResult)
    }

  } catch (error) {
    console.error('Billing enforcement error:', error)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
}

async function checkLimitsForAction(tenant: any, action: string, workflowId?: string) {
  try {
    // Get plan limits
    const { data: plan, error: planError } = await supabase
      .from('plans')
      .select('*')
      .eq('key', tenant.plan)
      .single()

    if (planError || !plan) {
      console.error(`No plan found for tenant ${tenant.id} with plan ${tenant.plan}`)
      return {
        allowed: true,
        reason: 'no_plan_limits',
        message: 'No plan limits configured'
      }
    }

    const limits = plan.limits as any

    // Enterprise plans have no limits
    if (tenant.plan === 'enterprise' || !limits) {
      return {
        allowed: true,
        reason: 'enterprise_unlimited',
        message: 'Enterprise plan - unlimited access'
      }
    }

    switch (action) {
      case 'execute_workflow':
        return await checkExecutionLimits(tenant, limits, workflowId)
      
      case 'create_workflow':
        return await checkWorkflowCreationLimits(tenant, limits)
      
      case 'activate_workflow':
        return await checkWorkflowActivationLimits(tenant, limits)
      
      default:
        return {
          allowed: true,
          reason: 'unknown_action',
          message: `Action ${action} not subject to limits`
        }
    }

  } catch (error) {
    console.error('Error checking limits:', error)
    // Fail open - allow action if we can't check limits
    return {
      allowed: true,
      reason: 'check_failed',
      message: 'Could not verify limits, allowing action'
    }
  }
}

async function checkExecutionLimits(tenant: any, limits: any, workflowId?: string) {
  const executionLimit = limits.executions_per_month
  
  if (!executionLimit || executionLimit === -1) {
    return {
      allowed: true,
      reason: 'no_execution_limit',
      message: 'No execution limits set'
    }
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
    .eq('status', 'success')

  if (usageError) {
    console.error('Error fetching monthly usage:', usageError)
    return {
      allowed: true,
      reason: 'usage_check_failed',
      message: 'Could not verify current usage'
    }
  }

  const currentUsage = monthlyUsage?.length || 0
  const usagePercent = (currentUsage / executionLimit) * 100

  // Allow if under limit
  if (currentUsage < executionLimit) {
    return {
      allowed: true,
      reason: 'within_limit',
      message: `Usage: ${currentUsage}/${executionLimit} executions (${usagePercent.toFixed(1)}%)`,
      usage: {
        current: currentUsage,
        limit: executionLimit,
        percentage: usagePercent
      }
    }
  }

  // Check if tenant allows overage
  const allowOverage = limits.allow_overage !== false // Default to true if not specified

  if (allowOverage) {
    return {
      allowed: true,
      reason: 'overage_allowed',
      message: `Over limit but overage allowed: ${currentUsage}/${executionLimit} executions`,
      warning: true,
      usage: {
        current: currentUsage,
        limit: executionLimit,
        percentage: usagePercent,
        overage: currentUsage - executionLimit
      }
    }
  }

  // Limit exceeded and no overage allowed
  return {
    allowed: false,
    reason: 'execution_limit_exceeded',
    message: `Monthly execution limit exceeded: ${currentUsage}/${executionLimit}`,
    usage: {
      current: currentUsage,
      limit: executionLimit,
      percentage: usagePercent,
      overage: currentUsage - executionLimit
    }
  }
}

async function checkWorkflowCreationLimits(tenant: any, limits: any) {
  const workflowLimit = limits.workflows_max

  if (!workflowLimit || workflowLimit === -1) {
    return {
      allowed: true,
      reason: 'no_workflow_limit',
      message: 'No workflow limits set'
    }
  }

  // Count current workflows for tenant
  // Note: This would require tracking workflows per tenant in our database
  // For now, we'll allow workflow creation and implement this later
  
  return {
    allowed: true,
    reason: 'workflow_limit_not_implemented',
    message: 'Workflow limits not yet implemented'
  }
}

async function checkWorkflowActivationLimits(tenant: any, limits: any) {
  const activeWorkflowLimit = limits.active_workflows_max

  if (!activeWorkflowLimit || activeWorkflowLimit === -1) {
    return {
      allowed: true,
      reason: 'no_active_workflow_limit',
      message: 'No active workflow limits set'
    }
  }

  // This would also require tracking active workflows per tenant
  // For now, we'll allow activation
  
  return {
    allowed: true,
    reason: 'active_workflow_limit_not_implemented', 
    message: 'Active workflow limits not yet implemented'
  }
}

// Utility function to be called from other APIs before executing actions
export async function checkBillingLimits(tenantId: string, action: string, workflowId?: string) {
  try {
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', tenantId)
      .single()

    if (tenantError || !tenant) {
      throw new Error('Tenant not found')
    }

    return await checkLimitsForAction(tenant, action, workflowId)

  } catch (error) {
    console.error('Error checking billing limits:', error)
    // Fail open
    return {
      allowed: true,
      reason: 'check_failed',
      message: 'Could not verify limits, allowing action'
    }
  }
}