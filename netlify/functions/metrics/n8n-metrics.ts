import type { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface N8nMetrics {
  // Métricas básicas de ejecución
  executions_total: number
  executions_success: number
  executions_error: number
  executions_waiting: number
  executions_running: number
  workflows_active: number
  workflows_total: number
  
  // Métricas de rendimiento
  error_rate: number
  success_rate: number
  avg_execution_time: number
  p95_execution_time: number
  p99_execution_time: number
  
  // Métricas de salud del sistema
  system_uptime: number
  system_health: 'healthy' | 'degraded' | 'critical'
  database_status: 'connected' | 'disconnected' | 'slow'
  redis_status: 'connected' | 'disconnected' | 'slow'
  
  // Métricas de recursos
  memory_usage_mb: number
  cpu_usage_percent: number
  active_connections: number
  queue_size: number
  
  // Análisis de nodos y workflows
  nodes_execution_time: Record<string, number>
  top_failing_workflows: Array<{name: string, failures: number}>
  top_slow_workflows: Array<{name: string, avg_time: number}>
  node_failure_analysis: Record<string, number>
  
  // Métricas temporales
  hourly_execution_trend: Array<{hour: string, count: number}>
  daily_success_rate: Array<{date: string, rate: number}>
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

  const metrics: Partial<N8nMetrics> = {}

  // 1. Verificar salud del sistema
  try {
    const [healthResponse, readinessResponse] = await Promise.allSettled([
      fetch(`${n8nBaseUrl}/healthz`, {
        headers: { 'X-N8N-API-KEY': n8nApiKey },
        timeout: 5000
      }),
      fetch(`${n8nBaseUrl}/healthz/readiness`, {
        headers: { 'X-N8N-API-KEY': n8nApiKey },
        timeout: 5000
      })
    ])

    // Determinar estado del sistema
    const healthOk = healthResponse.status === 'fulfilled' && healthResponse.value.ok
    const readinessOk = readinessResponse.status === 'fulfilled' && readinessResponse.value.ok
    
    if (healthOk && readinessOk) {
      metrics.system_health = 'healthy'
      metrics.database_status = 'connected'
      metrics.redis_status = 'connected'
    } else if (healthOk && !readinessOk) {
      metrics.system_health = 'degraded'
      metrics.database_status = 'slow'
      metrics.redis_status = 'slow'
    } else {
      metrics.system_health = 'critical'
      metrics.database_status = 'disconnected'
      metrics.redis_status = 'disconnected'
    }
  } catch (error) {
    console.error('Health check failed:', error)
    metrics.system_health = 'critical'
    metrics.database_status = 'disconnected'
    metrics.redis_status = 'disconnected'
  }

  // 2. Intentar obtener métricas de Prometheus
  try {
    const metricsResponse = await fetch(`${n8nBaseUrl}/metrics`, {
      headers: {
        'X-N8N-API-KEY': n8nApiKey,
        'Accept': 'text/plain'
      },
      timeout: 10000
    })

    if (metricsResponse.ok) {
      const metricsText = await metricsResponse.text()
      const prometheusMetrics = parsePrometheusMetrics(metricsText)
      Object.assign(metrics, prometheusMetrics)
    }
  } catch (error) {
    console.log('Prometheus metrics not available, trying API approach')
  }

  // 3. Fallback: obtener métricas via API de n8n
  const [executionsResponse, workflowsResponse] = await Promise.allSettled([
    fetch(`${n8nBaseUrl}/api/v1/executions?limit=1000`, {
      headers: { 'X-N8N-API-KEY': n8nApiKey },
      timeout: 15000
    }),
    fetch(`${n8nBaseUrl}/api/v1/workflows`, {
      headers: { 'X-N8N-API-KEY': n8nApiKey },
      timeout: 10000
    })
  ])

  // Procesar executions con análisis avanzado
  if (executionsResponse.status === 'fulfilled' && executionsResponse.value.ok) {
    const executions = await executionsResponse.value.json()
    const executionData = executions.data || []

    metrics.executions_total = executionData.length
    metrics.executions_success = executionData.filter((e: any) => e.finished && !e.stoppedAt).length
    metrics.executions_error = executionData.filter((e: any) => e.stoppedAt && e.mode !== 'manual').length
    metrics.executions_running = executionData.filter((e: any) => !e.finished && !e.stoppedAt).length
    metrics.executions_waiting = executionData.filter((e: any) => e.waitTill).length

    // Calcular rates
    if (metrics.executions_total > 0) {
      metrics.error_rate = (metrics.executions_error / metrics.executions_total) * 100
      metrics.success_rate = (metrics.executions_success / metrics.executions_total) * 100
    }

    // Análisis de performance con percentiles
    const completedExecutions = executionData.filter((e: any) => e.finished && e.startedAt)
    if (completedExecutions.length > 0) {
      const durations = completedExecutions.map((e: any) => {
        const start = new Date(e.startedAt).getTime()
        const end = new Date(e.stoppedAt || e.finished).getTime()
        return end - start
      }).sort((a, b) => a - b)

      metrics.avg_execution_time = durations.reduce((sum, d) => sum + d, 0) / durations.length
      metrics.p95_execution_time = durations[Math.floor(durations.length * 0.95)] || 0
      metrics.p99_execution_time = durations[Math.floor(durations.length * 0.99)] || 0
    }

    // Análisis de workflows con más fallos
    const workflowFailures: Record<string, number> = {}
    const workflowTimes: Record<string, number[]> = {}
    
    executionData.forEach((e: any) => {
      if (e.workflowData?.name) {
        const workflowName = e.workflowData.name
        
        if (e.stoppedAt && e.mode !== 'manual') {
          workflowFailures[workflowName] = (workflowFailures[workflowName] || 0) + 1
        }
        
        if (e.finished && e.startedAt) {
          const duration = new Date(e.stoppedAt || e.finished).getTime() - new Date(e.startedAt).getTime()
          if (!workflowTimes[workflowName]) workflowTimes[workflowName] = []
          workflowTimes[workflowName].push(duration)
        }
      }
    })

    metrics.top_failing_workflows = Object.entries(workflowFailures)
      .map(([name, failures]) => ({ name, failures }))
      .sort((a, b) => b.failures - a.failures)
      .slice(0, 5)

    metrics.top_slow_workflows = Object.entries(workflowTimes)
      .map(([name, times]) => ({ 
        name, 
        avg_time: times.reduce((sum, time) => sum + time, 0) / times.length 
      }))
      .sort((a, b) => b.avg_time - a.avg_time)
      .slice(0, 5)

    // Tendencia horaria (últimas 24 horas)
    const hourlyTrend: Record<string, number> = {}
    const now = new Date()
    for (let i = 23; i >= 0; i--) {
      const hour = new Date(now.getTime() - (i * 60 * 60 * 1000))
      const hourKey = hour.toISOString().slice(0, 13) + ':00'
      hourlyTrend[hourKey] = 0
    }

    executionData.forEach((e: any) => {
      if (e.startedAt) {
        const executionHour = new Date(e.startedAt).toISOString().slice(0, 13) + ':00'
        if (hourlyTrend.hasOwnProperty(executionHour)) {
          hourlyTrend[executionHour]++
        }
      }
    })

    metrics.hourly_execution_trend = Object.entries(hourlyTrend)
      .map(([hour, count]) => ({ hour, count }))
  }

  // Procesar workflows
  if (workflowsResponse.status === 'fulfilled' && workflowsResponse.value.ok) {
    const workflows = await workflowsResponse.value.json()
    const workflowData = workflows.data || []
    metrics.workflows_active = workflowData.filter((w: any) => w.active).length
    metrics.workflows_total = workflowData.length
  }

  return metrics
}

function parsePrometheusMetrics(metricsText: string): Partial<N8nMetrics> {
  const metrics: Partial<N8nMetrics> = {}
  const lines = metricsText.split('\n')

  // Parse métricas avanzadas de Prometheus
  for (const line of lines) {
    if (line.startsWith('#') || !line.trim()) continue

    // Métricas básicas de ejecución
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

    if (line.includes('n8n_executions_running')) {
      const match = line.match(/n8n_executions_running\s+(\d+)/)
      if (match) metrics.executions_running = parseInt(match[1])
    }

    // Métricas de sistema
    if (line.includes('nodejs_heap_size_used_bytes')) {
      const match = line.match(/nodejs_heap_size_used_bytes\s+(\d+)/)
      if (match) metrics.memory_usage_mb = Math.round(parseInt(match[1]) / 1024 / 1024)
    }

    if (line.includes('process_cpu_user_seconds_total')) {
      const match = line.match(/process_cpu_user_seconds_total\s+([\d.]+)/)
      if (match) metrics.cpu_usage_percent = Math.round(parseFloat(match[1]) * 100)
    }

    if (line.includes('n8n_database_connections_active')) {
      const match = line.match(/n8n_database_connections_active\s+(\d+)/)
      if (match) metrics.active_connections = parseInt(match[1])
    }

    if (line.includes('n8n_queue_size')) {
      const match = line.match(/n8n_queue_size\s+(\d+)/)
      if (match) metrics.queue_size = parseInt(match[1])
    }

    // Métricas de tiempo de ejecución por percentiles
    if (line.includes('n8n_execution_duration_seconds{quantile="0.95"}')) {
      const match = line.match(/n8n_execution_duration_seconds\{quantile="0\.95"\}\s+([\d.]+)/)
      if (match) metrics.p95_execution_time = parseFloat(match[1]) * 1000 // convertir a ms
    }

    if (line.includes('n8n_execution_duration_seconds{quantile="0.99"}')) {
      const match = line.match(/n8n_execution_duration_seconds\{quantile="0\.99"\}\s+([\d.]+)/)
      if (match) metrics.p99_execution_time = parseFloat(match[1]) * 1000 // convertir a ms
    }

    // Uptime del sistema
    if (line.includes('process_start_time_seconds')) {
      const match = line.match(/process_start_time_seconds\s+([\d.]+)/)
      if (match) {
        const startTime = parseFloat(match[1]) * 1000 // convertir a ms
        metrics.system_uptime = Date.now() - startTime
      }
    }
  }

  // Calcular métricas derivadas
  if (metrics.executions_total && metrics.executions_total > 0) {
    if (metrics.executions_success !== undefined) {
      metrics.success_rate = (metrics.executions_success / metrics.executions_total) * 100
    }
    if (metrics.executions_error !== undefined) {
      metrics.error_rate = (metrics.executions_error / metrics.executions_total) * 100
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