'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Search, 
  Filter,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  PlayCircle,
  Calendar,
  ArrowUpDown,
  Activity,
  Server,
  Database,
  Cpu,
  MemoryStick,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  Zap,
  BarChart3,
  Gauge,
  RefreshCw
} from "lucide-react"
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

interface N8nMetrics {
  // Métricas básicas de ejecución
  executions_total: number
  executions_success: number
  executions_error: number
  executions_running: number
  executions_waiting: number
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
  system_health: 'healthy' | 'degraded' | 'critical' | 'unknown'
  database_status: 'connected' | 'disconnected' | 'slow' | 'unknown'
  redis_status: 'connected' | 'disconnected' | 'slow' | 'unknown'
  
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
  
  // Tendencias
  hourly_execution_trend: Array<{hour: string, count: number}>
  daily_success_rate: Array<{date: string, rate: number}>
  
  source?: string
  timeframe?: string
  generated_at?: string
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D']

export default function AnalyticsPage() {
  const [metrics, setMetrics] = useState<N8nMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [timeframe, setTimeframe] = useState<'1h' | '6h' | '12h' | '24h' | '7d' | '30d'>('24h')
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const fetchMetrics = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch(`/api/analytics/n8n?timeframe=${timeframe}`)
      if (!response.ok) {
        throw new Error(`Failed to fetch metrics: ${response.statusText}`)
      }
      
      const data = await response.json()
      if (data.ok && data.metrics) {
        setMetrics(data.metrics)
        setLastUpdated(new Date())
      } else {
        throw new Error(data.error || 'Invalid response format')
      }
    } catch (err) {
      console.error('Error fetching metrics:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMetrics()
  }, [timeframe])

  useEffect(() => {
    if (!autoRefresh) return
    
    const interval = setInterval(fetchMetrics, 30000) // Refresh every 30 seconds
    return () => clearInterval(interval)
  }, [autoRefresh, timeframe])

