'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ArrowLeft, Heart, TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle, RefreshCw, Calendar, BarChart3, Users, Activity, MessageSquare, Zap } from 'lucide-react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from 'recharts'

interface HealthScore {
  id: string
  tenant_id: string
  score: number
  breakdown: {
    usage: number
    success: number
    incidents: number
    nps: number
    engagement: number
  }
  risk_level: 'green' | 'yellow' | 'red'
  factors: {
    usage: any
    success: any
    incidents: any
    nps: any
    engagement: any
  }
  recommendations: string[]
  calculated_by: string
  notes?: string
  created_at: string
}

const riskConfig = {
  green: {
    label: 'Saludable',
    color: 'bg-green-500',
    textColor: 'text-green-700',
    bgColor: 'bg-green-50',
    icon: '✅',
    description: 'El cliente está en excelente estado'
  },
  yellow: {
    label: 'En Riesgo',
    color: 'bg-yellow-500', 
    textColor: 'text-yellow-700',
    bgColor: 'bg-yellow-50',
    icon: '⚠️',
    description: 'Requiere atención para prevenir problemas'
  },
  red: {
    label: 'Alto Riesgo',
    color: 'bg-red-500',
    textColor: 'text-red-700', 
    bgColor: 'bg-red-50',
    icon: '🚨',
    description: 'Necesita atención inmediata del CS'
  }
}

const componentConfig = {
  usage: {
    name: 'Uso de Plataforma',
    icon: Activity,
    description: 'Frecuencia y profundidad de uso',
    weight: '30%'
  },
  success: {
    name: 'Tasa de Éxito',
    icon: CheckCircle,
    description: 'Workflows exitosos vs fallidos',
    weight: '25%'
  },
  incidents: {
    name: 'Incidentes',
    icon: AlertTriangle,
    description: 'Tickets de soporte y problemas',
    weight: '20%'
  },
  nps: {
    name: 'Satisfacción',
    icon: Heart,
    description: 'NPS, CSAT y feedback',
    weight: '15%'
  },
  engagement: {
    name: 'Engagement',
    icon: Users,
    description: 'Adopción de features y actividad',
    weight: '10%'
  }
}

