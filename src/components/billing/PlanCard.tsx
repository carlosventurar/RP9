'use client'

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CreditCard, Zap, CheckCircle, Clock } from "lucide-react"

interface PlanCardProps {
  plan: {
    key: string
    name: string
    price: number
    features: string[]
  }
  currentPlan?: string
  subscription?: {
    status: string
    current_period_end?: string
  }
  onUpgrade?: (planKey: string) => void
  onBuyAddons?: () => void
  isUpgrading?: boolean
}

export function PlanCard({ 
  plan, 
  currentPlan, 
  subscription, 
  onUpgrade, 
  onBuyAddons,
  isUpgrading = false 
}: PlanCardProps) {
  const isCurrentPlan = plan.key === currentPlan
  const isActive = subscription?.status === 'active'
  
  return (
    <Card className={`relative ${isCurrentPlan ? 'ring-2 ring-primary' : ''}`}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            {plan.name}
          </CardTitle>
          {isCurrentPlan && (
            <Badge variant="default" className="bg-green-500">
              <CheckCircle className="h-3 w-3 mr-1" />
              Actual
            </Badge>
          )}
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-bold">
            ${plan.price}
          </span>
          <span className="text-muted-foreground">/mes</span>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Plan Features */}
        <div className="space-y-2">
          {plan.features.map((feature, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>{feature}</span>
            </div>
          ))}
        </div>

        {/* Subscription Status */}
        {isCurrentPlan && subscription && (
          <div className="space-y-2 pt-2 border-t">
            <div className="flex items-center gap-2">
              {isActive ? (
                <Badge variant="default" className="bg-green-500">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Activo
                </Badge>
              ) : (
                <Badge variant="outline" className="border-orange-500 text-orange-600">
                  <Clock className="h-3 w-3 mr-1" />
                  {subscription.status}
                </Badge>
              )}
            </div>
            
            {subscription.current_period_end && (
              <p className="text-sm text-muted-foreground">
                Próxima facturación: {new Date(subscription.current_period_end).toLocaleDateString('es-ES')}
              </p>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-2 pt-2">
          {isCurrentPlan ? (
            <div className="space-y-2">
              <Button 
                variant="outline" 
                className="w-full"
                onClick={onBuyAddons}
              >
                Comprar Paquetes
              </Button>
              {subscription?.status === 'active' && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="w-full"
                  onClick={() => window.open('https://billing.stripe.com/p/login/test_00000000000000', '_blank')}
                >
                  Gestionar Suscripción
                </Button>
              )}
            </div>
          ) : (
            <Button 
              className="w-full"
              variant={plan.price > 0 ? 'default' : 'outline'}
              onClick={() => onUpgrade?.(plan.key)}
              disabled={isUpgrading}
            >
              {isUpgrading ? (
                <>Procesando...</>
              ) : plan.price > 0 ? (
                <><Zap className="h-4 w-4 mr-2" />Actualizar</>
              ) : (
                'Plan Gratuito'
              )}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}