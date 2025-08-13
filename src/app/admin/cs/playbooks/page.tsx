'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ArrowLeft, CheckCircle, Clock, Users, Target, TrendingUp, Calendar, MessageSquare, Play, Pause, RotateCcw } from 'lucide-react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

interface PlaybookStep {
  id: string
  title: string
  description: string
  completed: boolean
  due_date?: string
  assigned_to?: string
  notes?: string
}

interface Playbook {
  id: string
  name: string
  description: string
  type: 'activation' | 'adoption' | 'expansion' | 'retention'
  trigger: string
  timeline_days: number
  success_criteria: string[]
  steps: PlaybookStep[]
  created_at: string
  updated_at: string
}

interface PlaybookExecution {
  id: string
  playbook_id: string
  tenant_id: string
  tenant_name: string
  status: 'active' | 'completed' | 'paused' | 'cancelled'
  progress: number
  started_at: string
  due_date: string
  assigned_csm: string
  current_step: number
  notes: string
}

const playbookTypes = {
  activation: {
    name: 'Activación D7',
    icon: '🚀',
    color: 'bg-blue-500',
    description: 'Primeros 7 días post-signup'
  },
  adoption: {
    name: 'Adopción D30',
    icon: '📈',
    color: 'bg-green-500',
    description: 'Profundizar uso primeros 30 días'
  },
  expansion: {
    name: 'Expansión D60-90',
    icon: '💎',
    color: 'bg-purple-500',
    description: 'Oportunidades de growth y upsell'
  },
  retention: {
    name: 'Retención',
    icon: '❤️',
    color: 'bg-red-500',
    description: 'Prevenir churn y renovar'
  }
}

const mockPlaybooks: Playbook[] = [
  {
    id: '1',
    name: 'Activación Nueva Cuenta',
    description: 'Guiar al cliente desde signup hasta primer workflow exitoso',
    type: 'activation',
    trigger: 'Nuevo signup',
    timeline_days: 7,
    success_criteria: [
      'Primer workflow creado y ejecutado exitosamente',
      'Al menos 3 ejecuciones completadas',
      'Configuración de perfil completada',
      'Primera integración conectada'
    ],
    steps: [
      {
        id: '1-1',
        title: 'Llamada de bienvenida',
        description: 'Contactar en las primeras 24h para dar bienvenida y ofrecer ayuda',
        completed: false,
        due_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: '1-2',
        title: 'Enviar recursos onboarding',
        description: 'Compartir guías, videos y templates relevantes para su caso de uso',
        completed: false,
        due_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: '1-3',
        title: 'Verificar primer workflow',
        description: 'Confirmar que han creado y ejecutado su primer workflow',
        completed: false,
        due_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: '1-4',
        title: 'Sesión de setup personalizada',
        description: 'Ofrecer 30min de setup asistido si no han progresado',
        completed: false,
        due_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: '1-5',
        title: 'Follow-up de activación',
        description: 'Verificar que están usando la plataforma activamente',
        completed: false,
        due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      }
    ],
    created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: '2',
    name: 'Adopción Profunda',
    description: 'Incrementar uso y adopción de features avanzadas',
    type: 'adoption',
    trigger: 'Health Score < 70 por 14 días',
    timeline_days: 30,
    success_criteria: [
      'Health Score > 80',
      'Uso de al menos 5 features diferentes',
      'Workflows complejos con múltiples integraciones',
      'API usage activo'
    ],
    steps: [
      {
        id: '2-1',
        title: 'Análisis de uso actual',
        description: 'Revisar métricas y identificar gaps de adopción',
        completed: false
      },
      {
        id: '2-2',
        title: 'Llamada de discovery',
        description: 'Entender objetivos y barreras para mejor adopción',
        completed: false
      },
      {
        id: '2-3',
        title: 'Plan de adopción personalizado',
        description: 'Crear roadmap específico con features prioritarias',
        completed: false
      },
      {
        id: '2-4',
        title: 'Training sessions semanales',
        description: 'Serie de 4 sesiones de 30min cada una',
        completed: false
      },
      {
        id: '2-5',
        title: 'Review de progreso',
        description: 'Evaluar mejoras en health score y uso',
        completed: false
      }
    ],
    created_at: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: '3',
    name: 'Expansión y Upsell',
    description: 'Identificar oportunidades de growth y upgrade de plan',
    type: 'expansion',
    trigger: 'Uso consistente por 60+ días + límites de plan',
    timeline_days: 90,
    success_criteria: [
      'Upgrade a plan superior',
      'Compra de add-ons o servicios adicionales',
      'Expansión a otros equipos/departamentos',
      'Aumento en ARR del cliente'
    ],
    steps: [
      {
        id: '3-1',
        title: 'Análisis de patterns de uso',
        description: 'Identificar señales de crecimiento y límites actuales',
        completed: false
      },
      {
        id: '3-2',
        title: 'Business case development',
        description: 'Calcular ROI y beneficios de expansión',
        completed: false
      },
      {
        id: '3-3',
        title: 'Stakeholder mapping',
        description: 'Identificar decision makers y influencers',
        completed: false
      },
      {
        id: '3-4',
        title: 'Propuesta de valor',
        description: 'Presentar upgrade path y beneficios específicos',
        completed: false
      },
      {
        id: '3-5',
        title: 'Negociación y cierre',
        description: 'Trabajar términos y completar expansión',
        completed: false
      }
    ],
    created_at: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
  }
]

