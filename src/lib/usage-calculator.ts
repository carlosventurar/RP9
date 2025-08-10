import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

export interface UsageMetrics {
  executions_total: number
  executions_success: number
  executions_failed: number
  success_rate: number
  total_duration_ms: number
  avg_duration_ms: number
  unique_workflows: number
  period_start: string
  period_end: string
}

export interface PlanLimits {
  executions_per_month: number
  workflows_max: number
  active_workflows_max: number
  storage_mb_max: number
  allow_overage: boolean
}

export interface UsageStatus {
  current_usage: number
  limit: number
  percentage: number
  status: 'within_limit' | 'approaching_limit' | 'at_limit' | 'over_limit'
  warning_threshold: number
  critical_threshold: number
}

/**
 * Calculate usage metrics for a tenant within a date range
 */
export async function calculateUsageMetrics(
  tenantId: string, 
  startDate: Date, 
  endDate: Date
): Promise<UsageMetrics> {
  const { data: executions, error } = await supabase
    .from('usage_executions')
    .select('*')
    .eq('tenant_id', tenantId)
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString())

  if (error) {
    console.error('Error fetching usage executions:', error)
    throw new Error('Failed to calculate usage metrics')
  }

  if (!executions || executions.length === 0) {
    return {
      executions_total: 0,
      executions_success: 0,
      executions_failed: 0,
      success_rate: 0,
      total_duration_ms: 0,
      avg_duration_ms: 0,
      unique_workflows: 0,
      period_start: startDate.toISOString(),
      period_end: endDate.toISOString()
    }
  }

  const successfulExecutions = executions.filter(e => e.status === 'success')
  const failedExecutions = executions.filter(e => e.status === 'error')
  const uniqueWorkflows = new Set(executions.map(e => e.workflow_id)).size
  
  const totalDuration = executions.reduce((sum, e) => sum + (e.duration_ms || 0), 0)
  const avgDuration = executions.length > 0 ? totalDuration / executions.length : 0
  const successRate = executions.length > 0 ? (successfulExecutions.length / executions.length) * 100 : 0

  return {
    executions_total: executions.length,
    executions_success: successfulExecutions.length,
    executions_failed: failedExecutions.length,
    success_rate: Math.round(successRate * 100) / 100,
    total_duration_ms: totalDuration,
    avg_duration_ms: Math.round(avgDuration),
    unique_workflows: uniqueWorkflows,
    period_start: startDate.toISOString(),
    period_end: endDate.toISOString()
  }
}

/**
 * Get current month usage for a tenant
 */
export async function getCurrentMonthUsage(tenantId: string): Promise<UsageMetrics> {
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)
  
  const endOfMonth = new Date(startOfMonth)
  endOfMonth.setMonth(endOfMonth.getMonth() + 1)
  endOfMonth.setDate(0) // Last day of current month
  endOfMonth.setHours(23, 59, 59, 999)

  return calculateUsageMetrics(tenantId, startOfMonth, endOfMonth)
}

/**
 * Get plan limits for a tenant
 */
export async function getPlanLimits(planKey: string): Promise<PlanLimits | null> {
  const { data: plan, error } = await supabase
    .from('plans')
    .select('limits')
    .eq('key', planKey)
    .single()

  if (error || !plan) {
    console.error('Error fetching plan limits:', error)
    return null
  }

  const limits = plan.limits as any
  
  return {
    executions_per_month: limits?.executions_per_month || -1, // -1 means unlimited
    workflows_max: limits?.workflows_max || -1,
    active_workflows_max: limits?.active_workflows_max || -1,
    storage_mb_max: limits?.storage_mb_max || -1,
    allow_overage: limits?.allow_overage !== false
  }
}

/**
 * Check usage status against plan limits
 */
