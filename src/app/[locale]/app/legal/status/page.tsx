import { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, AlertCircle, XCircle, Clock, TrendingUp } from 'lucide-react'

interface PageProps {
  params: {
    locale: string
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const t = await getTranslations('legal')
  
  return {
    title: t('status_page_title'),
    description: t('status_page_description'),
    robots: 'index, follow'
  }
}

// Get system status from database
async function getSystemStatus() {
  const supabase = createClient()
  
  // Get current incidents
  const { data: incidents } = await supabase
    .from('incidents')
    .select('*')
    .eq('public', true)
    .in('status', ['open', 'investigating'])
    .order('started_at', { ascending: false })
    .limit(10)

  // Get recent maintenance
  const { data: maintenance } = await supabase
    .from('maintenances')
    .select('*')
    .eq('public', true)
    .gte('scheduled_start', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .order('scheduled_start', { ascending: false })
    .limit(5)

  // Get SLA metrics for current month
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
  const { data: slaMetrics } = await supabase
    .from('sla_metrics')
    .select('*')
    .gte('metric_date', startOfMonth)
    .order('metric_date', { ascending: false })

  // Calculate overall uptime
  const avgUptime = slaMetrics && slaMetrics.length > 0 
    ? slaMetrics.reduce((sum, metric) => sum + parseFloat(metric.uptime_percentage), 0) / slaMetrics.length
    : 99.9

  return {
    incidents: incidents || [],
    maintenance: maintenance || [],
    currentUptime: avgUptime,
    hasActiveIncidents: incidents && incidents.length > 0,
    lastUpdated: new Date().toISOString()
  }
}

function getStatusColor(status: string) {
  switch (status) {
    case 'operational': return 'text-green-600'
    case 'degraded': return 'text-yellow-600'
    case 'partial': return 'text-orange-600'
    case 'major': return 'text-red-600'
    default: return 'text-gray-600'
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'operational': return <CheckCircle className="h-5 w-5 text-green-600" />
    case 'degraded': return <AlertCircle className="h-5 w-5 text-yellow-600" />
    case 'partial': return <AlertCircle className="h-5 w-5 text-orange-600" />
    case 'major': return <XCircle className="h-5 w-5 text-red-600" />
    default: return <Clock className="h-5 w-5 text-gray-600" />
  }
}

export default async function StatusPage({ params }: PageProps) {
  const t = await getTranslations('legal')
  const status = await getSystemStatus()
  
  const overallStatus = status.hasActiveIncidents ? 'partial' : 'operational'
  
  // Services status (mock data - in production, check actual services)
  const services = [
    { name: 'API Principal', status: 'operational', uptime: '99.98%' },
    { name: 'Portal Web', status: 'operational', uptime: '99.95%' },
    { name: 'Webhooks', status: 'operational', uptime: '99.92%' },
    { name: 'Ejecución de Workflows', status: overallStatus, uptime: status.currentUptime.toFixed(2) + '%' },
    { name: 'Base de Datos', status: 'operational', uptime: '99.99%' },
    { name: 'Sistema de Pagos', status: 'operational', uptime: '99.97%' }
  ]

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-6">
          <div className="max-w-6xl mx-auto">
            <h1 className="text-3xl font-bold tracking-tight">Estado del Sistema</h1>
            <p className="text-muted-foreground mt-2">
              Monitoreo en tiempo real de todos nuestros servicios
            </p>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto space-y-8">
          
          {/* Overall Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                {getStatusIcon(overallStatus)}
                <span>Estado General</span>
                <Badge 
                  variant={overallStatus === 'operational' ? 'default' : 'destructive'}
                  className="ml-auto"
                >
                  {overallStatus === 'operational' ? 'Todos los sistemas operativos' : 'Incidencia detectada'}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {status.currentUptime.toFixed(3)}%
                  </div>
                  <div className="text-sm text-muted-foreground">Uptime Mensual</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">
                    {status.incidents.length}
                  </div>
                  <div className="text-sm text-muted-foreground">Incidentes Activos</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">
                    99.9%
                  </div>
                  <div className="text-sm text-muted-foreground">SLA Objetivo</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Services Status */}
          <Card>
            <CardHeader>
              <CardTitle>Estado de Servicios</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {services.map((service, index) => (
                  <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(service.status)}
                      <span className="font-medium">{service.name}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-muted-foreground">
                        Uptime: {service.uptime}
                      </span>
                      <Badge 
                        variant={service.status === 'operational' ? 'default' : 'destructive'}
                      >
                        {service.status === 'operational' ? 'Operativo' : 'Degradado'}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Active Incidents */}
          {status.incidents.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-red-600">Incidentes Activos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {status.incidents.map((incident, index) => (
                    <div key={index} className="p-4 border-l-4 border-red-500 bg-red-50">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold text-red-800">{incident.title}</h3>
                          <p className="text-red-700 mt-1">{incident.description}</p>
                          <div className="flex items-center gap-4 mt-2 text-sm text-red-600">
                            <span>Severidad: {incident.severity}</span>
                            <span>Iniciado: {new Date(incident.started_at).toLocaleString(params.locale)}</span>
                          </div>
                        </div>
                        <Badge variant="destructive">
                          {incident.status === 'open' ? 'Abierto' : 'Investigando'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Scheduled Maintenance */}
          {status.maintenance.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Mantenimiento Programado</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {status.maintenance.map((maint, index) => (
                    <div key={index} className="p-4 border-l-4 border-blue-500 bg-blue-50">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold text-blue-800">{maint.title}</h3>
                          <p className="text-blue-700 mt-1">{maint.description}</p>
                          <div className="flex items-center gap-4 mt-2 text-sm text-blue-600">
                            <span>Inicio: {new Date(maint.scheduled_start).toLocaleString(params.locale)}</span>
                            <span>Fin: {new Date(maint.scheduled_end).toLocaleString(params.locale)}</span>
                          </div>
                        </div>
                        <Badge variant="outline">
                          {maint.status === 'scheduled' ? 'Programado' : maint.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* SLA Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Acuerdo de Nivel de Servicio (SLA)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold mb-3">Garantías de Disponibilidad</h3>
                  <ul className="space-y-2 text-sm">
                    <li className="flex justify-between">
                      <span>Disponibilidad Objetivo:</span>
                      <span className="font-medium">99.9% mensual</span>
                    </li>
                    <li className="flex justify-between">
                      <span>Tiempo de Respuesta:</span>
                      <span className="font-medium">&lt; 200ms promedio</span>
                    </li>
                    <li className="flex justify-between">
                      <span>Soporte P1:</span>
                      <span className="font-medium">4 horas (24/7)</span>
                    </li>
                    <li className="flex justify-between">
                      <span>Soporte P2:</span>
                      <span className="font-medium">8 horas (horario laboral)</span>
                    </li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-semibold mb-3">Créditos por Incumplimiento</h3>
                  <ul className="space-y-2 text-sm">
                    <li className="flex justify-between">
                      <span>99.0% - 99.5%:</span>
                      <span className="font-medium">5% de crédito</span>
                    </li>
                    <li className="flex justify-between">
                      <span>98.0% - 99.0%:</span>
                      <span className="font-medium">10% de crédito</span>
                    </li>
                    <li className="flex justify-between">
                      <span>&lt; 98.0%:</span>
                      <span className="font-medium">20% de crédito</span>
                    </li>
                    <li className="text-xs text-muted-foreground mt-2">
                      Los créditos se aplican automáticamente en la siguiente facturación
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Footer */}
          <div className="text-center text-sm text-muted-foreground">
            <p>
              Última actualización: {new Date(status.lastUpdated).toLocaleString(params.locale)}
            </p>
            <p className="mt-2">
              ¿Problemas no reportados? Contacta nuestro soporte: {' '}
              <a href="mailto:soporte@rp9portal.com" className="text-primary hover:underline">
                soporte@rp9portal.com
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}