'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ArrowLeft, Clock, Shield, AlertTriangle, CheckCircle, Info, Phone, Mail, MessageSquare } from 'lucide-react'
import Link from 'next/link'

interface SLAPlan {
  key: string
  name_es: string
  name_en: string
  channels: string[]
  frt_minutes: number
  support_hours: string
  escalation_enabled: boolean
}

interface SLAMatrix {
  plan_key: string
  severity: string
  frt_minutes: number
  restore_minutes: number
  description_es: string
  description_en: string
}

const severityConfig = {
  P1: { 
    label: 'P1 - Crítico', 
    color: 'destructive' as const, 
    icon: '🔴',
    description: 'Sistema completamente no funcional, impacto total en el negocio'
  },
  P2: { 
    label: 'P2 - Alto', 
    color: 'warning' as const, 
    icon: '🟡',
    description: 'Funcionalidad importante afectada, impacto significativo en el negocio'
  },
  P3: { 
    label: 'P3 - Medio', 
    color: 'default' as const, 
    icon: '🟢',
    description: 'Problema menor, consulta general o solicitud de mejora'
  }
}

const channelIcons = {
  email: { icon: Mail, label: 'Email' },
  chat: { icon: MessageSquare, label: 'Chat' },
  slack: { icon: Phone, label: 'Slack' }
}

const formatTime = (minutes: number): string => {
  if (minutes < 60) {
    return `${minutes} min`
  } else if (minutes < 1440) {
    const hours = Math.floor(minutes / 60)
    const remainingMinutes = minutes % 60
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`
  } else {
    const days = Math.floor(minutes / 1440)
    const remainingHours = Math.floor((minutes % 1440) / 60)
    return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`
  }
}

