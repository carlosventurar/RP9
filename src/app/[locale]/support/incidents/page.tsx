'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { ArrowLeft, Clock, AlertTriangle, CheckCircle, Eye, ExternalLink, RefreshCw, Activity, Globe } from 'lucide-react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { es, en } from 'date-fns/locale'

interface Incident {
  id: string
  title: string
  description?: string
  severity: 'P1' | 'P2' | 'P3'
  status: 'investigating' | 'identified' | 'monitoring' | 'resolved'
  impact?: string
  affected_services: string[]
  eta?: string
  status_provider_id?: string
  created_at: string
  updated_at: string
  updates: IncidentUpdate[]
}

interface IncidentUpdate {
  id: string
  at: string
  status: string
  message: string
  by_user?: string
  published_externally: boolean
}

interface SystemStatus {
  component: string
  status: 'operational' | 'degraded_performance' | 'partial_outage' | 'major_outage'
  description?: string
}

const severityConfig = {
  P1: { 
    label: 'Crítico', 
    color: 'destructive' as const, 
    icon: '🔴',
    description: 'Sistema no funcional'
  },
  P2: { 
    label: 'Alto', 
    color: 'warning' as const, 
    icon: '🟡',
    description: 'Funcionalidad importante afectada'
  },
  P3: { 
    label: 'Medio', 
    color: 'default' as const, 
    icon: '🟢',
    description: 'Problema menor'
  }
}

const statusConfig = {
  investigating: { 
    label: 'Investigando', 
    color: 'destructive' as const, 
    icon: '🔍',
    description: 'Estamos investigando el problema'
  },
  identified: { 
    label: 'Identificado', 
    color: 'warning' as const, 
    icon: '✅',
    description: 'Hemos identificado la causa'
  },
  monitoring: { 
    label: 'Monitoreando', 
    color: 'secondary' as const, 
    icon: '👀',
    description: 'Aplicamos una solución y estamos monitoreando'
  },
  resolved: { 
    label: 'Resuelto', 
    color: 'success' as const, 
    icon: '✅',
    description: 'El incidente ha sido resuelto'
  }
}

const componentStatusConfig = {
  operational: { 
    label: 'Operativo', 
    color: 'success' as const, 
    icon: '✅' 
  },
  degraded_performance: { 
    label: 'Rendimiento Degradado', 
    color: 'warning' as const, 
    icon: '⚠️' 
  },
  partial_outage: { 
    label: 'Interrupción Parcial', 
    color: 'destructive' as const, 
    icon: '🟡' 
  },
  major_outage: { 
    label: 'Interrupción Mayor', 
    color: 'destructive' as const, 
    icon: '🔴' 
  }
}

const mockSystemStatus: SystemStatus[] = [
  { component: 'API Principal', status: 'operational', description: 'Todos los endpoints funcionando normalmente' },
  { component: 'Dashboard Web', status: 'operational', description: 'Interfaz web completamente funcional' },
  { component: 'Motor de Workflows (n8n)', status: 'degraded_performance', description: 'Algunos workflows pueden ejecutarse más lento' },
  { component: 'Webhooks', status: 'operational', description: 'Entrega de webhooks normal' },
  { component: 'Sistema de Notificaciones', status: 'operational', description: 'Emails y notificaciones enviándose correctamente' },
  { component: 'Base de Datos', status: 'operational', description: 'Rendimiento normal de base de datos' }
]

