import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Get tenant for user
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id, name')
      .eq('owner_user_id', user.id)
      .single()

    if (tenantError || !tenant) {
      console.error('Tenant lookup error:', tenantError)
      // Return mock data instead of error for better UX
      const mockMetrics = {
        total_executions: 0,
        successful_executions: 0,
        failed_executions: 0,
        success_rate: 0,
        avg_duration_seconds: 0,
        p95_duration_seconds: 0,
        active_workflows: 0
      }

      return NextResponse.json({
        success: true,
        data: {
          metrics: mockMetrics,
          recentExecutions: [],
          topWorkflows: [],
          period: '24h'
        },
        tenant: 'default',
        note: 'Using mock data - tenant not configured'
      })
    }

    // Try to get real data, fallback to mock on any error
    try {
      // Get metrics from dashboard_metrics_24h view
      const { data: metrics, error: metricsError } = await supabase
        .from('dashboard_metrics_24h')
        .select('*')
        .eq('tenant_id', tenant.id)
        .single()

      if (metricsError && metricsError.code !== 'PGRST116') {
        console.error('Metrics error:', metricsError)
      }

      // Get recent executions
      const { data: recentExecutions, error: executionsError } = await supabase
        .from('usage_executions')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false })
        .limit(10)

      if (executionsError) {
        console.error('Executions error:', executionsError)
      }

      // Get top workflows by execution count
      const { data: topWorkflows, error: topWorkflowsError } = await supabase
        .from('usage_executions')
        .select('workflow_name, workflow_id')
        .eq('tenant_id', tenant.id)
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
        tenant: tenant.id
      }

      return NextResponse.json(responseData)
      
    } catch (dataError) {
      console.error('Error fetching dashboard data, using mock data:', dataError)
      
      // Return mock data on database error
      const mockMetrics = {
        total_executions: 0,
        successful_executions: 0,
        failed_executions: 0,
        success_rate: 0,
        avg_duration_seconds: 0,
        p95_duration_seconds: 0,
        active_workflows: 0
      }

      return NextResponse.json({
        success: true,
        data: {
          metrics: mockMetrics,
          recentExecutions: [],
          topWorkflows: [],
          period: '24h'
        },
        tenant: tenant.id,
        note: 'Using mock data - database query failed'
      })
    }

  } catch (error) {
    console.error('Dashboard GET error:', error)
    
    // Return mock data on any error
    const mockMetrics = {
      total_executions: 0,
      successful_executions: 0,
      failed_executions: 0,
      success_rate: 0,
      avg_duration_seconds: 0,
      p95_duration_seconds: 0,
      active_workflows: 0
    }

    return NextResponse.json({
      success: true,
      data: {
        metrics: mockMetrics,
        recentExecutions: [],
        topWorkflows: [],
        period: '24h'
      },
      note: 'Using mock data - API error occurred'
    })
  }
}