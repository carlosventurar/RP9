'use client'

import { useState } from 'react'
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  CreditCard, 
  Shield, 
  Clock, 
  Star, 
  ArrowRight,
  Loader2,
  CheckCircle,
  AlertCircle
} from 'lucide-react'
import { TemplatePriceBadge, getTemplateTierInfo } from './template-price-badge'
import { useAuth } from '@/lib/hooks/useAuth'

interface Template {
  id: string
  name: string
  description: string
  category: string
  price: number
  difficulty: string
  estimated_time: number
  tags: string[]
  rating?: number
  install_count?: number
}

interface PurchaseModalProps {
  template: Template | null
  isOpen: boolean
  onClose: () => void
  onPurchaseSuccess?: (templateId: string) => void
}

export function PurchaseModal({ 
  template, 
  isOpen, 
  onClose, 
  onPurchaseSuccess 
}: PurchaseModalProps) {
  const { token, isAuthenticated } = useAuth()
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!template) return null

  const tierInfo = getTemplateTierInfo(template.price)

  const handlePurchase = async () => {
    if (!isAuthenticated || !token) {
      setError('Please log in to purchase templates')
      return
    }

    setIsProcessing(true)
    setError(null)

    try {
      const response = await fetch('/api/template-purchase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          templateId: template.id,
          successUrl: `${window.location.origin}/templates?purchase=success&template=${template.id}`,
          cancelUrl: `${window.location.origin}/templates?purchase=cancelled`
        })
      })

      const data = await response.json()

      if (data.success && data.data.checkout_url) {
        // Redirect to Stripe Checkout
        window.location.href = data.data.checkout_url
      } else {
        throw new Error(data.error || 'Failed to initiate purchase')
      }

    } catch (error) {
      console.error('Purchase error:', error)
      setError(error instanceof Error ? error.message : 'Purchase failed. Please try again.')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="text-xl font-bold">
                Purchase Template
              </DialogTitle>
              <DialogDescription className="mt-1">
                Get instant access to this professional workflow
              </DialogDescription>
            </div>
            <TemplatePriceBadge price={template.price} size="lg" />
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Template Info */}
          <div className="border rounded-lg p-4 bg-muted/30">
            <h3 className="font-semibold text-lg mb-2">{template.name}</h3>
            <p className="text-sm text-muted-foreground mb-3">
              {template.description}
            </p>
            
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {template.estimated_time} min
              </div>
              {template.rating && (
                <div className="flex items-center gap-1">
                  <Star className="h-4 w-4" />
                  {template.rating}
                </div>
              )}
              <Badge variant="outline" className="text-xs">
                {template.difficulty}
              </Badge>
            </div>

            <div className="flex flex-wrap gap-1 mt-3">
              {template.tags.slice(0, 4).map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>

          {/* Tier Benefits */}
          <div className="space-y-3">
            <h4 className="font-medium">What you get:</h4>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>Instant access to complete workflow</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>One-click installation to your n8n instance</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>Lifetime access - no recurring fees</span>
              </div>
              {tierInfo.tier !== 'free' && (
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>Advanced configuration documentation</span>
                </div>
              )}
              {tierInfo.tier === 'enterprise' && (
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>Premium support and customization guide</span>
                </div>
              )}
            </div>
          </div>

          {/* Security Badge */}
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
            <Shield className="h-4 w-4" />
            <span>Secure payment processed by Stripe • 30-day money-back guarantee</span>
          </div>

          {/* Error Display */}
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
              <AlertCircle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          )}

          {/* Purchase Button */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1"
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button
              onClick={handlePurchase}
              disabled={isProcessing || !isAuthenticated}
              className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CreditCard className="h-4 w-4 mr-2" />
                  Purchase ${template.price}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          </div>

          {!isAuthenticated && (
            <p className="text-xs text-muted-foreground text-center">
              Please log in to purchase templates
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}