export default function IncidentsPage() {
  const t = useTranslations('support')
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [systemStatus, setSystemStatus] = useState<SystemStatus[]>(mockSystemStatus)
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())

  useEffect(() => {
    loadIncidents()
    // Actualizar cada 30 segundos
    const interval = setInterval(loadIncidents, 30000)
    return () => clearInterval(interval)
  }, [])

  const loadIncidents = async () => {
    setLoading(true)
    try {
      // Mock data - en producción vendría de la API
      const mockIncidents: Incident[] = [
        {
          id: '1',
          title: 'Lentitud en la ejecución de workflows',
          description: 'Algunos usuarios están experimentando lentitud en la ejecución de workflows complejos.',
          severity: 'P2',
          status: 'monitoring',
          impact: 'Workflows pueden tardar hasta 2x más tiempo en ejecutarse',
          affected_services: ['Motor de Workflows (n8n)', 'API Principal'],
          eta: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 horas
          status_provider_id: 'ext-001',
          created_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
          updated_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
          updates: [
            {
              id: '1-1',
              at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
              status: 'investigating',
              message: 'Hemos detectado informes de lentitud en workflows. Nuestro equipo está investigando.',
              by_user: 'soporte@rp9.com',
              published_externally: true
            },
            {
              id: '1-2',
              at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
              status: 'identified',
              message: 'Hemos identificado un cuello de botella en nuestros servidores de procesamiento. Implementando optimizaciones.',
              by_user: 'engineering@rp9.com',
              published_externally: true
            },
            {
              id: '1-3',
              at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
              status: 'monitoring',
              message: 'Optimizaciones implementadas. Monitoreando el rendimiento para confirmar mejoras.',
              by_user: 'engineering@rp9.com',
              published_externally: true
            }
          ]
        },
        {
          id: '2',
          title: 'Mantenimiento programado - Actualizaciones de seguridad',
          description: 'Mantenimiento programado para aplicar actualizaciones críticas de seguridad.',
          severity: 'P3',
          status: 'resolved',
          impact: 'Posibles interrupciones menores de 5-10 minutos',
          affected_services: ['Dashboard Web'],
          created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          updated_at: new Date(Date.now() - 22 * 60 * 60 * 1000).toISOString(),
          updates: [
            {
              id: '2-1',
              at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
              status: 'investigating',
              message: 'Iniciando mantenimiento programado para actualizaciones de seguridad.',
              by_user: 'ops@rp9.com',
              published_externally: true
            },
            {
              id: '2-2',
              at: new Date(Date.now() - 22 * 60 * 60 * 1000).toISOString(),
              status: 'resolved',
              message: 'Mantenimiento completado exitosamente. Todos los servicios operativos.',
              by_user: 'ops@rp9.com',
              published_externally: true
            }
          ]
        }
      ]
      
      setIncidents(mockIncidents)
      setLastUpdated(new Date())
    } catch (error) {
      console.error('Error loading incidents:', error)
    } finally {
      setLoading(false)
    }
  }

  const activeIncidents = incidents.filter(i => i.status !== 'resolved')
  const resolvedIncidents = incidents.filter(i => i.status === 'resolved')

  const overallStatus = systemStatus.some(s => s.status === 'major_outage') 
    ? 'major_outage'
    : systemStatus.some(s => s.status === 'partial_outage')
    ? 'partial_outage' 
    : systemStatus.some(s => s.status === 'degraded_performance')
    ? 'degraded_performance'
    : 'operational'

  const formatTimeAgo = (date: string) => {
    return formatDistanceToNow(new Date(date), { 
      addSuffix: true,
      locale: es
    })
  }

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

      <div className="space-y-6">
        <div className=\"flex items-center justify-between\">
          <div>
            <h1 className=\"text-3xl font-bold flex items-center gap-3\">
              <Activity className=\"h-8 w-8\" />
              Estado del Sistema
            </h1>
            <p className=\"text-muted-foreground mt-2\">
              Estado actual de nuestros servicios e incidentes activos
            </p>
          </div>
          
          <div className=\"flex items-center gap-3\">
            <div className=\"text-sm text-muted-foreground\">
              Actualizado {formatTimeAgo(lastUpdated.toISOString())}
            </div>
            <Button variant=\"outline\" size=\"sm\" onClick={loadIncidents} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Actualizar
            </Button>
            <Button variant=\"outline\" size=\"sm\" asChild>
              <Link href=\"https://status.rp9.com\" target=\"_blank\">
                <Globe className=\"h-4 w-4 mr-2\" />
                Página de Estado
                <ExternalLink className=\"h-3 w-3 ml-1\" />
              </Link>
            </Button>
          </div>
        </div>

        {/* Estado general */}
        <Card>
          <CardContent className=\"p-6\">
            <div className=\"flex items-center justify-between\">
              <div className=\"flex items-center gap-3\">
                <div className=\"text-2xl\">
                  {componentStatusConfig[overallStatus].icon}
                </div>
                <div>
                  <h2 className=\"text-xl font-semibold\">
                    {overallStatus === 'operational' 
                      ? 'Todos los sistemas operativos' 
                      : 'Algunos sistemas afectados'}
                  </h2>
                  <p className=\"text-muted-foreground\">
                    {overallStatus === 'operational' 
                      ? 'Todos nuestros servicios están funcionando normalmente'
                      : `${activeIncidents.length} incidente${activeIncidents.length !== 1 ? 's' : ''} activo${activeIncidents.length !== 1 ? 's' : ''}`}
                  </p>
                </div>
              </div>
              <Badge variant={componentStatusConfig[overallStatus].color} className=\"text-sm\">
                {componentStatusConfig[overallStatus].label}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue=\"current\" className=\"space-y-6\">
          <TabsList>
            <TabsTrigger value=\"current\">
              Incidentes Actuales ({activeIncidents.length})
            </TabsTrigger>
            <TabsTrigger value=\"components\">Estado de Componentes</TabsTrigger>
            <TabsTrigger value=\"history\">Historial</TabsTrigger>
          </TabsList>

          {/* Incidentes actuales */}
          <TabsContent value=\"current\" className=\"space-y-4\">
            {activeIncidents.length === 0 ? (
              <Card>
                <CardContent className=\"p-8 text-center\">
                  <CheckCircle className=\"h-12 w-12 mx-auto mb-4 text-green-500\" />
                  <h3 className=\"text-lg font-semibold mb-2\">No hay incidentes activos</h3>
                  <p className=\"text-muted-foreground\">
                    Todos nuestros servicios están funcionando normalmente
                  </p>
                </CardContent>
              </Card>
            ) : (
              activeIncidents.map((incident) => (
                <Card key={incident.id}>
                  <CardHeader>
                    <div className=\"flex items-start justify-between\">
                      <div>
                        <CardTitle className=\"flex items-center gap-3\">
                          {severityConfig[incident.severity].icon} {incident.title}
                          <Badge variant={severityConfig[incident.severity].color}>
                            {incident.severity}
                          </Badge>
                          <Badge variant={statusConfig[incident.status].color}>
                            {statusConfig[incident.status].icon} {statusConfig[incident.status].label}
                          </Badge>
                        </CardTitle>
                        <CardDescription className=\"mt-2\">
                          {incident.description}
                        </CardDescription>
                      </div>
                      
                      {incident.status_provider_id && (
                        <Button variant=\"outline\" size=\"sm\" asChild>
                          <Link href={`https://status.rp9.com/incidents/${incident.status_provider_id}`} target=\"_blank\">
                            <ExternalLink className=\"h-4 w-4 mr-2\" />
                            Ver en Status Page
                          </Link>
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className=\"space-y-4\">
                    {/* Información del incidente */}
                    <div className=\"grid grid-cols-1 md:grid-cols-3 gap-4 text-sm\">
                      <div>
                        <span className=\"font-medium\">Impacto:</span>
                        <p className=\"text-muted-foreground\">{incident.impact || 'Evaluando impacto'}</p>
                      </div>
                      <div>
                        <span className=\"font-medium\">Servicios afectados:</span>
                        <p className=\"text-muted-foreground\">{incident.affected_services.join(', ')}</p>
                      </div>
                      <div>
                        <span className=\"font-medium\">Tiempo estimado:</span>
                        <p className=\"text-muted-foreground\">
                          {incident.eta 
                            ? new Date(incident.eta).toLocaleString('es-MX')
                            : 'Por determinar'}
                        </p>
                      </div>
                    </div>

                    {/* Timeline de updates */}
                    <div>
                      <h4 className=\"font-medium mb-3 flex items-center gap-2\">
                        <Clock className=\"h-4 w-4\" />
                        Actualizaciones
                      </h4>
                      <div className=\"space-y-3\">
                        {incident.updates.map((update) => (
                          <div key={update.id} className=\"flex gap-3 p-3 bg-muted/50 rounded\">
                            <div className=\"text-sm text-muted-foreground whitespace-nowrap\">
                              {formatTimeAgo(update.at)}
                            </div>
                            <div className=\"flex-1\">
                              <div className=\"flex items-center gap-2 mb-1\">
                                <Badge variant={statusConfig[update.status as keyof typeof statusConfig].color} className=\"text-xs\">
                                  {statusConfig[update.status as keyof typeof statusConfig].label}
                                </Badge>
                                {update.published_externally && (
                                  <Badge variant=\"outline\" className=\"text-xs\">
                                    <Globe className=\"h-3 w-3 mr-1\" />
                                    Público
                                  </Badge>
                                )}
                              </div>
                              <p className=\"text-sm\">{update.message}</p>
                              {update.by_user && (
                                <p className=\"text-xs text-muted-foreground mt-1\">
                                  Por {update.by_user}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* Estado de componentes */}
          <TabsContent value=\"components\" className=\"space-y-4\">
            <div className=\"grid grid-cols-1 md:grid-cols-2 gap-4\">
              {systemStatus.map((component) => (
                <Card key={component.component}>
                  <CardContent className=\"p-4\">
                    <div className=\"flex items-center justify-between mb-2\">
                      <h3 className=\"font-medium\">{component.component}</h3>
                      <Badge variant={componentStatusConfig[component.status].color}>
                        {componentStatusConfig[component.status].icon} {componentStatusConfig[component.status].label}
                      </Badge>
                    </div>
                    {component.description && (
                      <p className=\"text-sm text-muted-foreground\">{component.description}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Historial */}
          <TabsContent value=\"history\" className=\"space-y-4\">
            {resolvedIncidents.length === 0 ? (
              <Card>
                <CardContent className=\"p-8 text-center\">
                  <Clock className=\"h-12 w-12 mx-auto mb-4 text-muted-foreground\" />
                  <h3 className=\"text-lg font-semibold mb-2\">No hay incidentes recientes</h3>
                  <p className=\"text-muted-foreground\">
                    No se han reportado incidentes en los últimos 30 días
                  </p>
                </CardContent>
              </Card>
            ) : (
              resolvedIncidents.map((incident) => (
                <Card key={incident.id} className=\"opacity-75\">
                  <CardContent className=\"p-4\">
                    <div className=\"flex items-center justify-between\">
                      <div>
                        <h3 className=\"font-medium flex items-center gap-2\">
                          {severityConfig[incident.severity].icon} {incident.title}
                          <Badge variant=\"outline\">Resuelto</Badge>
                        </h3>
                        <p className=\"text-sm text-muted-foreground mt-1\">
                          {incident.description}
                        </p>
                        <div className=\"flex items-center gap-4 mt-2 text-xs text-muted-foreground\">
                          <span>Inicio: {formatTimeAgo(incident.created_at)}</span>
                          <span>Resolución: {formatTimeAgo(incident.updated_at)}</span>
                          <span>Duración: {formatDistanceToNow(new Date(incident.created_at), {
                            locale: es
                          })}</span>
                        </div>
                      </div>
                      <Badge variant={severityConfig[incident.severity].color} className=\"opacity-75\">
                        {incident.severity}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>

        {/* Información adicional */}
        <div className=\"grid grid-cols-1 md:grid-cols-2 gap-6\">
          <Card>
            <CardHeader>
              <CardTitle className=\"text-base\">¿Experimentas problemas?</CardTitle>
            </CardHeader>
            <CardContent>
              <p className=\"text-sm text-muted-foreground mb-4\">
                Si experimentas problemas no listados aquí, crea un ticket de soporte
              </p>
              <Button asChild>
                <Link href=\"/support/new\">Reportar Problema</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className=\"text-base\">Suscribirse a Actualizaciones</CardTitle>
            </CardHeader>
            <CardContent>
              <p className=\"text-sm text-muted-foreground mb-4\">
                Recibe notificaciones automáticas sobre el estado de nuestros servicios
              </p>
              <Button variant=\"outline\" asChild>
                <Link href=\"https://status.rp9.com/subscribe\" target=\"_blank\">
                  <Globe className=\"h-4 w-4 mr-2\" />
                  Suscribirse
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}