export default function HealthScorePage() {
  const t = useTranslations('support')
  const [healthScores, setHealthScores] = useState<HealthScore[]>([])
  const [currentScore, setCurrentScore] = useState<HealthScore | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    loadHealthScores()
  }, [])

  const loadHealthScores = async () => {
    setLoading(true)
    try {
      // Mock data - en producción vendría de la API
      const mockHealthScores: HealthScore[] = [
        {
          id: '1',
          tenant_id: 'current-tenant',
          score: 78,
          breakdown: {
            usage: 85,
            success: 92,
            incidents: 65,
            nps: 70,
            engagement: 75
          },
          risk_level: 'yellow',
          factors: {
            usage: {
              totalExecutions: 156,
              activeWorkflows: 8,
              avgExecutionTime: 3200,
              lastExecution: new Date(Date.now() - 6 * 60 * 60 * 1000),
              breakdown: {
                usageFrequency: 85,
                recentActivity: 90,
                workflowDiversity: 80,
                performance: 85
              }
            },
            success: {
              totalExecutions: 156,
              successfulExecutions: 144,
              failedExecutions: 12,
              successRate: 0.923
            },
            incidents: {
              totalTickets: 3,
              totalIncidents: 0,
              criticalIssues: 1,
              avgResolutionTime: 18.5
            },
            nps: {
              totalSurveys: 2,
              npsCount: 2,
              csatCount: 0,
              npsScore: 0
            },
            engagement: {
              loginDays: 18,
              featureAdoption: 0.7,
              documentationViews: 8,
              supportInteractions: 3,
              apiUsage: 120,
              breakdown: {
                login: 75,
                features: 70,
                documentation: 80,
                support: 70,
                api: 80
              }
            }
          },
          recommendations: [
            'Resolver el ticket crítico P1 pendiente para mejorar el score de incidentes',
            'Incrementar participación en encuestas NPS para obtener mejor feedback',
            'Explorar nuevas funcionalidades para aumentar la adopción de features'
          ],
          calculated_by: 'scheduled_function',
          notes: 'Score influenciado por ticket P1 reciente',
          created_at: new Date().toISOString()
        },
        // Scores históricos para la gráfica
        {
          id: '2',
          tenant_id: 'current-tenant',
          score: 82,
          breakdown: { usage: 80, success: 90, incidents: 85, nps: 75, engagement: 70 },
          risk_level: 'green',
          factors: {},
          recommendations: [],
          calculated_by: 'scheduled_function',
          created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
          id: '3',
          tenant_id: 'current-tenant',
          score: 75,
          breakdown: { usage: 75, success: 85, incidents: 70, nps: 65, engagement: 75 },
          risk_level: 'yellow',
          factors: {},
          recommendations: [],
          calculated_by: 'scheduled_function',
          created_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
          id: '4',
          tenant_id: 'current-tenant',
          score: 85,
          breakdown: { usage: 85, success: 95, incidents: 90, nps: 80, engagement: 65 },
          risk_level: 'green',
          factors: {},
          recommendations: [],
          calculated_by: 'scheduled_function',
          created_at: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString()
        }
      ]

      setHealthScores(mockHealthScores)
      setCurrentScore(mockHealthScores[0])
    } catch (error) {
      console.error('Error loading health scores:', error)
    } finally {
      setLoading(false)
    }
  }

  const recalculateScore = async () => {
    setRefreshing(true)
    try {
      // TODO: Llamar a la API para recalcular
      await new Promise(resolve => setTimeout(resolve, 2000)) // Simular delay
      await loadHealthScores()
    } catch (error) {
      console.error('Error recalculating score:', error)
    } finally {
      setRefreshing(false)
    }
  }

  const formatTimeAgo = (date: string) => {
    return formatDistanceToNow(new Date(date), { 
      addSuffix: true,
      locale: es
    })
  }

  const getScoreTrend = () => {
    if (healthScores.length < 2) return 'stable'
    const current = healthScores[0].score
    const previous = healthScores[1].score
    const diff = current - previous
    
    if (diff > 5) return 'up'
    if (diff < -5) return 'down'
    return 'stable'
  }

  const getTrendIcon = () => {
    const trend = getScoreTrend()
    switch (trend) {
      case 'up': return <TrendingUp className="h-4 w-4 text-green-500" />
      case 'down': return <TrendingDown className="h-4 w-4 text-red-500" />
      default: return <Minus className="h-4 w-4 text-gray-500" />
    }
  }

  const chartData = healthScores
    .slice()
    .reverse()
    .map(score => ({
      date: new Date(score.created_at).toLocaleDateString('es-MX', { 
        month: 'short', 
        day: 'numeric' 
      }),
      score: score.score,
      ...score.breakdown
    }))

  const pieData = currentScore ? Object.entries(currentScore.breakdown).map(([key, value]) => ({
    name: componentConfig[key as keyof typeof componentConfig].name,
    value,
    weight: componentConfig[key as keyof typeof componentConfig].weight
  })) : []

  const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#8dd1e1']

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Cargando Health Score...</p>
        </div>
      </div>
    )
  }

  if (!currentScore) {
    return (
      <div className="container mx-auto py-6">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            No se pudo cargar el Health Score. Intenta refrescar la página.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  const riskInfo = riskConfig[currentScore.risk_level]

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/support">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver a Soporte
          </Link>
        </Button>
      </div>

      <div className=\"space-y-6\">
        <div className=\"flex items-center justify-between\">
          <div>
            <h1 className=\"text-3xl font-bold flex items-center gap-3\">
              <Heart className=\"h-8 w-8\" />
              Health Score del Cliente
            </h1>
            <p className=\"text-muted-foreground mt-2\">
              Puntuación integral del estado de tu cuenta y uso de la plataforma
            </p>
          </div>
          
          <div className=\"flex items-center gap-3\">
            <div className=\"text-sm text-muted-foreground\">
              Actualizado {formatTimeAgo(currentScore.created_at)}
            </div>
            <Button 
              variant=\"outline\" 
              size=\"sm\" 
              onClick={recalculateScore} 
              disabled={refreshing}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Recalcular
            </Button>
          </div>
        </div>

        {/* Score principal */}
        <div className=\"grid grid-cols-1 lg:grid-cols-3 gap-6\">
          {/* Score actual */}
          <Card className={`lg:col-span-1 ${riskInfo.bgColor} border-2`}>
            <CardContent className=\"p-6 text-center\">
              <div className=\"space-y-4\">
                <div className=\"text-6xl font-bold flex items-center justify-center gap-2\">
                  {currentScore.score}
                  <span className=\"text-2xl text-muted-foreground\">/100</span>
                  {getTrendIcon()}
                </div>
                
                <div>
                  <Badge className={`${riskInfo.color} text-white text-lg px-4 py-1`}>
                    {riskInfo.icon} {riskInfo.label}
                  </Badge>
                  <p className={`text-sm mt-2 ${riskInfo.textColor}`}>
                    {riskInfo.description}
                  </p>
                </div>

                <Progress 
                  value={currentScore.score} 
                  className=\"h-3\"
                />
              </div>
            </CardContent>
          </Card>

          {/* Gráfica de tendencia */}
          <Card className=\"lg:col-span-2\">
            <CardHeader>
              <CardTitle className=\"flex items-center gap-2\">
                <BarChart3 className=\"h-5 w-5\" />
                Tendencia de Health Score
              </CardTitle>
              <CardDescription>
                Evolución del score en las últimas semanas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width=\"100%\" height={200}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray=\"3 3\" />
                  <XAxis dataKey=\"date\" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip 
                    formatter={(value: any, name: string) => [`${value}/100`, 'Score']}
                    labelFormatter={(date) => `Fecha: ${date}`}
                  />
                  <Line 
                    type=\"monotone\" 
                    dataKey=\"score\" 
                    stroke=\"#8884d8\" 
                    strokeWidth={3}
                    dot={{ fill: '#8884d8', strokeWidth: 2, r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue=\"breakdown\" className=\"space-y-6\">
          <TabsList>
            <TabsTrigger value=\"breakdown\">Desglose por Componentes</TabsTrigger>
            <TabsTrigger value=\"details\">Detalles y Métricas</TabsTrigger>
            <TabsTrigger value=\"recommendations\">Recomendaciones</TabsTrigger>
          </TabsList>

          {/* Desglose por componentes */}
          <TabsContent value=\"breakdown\" className=\"space-y-6\">
            <div className=\"grid grid-cols-1 lg:grid-cols-3 gap-6\">
              {/* Scores por componente */}
              <div className=\"lg:col-span-2 space-y-4\">
                {Object.entries(currentScore.breakdown).map(([component, score]) => {
                  const config = componentConfig[component as keyof typeof componentConfig]
                  const Icon = config.icon
                  
                  return (
                    <Card key={component}>
                      <CardContent className=\"p-4\">
                        <div className=\"flex items-center justify-between mb-3\">
                          <div className=\"flex items-center gap-3\">
                            <div className=\"p-2 bg-primary/10 rounded-lg\">
                              <Icon className=\"h-5 w-5 text-primary\" />
                            </div>
                            <div>
                              <h3 className=\"font-semibold\">{config.name}</h3>
                              <p className=\"text-sm text-muted-foreground\">
                                {config.description} • Peso: {config.weight}
                              </p>
                            </div>
                          </div>
                          <div className=\"text-right\">
                            <div className=\"text-2xl font-bold\">{score}</div>
                            <div className=\"text-sm text-muted-foreground\">/ 100</div>
                          </div>
                        </div>
                        <Progress value={score} className=\"h-2\" />
                      </CardContent>
                    </Card>
                  )
                })}
              </div>

              {/* Gráfica de distribución */}
              <Card>
                <CardHeader>
                  <CardTitle>Distribución de Score</CardTitle>
                  <CardDescription>
                    Contribución de cada componente
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width=\"100%\" height={250}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx=\"50%\"
                        cy=\"50%\"
                        innerRadius={40}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey=\"value\"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(value: any, name: string, props: any) => [
                          `${value}/100`,
                          `${name} (${props.payload.weight})`
                        ]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  
                  {/* Leyenda */}
                  <div className=\"space-y-1 mt-4\">
                    {pieData.map((entry, index) => (
                      <div key={entry.name} className=\"flex items-center gap-2 text-xs\">
                        <div 
                          className=\"w-3 h-3 rounded\" 
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <span>{entry.name}: {entry.value}/100</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Detalles y métricas */}
          <TabsContent value=\"details\" className=\"space-y-6\">
            <div className=\"grid grid-cols-1 md:grid-cols-2 gap-6\">
              {/* Uso de Plataforma */}
              <Card>
                <CardHeader>
                  <CardTitle className=\"flex items-center gap-2\">
                    <Activity className=\"h-5 w-5\" />
                    Uso de Plataforma
                  </CardTitle>
                </CardHeader>
                <CardContent className=\"space-y-3\">
                  <div className=\"grid grid-cols-2 gap-4 text-sm\">
                    <div>
                      <span className=\"text-muted-foreground\">Ejecuciones Totales</span>
                      <div className=\"font-semibold\">{currentScore.factors.usage.totalExecutions}</div>
                    </div>
                    <div>
                      <span className=\"text-muted-foreground\">Workflows Activos</span>
                      <div className=\"font-semibold\">{currentScore.factors.usage.activeWorkflows}</div>
                    </div>
                    <div>
                      <span className=\"text-muted-foreground\">Tiempo Promedio</span>
                      <div className=\"font-semibold\">{(currentScore.factors.usage.avgExecutionTime / 1000).toFixed(1)}s</div>
                    </div>
                    <div>
                      <span className=\"text-muted-foreground\">Última Ejecución</span>
                      <div className=\"font-semibold\">{formatTimeAgo(currentScore.factors.usage.lastExecution)}</div>
                    </div>
                  </div>
                  
                  {currentScore.factors.usage.breakdown && (
                    <div className=\"pt-3 border-t space-y-2\">
                      <h4 className=\"font-medium text-sm\">Desglose:</h4>
                      {Object.entries(currentScore.factors.usage.breakdown).map(([key, value]) => (
                        <div key={key} className=\"flex justify-between text-xs\">
                          <span className=\"capitalize\">{key.replace(/([A-Z])/g, ' $1').toLowerCase()}</span>
                          <span>{value}/100</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Tasa de Éxito */}
              <Card>
                <CardHeader>
                  <CardTitle className=\"flex items-center gap-2\">
                    <CheckCircle className=\"h-5 w-5\" />
                    Tasa de Éxito
                  </CardTitle>
                </CardHeader>
                <CardContent className=\"space-y-3\">
                  <div className=\"grid grid-cols-2 gap-4 text-sm\">
                    <div>
                      <span className=\"text-muted-foreground\">Exitosas</span>
                      <div className=\"font-semibold text-green-600\">{currentScore.factors.success.successfulExecutions}</div>
                    </div>
                    <div>
                      <span className=\"text-muted-foreground\">Fallidas</span>
                      <div className=\"font-semibold text-red-600\">{currentScore.factors.success.failedExecutions}</div>
                    </div>
                    <div className=\"col-span-2\">
                      <span className=\"text-muted-foreground\">Tasa de Éxito</span>
                      <div className=\"font-semibold text-lg\">
                        {(currentScore.factors.success.successRate * 100).toFixed(1)}%
                      </div>
                      <Progress value={currentScore.factors.success.successRate * 100} className=\"h-2 mt-1\" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Incidentes */}
              <Card>
                <CardHeader>
                  <CardTitle className=\"flex items-center gap-2\">
                    <AlertTriangle className=\"h-5 w-5\" />
                    Incidentes y Soporte
                  </CardTitle>
                </CardHeader>
                <CardContent className=\"space-y-3\">
                  <div className=\"grid grid-cols-2 gap-4 text-sm\">
                    <div>
                      <span className=\"text-muted-foreground\">Tickets Totales</span>
                      <div className=\"font-semibold\">{currentScore.factors.incidents.totalTickets}</div>
                    </div>
                    <div>
                      <span className=\"text-muted-foreground\">Críticos (P1)</span>
                      <div className=\"font-semibold text-red-600\">{currentScore.factors.incidents.criticalIssues}</div>
                    </div>
                    <div className=\"col-span-2\">
                      <span className=\"text-muted-foreground\">Tiempo Promedio Resolución</span>
                      <div className=\"font-semibold\">{currentScore.factors.incidents.avgResolutionTime}h</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Satisfacción */}
              <Card>
                <CardHeader>
                  <CardTitle className=\"flex items-center gap-2\">
                    <Heart className=\"h-5 w-5\" />
                    Satisfacción del Cliente
                  </CardTitle>
                </CardHeader>
                <CardContent className=\"space-y-3\">
                  <div className=\"text-center\">
                    {currentScore.factors.nps.npsScore !== null ? (
                      <div>
                        <div className=\"text-2xl font-bold\">
                          {currentScore.factors.nps.npsScore}
                        </div>
                        <div className=\"text-sm text-muted-foreground\">NPS Score</div>
                        <div className=\"text-xs text-muted-foreground mt-1\">
                          Basado en {currentScore.factors.nps.npsCount} respuestas
                        </div>
                      </div>
                    ) : (
                      <div className=\"text-muted-foreground\">
                        <MessageSquare className=\"h-8 w-8 mx-auto mb-2\" />
                        <div className=\"text-sm\">Datos insuficientes</div>
                        <div className=\"text-xs\">Mínimo 3 respuestas NPS</div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Recomendaciones */}
          <TabsContent value=\"recommendations\" className=\"space-y-6\">
            <div className=\"grid grid-cols-1 lg:grid-cols-2 gap-6\">
              <Card>
                <CardHeader>
                  <CardTitle>Acciones Recomendadas</CardTitle>
                  <CardDescription>
                    Pasos específicos para mejorar tu Health Score
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className=\"space-y-3\">
                    {currentScore.recommendations.map((recommendation, index) => (
                      <div key={index} className=\"flex gap-3 p-3 bg-muted/50 rounded-lg\">
                        <div className=\"bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold flex-shrink-0\">
                          {index + 1}
                        </div>
                        <p className=\"text-sm\">{recommendation}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Próximos Pasos</CardTitle>
                  <CardDescription>
                    Cómo continuar optimizando tu experiencia
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className=\"space-y-4\">
                    <Button asChild className=\"w-full\">
                      <Link href=\"/support/new\">
                        <MessageSquare className=\"h-4 w-4 mr-2\" />
                        Contactar Customer Success
                      </Link>
                    </Button>
                    
                    <Button variant=\"outline\" asChild className=\"w-full\">
                      <Link href=\"/support/kb\">
                        Explorar Base de Conocimiento
                      </Link>
                    </Button>
                    
                    <Button variant=\"outline\" asChild className=\"w-full\">
                      <Link href=\"/workflows\">
                        <Zap className=\"h-4 w-4 mr-2\" />
                        Optimizar Workflows
                      </Link>
                    </Button>

                    <div className=\"pt-4 border-t text-sm text-muted-foreground\">
                      <p>
                        <Calendar className=\"h-4 w-4 inline mr-1\" />
                        Próxima actualización programada para {new Date(Date.now() + 24 * 60 * 60 * 1000).toLocaleDateString('es-MX')}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}