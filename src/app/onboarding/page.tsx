'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  Sparkles, 
  Target, 
  Trophy, 
  ArrowRight,
  Clock,
  CheckCircle
} from 'lucide-react'

export default function OnboardingIndexPage() {
  const router = useRouter()

  useEffect(() => {
    // Auto-redirect to wizard after a short delay to show welcome message
    const timer = setTimeout(() => {
      router.push('/onboarding/wizard')
    }, 3000)

    return () => clearTimeout(timer)
  }, [router])

  const handleStartOnboarding = () => {
    router.push('/onboarding/wizard')
  }

  const handleGoToChecklist = () => {
    router.push('/onboarding/checklist')
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      {/* Welcome Header */}
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center">
          <div className="p-4 bg-blue-100 rounded-full">
            <Sparkles className="w-12 h-12 text-blue-600" />
          </div>
        </div>
        <h1 className="text-4xl font-bold text-gray-900">
          ¡Bienvenido a RP9!
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
          Estás a solo unos minutos de automatizar tus procesos de negocio. 
          Nuestro sistema de onboarding te guiará paso a paso.
        </p>
      </div>

      {/* Progress Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="text-center hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="flex items-center justify-center mb-2">
              <Target className="w-8 h-8 text-blue-600" />
            </div>
            <CardTitle className="text-lg">Configuración Inicial</CardTitle>
            <CardDescription>
              Selecciona tu vertical y configura tus primeros templates
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
                <Clock className="w-4 h-4" />
                <span>~5 minutos</span>
              </div>
              <Button 
                onClick={handleStartOnboarding}
                className="w-full"
              >
                Comenzar Configuración
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="text-center hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="flex items-center justify-center mb-2">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <CardTitle className="text-lg">Lista de Tareas</CardTitle>
            <CardDescription>
              Completa las tareas para activar completamente tu cuenta
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
                <Clock className="w-4 h-4" />
                <span>~10 minutos</span>
              </div>
              <Button 
                onClick={handleGoToChecklist}
                variant="outline"
                className="w-full"
              >
                Ver Lista de Tareas
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="text-center hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="flex items-center justify-center mb-2">
              <Trophy className="w-8 h-8 text-yellow-600" />
            </div>
            <CardTitle className="text-lg">Activación</CardTitle>
            <CardDescription>
              ¡Obtén el máximo valor de RP9 con tu cuenta completamente activada!
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
                <Trophy className="w-4 h-4" />
                <span>¡Casi ahí!</span>
              </div>
              <Button 
                variant="secondary"
                className="w-full"
                disabled
              >
                Completa el onboarding
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* What You'll Get */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">¿Qué obtienes con el onboarding completo?</CardTitle>
          <CardDescription>
            Al completar todo el proceso de onboarding, desbloquearás:
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                <div>
                  <h4 className="font-medium">Templates Listos para Usar</h4>
                  <p className="text-sm text-gray-600">
                    Plantillas pre-configuradas para tu vertical de negocio
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                <div>
                  <h4 className="font-medium">Conexiones Configuradas</h4>
                  <p className="text-sm text-gray-600">
                    Integraciones con tus herramientas favoritas
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                <div>
                  <h4 className="font-medium">Primeros Resultados</h4>
                  <p className="text-sm text-gray-600">
                    Workflows ejecutándose y generando valor inmediato
                  </p>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                <div>
                  <h4 className="font-medium">Dashboard Personalizado</h4>
                  <p className="text-sm text-gray-600">
                    Métricas y reportes adaptados a tus necesidades
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                <div>
                  <h4 className="font-medium">Soporte Prioritario</h4>
                  <p className="text-sm text-gray-600">
                    Acceso a nuestro equipo de especialistas
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                <div>
                  <h4 className="font-medium">Funcionalidades Avanzadas</h4>
                  <p className="text-sm text-gray-600">
                    Acceso completo a todas las características de RP9
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Auto-redirect Notice */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="pt-6">
          <div className="text-center text-blue-800">
            <Sparkles className="w-8 h-8 mx-auto mb-2" />
            <p className="font-medium">Te redirigiremos automáticamente al wizard en unos segundos...</p>
            <p className="text-sm mt-1">O haz clic en "Comenzar Configuración" para empezar ahora</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}