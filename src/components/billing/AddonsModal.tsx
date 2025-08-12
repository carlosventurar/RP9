'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Zap, Package, Loader2 } from "lucide-react"

interface AddonPack {
  id: string
  name: string
  executions: number
  price: number
  popular?: boolean
  savings?: string
}

const ADDON_PACKS: AddonPack[] = [
  {
    id: 'pack_10k',
    name: '10K Pack',
    executions: 10000,
    price: 19,
    savings: 'Ahorra 5%'
  },
  {
    id: 'pack_50k',
    name: '50K Pack',
    executions: 50000,
    price: 89,
    popular: true,
    savings: 'Ahorra 10%'
  },
  {
    id: 'pack_100k',
    name: '100K Pack',
    executions: 100000,
    price: 169,
    savings: 'Ahorra 15%'
  }
]

interface AddonsModalProps {
  open: boolean
  onClose: () => void
  onPurchase: (packId: string) => Promise<void>
}

export function AddonsModal({ open, onClose, onPurchase }: AddonsModalProps) {
  const [purchasing, setPurchasing] = useState<string | null>(null)

  const handlePurchase = async (packId: string) => {
    setPurchasing(packId)
    try {
      await onPurchase(packId)
      onClose()
    } catch (error) {
      console.error('Error purchasing addon pack:', error)
    } finally {
      setPurchasing(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Paquetes de Ejecuciones
          </DialogTitle>
          <DialogDescription>
            Compra paquetes adicionales de ejecuciones para complementar tu plan actual. 
            Los paquetes no expiran y se consumen antes que tu límite mensual.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          {ADDON_PACKS.map((pack) => (
            <Card key={pack.id} className={`relative ${pack.popular ? 'ring-2 ring-primary' : ''}`}>
              {pack.popular && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <Badge variant="default" className="bg-primary">
                    Más Popular
                  </Badge>
                </div>
              )}
              
              <CardHeader className="text-center pb-4">
                <CardTitle className="text-xl">{pack.name}</CardTitle>
                <CardDescription>
                  {pack.executions.toLocaleString()} ejecuciones adicionales
                </CardDescription>
                
                <div className="space-y-2">
                  <div className="text-3xl font-bold">
                    ${pack.price}
                  </div>
                  {pack.savings && (
                    <Badge variant="secondary" className="text-xs">
                      {pack.savings}
                    </Badge>
                  )}
                </div>
              </CardHeader>

              <CardContent>
                <div className="space-y-4">
                  {/* Price per execution */}
                  <div className="text-center text-sm text-muted-foreground">
                    ${(pack.price / pack.executions).toFixed(4)} por ejecución
                  </div>

                  {/* Features */}
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span>Ejecuciones:</span>
                      <span className="font-medium">{pack.executions.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>No expira:</span>
                      <span className="text-green-600">✓</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Se aplica inmediatamente:</span>
                      <span className="text-green-600">✓</span>
                    </div>
                  </div>

                  {/* Purchase Button */}
                  <Button 
                    className="w-full" 
                    variant={pack.popular ? 'default' : 'outline'}
                    onClick={() => handlePurchase(pack.id)}
                    disabled={purchasing !== null}
                  >
                    {purchasing === pack.id ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Procesando...
                      </>
                    ) : (
                      <>
                        <Zap className="h-4 w-4 mr-2" />
                        Comprar Ahora
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <h4 className="font-medium text-blue-800 mb-2">¿Cómo funcionan los paquetes?</h4>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• Los paquetes se consumen antes que tu límite mensual</li>
            <li>• No tienen fecha de expiración</li>
            <li>• Se aplican inmediatamente después de la compra</li>
            <li>• Puedes comprar múltiples paquetes</li>
            <li>• Perfectos para picos de uso o proyectos especiales</li>
          </ul>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="ghost" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}