'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  Star, 
  Download, 
  Clock, 
  ArrowRight,
  Loader2,
  ShoppingCart,
  CheckCircle2,
  MessageSquare
} from 'lucide-react'
import { TemplatePriceBadge, getTemplateTierInfo } from './template-price-badge'
import { PurchaseModal } from './purchase-modal'
import { ReviewModal } from './review-modal'
import { useAuth } from '@/lib/hooks/useAuth'

interface Template {
  id: string
  name: string
  description: string
  category: string
  subcategory?: string
  price: number
  difficulty: string
  estimated_time: number
  tags: string[]
  rating?: number
  install_count?: number
  is_featured: boolean
  icon_url?: string
  preview_images?: string[]
}

interface PremiumTemplateCardProps {
  template: Template
  onInstall?: (template: Template) => void
  onPurchaseSuccess?: (templateId: string) => void
  className?: string
  size?: 'default' | 'compact'
  showPurchaseModal?: boolean
}

export function PremiumTemplateCard({ 
  template, 
  onInstall, 
  onPurchaseSuccess,
  className = '',
  size = 'default',
  showPurchaseModal = true
}: PremiumTemplateCardProps) {
  const { isAuthenticated } = useAuth()
  const [installLoading, setInstallLoading] = useState(false)
  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false)
  const [reviewModalOpen, setReviewModalOpen] = useState(false)
  const [hasPurchased, setHasPurchased] = useState(false) // This should come from API
  
  const tierInfo = getTemplateTierInfo(template.price)
  const isFree = template.price <= 0
  const canInstall = isFree || hasPurchased

  const handleActionClick = () => {
    if (canInstall) {
      handleInstall()
    } else {
      handlePurchase()
    }
  }

  const handleInstall = async () => {
    if (!isAuthenticated) {
      alert('Please log in to install templates')
      return
    }

    setInstallLoading(true)
    try {
      if (onInstall) {
        await onInstall(template)
      }
    } catch (error) {
      console.error('Installation failed:', error)
    } finally {
      setInstallLoading(false)
    }
  }

  const handlePurchase = () => {
    if (!isAuthenticated) {
      alert('Please log in to purchase templates')
      return
    }
    
    if (showPurchaseModal) {
      setPurchaseModalOpen(true)
    }
  }

  const handlePurchaseSuccess = (templateId: string) => {
    setHasPurchased(true)
    setPurchaseModalOpen(false)
    if (onPurchaseSuccess) {
      onPurchaseSuccess(templateId)
    }
  }

  const handleReviewSubmitted = (templateId: string, rating: number) => {
    setReviewModalOpen(false)
    // Update local template rating if needed
    if (onPurchaseSuccess) { // Reuse callback for now
      onPurchaseSuccess(templateId)
    }
  }

  // Compact size for list views
  if (size === 'compact') {
    return (
      <>
        <Card className={`hover:shadow-md transition-shadow ${className}`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-medium truncate">{template.name}</h3>
                  <TemplatePriceBadge price={template.price} size="sm" />
                  {template.is_featured && (
                    <Badge variant="outline" className="text-xs bg-amber-500/20 text-amber-300 border-amber-500/50">
                      FEATURED
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground line-clamp-1 mb-2">
                  {template.description}
                </p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {template.estimated_time}min
                  </div>
                  {template.rating && (
                    <div className="flex items-center gap-1">
                      <Star className="h-3 w-3" />
                      {template.rating}
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    <Download className="h-3 w-3" />
                    {template.install_count?.toLocaleString() || 0}
                  </div>
                </div>
              </div>
              <div className="ml-4">
                <Button
                  size="sm"
                  onClick={handleActionClick}
                  disabled={installLoading}
                  variant={canInstall ? "default" : "outline"}
                  className={!canInstall ? "border-blue-500/50 text-blue-300 hover:bg-blue-500/10" : ""}
                >
                  {installLoading ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : canInstall ? (
                    <>
                      <Download className="h-3 w-3 mr-1" />
                      Install
                    </>
                  ) : (
                    <>
                      <ShoppingCart className="h-3 w-3 mr-1" />
                      Buy
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {showPurchaseModal && (
          <PurchaseModal
            template={template}
            isOpen={purchaseModalOpen}
            onClose={() => setPurchaseModalOpen(false)}
            onPurchaseSuccess={handlePurchaseSuccess}
          />
        )}

        <ReviewModal
          template={template}
          isOpen={reviewModalOpen}
          onClose={() => setReviewModalOpen(false)}
          onReviewSubmitted={handleReviewSubmitted}
        />
      </>
    )
  }

  // Default card size
  return (
    <>
      <Card className={`hover:shadow-md transition-shadow ${className}`}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="space-y-1 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle className="text-lg leading-tight">
                  {template.name}
                </CardTitle>
                <TemplatePriceBadge price={template.price} />
                {template.is_featured && (
                  <Badge variant="outline" className="text-xs bg-amber-500/20 text-amber-300 border-amber-500/50">
                    FEATURED
                  </Badge>
                )}
                {hasPurchased && (
                  <Badge variant="outline" className="text-xs bg-green-500/20 text-green-300 border-green-500/50">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    OWNED
                  </Badge>
                )}
              </div>
              
              <div className="flex items-center gap-2 flex-wrap">
                <Badge 
                  variant="outline" 
                  className={`text-xs ${
                    template.difficulty === 'beginner' ? 'bg-green-500/20 text-green-300 border-green-500/50' :
                    template.difficulty === 'intermediate' ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/50' :
                    'bg-red-500/20 text-red-300 border-red-500/50'
                  }`}
                >
                  {template.difficulty}
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  <Clock className="h-3 w-3 mr-1" />
                  {template.estimated_time}min
                </Badge>
                {template.rating && (
                  <Badge variant="secondary" className="text-xs">
                    <Star className="h-3 w-3 mr-1" />
                    {template.rating}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <CardDescription className="line-clamp-2">
            {template.description}
          </CardDescription>
          
          <div className="flex flex-wrap gap-1">
            {template.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
            {template.tags.length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{template.tags.length - 3}
              </Badge>
            )}
          </div>

          {/* Premium Features for paid templates */}
          {!isFree && (
            <div className="bg-muted/30 rounded-lg p-3 space-y-1">
              <div className="flex items-center gap-2 text-sm font-medium">
                {tierInfo.icon && <tierInfo.icon className="h-4 w-4" />}
                <span>{tierInfo.name} Template</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {tierInfo.description}
              </p>
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Download className="h-3 w-3" />
                {template.install_count?.toLocaleString() || 0}
              </div>
              {template.rating && (
                <div className="flex items-center gap-1">
                  <Star className="h-3 w-3 text-yellow-400 fill-current" />
                  {template.rating}
                </div>
              )}
              <button
                onClick={() => setReviewModalOpen(true)}
                className="flex items-center gap-1 hover:text-foreground transition-colors"
              >
                <MessageSquare className="h-3 w-3" />
                Review
              </button>
            </div>
            
            <Button 
              onClick={handleActionClick}
              disabled={installLoading}
              className={
                canInstall ? 
                  "" : 
                  "bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              }
              variant={canInstall ? "default" : "default"}
            >
              {installLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Installing...
                </>
              ) : canInstall ? (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Install
                </>
              ) : (
                <>
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  Buy ${template.price}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {showPurchaseModal && (
        <PurchaseModal
          template={template}
          isOpen={purchaseModalOpen}
          onClose={() => setPurchaseModalOpen(false)}
          onPurchaseSuccess={handlePurchaseSuccess}
        />
      )}

      <ReviewModal
        template={template}
        isOpen={reviewModalOpen}
        onClose={() => setReviewModalOpen(false)}
        onReviewSubmitted={handleReviewSubmitted}
      />
    </>
  )
}