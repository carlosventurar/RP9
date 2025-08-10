import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth/supabase-auth'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const supabase = createClient()

    // Get metrics from dashboard_metrics_24h view
    const { data: metrics, error: metricsError } = await supabase
      .from('dashboard_metrics_24h')
      .select('*')
      .eq('tenant_id', user.tenantId)
      .single()

    if (metricsError && metricsError.code !== 'PGRST116') {
      console.error('Metrics error:', metricsError)
    }

    // Get recent executions
    const { data: recentExecutions, error: executionsError } = await supabase
      .from('usage_executions')
      .select('*')
      .eq('tenant_id', user.tenantId)
      .order('created_at', { ascending: false })
      .limit(10)

    if (executionsError) {
      console.error('Executions error:', executionsError)
    }

    // Get top workflows by execution count
    const { data: topWorkflows, error: topWorkflowsError } = await supabase
      .from('usage_executions')
      .select('workflow_name, workflow_id')
      .eq('tenant_id', user.tenantId)
      .not('workflow_name', 'is', null)
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()) // Last 7 days

    if (topWorkflowsError) {
      console.error('Top workflows error:', topWorkflowsError)
    }

    // Calculate top workflows with counts
    const workflowCounts: Record<string, number> = {}
    topWorkflows?.forEach(execution => {
      if (execution.workflow_name) {
        workflowCounts[execution.workflow_name] = (workflowCounts[execution.workflow_name] || 0) + 1
      }
    })

    const topWorkflowsFormatted = Object.entries(workflowCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    // Default metrics if no data exists
    const defaultMetrics = {
      total_executions: 0,
      successful_executions: 0,
      failed_executions: 0,
      success_rate: 0,
      avg_duration_seconds: 0,
      p95_duration_seconds: 0,
      active_workflows: 0
    }

    const responseData = {
      success: true,
      data: {
        metrics: metrics || defaultMetrics,
        recentExecutions: recentExecutions || [],
        topWorkflows: topWorkflowsFormatted,
        period: '24h'
      },
      tenant: user.tenantId
    }

    return NextResponse.json(responseData)

  } catch (error) {
    console.error('Dashboard GET error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch dashboard data', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}