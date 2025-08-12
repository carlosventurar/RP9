"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Activity, AlertTriangle, CheckCircle, Clock, TrendingUp, Zap } from "lucide-react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from "recharts"

interface MetricsData {
  executions_total: number
  executions_success: number
  executions_error: number
  executions_running: number
  executions_waiting: number
  workflows_active: number
  error_rate: number
  avg_execution_time: number
  nodes_execution_time: Record<string, number>
  source: string
  timeframe: string
  generated_at: string
}

interface TrendDataPoint {
  timestamp: string
  hour: string
  executions: number
  errors: number
  success_rate: number
  avg_time: number
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8']

export function MetricsDashboard() {
  const [metrics, setMetrics] = useState<MetricsData | null>(null)
  const [trends, setTrends] = useState<TrendDataPoint[]>([])
  const [timeframe, setTimeframe] = useState("24h")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchMetrics()
    const interval = setInterval(fetchMetrics, 5 * 60 * 1000) // Actualizar cada 5 min
    return () => clearInterval(interval)
  }, [timeframe])

  const fetchMetrics = async () => {
    try {
      const response = await fetch(`/.netlify/functions/n8n-metrics?timeframe=${timeframe}`)
      const data = await response.json()
      
      if (data.ok) {
        setMetrics(data.metrics)
        generateTrendData(data.metrics)
      }
    } catch (error) {
      console.error('Error fetching metrics:', error)
    } finally {
      setLoading(false)
    }
  }

  const generateTrendData = (metricsData: MetricsData) => {
    // Simular datos de tendencias por hora (en producción vendría de la base de datos)
    const hours = timeframe === '24h' ? 24 : timeframe === '7d' ? 7 * 24 : 30 * 24
    const trendData: TrendDataPoint[] = []
    
    for (let i = hours; i >= 0; i--) {
      const timestamp = new Date(Date.now() - i * 60 * 60 * 1000)
      const baseExecutions = Math.floor(Math.random() * 50) + 10
      const errors = Math.floor(baseExecutions * (metricsData.error_rate / 100))
      
      trendData.push({
        timestamp: timestamp.toISOString(),
        hour: timestamp.getHours().toString().padStart(2, '0') + ':00',
        executions: baseExecutions,
        errors,
        success_rate: ((baseExecutions - errors) / baseExecutions) * 100,
        avg_time: Math.random() * 2000 + 500
      })
    }
    
    setTrends(trendData)
  }

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('es-ES').format(num)
  }

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${Math.round(ms)}ms`
    return `${Math.round(ms / 1000)}s`
  }

  const getNodeFailures = () => {
    if (!metrics?.nodes_execution_time) return []
    
    return Object.entries(metrics.nodes_execution_time)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([node, failures]) => ({ node, failures }))
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'text-green-600'
      case 'error': return 'text-red-600'
      case 'running': return 'text-blue-600'
      case 'waiting': return 'text-yellow-600'
      default: return 'text-gray-600'
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64">Cargando métricas...</div>
  }

  if (!metrics) {
    return <div className="flex items-center justify-center h-64">No se pudieron cargar las métricas</div>
  }

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <Badge variant="outline" className="mb-2">
            Fuente: {metrics.source === 'n8n_direct' ? 'n8n Prometheus' : 'Métricas Derivadas'}
          </Badge>
          <p className="text-sm text-muted-foreground">
            Última actualización: {new Date(metrics.generated_at).toLocaleString('es-ES')}
          </p>
        </div>
        
        <Select value={timeframe} onValueChange={setTimeframe}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1h">Última hora</SelectItem>
            <SelectItem value="6h">Últimas 6 horas</SelectItem>
            <SelectItem value="24h">Últimas 24 horas</SelectItem>
            <SelectItem value="7d">Últimos 7 días</SelectItem>
            <SelectItem value="30d">Últimos 30 días</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Ejecuciones</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(metrics.executions_total)}</div>
            <p className="text-xs text-muted-foreground">
              en {timeframe === '24h' ? 'las últimas 24h' : `los últimos ${timeframe}`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tasa de Éxito</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {((metrics.executions_success / metrics.executions_total) * 100).toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              {formatNumber(metrics.executions_success)} exitosas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tasa de Error</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {metrics.error_rate.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              {formatNumber(metrics.executions_error)} fallidas
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
              {formatDuration(metrics.avg_execution_time)}
            </div>
            <p className="text-xs text-muted-foreground">por ejecución</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <Tabs defaultValue="trends" className="space-y-4">
        <TabsList>
          <TabsTrigger value="trends">Tendencias</TabsTrigger>
          <TabsTrigger value="failures">Fallos por Nodo</TabsTrigger>
          <TabsTrigger value="status">Estado Actual</TabsTrigger>
        </TabsList>

        <TabsContent value="trends" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Executions Trend */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Ejecuciones por Hora
                </CardTitle>
                <CardDescription>
                  Tendencia de ejecuciones en {timeframe}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={trends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="hour" 
                      tick={{ fontSize: 12 }}
                      interval="preserveStartEnd"
                    />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip 
                      labelFormatter={(label) => `Hora: ${label}`}
                      formatter={(value: number) => [formatNumber(value), 'Ejecuciones']}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="executions" 
                      stroke="#0066CC" 
                      strokeWidth={2}
                      dot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Success Rate Trend */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  Tasa de Éxito por Hora
                </CardTitle>
                <CardDescription>
                  Porcentaje de ejecuciones exitosas
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={trends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="hour" 
                      tick={{ fontSize: 12 }}
                      interval="preserveStartEnd"
                    />
                    <YAxis 
                      tick={{ fontSize: 12 }}
                      domain={[0, 100]}
                    />
                    <Tooltip 
                      labelFormatter={(label) => `Hora: ${label}`}
                      formatter={(value: number) => [`${value.toFixed(1)}%`, 'Tasa de Éxito']}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="success_rate" 
                      stroke="#00CC66" 
                      strokeWidth={2}
                      dot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="failures" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Top Node Failures */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  Top Fallos por Nodo
                </CardTitle>
                <CardDescription>
                  Nodos con más errores en {timeframe}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={getNodeFailures()} layout="horizontal">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" tick={{ fontSize: 12 }} />
                    <YAxis 
                      dataKey="node" 
                      type="category" 
                      width={80}
                      tick={{ fontSize: 10 }}
                    />
                    <Tooltip 
                      formatter={(value: number) => [formatNumber(value), 'Fallos']}
                    />
                    <Bar dataKey="failures" fill="#FF8042" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Node Failures List */}
            <Card>
              <CardHeader>
                <CardTitle>Detalle de Fallos</CardTitle>
                <CardDescription>
                  Lista completa de nodos con errores
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {getNodeFailures().map(({ node, failures }, index) => (
                    <div key={node} className="flex items-center justify-between p-2 bg-muted rounded">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                          #{index + 1}
                        </Badge>
                        <span className="font-medium text-sm">{node}</span>
                      </div>
                      <Badge variant="destructive">
                        {formatNumber(failures)} errores
                      </Badge>
                    </div>
                  ))}
                  {getNodeFailures().length === 0 && (
                    <div className="text-center text-muted-foreground py-8">
                      <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-600" />
                      ¡Sin errores de nodos!
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="status" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Status Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Distribución de Estados</CardTitle>
                <CardDescription>
                  Ejecuciones por estado actual
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Exitosas', value: metrics.executions_success, color: '#00C49F' },
                        { name: 'Errores', value: metrics.executions_error, color: '#FF8042' },
                        { name: 'Ejecutando', value: metrics.executions_running, color: '#0088FE' },
                        { name: 'Esperando', value: metrics.executions_waiting, color: '#FFBB28' },
                      ].filter(item => item.value > 0)}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {[
                        { name: 'Exitosas', value: metrics.executions_success, color: '#00C49F' },
                        { name: 'Errores', value: metrics.executions_error, color: '#FF8042' },
                        { name: 'Ejecutando', value: metrics.executions_running, color: '#0088FE' },
                        { name: 'Esperando', value: metrics.executions_waiting, color: '#FFBB28' },
                      ].filter(item => item.value > 0).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatNumber(value)} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* System Status */}
            <Card>
              <CardHeader>
                <CardTitle>Estado del Sistema</CardTitle>
                <CardDescription>
                  Información actual de workflows
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Workflows Activos</span>
                    <Badge variant="outline" className="text-lg px-3 py-1">
                      {formatNumber(metrics.workflows_active)}
                    </Badge>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className={`text-sm ${getStatusColor('success')}`}>Exitosas</span>
                      <span className="font-medium">{formatNumber(metrics.executions_success)}</span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className={`text-sm ${getStatusColor('error')}`}>Con Errores</span>
                      <span className="font-medium">{formatNumber(metrics.executions_error)}</span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className={`text-sm ${getStatusColor('running')}`}>Ejecutando</span>
                      <span className="font-medium">{formatNumber(metrics.executions_running)}</span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className={`text-sm ${getStatusColor('waiting')}`}>En Espera</span>
                      <span className="font-medium">{formatNumber(metrics.executions_waiting)}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}