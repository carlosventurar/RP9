'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  CreditCard, 
  Download, 
  CheckCircle,
  Clock,
  Zap,
  Loader2
} from "lucide-react"
import { createClient } from '@/lib/supabase/client'
import { PLAN_CONFIG, createCheckoutSession, PlanKey } from '@/lib/stripe'

interface TenantData {
  id: string
  name: string
  plan: PlanKey
}

interface SubscriptionData {
  id: string
  status: string
  current_period_end: string
  stripe_customer_id: string
}

interface UsageData {
  executions: number
  workflows: number
  storage_mb: number
}

export default function BillingPage() {
  const [tenant, setTenant] = useState<TenantData | null>(null)
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null)
  const [usage, setUsage] = useState<UsageData>({ executions: 0, workflows: 0, storage_mb: 0 })
  const [loading, setLoading] = useState(true)
  const [upgrading, setUpgrading] = useState<PlanKey | null>(null)
  const supabase = createClient()

  useEffect(() => {
    loadBillingData()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadBillingData() {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      // Get tenant data
      const { data: tenantData, error: tenantError } = await supabase
        .from('tenants')
        .select('id, name, plan')
        .eq('owner_user_id', session.user.id)
        .single()

      if (tenantError) {
        console.error('Error loading tenant:', tenantError)
        return
      }

      setTenant(tenantData)

      // Get subscription data
      const { data: subscriptionData } = await supabase
        .from('subscriptions')
        .select('id, status, current_period_end, stripe_customer_id')
        .eq('tenant_id', tenantData.id)
        .single()

      setSubscription(subscriptionData)

      // Get usage data from dashboard API
      const response = await fetch('/api/dashboard', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })
      
      if (response.ok) {
        const dashboardData = await response.json()
        setUsage({
          executions: dashboardData.data?.metrics?.total_executions || 0,
          workflows: dashboardData.data?.metrics?.active_workflows || 0,
          storage_mb: 245 // Mock data for now
        })
      }

    } catch (error) {
      console.error('Error loading billing data:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleUpgrade(planKey: PlanKey) {
    if (!tenant || upgrading) return
    
    setUpgrading(planKey)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('No session')

      const { sessionUrl } = await createCheckoutSession(planKey, session.access_token)
      window.location.href = sessionUrl
    } catch (error) {
      console.error('Error creating checkout session:', error)
      alert('Error al iniciar el proceso de pago. Intenta de nuevo.')
    } finally {
      setUpgrading(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!tenant) {
    return (
      <div className="text-center py-8">
        <p>Error loading billing information</p>
      </div>
    )
  }

  const currentPlan = PLAN_CONFIG[tenant.plan]
  const planLimits = {
    executions: currentPlan.executions,
    workflows: currentPlan.workflows
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Facturación</h1>
        <p className="text-muted-foreground">
          Administra tu suscripción y visualiza detalles de uso
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Current Plan */}
        <Card className="col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Plan Actual
            </CardTitle>
            <CardDescription>
              Detalles de tu suscripción activa
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">{currentPlan.name}</div>
                <div className="text-muted-foreground">${currentPlan.price}/mes</div>
              </div>
              <Badge variant="default" className={subscription?.status === 'active' ? 'bg-green-500' : 'bg-orange-500'}>
                {subscription?.status === 'active' ? (
                  <><CheckCircle className="h-3 w-3 mr-1" />Activo</>
                ) : (
                  <><Clock className="h-3 w-3 mr-1" />{subscription?.status || 'Sin suscripción'}</>
                )}
              </Badge>
            </div>
            
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span>Ciclo de facturación</span>
                <span>Mensual</span>
              </div>
              {subscription?.current_period_end && (
                <div className="flex justify-between text-sm">
                  <span>Próxima facturación</span>
                  <span>{new Date(subscription.current_period_end).toLocaleDateString('es-ES')}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span>Estado del pago</span>
                <span>{subscription ? 'Configurado' : 'Pendiente'}</span>
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              {subscription?.stripe_customer_id && (
                <Button variant="outline" onClick={() => window.open('https://billing.stripe.com/p/login/test_00000000000000', '_blank')}>
                  Gestionar Suscripción
                </Button>
              )}
              <Button variant="outline" disabled>
                Actualizar Pago
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Usage Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Uso Este Mes</CardTitle>
            <CardDescription>
              Uso actual vs límites del plan
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Ejecuciones</span>
                <span>
                  {usage.executions.toLocaleString()} / {planLimits.executions === -1 ? '∞' : planLimits.executions.toLocaleString()}
                </span>
              </div>
              <div className="w-full bg-secondary rounded-full h-2">
                <div 
                  className="bg-primary h-2 rounded-full" 
                  style={{ 
                    width: planLimits.executions === -1 ? '0%' : `${Math.min((usage.executions / planLimits.executions) * 100, 100)}%` 
                  }}
                ></div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Workflows</span>
                <span>
                  {usage.workflows} / {planLimits.workflows === -1 ? '∞' : planLimits.workflows}
                </span>
              </div>
              <div className="w-full bg-secondary rounded-full h-2">
                <div 
                  className="bg-primary h-2 rounded-full" 
                  style={{ 
                    width: planLimits.workflows === -1 ? '0%' : `${Math.min((usage.workflows / planLimits.workflows) * 100, 100)}%` 
                  }}
                ></div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Almacenamiento</span>
                <span>{usage.storage_mb}MB / {currentPlan.storage}</span>
              </div>
              <div className="w-full bg-secondary rounded-full h-2">
                <div className="bg-primary h-2 rounded-full" style={{ width: '24%' }}></div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Available Plans */}
      <Card>
        <CardHeader>
          <CardTitle>Planes Disponibles</CardTitle>
          <CardDescription>
            Actualiza o cambia tu suscripción
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {Object.entries(PLAN_CONFIG).map(([key, plan]) => {
              const isCurrentPlan = key === tenant.plan
              const planKey = key as PlanKey
              
              return (
                <div 
                  key={key}
                  className={`border rounded-lg p-4 ${
                    isCurrentPlan ? 'bg-primary/5 border-primary' : ''
                  }`}
                >
                  <div className="text-center space-y-2">
                    <h3 className="text-lg font-semibold">{plan.name}</h3>
                    {isCurrentPlan && <Badge variant="default" className="mb-2">Actual</Badge>}
                    <div className="text-2xl font-bold">
                      ${plan.price}<span className="text-sm font-normal">/mes</span>
                    </div>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      {plan.features.map((feature, i) => (
                        <li key={i}>{feature}</li>
                      ))}
                    </ul>
                    
                    {isCurrentPlan ? (
                      <Button disabled className="w-full">Plan Actual</Button>
                    ) : (
                      <Button 
                        className="w-full"
                        variant={plan.price > currentPlan.price ? 'default' : 'outline'}
                        onClick={() => handleUpgrade(planKey)}
                        disabled={upgrading !== null}
                      >
                        {upgrading === planKey ? (
                          <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Procesando...</>
                        ) : plan.price > currentPlan.price ? (
                          <><Zap className="h-4 w-4 mr-2" />Actualizar</>
                        ) : (
                          'Cambiar Plan'
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Billing History */}
      <Card>
        <CardHeader>
          <CardTitle>Historial de Facturación</CardTitle>
          <CardDescription>
            Tus facturas y pagos recientes
          </CardDescription>
        </CardHeader>
        <CardContent>
          {subscription ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-4">
                  <div className="space-y-1">
                    <div className="font-medium">Suscripción {currentPlan.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {subscription.current_period_end && 
                        `Válido hasta ${new Date(subscription.current_period_end).toLocaleDateString('es-ES')}`
                      }
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="font-medium">${currentPlan.price}.00</div>
                    <Badge variant={subscription.status === 'active' ? 'default' : 'outline'}>
                      {subscription.status === 'active' ? (
                        <><CheckCircle className="h-3 w-3 mr-1" />Pagado</>
                      ) : (
                        <><Clock className="h-3 w-3 mr-1" />{subscription.status}</>
                      )}
                    </Badge>
                  </div>
                  <Button variant="ghost" size="sm" disabled>
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p>No hay historial de facturación disponible</p>
              <p className="text-sm mt-2">Suscríbete a un plan para ver tu historial</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}