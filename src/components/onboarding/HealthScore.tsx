'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { 
  Activity, 
  CheckCircle, 
  AlertCircle, 
  TrendingUp,
  Users,
  Zap,
  Target
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface HealthScoreData {
  total: number
  outcome: number
  integrations: number
  usage: number
}

interface HealthScoreProps {
  tenantId: string
  showDetails?: boolean
  className?: string
}

export default function HealthScore({ tenantId, showDetails = true, className = '' }: HealthScoreProps) {
  const supabase = createClient()
  const [healthScore, setHealthScore] = useState<HealthScoreData | null>(null)
  const [isActivated, setIsActivated] = useState(false)
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)

  useEffect(() => {
    if (tenantId) {
      loadHealthScore()
    }
  }, [tenantId])

  const loadHealthScore = async () => {
    setLoading(true)
    try {
      // Get latest health score
      const { data: scoreData, error: scoreError } = await supabase
        .rpc('calculate_health_score', { p_tenant_id: tenantId })

      if (scoreError) {
        console.error('Error calculating health score:', scoreError)
        return
      }

      if (scoreData) {
        setHealthScore(scoreData)
      }

      // Check activation status
      const { data: activationData, error: activationError } = await supabase
        .rpc('is_tenant_activated', { p_tenant_id: tenantId })

      if (!activationError) {
        setIsActivated(activationData || false)
      }

      // Get last update timestamp
      const { data: snapshotData } = await supabase
        .from('health_snapshots')
        .select('created_at')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(1)

      if (snapshotData && snapshotData.length > 0) {
        setLastUpdated(snapshotData[0].created_at)
      }

    } catch (error) {
      console.error('Error loading health score:', error)
    } finally {
      setLoading(false)
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600'
    if (score >= 60) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getScoreBgColor = (score: number) => {
    if (score >= 80) return 'bg-green-50 border-green-200'
    if (score >= 60) return 'bg-yellow-50 border-yellow-200'
    return 'bg-red-50 border-red-200'
  }

  const getScoreProgressColor = (score: number) => {
    if (score >= 80) return 'bg-green-500'
    if (score >= 60) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  const getScoreLabel = (score: number) => {
    if (score >= 80) return 'Excelente'
    if (score >= 60) return 'Bueno'
    if (score >= 40) return 'Regular'
    return 'Necesita mejora'
  }

  const getActivationBadge = () => {
    if (isActivated) {
      return (
        <Badge className="bg-green-100 text-green-800 border-green-200">
          <CheckCircle className="w-3 h-3 mr-1" />
          Activado
        </Badge>
      )
    } else {
      return (
        <Badge variant="outline" className="border-orange-300 text-orange-700">
          <AlertCircle className="w-3 h-3 mr-1" />
          Pendiente activación
        </Badge>
      )
    }
  }

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="h-6 w-32 bg-gray-200 rounded animate-pulse" />
            <div className="h-6 w-20 bg-gray-200 rounded animate-pulse" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="h-4 w-full bg-gray-200 rounded animate-pulse" />
            <div className="h-12 w-full bg-gray-200 rounded animate-pulse" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!healthScore) {
    return (
      <Card className={`${className} border-gray-200`}>
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground">
            <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No hay datos de health score disponibles</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={`${className} ${getScoreBgColor(healthScore.total)}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Health Score
            </CardTitle>
            <CardDescription>
              Salud de tu cuenta • {getScoreLabel(healthScore.total)}
            </CardDescription>
          </div>
          <div className="text-right">
            <div className={`text-2xl font-bold ${getScoreColor(healthScore.total)}`}>
              {healthScore.total}%
            </div>
            {getActivationBadge()}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Main Progress */}
        <div className="space-y-2">
          <Progress 
            value={healthScore.total} 
            className="h-3"
            style={{
              // @ts-ignore
              '--progress-background': getScoreProgressColor(healthScore.total)
            }}
          />
          <p className="text-xs text-muted-foreground">
            {isActivated 
              ? '¡Tu cuenta está activada! Sigue mejorando tu score.' 
              : `Necesitas ${Math.max(0, 70 - healthScore.total)}% más para activar tu cuenta`
            }
          </p>
        </div>

        {/* Detailed Breakdown */}
        {showDetails && (
          <div className="grid grid-cols-3 gap-3 pt-2 border-t border-gray-200">
            <div className="text-center">
              <div className="flex items-center justify-center w-8 h-8 bg-blue-100 rounded-full mx-auto mb-1">
                <Target className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-lg font-semibold">{healthScore.outcome}%</div>
              <div className="text-xs text-muted-foreground">Resultados</div>
            </div>
            
            <div className="text-center">
              <div className="flex items-center justify-center w-8 h-8 bg-purple-100 rounded-full mx-auto mb-1">
                <Zap className="w-4 h-4 text-purple-600" />
              </div>
              <div className="text-lg font-semibold">{healthScore.integrations}%</div>
              <div className="text-xs text-muted-foreground">Conexiones</div>
            </div>
            
            <div className="text-center">
              <div className="flex items-center justify-center w-8 h-8 bg-green-100 rounded-full mx-auto mb-1">
                <TrendingUp className="w-4 h-4 text-green-600" />
              </div>
              <div className="text-lg font-semibold">{healthScore.usage}%</div>
              <div className="text-xs text-muted-foreground">Uso</div>
            </div>
          </div>
        )}

        {/* Last Updated */}
        {lastUpdated && (
          <div className="text-xs text-muted-foreground pt-2 border-t border-gray-200">
            Actualizado: {new Date(lastUpdated).toLocaleString('es-MX', {
              day: '2-digit',
              month: '2-digit', 
              hour: '2-digit',
              minute: '2-digit'
            })}
          </div>
        )}

        {/* Activation Message */}
        {!isActivated && healthScore.total >= 70 && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 mt-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span className="text-sm text-green-800 font-medium">
                ¡Felicidades! Tu cuenta cumple los criterios de activación.
              </span>
            </div>
            <p className="text-xs text-green-700 mt-1">
              Completa una tarea más y tu cuenta se activará automáticamente.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}