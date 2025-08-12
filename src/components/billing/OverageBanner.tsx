'use client'

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { AlertTriangle, Ban, CheckCircle, Zap } from "lucide-react"

interface OverageBannerProps {
  currentUsage: number
  limit: number
  plan: string
  onUpgrade?: () => void
  onBuyAddons?: () => void
}

export function OverageBanner({ 
  currentUsage, 
  limit, 
  plan,
  onUpgrade,
  onBuyAddons 
}: OverageBannerProps) {
  // Calculate usage percentage
  const percentage = limit > 0 ? Math.round((currentUsage / limit) * 100) : 0
  
  // Don't show banner if limit is unlimited
  if (limit === -1 || percentage < 80) {
    return null
  }

  const isWarning = percentage >= 80 && percentage < 100
  const isOverage = percentage >= 100
  const isNearLimit = percentage >= 90 && percentage < 100
  
  if (isOverage) {
    return (
      <Alert className="border-red-200 bg-red-50">
        <Ban className="h-4 w-4 text-red-600" />
        <AlertDescription className="flex items-center justify-between w-full">
          <div>
            <strong className="text-red-800">Límite excedido</strong>
            <p className="text-red-700">
              Has usado {currentUsage.toLocaleString()} de {limit.toLocaleString()} ejecuciones ({percentage}%). 
              {plan !== 'enterprise' && (
                <>
                  {' '}Se aplicarán cargos por overage o el servicio será limitado.
                </>
              )}
            </p>
          </div>
          <div className="flex gap-2 ml-4">
            {plan !== 'enterprise' && onBuyAddons && (
              <Button size="sm" variant="outline" onClick={onBuyAddons}>
                Comprar Paquetes
              </Button>
            )}
            {onUpgrade && plan !== 'enterprise' && (
              <Button size="sm" onClick={onUpgrade}>
                <Zap className="h-4 w-4 mr-1" />
                Upgrade
              </Button>
            )}
          </div>
        </AlertDescription>
      </Alert>
    )
  }

  if (isNearLimit) {
    return (
      <Alert className="border-orange-200 bg-orange-50">
        <AlertTriangle className="h-4 w-4 text-orange-600" />
        <AlertDescription className="flex items-center justify-between w-full">
          <div>
            <strong className="text-orange-800">Cerca del límite</strong>
            <p className="text-orange-700">
              Has usado {currentUsage.toLocaleString()} de {limit.toLocaleString()} ejecuciones ({percentage}%). 
              Te recomendamos considerar un upgrade o comprar paquetes adicionales.
            </p>
          </div>
          <div className="flex gap-2 ml-4">
            {onBuyAddons && (
              <Button size="sm" variant="outline" onClick={onBuyAddons}>
                Comprar Paquetes
              </Button>
            )}
            {onUpgrade && plan !== 'enterprise' && (
              <Button size="sm" onClick={onUpgrade}>
                <Zap className="h-4 w-4 mr-1" />
                Upgrade
              </Button>
            )}
          </div>
        </AlertDescription>
      </Alert>
    )
  }

  if (isWarning) {
    return (
      <Alert className="border-yellow-200 bg-yellow-50">
        <AlertTriangle className="h-4 w-4 text-yellow-600" />
        <AlertDescription className="flex items-center justify-between w-full">
          <div>
            <strong className="text-yellow-800">Aviso de uso</strong>
            <p className="text-yellow-700">
              Has usado {currentUsage.toLocaleString()} de {limit.toLocaleString()} ejecuciones ({percentage}%).
              {' '}Considera planificar un upgrade si necesitas más capacidad.
            </p>
          </div>
          <div className="flex gap-2 ml-4">
            {onBuyAddons && (
              <Button size="sm" variant="outline" onClick={onBuyAddons}>
                Comprar Paquetes
              </Button>
            )}
            {onUpgrade && plan !== 'enterprise' && (
              <Button size="sm" variant="ghost" onClick={onUpgrade}>
                Ver Planes
              </Button>
            )}
          </div>
        </AlertDescription>
      </Alert>
    )
  }

  // Should not reach here, but just in case
  return null
}

// Usage Status component for general status display
export function UsageStatus({ 
  currentUsage, 
  limit, 
  className 
}: { 
  currentUsage: number
  limit: number
  className?: string 
}) {
  const percentage = limit > 0 && limit !== -1 ? Math.round((currentUsage / limit) * 100) : 0
  const isUnlimited = limit === -1
  
  if (isUnlimited) {
    return (
      <div className={`flex items-center gap-2 text-sm ${className}`}>
        <CheckCircle className="h-4 w-4 text-green-500" />
        <span className="text-green-600">
          {currentUsage.toLocaleString()} ejecuciones (Ilimitado)
        </span>
      </div>
    )
  }

  const getStatusColor = () => {
    if (percentage >= 100) return 'text-red-600'
    if (percentage >= 90) return 'text-orange-600'  
    if (percentage >= 80) return 'text-yellow-600'
    return 'text-green-600'
  }

  const getStatusIcon = () => {
    if (percentage >= 100) return <Ban className="h-4 w-4 text-red-500" />
    if (percentage >= 90) return <AlertTriangle className="h-4 w-4 text-orange-500" />
    if (percentage >= 80) return <AlertTriangle className="h-4 w-4 text-yellow-500" />
    return <CheckCircle className="h-4 w-4 text-green-500" />
  }

  return (
    <div className={`flex items-center gap-2 text-sm ${className}`}>
      {getStatusIcon()}
      <span className={getStatusColor()}>
        {currentUsage.toLocaleString()} / {limit.toLocaleString()} ejecuciones ({percentage}%)
      </span>
    </div>
  )
}