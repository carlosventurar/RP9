import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase configuration:', { 
    hasUrl: !!supabaseUrl, 
    hasServiceKey: !!supabaseServiceKey 
  })
}

const supabase = supabaseUrl && supabaseServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Content-Type': 'application/json'
  }

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    }
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    }
  }

  try {
    // Check if Supabase is configured
    if (!supabase) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: 'Service configuration error',
          details: 'Database connection not available'
        })
      }
    }

    // Get user from JWT token
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

    // Get tenant for user
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('*')
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

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
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
    }

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

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(responseData)
    }

  } catch (error) {
    console.error('Dashboard function error:', error)
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