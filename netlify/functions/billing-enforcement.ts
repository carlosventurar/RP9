import { Handler, HandlerEvent } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

export const handler: Handler = async (event: HandlerEvent) => {
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