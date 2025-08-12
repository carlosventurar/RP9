'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
  CheckCircle, 
  Circle, 
  Play, 
  Settings, 
  Calendar,
  Trophy,
  Target,
  Zap,
  ExternalLink,
  AlertCircle,
  Sparkles
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useOnboardingProgress } from '@/hooks/useOnboardingProgress'
import HealthScore from '@/components/onboarding/HealthScore'
import ProgressGamification from '@/components/onboarding/ProgressGamification'
import ProgressNotifications from '@/components/onboarding/ProgressNotifications'
import OnboardingNavigation from '@/components/onboarding/OnboardingNavigation'

export default function OnboardingChecklistPage() {
  const router = useRouter()
  const supabase = createClient()
  const [tenantId, setTenantId] = useState<string | null>(null)
  const [user, setUser] = useState<any>(null) // eslint-disable-line @typescript-eslint/no-explicit-any
  const [daysSinceSignup, setDaysSinceSignup] = useState(0)
  
  const {
    tasks,
    stats,
    isActivated,
    healthScore,
    loading,
    error,
    completeTask,
    markTaskError,
    refresh
  } = useOnboardingProgress(tenantId || undefined)

  useEffect(() => {
    loadUserData()
  }, [])

  const loadUserData = async () => {
    try {
      const { data: { user: userData } } = await supabase.auth.getUser()
      setUser(userData)
      
      if (userData) {
        const { data: tenant } = await supabase
          .from('tenants')
          .select('id')
          .eq('owner_user', userData.id)
          .single()

        if (tenant) {
          setTenantId(tenant.id)
          
          // Calculate days since signup
          const signupDate = new Date(tenant.created_at || userData.created_at)
          const daysSince = Math.floor(
            (new Date().getTime() - signupDate.getTime()) / (1000 * 60 * 60 * 24)
          )
          setDaysSinceSignup(daysSince)
        }
      }
    } catch (error) {
      console.error('Error loading user data:', error)
    }
  }

  const executeWorkflow = async (workflowName: string) => {
    try {
      const success = await completeTask('execute_mock', { 
        workflow_name: workflowName,
        execution_timestamp: new Date().toISOString()
      })
      if (!success) {
        await markTaskError('execute_mock', 'Error ejecutando workflow demo')
      }
    } catch (error) {
      console.error('Error executing workflow:', error)
      await markTaskError('execute_mock', 'Error ejecutando workflow')
    }
  }

  const handleCompleteTask = async (taskKey: string) => {
    const success = await completeTask(taskKey)
    if (!success) {
      console.error('Error completing task:', taskKey)
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Cargando tu progreso...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-red-800">Error cargando el progreso</h2>
              <p className="text-red-600 mt-2">{error}</p>
              <Button onClick={refresh} className="mt-4">
                Reintentar
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Navigation */}
      <OnboardingNavigation 
        currentStep="checklist"
        completedSteps={tasks.filter(t => t.status === 'done').length > 0 ? ['wizard'] : []}
        showStepIndicator={true}
      />

      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold flex items-center justify-center gap-2">
          <Target className="w-8 h-8 text-blue-600" />
          Tu Progreso de Onboarding
        </h1>
        <p className="text-lg text-muted-foreground">
          Completa estas tareas para obtener el máximo valor de RP9
        </p>
      </div>

      {/* Progress Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Progress Summary Card */}
        <Card className="md:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Target className="w-5 h-5 text-blue-600" />
              Progreso General
            </CardTitle>
            <CardDescription>
              {stats.completed} de {stats.total} tareas completadas
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Completado</span>
                <span className="font-medium">{stats.percentage}%</span>
              </div>
              <Progress value={stats.percentage} className="h-3" />
            </div>
            
            <div className="grid grid-cols-2 gap-4 pt-2 border-t">
              <div className="text-center">
                <div className="text-lg font-bold text-green-600">{stats.completed}</div>
                <div className="text-xs text-muted-foreground">Completadas</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-orange-600">{stats.critical_pending}</div>
                <div className="text-xs text-muted-foreground">Críticas pendientes</div>
              </div>
            </div>

            {/* Activation Status */}
            <div className="pt-2 border-t">
              {isActivated ? (
                <div className="flex items-center gap-2 text-green-600">
                  <Trophy className="w-4 h-4" />
                  <span className="font-medium">¡Cuenta activada!</span>
                  <Badge className="bg-green-100 text-green-800 border-green-200">
                    <Sparkles className="w-3 h-3 mr-1" />
                    Activo
                  </Badge>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-orange-600">
                  <Circle className="w-4 h-4" />
                  <span className="font-medium">Pendiente activación</span>
                  <Badge variant="outline" className="border-orange-300 text-orange-700">
                    Pendiente
                  </Badge>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Health Score Card */}
        {tenantId && (
          <HealthScore 
            tenantId={tenantId}
            showDetails={true}
            className="md:col-span-1"
          />
        )}

        {/* Notifications Card */}
        {tenantId && (
          <ProgressNotifications
            tenantId={tenantId}
            className="md:col-span-1"
          />
        )}
      </div>

      {/* Activation Banner */}
      {!isActivated && stats.critical_pending > 0 && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-yellow-800">
              <AlertCircle className="w-5 h-5" />
              Para activar tu cuenta
            </CardTitle>
            <CardDescription className="text-yellow-700">
              Tienes {stats.critical_pending} tareas críticas pendientes. Completa estas tareas para activar tu cuenta.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Tasks Checklist */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Tareas</CardTitle>
          <CardDescription>
            Completa estas tareas para maximizar tu experiencia con RP9
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {tasks.map((task) => (
              <div
                key={task.key}
                className={`flex items-center justify-between p-4 rounded-lg border ${
                  task.status === 'done' 
                    ? 'bg-green-50 border-green-200' 
                    : task.critical 
                    ? 'bg-blue-50 border-blue-200'
                    : 'bg-gray-50 border-gray-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  {task.status === 'done' ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : task.status === 'error' ? (
                    <AlertCircle className="w-5 h-5 text-red-600" />
                  ) : (
                    <Circle className="w-5 h-5 text-gray-400" />
                  )}
                  <div>
                    <div className="font-medium flex items-center gap-2">
                      {task.title}
                      {task.critical && <Badge variant="secondary" className="text-xs">Crítico</Badge>}
                    </div>
                    <div className="text-sm text-muted-foreground">{task.description}</div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {task.key === 'execute_mock' && task.status === 'pending' && (
                    <Button
                      size="sm"
                      onClick={() => executeWorkflow('RP9 Demo')}
                      className="flex items-center gap-1"
                    >
                      <Play className="w-3 h-3" />
                      Ejecutar Demo
                    </Button>
                  )}
                  
                  {task.key === 'configure_real' && task.status === 'pending' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => router.push('/workflows')}
                      className="flex items-center gap-1"
                    >
                      <Settings className="w-3 h-3" />
                      Configurar
                    </Button>
                  )}

                  {task.key === 'install_templates' && task.status === 'pending' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => router.push('/onboarding/wizard')}
                      className="flex items-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Wizard
                    </Button>
                  )}

                  {task.status === 'pending' && !['execute_mock', 'configure_real', 'install_templates'].includes(task.key) && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCompleteTask(task.key)}
                    >
                      Marcar completado
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Gamification Section */}
      <ProgressGamification
        healthScore={healthScore}
        tasksCompleted={stats.completed}
        totalTasks={stats.total}
        isActivated={isActivated}
        daysSinceSignup={daysSinceSignup}
      />

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => router.push('/workflows')}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Ver Workflows
            </CardTitle>
            <CardDescription>
              Gestiona tus automatizaciones
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => router.push('/onboarding/wizard')}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ExternalLink className="w-4 h-4" />
              Explorar Templates
            </CardTitle>
            <CardDescription>
              Descubre más automatizaciones
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Agendar Ayuda
            </CardTitle>
            <CardDescription>
              Habla con un experto (15 min)
            </CardDescription>
          </CardHeader>
        </Card>
      </div>

      {/* Completion Banner */}
      {isActivated && (
        <Card className="border-green-200 bg-green-50">
          <CardHeader className="text-center">
            <CardTitle className="text-xl flex items-center justify-center gap-2 text-green-800">
              <Trophy className="w-6 h-6" />
              ¡Felicitaciones! Tu cuenta está activada
            </CardTitle>
            <CardDescription className="text-green-700">
              Ya estás obteniendo valor real de RP9. Continúa explorando más automatizaciones.
            </CardDescription>
            <div className="pt-2">
              <Button onClick={() => router.push('/dashboard')} className="bg-green-600 hover:bg-green-700">
                Ir al Dashboard Principal
              </Button>
            </div>
          </CardHeader>
        </Card>
      )}
    </div>
  )
}