const mockExecutions: PlaybookExecution[] = [
  {
    id: '1',
    playbook_id: '1',
    tenant_id: 'tenant-1',
    tenant_name: 'TechCorp Solutions',
    status: 'active',
    progress: 60,
    started_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    due_date: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(),
    assigned_csm: 'María González',
    current_step: 3,
    notes: 'Cliente muy engaged, progresando bien. Ya crearon 2 workflows.'
  },
  {
    id: '2',
    playbook_id: '2',
    tenant_id: 'tenant-2',
    tenant_name: 'Digital Marketing Pro',
    status: 'active',
    progress: 25,
    started_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    due_date: new Date(Date.now() + 23 * 24 * 60 * 60 * 1000).toISOString(),
    assigned_csm: 'Carlos Ruiz',
    current_step: 1,
    notes: 'Health score bajo. Necesitan más training en features avanzadas.'
  },
  {
    id: '3',
    playbook_id: '1',
    tenant_id: 'tenant-3',
    tenant_name: 'StartupXYZ',
    status: 'completed',
    progress: 100,
    started_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    due_date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    assigned_csm: 'Ana López',
    current_step: 5,
    notes: 'Activación exitosa. Cliente muy satisfecho, health score 85.'
  }
]

export default function CSPlaybooksPage() {
  const [playbooks, setPlaybooks] = useState<Playbook[]>(mockPlaybooks)
  const [executions, setExecutions] = useState<PlaybookExecution[]>(mockExecutions)
  const [selectedPlaybook, setSelectedPlaybook] = useState<Playbook | null>(null)
  const [activeTab, setActiveTab] = useState('overview')

  const formatTimeAgo = (date: string) => {
    return formatDistanceToNow(new Date(date), { 
      addSuffix: true,
      locale: es
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-blue-500'
      case 'completed': return 'bg-green-500'
      case 'paused': return 'bg-yellow-500'
      case 'cancelled': return 'bg-red-500'
      default: return 'bg-gray-500'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active': return 'Activo'
      case 'completed': return 'Completado'
      case 'paused': return 'Pausado'
      case 'cancelled': return 'Cancelado'
      default: return status
    }
  }

  const activeExecutions = executions.filter(e => e.status === 'active')
  const completedExecutions = executions.filter(e => e.status === 'completed')

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver a Admin
          </Link>
        </Button>
      </div>

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Users className="h-8 w-8" />
              Customer Success Playbooks
            </h1>
            <p className="text-muted-foreground mt-2">
              Workflows automatizados para activación, adopción, expansión y retención
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <Button variant="outline">
              <Target className="h-4 w-4 mr-2" />
              Nuevo Playbook
            </Button>
            <Button>
              <Play className="h-4 w-4 mr-2" />
              Ejecutar Playbook
            </Button>
          </div>
        </div>

        {/* Estadísticas rápidas */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">{activeExecutions.length}</div>
              <div className="text-sm text-muted-foreground">Ejecuciones Activas</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-green-600">{completedExecutions.length}</div>
              <div className="text-sm text-muted-foreground">Completadas</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-purple-600">{playbooks.length}</div>
              <div className="text-sm text-muted-foreground">Playbooks Activos</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-orange-600">
                {Math.round(executions.filter(e => e.status === 'completed').length / executions.length * 100)}%
              </div>
              <div className="text-sm text-muted-foreground">Tasa de Éxito</div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Vista General</TabsTrigger>
            <TabsTrigger value="playbooks">Playbooks</TabsTrigger>
            <TabsTrigger value="executions">Ejecuciones Activas</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          {/* Vista General */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Playbooks por tipo */}
              <Card>
                <CardHeader>
                  <CardTitle>Playbooks por Tipo</CardTitle>
                  <CardDescription>
                    Distribución de playbooks según fase del customer journey
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {Object.entries(playbookTypes).map(([type, config]) => {
                    const count = playbooks.filter(p => p.type === type).length
                    return (
                      <div key={type} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full ${config.color}`} />
                          <div>
                            <div className="font-medium">{config.name}</div>
                            <div className="text-sm text-muted-foreground">{config.description}</div>
                          </div>
                        </div>
                        <Badge variant="secondary">{count}</Badge>
                      </div>
                    )
                  })}
                </CardContent>
              </Card>

              {/* Ejecuciones recientes */}
              <Card>
                <CardHeader>
                  <CardTitle>Ejecuciones Recientes</CardTitle>
                  <CardDescription>
                    Últimas actividades de Customer Success
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {executions.slice(0, 5).map((execution) => {
                    const playbook = playbooks.find(p => p.id === execution.playbook_id)
                    return (
                      <div key={execution.id} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                        <div>
                          <div className="font-medium text-sm">{execution.tenant_name}</div>
                          <div className="text-xs text-muted-foreground">
                            {playbook?.name} • {execution.assigned_csm}
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge className={getStatusColor(execution.status)} variant="secondary">
                            {getStatusLabel(execution.status)}
                          </Badge>
                          <div className="text-xs text-muted-foreground mt-1">
                            {execution.progress}%
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Lista de Playbooks */}
          <TabsContent value="playbooks" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {playbooks.map((playbook) => {
                const config = playbookTypes[playbook.type]
                const execCount = executions.filter(e => e.playbook_id === playbook.id).length
                
                return (
                  <Card key={playbook.id} className="hover:shadow-md transition-shadow">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <Badge className={config.color} variant="secondary">
                          {config.icon} {config.name}
                        </Badge>
                        <Badge variant="outline">{execCount} ejecuciones</Badge>
                      </div>
                      <CardTitle className="text-lg">{playbook.name}</CardTitle>
                      <CardDescription>{playbook.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Timeline:</span>
                          <div className="font-medium">{playbook.timeline_days} días</div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Pasos:</span>
                          <div className="font-medium">{playbook.steps.length}</div>
                        </div>
                      </div>
                      
                      <div>
                        <span className="text-sm text-muted-foreground">Trigger:</span>
                        <div className="text-sm mt-1 p-2 bg-muted/50 rounded">{playbook.trigger}</div>
                      </div>

                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => setSelectedPlaybook(playbook)}
                        >
                          Ver Detalles
                        </Button>
                        <Button size="sm">
                          <Play className="h-3 w-3 mr-1" />
                          Ejecutar
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </TabsContent>

          {/* Ejecuciones Activas */}
          <TabsContent value="executions" className="space-y-6">
            <div className="space-y-4">
              {activeExecutions.map((execution) => {
                const playbook = playbooks.find(p => p.id === execution.playbook_id)
                const daysLeft = Math.ceil((new Date(execution.due_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                
                return (
                  <Card key={execution.id}>
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="font-semibold text-lg">{execution.tenant_name}</h3>
                          <p className="text-muted-foreground">{playbook?.name}</p>
                          <div className="flex items-center gap-4 mt-2 text-sm">
                            <span>CSM: {execution.assigned_csm}</span>
                            <span>Paso {execution.current_step} de {playbook?.steps.length}</span>
                            <span className={daysLeft < 2 ? 'text-red-600' : 'text-muted-foreground'}>
                              {daysLeft > 0 ? `${daysLeft} días restantes` : 'Vencido'}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold">{execution.progress}%</div>
                          <Progress value={execution.progress} className="w-32 mt-1" />
                        </div>
                      </div>

                      {execution.notes && (
                        <div className="mb-4 p-3 bg-muted/50 rounded">
                          <div className="text-sm font-medium mb-1">Notas:</div>
                          <div className="text-sm">{execution.notes}</div>
                        </div>
                      )}

                      <div className="flex gap-2">
                        <Button variant="outline" size="sm">
                          <MessageSquare className="h-3 w-3 mr-1" />
                          Contactar Cliente
                        </Button>
                        <Button variant="outline" size="sm">
                          <Calendar className="h-3 w-3 mr-1" />
                          Agendar Follow-up
                        </Button>
                        <Button variant="outline" size="sm">
                          <Pause className="h-3 w-3 mr-1" />
                          Pausar
                        </Button>
                        <Button variant="outline" size="sm">
                          Marcar Completado
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </TabsContent>

          {/* Analytics */}
          <TabsContent value="analytics" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Performance por Playbook</CardTitle>
                  <CardDescription>
                    Tasa de éxito y tiempo promedio de completado
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {playbooks.map((playbook) => {
                      const playbookExecutions = executions.filter(e => e.playbook_id === playbook.id)
                      const completed = playbookExecutions.filter(e => e.status === 'completed').length
                      const successRate = playbookExecutions.length > 0 ? (completed / playbookExecutions.length) * 100 : 0
                      
                      return (
                        <div key={playbook.id} className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>{playbook.name}</span>
                            <span>{Math.round(successRate)}% éxito</span>
                          </div>
                          <Progress value={successRate} className="h-2" />
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Métricas del Equipo</CardTitle>
                  <CardDescription>
                    Performance del equipo de Customer Success
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">92%</div>
                        <div className="text-sm text-muted-foreground">Tasa de Activación</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">4.2d</div>
                        <div className="text-sm text-muted-foreground">Tiempo Promedio</div>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span>María González</span>
                        <span>8 activos, 95% éxito</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Carlos Ruiz</span>
                        <span>6 activos, 88% éxito</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Ana López</span>
                        <span>5 activos, 100% éxito</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Modal de detalles de playbook */}
        {selectedPlaybook && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <Card className="max-w-2xl w-full max-h-[80vh] overflow-y-auto">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{selectedPlaybook.name}</CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedPlaybook(null)}>
                    ✕
                  </Button>
                </div>
                <CardDescription>{selectedPlaybook.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Tipo:</span>
                    <div className="font-medium">{playbookTypes[selectedPlaybook.type].name}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Timeline:</span>
                    <div className="font-medium">{selectedPlaybook.timeline_days} días</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Trigger:</span>
                    <div className="font-medium">{selectedPlaybook.trigger}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Pasos:</span>
                    <div className="font-medium">{selectedPlaybook.steps.length}</div>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-3">Criterios de Éxito:</h4>
                  <ul className="space-y-1 text-sm">
                    {selectedPlaybook.success_criteria.map((criteria, index) => (
                      <li key={index} className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        {criteria}
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h4 className="font-medium mb-3">Pasos del Playbook:</h4>
                  <div className="space-y-3">
                    {selectedPlaybook.steps.map((step, index) => (
                      <div key={step.id} className="flex gap-3 p-3 bg-muted/50 rounded">
                        <div className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold flex-shrink-0">
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <div className="font-medium">{step.title}</div>
                          <div className="text-sm text-muted-foreground mt-1">{step.description}</div>
                          {step.due_date && (
                            <div className="text-xs text-muted-foreground mt-2">
                              Vence: {formatTimeAgo(step.due_date)}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}