  const getHealthIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'degraded':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />
      case 'critical':
        return <XCircle className="h-4 w-4 text-red-500" />
      default:
        return <Minus className="h-4 w-4 text-gray-500" />
    }
  }

  const getHealthColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-600'
      case 'degraded': return 'text-yellow-600'
      case 'critical': return 'text-red-600'
      default: return 'text-gray-600'
    }
  }

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms.toFixed(0)}ms`
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
    return `${(ms / 60000).toFixed(1)}m`
  }

  const formatUptime = (ms: number) => {
    const days = Math.floor(ms / (24 * 60 * 60 * 1000))
    const hours = Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000))
    const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000))
    
    if (days > 0) return `${days}d ${hours}h`
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m`
  }

  const formatBytes = (bytes: number) => {
    const mb = bytes / (1024 * 1024)
    if (mb > 1024) return `${(mb / 1024).toFixed(1)} GB`
    return `${mb.toFixed(0)} MB`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Cargando analytics de producción...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analytics n8n - Producción</h1>
          <p className="text-muted-foreground">
            Monitoreo en tiempo real de tu instancia n8n
          </p>
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-center space-y-2 text-center">
              <div>
                <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold">Error al cargar métricas</h3>
                <p className="text-muted-foreground mb-4">{error}</p>
                <Button onClick={fetchMetrics} variant="outline">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Reintentar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!metrics) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analytics n8n - Producción</h1>
          <p className="text-muted-foreground">No hay datos disponibles</p>
        </div>
      </div>
    )
  }

  const executionData = [
    { name: 'Exitosas', value: metrics.executions_success, color: '#00C49F' },
    { name: 'Errores', value: metrics.executions_error, color: '#FF8042' },
    { name: 'Ejecutando', value: metrics.executions_running, color: '#0088FE' },
    { name: 'Esperando', value: metrics.executions_waiting, color: '#FFBB28' }
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analytics n8n - Producción</h1>
          <p className="text-muted-foreground">
            Monitoreo en tiempo real de tu instancia n8n
            {lastUpdated && (
              <span className="ml-2 text-xs">
                • Actualizado: {lastUpdated.toLocaleTimeString()}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <Select value={timeframe} onValueChange={(value: any) => setTimeframe(value)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">1 hora</SelectItem>
              <SelectItem value="6h">6 horas</SelectItem>
              <SelectItem value="12h">12 horas</SelectItem>
              <SelectItem value="24h">24 horas</SelectItem>
              <SelectItem value="7d">7 días</SelectItem>
              <SelectItem value="30d">30 días</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant={autoRefresh ? "default" : "outline"}
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
            Auto-refresh
          </Button>
          <Button variant="outline" size="sm" onClick={fetchMetrics}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualizar
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Vista General</TabsTrigger>
          <TabsTrigger value="performance">Rendimiento</TabsTrigger>
          <TabsTrigger value="health">Salud del Sistema</TabsTrigger>
          <TabsTrigger value="workflows">Workflows</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* KPI Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Ejecuciones</CardTitle>
                <PlayCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.executions_total?.toLocaleString() || 0}</div>
                <p className="text-xs text-muted-foreground">Últimas {timeframe}</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Tasa de Éxito</CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {metrics.success_rate?.toFixed(1) || 0}%
                </div>
                <p className="text-xs text-muted-foreground">
                  {metrics.executions_success || 0} exitosas
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Tiempo Promedio</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatDuration(metrics.avg_execution_time || 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  P95: {formatDuration(metrics.p95_execution_time || 0)}
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Workflows Activos</CardTitle>
                <Zap className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.workflows_active || 0}</div>
                <p className="text-xs text-muted-foreground">
                  de {metrics.workflows_total || 0} total
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Execution Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Distribución de Ejecuciones</CardTitle>
                <CardDescription>Estado de las ejecuciones en {timeframe}</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={executionData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {executionData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Hourly Trend */}
            <Card>
              <CardHeader>
                <CardTitle>Tendencia Horaria</CardTitle>
                <CardDescription>Ejecuciones por hora</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={metrics.hourly_execution_trend || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="hour" 
                      tickFormatter={(value) => new Date(value).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                    />
                    <YAxis />
                    <Tooltip 
                      labelFormatter={(value) => new Date(value).toLocaleString('es-ES')}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="count" 
                      stroke="#8884d8" 
                      strokeWidth={2} 
                      dot={{ fill: '#8884d8' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="performance" className="space-y-6">
          {/* Performance Metrics */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Tasa de Error</CardTitle>
                <XCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {metrics.error_rate?.toFixed(2) || 0}%
                </div>
                <p className="text-xs text-muted-foreground">
                  {metrics.executions_error || 0} errores de {metrics.executions_total || 0}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">P95 Duración</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatDuration(metrics.p95_execution_time || 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  95% de ejecuciones
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">P99 Duración</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatDuration(metrics.p99_execution_time || 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  99% de ejecuciones
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Top Slow Workflows */}
          <Card>
            <CardHeader>
              <CardTitle>Workflows Más Lentos</CardTitle>
              <CardDescription>Top 5 workflows por tiempo promedio de ejecución</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {metrics.top_slow_workflows?.length ? metrics.top_slow_workflows.map((workflow, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Badge variant="outline">#{index + 1}</Badge>
                      <span className="font-medium">{workflow.name}</span>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">{formatDuration(workflow.avg_time)}</div>
                      <div className="text-xs text-muted-foreground">promedio</div>
                    </div>
                  </div>
                )) : (
                  <p className="text-center text-muted-foreground py-4">
                    No hay datos de workflows lentos disponibles
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="health" className="space-y-6">
          {/* System Health */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Estado del Sistema</CardTitle>
                <Server className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-2">
                  {getHealthIcon(metrics.system_health)}
                  <span className={`text-lg font-semibold capitalize ${getHealthColor(metrics.system_health)}`}>
                    {metrics.system_health || 'Unknown'}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Uptime: {metrics.system_uptime ? formatUptime(metrics.system_uptime) : 'N/A'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Base de Datos</CardTitle>
                <Database className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-2">
                  {getHealthIcon(metrics.database_status === 'connected' ? 'healthy' : 
                                metrics.database_status === 'slow' ? 'degraded' : 'critical')}
                  <span className={`text-lg font-semibold capitalize ${getHealthColor(
                    metrics.database_status === 'connected' ? 'healthy' : 
                    metrics.database_status === 'slow' ? 'degraded' : 'critical'
                  )}`}>
                    {metrics.database_status || 'Unknown'}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Conexiones: {metrics.active_connections || 0}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Redis</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-2">
                  {getHealthIcon(metrics.redis_status === 'connected' ? 'healthy' : 
                                metrics.redis_status === 'slow' ? 'degraded' : 'critical')}
                  <span className={`text-lg font-semibold capitalize ${getHealthColor(
                    metrics.redis_status === 'connected' ? 'healthy' : 
                    metrics.redis_status === 'slow' ? 'degraded' : 'critical'
                  )}`}>
                    {metrics.redis_status || 'Unknown'}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Cola: {metrics.queue_size || 0} trabajos
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Recursos</CardTitle>
                <Gauge className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>CPU:</span>
                    <span className="font-semibold">{metrics.cpu_usage_percent || 0}%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Memoria:</span>
                    <span className="font-semibold">{metrics.memory_usage_mb || 0} MB</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="workflows" className="space-y-6">
          {/* Top Failing Workflows */}
          <Card>
            <CardHeader>
              <CardTitle>Workflows con Más Errores</CardTitle>
              <CardDescription>Top 5 workflows con mayor número de fallos</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {metrics.top_failing_workflows?.length ? metrics.top_failing_workflows.map((workflow, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Badge variant="destructive">#{index + 1}</Badge>
                      <span className="font-medium">{workflow.name}</span>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-red-600">{workflow.failures} errores</div>
                      <div className="text-xs text-muted-foreground">en {timeframe}</div>
                    </div>
                  </div>
                )) : (
                  <p className="text-center text-muted-foreground py-4">
                    No hay workflows con errores reportados
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Source Info */}
      {metrics.source && (
        <div className="text-xs text-muted-foreground text-center">
          Datos obtenidos de: {metrics.source} • Generado: {metrics.generated_at ? new Date(metrics.generated_at).toLocaleString('es-ES') : 'N/A'}
        </div>
      )}
    </div>
  )
}