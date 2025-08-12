'use client'

import React from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  ArrowLeft, 
  ArrowRight, 
  CheckCircle, 
  Circle, 
  Sparkles, 
  Target,
  List,
  Trophy
} from 'lucide-react'

interface NavigationStep {
  key: string
  title: string
  description: string
  path: string
  icon: React.ComponentType<{ className?: string }>
  completed?: boolean
  current?: boolean
}

interface OnboardingNavigationProps {
  currentStep?: string
  completedSteps?: string[]
  showStepIndicator?: boolean
  className?: string
}

const ONBOARDING_STEPS: NavigationStep[] = [
  {
    key: 'wizard',
    title: 'Configuración Inicial',
    description: 'Selecciona tu vertical y instala templates',
    path: '/onboarding/wizard',
    icon: Sparkles
  },
  {
    key: 'checklist',
    title: 'Lista de Tareas',
    description: 'Completa las tareas para activar tu cuenta',
    path: '/onboarding/checklist',
    icon: List
  }
]

export default function OnboardingNavigation({ 
  currentStep = 'wizard',
  completedSteps = [],
  showStepIndicator = true,
  className = '' 
}: OnboardingNavigationProps) {
  const router = useRouter()
  const pathname = usePathname()

  const currentStepIndex = ONBOARDING_STEPS.findIndex(step => 
    pathname.includes(step.path) || step.key === currentStep
  )
  
  const stepsWithStatus = ONBOARDING_STEPS.map((step, index) => ({
    ...step,
    completed: completedSteps.includes(step.key),
    current: index === currentStepIndex
  }))

  const handleStepClick = (step: NavigationStep) => {
    router.push(step.path)
  }

  const handlePrevious = () => {
    if (currentStepIndex > 0) {
      router.push(ONBOARDING_STEPS[currentStepIndex - 1].path)
    }
  }

  const handleNext = () => {
    if (currentStepIndex < ONBOARDING_STEPS.length - 1) {
      router.push(ONBOARDING_STEPS[currentStepIndex + 1].path)
    }
  }

  const canGoPrevious = currentStepIndex > 0
  const canGoNext = currentStepIndex < ONBOARDING_STEPS.length - 1

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Step Indicator */}
      {showStepIndicator && (
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                {stepsWithStatus.map((step, index) => {
                  const IconComponent = step.icon
                  
                  return (
                    <div key={step.key} className="flex items-center">
                      {/* Step Button */}
                      <button
                        onClick={() => handleStepClick(step)}
                        className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all ${
                          step.current 
                            ? 'border-blue-300 bg-blue-50 text-blue-700' 
                            : step.completed
                            ? 'border-green-300 bg-green-50 text-green-700 hover:bg-green-100'
                            : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {step.completed ? (
                            <CheckCircle className="w-5 h-5" />
                          ) : step.current ? (
                            <Circle className="w-5 h-5" />
                          ) : (
                            <IconComponent className="w-5 h-5" />
                          )}
                          <div className="text-left">
                            <div className="font-medium text-sm">{step.title}</div>
                            <div className="text-xs opacity-75">{step.description}</div>
                          </div>
                        </div>
                        {step.current && (
                          <Badge variant="secondary" className="text-xs">
                            Actual
                          </Badge>
                        )}
                      </button>
                      
                      {/* Arrow Connector */}
                      {index < stepsWithStatus.length - 1 && (
                        <ArrowRight className="w-4 h-4 text-gray-400 mx-2" />
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Progress Summary */}
              <div className="text-right">
                <div className="text-sm font-medium">
                  Paso {currentStepIndex + 1} de {ONBOARDING_STEPS.length}
                </div>
                <div className="text-xs text-muted-foreground">
                  {completedSteps.length} completados
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Navigation Controls */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={handlePrevious}
          disabled={!canGoPrevious}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Anterior
        </Button>

        <div className="flex items-center gap-2">
          {/* Current Step Info */}
          <div className="text-center">
            <h2 className="font-semibold text-lg">
              {ONBOARDING_STEPS[currentStepIndex]?.title}
            </h2>
            <p className="text-sm text-muted-foreground">
              {ONBOARDING_STEPS[currentStepIndex]?.description}
            </p>
          </div>
        </div>

        <Button
          onClick={handleNext}
          disabled={!canGoNext}
          className="flex items-center gap-2"
        >
          Siguiente
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Completion Status */}
      {completedSteps.length === ONBOARDING_STEPS.length && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="py-4">
            <div className="flex items-center justify-center gap-2 text-green-700">
              <Trophy className="w-5 h-5" />
              <span className="font-medium">
                ¡Felicitaciones! Has completado todo el onboarding
              </span>
            </div>
            <div className="text-center mt-2">
              <Button 
                onClick={() => router.push('/dashboard')}
                className="bg-green-600 hover:bg-green-700"
              >
                Ir al Dashboard Principal
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}