import type { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface N8nMetrics {
  executions_total: number
  executions_success: number
  executions_error: number
  executions_waiting: number
  executions_running: number
  workflows_active: number
  nodes_execution_time: Record<string, number>
  error_rate: number
  avg_execution_time: number
}

interface UsageExecutionMetrics {
  timestamp: string
  tenant_id: string
  workflow_id: string
  execution_id: string
  status: 'success' | 'error' | 'running' | 'waiting'
  execution_time_ms: number
  node_failures: string[]
  created_at: string
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' })
    }
  }

  try {
    const { timeframe = '24h', tenant_id } = event.queryStringParameters || {}

    // Intentar obtener métricas directamente de n8n
    let n8nMetrics: Partial<N8nMetrics> = {}
    try {
      n8nMetrics = await fetchN8nMetrics()
    } catch (error) {
      console.log('N8n metrics endpoint not available, deriving from usage_executions')
    }

    // Derivar métricas de usage_executions
    const derivedMetrics = await getDerivedMetrics(timeframe, tenant_id)

    // Combinar métricas
    const combinedMetrics = {
      ...n8nMetrics,
      ...derivedMetrics,
      source: n8nMetrics.executions_total ? 'n8n_direct' : 'derived',
      timeframe,
      generated_at: new Date().toISOString()
    }

    return {
      statusCode: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300' // 5 minutes cache
      },
      body: JSON.stringify({
        ok: true,
        metrics: combinedMetrics
      })
    }

  } catch (error) {
    console.error('Error fetching metrics:', error)
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ok: false,
        error: 'Failed to fetch metrics',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
}

async function fetchN8nMetrics(): Promise<Partial<N8nMetrics>> {
  const n8nBaseUrl = process.env.N8N_BASE_URL?.replace(/\/$/, '')
  const n8nApiKey = process.env.N8N_API_KEY

  if (!n8nBaseUrl || !n8nApiKey) {
    throw new Error('N8n configuration missing')
  }

  // Intentar obtener métricas de Prometheus endpoint
  try {
    const metricsResponse = await fetch(`${n8nBaseUrl}/metrics`, {
      headers: {
        'X-N8N-API-KEY': n8nApiKey,
        'Accept': 'text/plain'
      }
    })

    if (metricsResponse.ok) {
      const metricsText = await metricsResponse.text()
      return parsePrometheusMetrics(metricsText)
    }
  } catch (error) {
    console.log('Prometheus metrics not available, trying API approach')
  }

  // Fallback: obtener métricas via API de n8n
  const [executionsResponse, workflowsResponse] = await Promise.allSettled([
    fetch(`${n8nBaseUrl}/api/v1/executions?limit=1000`, {
      headers: { 'X-N8N-API-KEY': n8nApiKey }
    }),
    fetch(`${n8nBaseUrl}/api/v1/workflows`, {
      headers: { 'X-N8N-API-KEY': n8nApiKey }
    })
  ])

  const metrics: Partial<N8nMetrics> = {}

  // Procesar executions
  if (executionsResponse.status === 'fulfilled' && executionsResponse.value.ok) {
    const executions = await executionsResponse.value.json()
    const executionData = executions.data || []

    metrics.executions_total = executionData.length
    metrics.executions_success = executionData.filter((e: any) => e.finished && !e.stoppedAt).length
    metrics.executions_error = executionData.filter((e: any) => e.stoppedAt).length
    metrics.executions_running = executionData.filter((e: any) => !e.finished && !e.stoppedAt).length
    metrics.executions_waiting = executionData.filter((e: any) => e.waitTill).length

    // Calcular tiempo promedio de ejecución
    const completedExecutions = executionData.filter((e: any) => e.finished)
    if (completedExecutions.length > 0) {
      const totalTime = completedExecutions.reduce((sum: number, e: any) => {
        const start = new Date(e.startedAt).getTime()
        const end = new Date(e.stoppedAt || e.finished).getTime()
        return sum + (end - start)
      }, 0)
      metrics.avg_execution_time = totalTime / completedExecutions.length
    }

    // Calcular error rate
    if (metrics.executions_total > 0) {
      metrics.error_rate = (metrics.executions_error / metrics.executions_total) * 100
    }
  }

  // Procesar workflows
  if (workflowsResponse.status === 'fulfilled' && workflowsResponse.value.ok) {
    const workflows = await workflowsResponse.value.json()
    const workflowData = workflows.data || []
    metrics.workflows_active = workflowData.filter((w: any) => w.active).length
  }

  return metrics
}

function parsePrometheusMetrics(metricsText: string): Partial<N8nMetrics> {
  const metrics: Partial<N8nMetrics> = {}
  const lines = metricsText.split('\n')

  for (const line of lines) {
    if (line.startsWith('#') || !line.trim()) continue

    // Parse métricas básicas de n8n
    if (line.includes('n8n_executions_total')) {
      const match = line.match(/n8n_executions_total\s+(\d+)/)
      if (match) metrics.executions_total = parseInt(match[1])
    }

    if (line.includes('n8n_executions_success_total')) {
      const match = line.match(/n8n_executions_success_total\s+(\d+)/)
      if (match) metrics.executions_success = parseInt(match[1])
    }

    if (line.includes('n8n_executions_error_total')) {
      const match = line.match(/n8n_executions_error_total\s+(\d+)/)
      if (match) metrics.executions_error = parseInt(match[1])
    }
  }

  return metrics
}

async function getDerivedMetrics(timeframe: string, tenantId?: string): Promise<Partial<N8nMetrics>> {
  const hoursBack = getHoursFromTimeframe(timeframe)
  const cutoffTime = new Date()
  cutoffTime.setHours(cutoffTime.getHours() - hoursBack)

  let query = supabase
    .from('usage_executions')
    .select('*')
    .gte('created_at', cutoffTime.toISOString())

  if (tenantId) {
    query = query.eq('tenant_id', tenantId)
  }

  const { data: executions, error } = await query

  if (error) {
    throw new Error(`Database query failed: ${error.message}`)
  }

  const executionData = executions || []
  
  const metrics: Partial<N8nMetrics> = {
    executions_total: executionData.length,
    executions_success: executionData.filter(e => e.status === 'success').length,
    executions_error: executionData.filter(e => e.status === 'error').length,
    executions_running: executionData.filter(e => e.status === 'running').length,
    executions_waiting: executionData.filter(e => e.status === 'waiting').length
  }

  // Calcular tiempo promedio de ejecución
  const completedExecutions = executionData.filter(e => e.execution_time_ms > 0)
  if (completedExecutions.length > 0) {
    const totalTime = completedExecutions.reduce((sum, e) => sum + e.execution_time_ms, 0)
    metrics.avg_execution_time = totalTime / completedExecutions.length
  }

  // Calcular error rate
  if (metrics.executions_total > 0) {
    metrics.error_rate = (metrics.executions_error / metrics.executions_total) * 100
  }

  // Obtener fallos por nodo
  const nodeFailures: Record<string, number> = {}
  executionData.forEach(execution => {
    if (execution.node_failures && Array.isArray(execution.node_failures)) {
      execution.node_failures.forEach(nodeName => {
        nodeFailures[nodeName] = (nodeFailures[nodeName] || 0) + 1
      })
    }
  })

  metrics.nodes_execution_time = nodeFailures

  return metrics
}

function getHoursFromTimeframe(timeframe: string): number {
  switch (timeframe.toLowerCase()) {
    case '1h': return 1
    case '6h': return 6
    case '12h': return 12
    case '24h': return 24
    case '7d': return 24 * 7
    case '30d': return 24 * 30
    default: return 24
  }
}