export async function checkUsageStatus(tenantId: string, planKey: string): Promise<UsageStatus | null> {
  try {
    const [usage, limits] = await Promise.all([
      getCurrentMonthUsage(tenantId),
      getPlanLimits(planKey)
    ])

    if (!limits) {
      return null
    }

    // Focus on execution limits for now
    const executionLimit = limits.executions_per_month
    if (executionLimit === -1) {
      return {
        current_usage: usage.executions_total,
        limit: -1,
        percentage: 0,
        status: 'within_limit',
        warning_threshold: 80,
        critical_threshold: 100
      }
    }

    const percentage = (usage.executions_total / executionLimit) * 100
    let status: UsageStatus['status']

    if (percentage >= 100) {
      status = 'over_limit'
    } else if (percentage >= 100) {
      status = 'at_limit'
    } else if (percentage >= 80) {
      status = 'approaching_limit'
    } else {
      status = 'within_limit'
    }

    return {
      current_usage: usage.executions_total,
      limit: executionLimit,
      percentage: Math.round(percentage * 100) / 100,
      status,
      warning_threshold: 80,
      critical_threshold: 100
    }

  } catch (error) {
    console.error('Error checking usage status:', error)
    return null
  }
}

/**
 * Generate usage report for a tenant
 */
export async function generateUsageReport(tenantId: string, months: number = 1) {
  const reports = []
  
  for (let i = 0; i < months; i++) {
    const startOfMonth = new Date()
    startOfMonth.setMonth(startOfMonth.getMonth() - i)
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)
    
    const endOfMonth = new Date(startOfMonth)
    endOfMonth.setMonth(endOfMonth.getMonth() + 1)
    endOfMonth.setDate(0)
    endOfMonth.setHours(23, 59, 59, 999)

    const usage = await calculateUsageMetrics(tenantId, startOfMonth, endOfMonth)
    
    reports.push({
      month: startOfMonth.toISOString().slice(0, 7), // YYYY-MM format
      ...usage
    })
  }

  return reports
}

/**
 * Calculate estimated cost based on usage and plan
 */
export function calculateEstimatedCost(usage: UsageMetrics, planLimits: PlanLimits, planPrice: number): number {
  // Base plan cost
  let totalCost = planPrice

  // Add overage costs if applicable
  if (planLimits.allow_overage && planLimits.executions_per_month !== -1) {
    const overage = Math.max(0, usage.executions_total - planLimits.executions_per_month)
    if (overage > 0) {
      // $0.005 per execution over limit (example pricing)
      const overageCost = overage * 0.005
      totalCost += overageCost
    }
  }

  return Math.round(totalCost * 100) / 100 // Round to 2 decimal places
}

/**
 * Get top workflows by usage
 */
export async function getTopWorkflowsByUsage(tenantId: string, startDate: Date, endDate: Date, limit: number = 10) {
  const { data: executions, error } = await supabase
    .from('usage_executions')
    .select('workflow_id, workflow_name, status, duration_ms')
    .eq('tenant_id', tenantId)
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString())

  if (error || !executions) {
    console.error('Error fetching workflow usage:', error)
    return []
  }

  // Group by workflow
  const workflowStats: Record<string, {
    workflow_id: string
    workflow_name: string
    executions: number
    success_count: number
    total_duration_ms: number
    avg_duration_ms: number
    success_rate: number
  }> = {}

  executions.forEach(execution => {
    const id = execution.workflow_id
    if (!workflowStats[id]) {
      workflowStats[id] = {
        workflow_id: execution.workflow_id,
        workflow_name: execution.workflow_name || `Workflow ${execution.workflow_id}`,
        executions: 0,
        success_count: 0,
        total_duration_ms: 0,
        avg_duration_ms: 0,
        success_rate: 0
      }
    }

    const stats = workflowStats[id]
    stats.executions += 1
    if (execution.status === 'success') {
      stats.success_count += 1
    }
    stats.total_duration_ms += execution.duration_ms || 0
  })

  // Calculate averages and success rates
  Object.values(workflowStats).forEach(stats => {
    stats.avg_duration_ms = stats.executions > 0 ? stats.total_duration_ms / stats.executions : 0
    stats.success_rate = stats.executions > 0 ? (stats.success_count / stats.executions) * 100 : 0
  })

  // Sort by execution count and return top N
  return Object.values(workflowStats)
    .sort((a, b) => b.executions - a.executions)
    .slice(0, limit)
}