export default function SLAPage() {
  const t = useTranslations('support')
  const [plans, setPlans] = useState<SLAPlan[]>([])
  const [slaMatrix, setSlaMatrix] = useState<SLAMatrix[]>([])
  const [loading, setLoading] = useState(true)
  const [currentPlan, setCurrentPlan] = useState('pro') // Mock: plan actual del usuario

  useEffect(() => {
    const loadSLAData = async () => {
      setLoading(true)
      try {
        // Mock data - en producción vendría de la API
        const mockPlans: SLAPlan[] = [
          {
            key: 'starter',
            name_es: 'Básico',
            name_en: 'Starter',
            channels: ['email'],
            frt_minutes: 480, // 8 horas
            support_hours: '8x5',
            escalation_enabled: false
          },
          {
            key: 'pro',
            name_es: 'Profesional',
            name_en: 'Professional',
            channels: ['email', 'chat'],
            frt_minutes: 240, // 4 horas
            support_hours: '8x5',
            escalation_enabled: true
          },
          {
            key: 'enterprise',
            name_es: 'Empresarial',
            name_en: 'Enterprise',
            channels: ['email', 'chat', 'slack'],
            frt_minutes: 60, // 1 hora
            support_hours: '24x5',
            escalation_enabled: true
          }
        ]

        const mockSLAMatrix: SLAMatrix[] = [
          // Starter
          { plan_key: 'starter', severity: 'P1', frt_minutes: 480, restore_minutes: 120, description_es: 'Sistema no funcional', description_en: 'System down' },
          { plan_key: 'starter', severity: 'P2', frt_minutes: 480, restore_minutes: 480, description_es: 'Funcionalidad importante afectada', description_en: 'Important feature affected' },
          { plan_key: 'starter', severity: 'P3', frt_minutes: 480, restore_minutes: 2880, description_es: 'Problema menor o consulta', description_en: 'Minor issue or question' },
          
          // Pro
          { plan_key: 'pro', severity: 'P1', frt_minutes: 240, restore_minutes: 120, description_es: 'Sistema no funcional', description_en: 'System down' },
          { plan_key: 'pro', severity: 'P2', frt_minutes: 240, restore_minutes: 480, description_es: 'Funcionalidad importante afectada', description_en: 'Important feature affected' },
          { plan_key: 'pro', severity: 'P3', frt_minutes: 240, restore_minutes: 2880, description_es: 'Problema menor o consulta', description_en: 'Minor issue or question' },
          
          // Enterprise
          { plan_key: 'enterprise', severity: 'P1', frt_minutes: 60, restore_minutes: 120, description_es: 'Sistema no funcional', description_en: 'System down' },
          { plan_key: 'enterprise', severity: 'P2', frt_minutes: 60, restore_minutes: 480, description_es: 'Funcionalidad importante afectada', description_en: 'Important feature affected' },
          { plan_key: 'enterprise', severity: 'P3', frt_minutes: 60, restore_minutes: 2880, description_es: 'Problema menor o consulta', description_en: 'Minor issue or question' }
        ]

        setPlans(mockPlans)
        setSlaMatrix(mockSLAMatrix)
      } catch (error) {
        console.error('Error loading SLA data:', error)
      } finally {
        setLoading(false)
      }
    }

    loadSLAData()
  }, [])

  const getPlanSLA = (planKey: string) => {
    return slaMatrix.filter(sla => sla.plan_key === planKey)
  }

  const getCurrentPlan = () => {
    return plans.find(plan => plan.key === currentPlan)
  }

  if (loading) {
    return (
      <div className=\"min-h-screen flex items-center justify-center\">
        <div className=\"text-center\">
          <Clock className=\"h-8 w-8 animate-spin mx-auto mb-4\" />
          <p>Cargando información SLA...</p>
        </div>
      </div>
    )
  }

  const userPlan = getCurrentPlan()

  return (
    <div className=\"container mx-auto py-6 space-y-6\">
      {/* Header */}
      <div className=\"flex items-center gap-4 mb-6\">
        <Button variant=\"ghost\" size=\"sm\" asChild>
          <Link href=\"/support\">
            <ArrowLeft className=\"h-4 w-4 mr-2\" />
            Volver a Soporte
          </Link>
        </Button>
      </div>

      <div className=\"space-y-6\">
        <div>
          <h1 className=\"text-3xl font-bold flex items-center gap-3\">
            <Shield className=\"h-8 w-8\" />
            Acuerdos de Nivel de Servicio (SLA)
          </h1>
          <p className=\"text-muted-foreground mt-2\">
            Conoce nuestros compromisos de tiempo de respuesta y resolución según tu plan de soporte
          </p>
        </div>

        {/* Tu plan actual */}
        {userPlan && (
          <Alert>
            <CheckCircle className=\"h-4 w-4\" />
            <AlertDescription>
              <strong>Tu plan actual:</strong> {userPlan.name_es} - 
              Primera respuesta en {formatTime(userPlan.frt_minutes)}, 
              soporte {userPlan.support_hours}
            </AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue=\"matrix\" className=\"space-y-6\">
          <TabsList>
            <TabsTrigger value=\"matrix\">Matriz SLA</TabsTrigger>
            <TabsTrigger value=\"plans\">Comparar Planes</TabsTrigger>
            <TabsTrigger value=\"definitions\">Definiciones</TabsTrigger>
          </TabsList>

          {/* Matriz SLA */}
          <TabsContent value=\"matrix\" className=\"space-y-6\">
            {plans.map((plan) => {
              const planSLAs = getPlanSLA(plan.key)
              const isCurrentPlan = plan.key === currentPlan
              
              return (
                <Card key={plan.key} className={isCurrentPlan ? 'ring-2 ring-primary' : ''}>
                  <CardHeader>
                    <div className=\"flex items-center justify-between\">
                      <div>
                        <CardTitle className=\"flex items-center gap-2\">
                          {plan.name_es}
                          {isCurrentPlan && (
                            <Badge variant=\"default\">Tu Plan</Badge>
                          )}
                        </CardTitle>
                        <CardDescription>
                          Soporte {plan.support_hours} • Canales: {plan.channels.map(ch => channelIcons[ch as keyof typeof channelIcons]?.label).join(', ')}
                        </CardDescription>
                      </div>
                      <div className=\"flex gap-2\">
                        {plan.channels.map((channel) => {
                          const ChannelIcon = channelIcons[channel as keyof typeof channelIcons]?.icon
                          return ChannelIcon ? <ChannelIcon key={channel} className=\"h-5 w-5 text-muted-foreground\" /> : null
                        })}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className=\"overflow-x-auto\">
                      <table className=\"w-full\">
                        <thead>
                          <tr className=\"border-b\">
                            <th className=\"text-left py-2 font-medium\">Severidad</th>
                            <th className=\"text-left py-2 font-medium\">Descripción</th>
                            <th className=\"text-center py-2 font-medium\">Primera Respuesta</th>
                            <th className=\"text-center py-2 font-medium\">Tiempo de Resolución</th>
                          </tr>
                        </thead>
                        <tbody>
                          {planSLAs.map((sla) => (
                            <tr key={`${plan.key}-${sla.severity}`} className=\"border-b last:border-b-0\">
                              <td className=\"py-3\">
                                <Badge variant={severityConfig[sla.severity as keyof typeof severityConfig].color}>
                                  {severityConfig[sla.severity as keyof typeof severityConfig].icon} {sla.severity}
                                </Badge>
                              </td>
                              <td className=\"py-3 text-sm text-muted-foreground\">
                                {sla.description_es}
                              </td>
                              <td className=\"py-3 text-center\">
                                <Badge variant=\"outline\" className=\"font-mono\">
                                  {formatTime(sla.frt_minutes)}
                                </Badge>
                              </td>
                              <td className=\"py-3 text-center\">
                                <Badge variant=\"outline\" className=\"font-mono\">
                                  {formatTime(sla.restore_minutes)}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </TabsContent>

          {/* Comparar planes */}
          <TabsContent value=\"plans\" className=\"space-y-6\">
            <div className=\"grid grid-cols-1 md:grid-cols-3 gap-6\">
              {plans.map((plan) => {
                const isCurrentPlan = plan.key === currentPlan
                const planSLAs = getPlanSLA(plan.key)
                
                return (
                  <Card key={plan.key} className={isCurrentPlan ? 'ring-2 ring-primary' : ''}>
                    <CardHeader className=\"text-center\">
                      <CardTitle className=\"flex items-center justify-center gap-2\">
                        {plan.name_es}
                        {isCurrentPlan && (
                          <Badge variant=\"default\">Actual</Badge>
                        )}
                      </CardTitle>
                      <CardDescription>
                        Soporte {plan.support_hours}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className=\"space-y-4\">
                      {/* Canales */}
                      <div>
                        <h4 className=\"font-medium mb-2\">Canales de Soporte</h4>
                        <div className=\"space-y-1\">
                          {plan.channels.map((channel) => {
                            const ChannelIcon = channelIcons[channel as keyof typeof channelIcons]?.icon
                            const label = channelIcons[channel as keyof typeof channelIcons]?.label
                            return (
                              <div key={channel} className=\"flex items-center gap-2 text-sm\">
                                {ChannelIcon && <ChannelIcon className=\"h-4 w-4\" />}
                                {label}
                              </div>
                            )
                          })}
                        </div>
                      </div>

                      {/* SLA por severidad */}
                      <div>
                        <h4 className=\"font-medium mb-2\">Tiempos de Respuesta</h4>
                        <div className=\"space-y-2\">
                          {planSLAs.map((sla) => (
                            <div key={sla.severity} className=\"flex items-center justify-between text-sm\">
                              <Badge variant={severityConfig[sla.severity as keyof typeof severityConfig].color} className=\"text-xs\">
                                {sla.severity}
                              </Badge>
                              <span className=\"font-mono text-xs\">
                                {formatTime(sla.frt_minutes)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Escalamiento */}
                      <div className=\"pt-2 border-t\">
                        <div className=\"flex items-center gap-2 text-sm\">
                          {plan.escalation_enabled ? (
                            <>
                              <CheckCircle className=\"h-4 w-4 text-green-500\" />
                              Escalamiento automático
                            </>
                          ) : (
                            <>
                              <AlertTriangle className=\"h-4 w-4 text-muted-foreground\" />
                              Sin escalamiento
                            </>
                          )}
                        </div>
                      </div>

                      {!isCurrentPlan && (
                        <Button variant=\"outline\" className=\"w-full\" asChild>
                          <Link href=\"/billing\">Cambiar Plan</Link>
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </TabsContent>

          {/* Definiciones */}
          <TabsContent value=\"definitions\" className=\"space-y-6\">
            <div className=\"grid grid-cols-1 md:grid-cols-2 gap-6\">
              {/* Definiciones de severidad */}
              <Card>
                <CardHeader>
                  <CardTitle>Niveles de Severidad</CardTitle>
                  <CardDescription>
                    Clasificación de tickets según su impacto en el negocio
                  </CardDescription>
                </CardHeader>
                <CardContent className=\"space-y-4\">
                  {Object.entries(severityConfig).map(([severity, config]) => (
                    <div key={severity} className=\"space-y-2\">
                      <div className=\"flex items-center gap-2\">
                        <Badge variant={config.color}>
                          {config.icon} {config.label}
                        </Badge>
                      </div>
                      <p className=\"text-sm text-muted-foreground pl-2 border-l-2 border-muted\">
                        {config.description}
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Definiciones de tiempos */}
              <Card>
                <CardHeader>
                  <CardTitle>Definiciones de Tiempo</CardTitle>
                  <CardDescription>
                    Explicación de nuestras métricas de tiempo
                  </CardDescription>
                </CardHeader>
                <CardContent className=\"space-y-4\">
                  <div className=\"space-y-2\">
                    <h4 className=\"font-medium flex items-center gap-2\">
                      <Clock className=\"h-4 w-4\" />
                      Tiempo de Primera Respuesta (FRT)
                    </h4>
                    <p className=\"text-sm text-muted-foreground pl-6\">
                      Tiempo desde que creas el ticket hasta que recibas la primera respuesta de nuestro equipo.
                    </p>
                  </div>

                  <div className=\"space-y-2\">
                    <h4 className=\"font-medium flex items-center gap-2\">
                      <CheckCircle className=\"h-4 w-4\" />
                      Tiempo de Resolución
                    </h4>
                    <p className=\"text-sm text-muted-foreground pl-6\">
                      Tiempo desde que creas el ticket hasta que el problema se resuelve completamente.
                    </p>
                  </div>

                  <div className=\"space-y-2\">
                    <h4 className=\"font-medium flex items-center gap-2\">
                      <AlertTriangle className=\"h-4 w-4\" />
                      Horario de Soporte
                    </h4>
                    <div className=\"text-sm text-muted-foreground pl-6 space-y-1\">
                      <p><strong>8x5:</strong> Lunes a Viernes, 9:00 - 17:00 (GMT-6)</p>
                      <p><strong>24x5:</strong> Lunes a Viernes, 24 horas</p>
                      <p><strong>24x7:</strong> Todos los días, 24 horas</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Excepciones */}
              <Card className=\"md:col-span-2\">
                <CardHeader>
                  <CardTitle className=\"flex items-center gap-2\">
                    <Info className=\"h-4 w-4\" />
                    Excepciones y Consideraciones
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className=\"grid grid-cols-1 md:grid-cols-2 gap-4 text-sm\">
                    <div className=\"space-y-2\">
                      <h4 className=\"font-medium\">SLA se pausa cuando:</h4>
                      <ul className=\"space-y-1 text-muted-foreground\">
                        <li>• Esperamos información adicional de tu parte</li>
                        <li>• El ticket está en estado \"Esperando Cliente\"</li>
                        <li>• Se requiere acceso a sistemas externos</li>
                        <li>• Durante mantenimientos programados</li>
                      </ul>
                    </div>
                    <div className=\"space-y-2\">
                      <h4 className=\"font-medium\">Escalamiento automático:</h4>
                      <ul className=\"space-y-1 text-muted-foreground\">
                        <li>• P1: Escalamiento inmediato al manager</li>
                        <li>• P2: Escalamiento a las 2 horas sin respuesta</li>
                        <li>• P3: Escalamiento a las 24 horas sin respuesta</li>
                        <li>• Notificaciones automáticas por email/Slack</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* CTA */}
        <Card>
          <CardContent className=\"p-6 text-center\">
            <h3 className=\"text-lg font-semibold mb-2\">¿Necesitas crear un ticket?</h3>
            <p className=\"text-muted-foreground mb-4\">
              Nuestro equipo está listo para ayudarte según los SLA de tu plan
            </p>
            <div className=\"flex justify-center gap-3\">
              <Button asChild>
                <Link href=\"/support/new\">Crear Ticket</Link>
              </Button>
              <Button variant=\"outline\" asChild>
                <Link href=\"/support/kb\">Ver Base de Conocimiento</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}