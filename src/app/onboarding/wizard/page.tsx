'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { CheckCircle, Circle, Loader2, ArrowRight, ArrowLeft, Sparkles } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import OnboardingNavigation from '@/components/onboarding/OnboardingNavigation'

type Step = 1 | 2 | 3 | 4
type Vertical = 'cc' | 'fin'

interface WizardState {
  step: Step
  vertical: Vertical
  intent: 'low' | 'high'
  connected: string[]
  installed: { mock?: boolean; real?: boolean }
  country: string
  loading: boolean
}

export default function OnboardingWizardPage() {
  const router = useRouter()
  const supabase = createClient()
  const [state, setState] = useState<WizardState>({
    step: 1,
    vertical: 'cc',
    intent: 'low',
    connected: [],
    installed: {},
    country: 'MX',
    loading: false
  })

  useEffect(() => {
    // Detect vertical from UTM parameters
    const urlParams = new URLSearchParams(window.location.search)
    if (urlParams.get('utm_campaign')?.includes('fin')) {
      setState(prev => ({ ...prev, vertical: 'fin' }))
    }

    // Detect country
    fetch('/.netlify/functions/onboarding-geo')
      .then(r => r.json())
      .then(d => setState(prev => ({ ...prev, country: d.country || 'MX' })))
      .catch(() => console.log('Could not detect country'))
  }, [])

  const progress = useMemo(() => {
    const stepProgress = (state.step / 4) * 100
    return Math.max(25, stepProgress) // Minimum 25% to show progress
  }, [state.step])

  const canContinue = useMemo(() => {
    switch (state.step) {
      case 1: return true
      case 2: return state.connected.length >= 1
      case 3: return state.installed.mock && state.installed.real
      case 4: return true
      default: return false
    }
  }, [state.step, state.connected, state.installed])

  const handleVerticalSelect = (vertical: Vertical) => {
    setState(prev => ({ ...prev, vertical }))
    saveProgress('select_vertical', 'done', { vertical })
  }

  const handleConnect = (provider: string) => {
    setState(prev => {
      const newConnected = Array.from(new Set([...prev.connected, provider]))
      const newIntent = newConnected.length >= 1 ? 'high' : 'low'
      
      // Save progress when connecting first integration
      if (newConnected.length === 1) {
        saveProgress('connect_integration', 'done', { provider, connected: newConnected })
      }
      
      return {
        ...prev,
        connected: newConnected,
        intent: newIntent
      }
    })
  }

  const handleInstallTemplates = async () => {
    setState(prev => ({ ...prev, loading: true }))
    
    try {
      // Mock template - executes immediately
      const mockWorkflow = {
        name: `RP9 Demo - ${state.vertical.toUpperCase()}`,
        active: false,
        nodes: [
          {
            id: '1',
            name: 'Manual Trigger',
            type: 'n8n-nodes-base.manualTrigger',
            typeVersion: 1,
            parameters: {},
            position: [0, 0]
          },
          {
            id: '2',
            name: 'Demo Data',
            type: 'n8n-nodes-base.set',
            typeVersion: 1,
            parameters: {
              keepOnlySet: true,
              values: {
                string: [
                  { name: 'status', value: 'success' },
                  { name: 'message', value: `Demo ${state.vertical} workflow executed` },
                  { name: 'timestamp', value: new Date().toISOString() }
                ]
              }
            },
            position: [260, 0]
          }
        ],
        connections: {
          'Manual Trigger': {
            main: [[{ node: 'Demo Data', type: 'main', index: 0 }]]
          }
        }
      }

      // Real template - ready for configuration
      const realWorkflow = {
        name: `RP9 Production - ${state.vertical.toUpperCase()}`,
        active: false,
        nodes: [
          {
            id: '1',
            name: 'Webhook Trigger',
            type: 'n8n-nodes-base.webhook',
            typeVersion: 1,
            parameters: {},
            position: [0, 0]
          },
          {
            id: '2',
            name: state.vertical === 'cc' ? 'CRM Integration' : 'Finance Integration',
            type: 'n8n-nodes-base.httpRequest',
            typeVersion: 4,
            parameters: {
              url: state.vertical === 'cc' ? 'https://api.hubapi.com/' : 'https://api.quickbooks.com/',
              method: 'GET'
            },
            position: [260, 0]
          }
        ],
        connections: {
          'Webhook Trigger': {
            main: [[{ node: state.vertical === 'cc' ? 'CRM Integration' : 'Finance Integration', type: 'main', index: 0 }]]
          }
        }
      }

      const response = await fetch('/.netlify/functions/onboarding-templates-install', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          mockWorkflow,
          realWorkflow,
          vertical: state.vertical
        })
      })

      if (response.ok) {
        setState(prev => ({ ...prev, installed: { mock: true, real: true } }))
        await saveProgress('install_templates', 'done', {
          mock: true,
          real: true,
          vertical: state.vertical
        })
      } else {
        throw new Error('Failed to install templates')
      }
    } catch (error) {
      console.error('Error installing templates:', error)
      // Could add error state here
    } finally {
      setState(prev => ({ ...prev, loading: false }))
    }
  }

  const saveProgress = async (taskKey: string, status: string, meta: any = {}) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: tenant } = await supabase
        .from('tenants')
        .select('id')
        .eq('owner_user', user?.id)
        .single()

      if (tenant) {
        await fetch('/.netlify/functions/onboarding-save-progress', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            tenantId: tenant.id,
            userId: user?.id,
            taskKey,
            status,
            meta
          })
        })
      }
    } catch (error) {
      console.error('Error saving progress:', error)
    }
  }

  const handleNext = () => {
    if (canContinue && state.step < 4) {
      setState(prev => ({ ...prev, step: (prev.step + 1) as Step }))
    }
  }

  const handleBack = () => {
    if (state.step > 1) {
      setState(prev => ({ ...prev, step: (prev.step - 1) as Step }))
    }
  }

  const handleComplete = async () => {
    await saveProgress('wizard_completed', 'done', {
      vertical: state.vertical,
      connected: state.connected,
      installed: state.installed,
      country: state.country
    })
    router.push('/onboarding/checklist')
  }

  const getIntegrationOptions = () => {
    if (state.vertical === 'cc') {
      return [
        { id: 'hubspot', name: 'HubSpot CRM', description: 'Gestión de contactos y tickets' },
        { id: 'freshdesk', name: 'Freshdesk', description: 'Mesa de ayuda y soporte' },
        { id: 'wa-cloud', name: 'WhatsApp Business', description: 'Mensajería empresarial' },
        { id: 'zendesk', name: 'Zendesk', description: 'Atención al cliente' }
      ]
    } else {
      return [
        { id: 'qbo', name: 'QuickBooks', description: 'Contabilidad y facturación' },
        { id: 'siigo', name: 'Siigo', description: 'Software contable colombiano' },
        { id: 'belvo', name: 'Belvo', description: 'Open banking para LATAM' },
        { id: 'stripe', name: 'Stripe', description: 'Procesamiento de pagos' }
      ]
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold flex items-center justify-center gap-2">
          <Sparkles className="w-8 h-8 text-blue-600" />
          Bienvenido a RP9
        </h1>
        <p className="text-lg text-muted-foreground">
          Te ayudaremos a configurar tu automatización en menos de 5 minutos
        </p>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>País detectado:</span>
          <Badge variant="outline">{state.country}</Badge>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <Progress value={progress} className="h-2" />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Paso {state.step} de 4</span>
          <span>{Math.round(progress)}% completado</span>
        </div>
      </div>

      {/* Step Content */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {state.step === 1 && <Circle className="w-5 h-5" />}
            {state.step > 1 && <CheckCircle className="w-5 h-5 text-green-600" />}
            {state.step === 1 ? '¿Qué quieres automatizar primero?' : 'Vertical seleccionado'}
          </CardTitle>
          {state.step === 1 && (
            <CardDescription>
              Selecciona el área donde quieres ver resultados más rápido
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          {state.step === 1 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card
                className={`cursor-pointer transition-all hover:shadow-md ${
                  state.vertical === 'cc' ? 'ring-2 ring-blue-600' : ''
                }`}
                onClick={() => handleVerticalSelect('cc')}
              >
                <CardHeader className="text-center">
                  <CardTitle className="text-lg">Contact Center</CardTitle>
                  <CardDescription>
                    Automatiza atención al cliente, tickets y seguimientos
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="text-sm space-y-1 text-muted-foreground">
                    <li>• Creación automática de tickets</li>
                    <li>• Notificaciones por WhatsApp</li>
                    <li>• Seguimiento de casos</li>
                  </ul>
                </CardContent>
              </Card>

              <Card
                className={`cursor-pointer transition-all hover:shadow-md ${
                  state.vertical === 'fin' ? 'ring-2 ring-blue-600' : ''
                }`}
                onClick={() => handleVerticalSelect('fin')}
              >
                <CardHeader className="text-center">
                  <CardTitle className="text-lg">Finanzas</CardTitle>
                  <CardDescription>
                    Automatiza facturación, conciliación y reportes
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="text-sm space-y-1 text-muted-foreground">
                    <li>• Validación de facturas</li>
                    <li>• Conciliación automática</li>
                    <li>• Reportes financieros</li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          )}

          {state.step === 2 && (
            <div className="space-y-4">
              <div className="text-center">
                <h3 className="text-lg font-medium">Conecta tu primera integración</h3>
                <p className="text-muted-foreground">
                  Selecciona las herramientas que ya usas para {state.vertical === 'cc' ? 'atención al cliente' : 'finanzas'}
                </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {getIntegrationOptions().map((option) => (
                  <Card
                    key={option.id}
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      state.connected.includes(option.id) ? 'ring-2 ring-green-600 bg-green-50' : ''
                    }`}
                    onClick={() => handleConnect(option.id)}
                  >
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        {state.connected.includes(option.id) && (
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        )}
                        {option.name}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        {option.description}
                      </CardDescription>
                    </CardHeader>
                  </Card>
                ))}
              </div>

              {state.intent === 'high' && (
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <p className="text-sm text-green-700">
                    👍 ¡Excelente! Detectamos alta intención. Te sugerimos conectar una segunda integración
                  </p>
                </div>
              )}
            </div>
          )}

          {state.step === 3 && (
            <div className="space-y-4">
              <div className="text-center">
                <h3 className="text-lg font-medium">Instalar plantillas</h3>
                <p className="text-muted-foreground">
                  Instalaremos una plantilla demo (ejecuta inmediatamente) y una real (lista para producción)
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="border-blue-200">
                  <CardHeader>
                    <CardTitle className="text-base text-blue-700">Plantilla Demo</CardTitle>
                    <CardDescription>Se ejecuta inmediatamente para mostrar resultados</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Badge variant="secondary">Mock</Badge>
                  </CardContent>
                </Card>

                <Card className="border-green-200">
                  <CardHeader>
                    <CardTitle className="text-base text-green-700">Plantilla Real</CardTitle>
                    <CardDescription>Lista para configurar con tus credenciales</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Badge variant="outline">Producción</Badge>
                  </CardContent>
                </Card>
              </div>

              <div className="text-center">
                <Button
                  onClick={handleInstallTemplates}
                  disabled={state.loading || (state.installed.mock && state.installed.real)}
                  className="px-8"
                >
                  {state.loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {state.installed.mock && state.installed.real ? '✅ Plantillas instaladas' : 'Instalar plantillas (1-click)'}
                </Button>
              </div>

              {state.installed.mock && state.installed.real && (
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <p className="text-green-700">
                    ¡Plantillas listas! Ahora puedes probar la demo y configurar la real.
                  </p>
                </div>
              )}
            </div>
          )}

          {state.step === 4 && (
            <div className="space-y-4 text-center">
              <div>
                <h3 className="text-lg font-medium">¡Todo listo!</h3>
                <p className="text-muted-foreground">
                  Ahora puedes probar la plantilla demo y configurar la real
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">1. Ejecutar Demo</CardTitle>
                    <CardDescription>Ve resultados inmediatos</CardDescription>
                  </CardHeader>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">2. Configurar Real</CardTitle>
                    <CardDescription>Conecta tus credenciales</CardDescription>
                  </CardHeader>
                </Card>
              </div>

              <Button onClick={handleComplete} className="px-8">
                Ir al Dashboard
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={handleBack}
          disabled={state.step === 1}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Atrás
        </Button>

        {state.step < 4 && (
          <Button
            onClick={handleNext}
            disabled={!canContinue}
          >
            Continuar
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        )}
      </div>
    </div>
  )
}