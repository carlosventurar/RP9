'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { FavoriteButton } from '@/components/favorite-button'
import { TemplatePreviewModal } from '@/components/template-preview-modal'
import {
  Star,
  Download,
  ShoppingCart,
  Eye,
  Crown,
  Zap,
  ArrowRight,
  Package
} from 'lucide-react'

interface Template {
  id: string
  name: string
  description: string
  price: number
  category: string
  is_premium: boolean
  average_rating: number
  total_installs: number
  image_url?: string
  created_at?: string
  favorite_id?: string
  favorited_at?: string
}

interface TemplateCardProps {
  template: Template
  variant?: 'default' | 'compact' | 'featured'
  showCategory?: boolean
  showFavorite?: boolean
  className?: string
}

export function TemplateCard({ 
  template, 
  variant = 'default',
  showCategory = true,
  showFavorite = true,
  className = ''
}: TemplateCardProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const formatNumber = (num: number) => {
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}k`
    }
    return num.toString()
  }

  const isFree = template.price === 0
  const isPremium = template.is_premium || template.price > 0

  if (variant === 'compact') {
    return (
      <>
      <Card className={`hover:shadow-md transition-all duration-200 ${className}`}>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-gradient-to-br from-blue-50 to-purple-50 flex-shrink-0">
              {template.image_url ? (
                <Image
                  src={template.image_url}
                  alt={template.name}
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Package className="w-6 h-6 text-muted-foreground" />
                </div>
              )}
              {isPremium && (
                <div className="absolute -top-1 -right-1">
                  <Crown className="w-4 h-4 text-yellow-500 fill-current" />
                </div>
              )}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <Link href={`/templates/${template.id}`}>
                    <h4 className="font-semibold text-sm hover:text-primary transition-colors line-clamp-1">
                      {template.name}
                    </h4>
                  </Link>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    {showCategory && (
                      <Badge variant="outline" className="text-xs">
                        {template.category}
                      </Badge>
                    )}
                    <div className="flex items-center gap-1">
                      <Star className="w-3 h-3 text-yellow-400 fill-current" />
                      {template.average_rating.toFixed(1)}
                    </div>
                    <div className="flex items-center gap-1">
                      <Download className="w-3 h-3" />
                      {formatNumber(template.total_installs)}
                    </div>
                  </div>
                </div>
                
                <div className="text-right flex-shrink-0 ml-2">
                  {isFree ? (
                    <Badge variant="secondary" className="bg-green-50 text-green-700">
                      Free
                    </Badge>
                  ) : (
                    <div className="font-bold text-sm">{formatCurrency(template.price)}</div>
                  )}
                </div>
              </div>
            </div>
            
            {showFavorite && (
              <FavoriteButton
                itemId={template.id}
                itemType="template"
                itemName={template.name}
                variant="ghost"
                size="icon"
                className="opacity-0 group-hover:opacity-100 transition-opacity"
              />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Template Preview Modal */}
      <TemplatePreviewModal
        templateId={template.id}
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        onInstall={(config) => {
          console.log('Installing template with config:', config)
          // Handle installation logic here
        }}
      />
      </>
    )
  }

  if (variant === 'featured') {
    return (
      <>
      <Card 
        className={`overflow-hidden hover:shadow-xl transition-all duration-300 border-2 border-primary/20 ${className}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="relative">
          <div className="aspect-[16/10] relative bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
            {template.image_url ? (
              <Image
                src={template.image_url}
                alt={template.name}
                fill
                className="object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Package className="w-16 h-16 text-muted-foreground/30" />
              </div>
            )}
            
            {/* Premium Badge */}
            {isPremium && (
              <div className="absolute top-3 left-3">
                <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white border-0">
                  <Crown className="w-3 h-3 mr-1 fill-current" />
                  Premium
                </Badge>
              </div>
            )}
            
            {/* Free Badge */}
            {isFree && (
              <div className="absolute top-3 left-3">
                <Badge className="bg-green-500 text-white">
                  Free
                </Badge>
              </div>
            )}
            
            {/* Favorite Button */}
            {showFavorite && (
              <div className="absolute bottom-3 right-3">
                <FavoriteButton
                  itemId={template.id}
                  itemType="template"
                  itemName={template.name}
                  variant="ghost"
                  className="bg-white/80 hover:bg-white/90"
                />
              </div>
            )}
          </div>
        </div>

        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <Link href={`/templates/${template.id}`}>
                <CardTitle className="text-lg hover:text-primary transition-colors line-clamp-2">
                  {template.name}
                </CardTitle>
              </Link>
              <CardDescription className="mt-1 line-clamp-2">
                {template.description}
              </CardDescription>
            </div>
          </div>
          
          <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2">
            <div className="flex items-center gap-1">
              <Star className="w-3 h-3 text-yellow-400 fill-current" />
              {template.average_rating.toFixed(1)}
            </div>
            <div className="flex items-center gap-1">
              <Download className="w-3 h-3" />
              {formatNumber(template.total_installs)}
            </div>
            {showCategory && (
              <Badge variant="outline" className="text-xs">
                {template.category}
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          {/* Pricing */}
          <div className="flex items-center justify-between mb-4">
            {isFree ? (
              <div>
                <Badge className="bg-green-500 text-white mb-2">Free Template</Badge>
                <p className="text-xs text-muted-foreground">No cost to install</p>
              </div>
            ) : (
              <div>
                <div className="text-2xl font-bold text-primary mb-1">
                  {formatCurrency(template.price)}
                </div>
                <p className="text-xs text-muted-foreground">One-time purchase</p>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button className="flex-1" asChild>
              <Link href={`/templates/${template.id}`}>
                {isFree ? (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Install Free
                  </>
                ) : (
                  <>
                    <ShoppingCart className="w-4 h-4 mr-2" />
                    Purchase
                  </>
                )}
              </Link>
            </Button>
            <Button 
              variant="outline" 
              size="icon"
              onClick={() => setShowPreview(true)}
            >
              <Eye className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Template Preview Modal */}
      <TemplatePreviewModal
        templateId={template.id}
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        onInstall={(config) => {
          console.log('Installing template with config:', config)
          // Handle installation logic here
        }}
      />
      </>
    )
  }

  // Default variant
  return (
    <>
    <Card 
      className={`overflow-hidden hover:shadow-lg transition-all duration-200 group ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="relative">
        <div className="aspect-[4/3] relative bg-gradient-to-br from-slate-50 to-slate-100">
          {template.image_url ? (
            <Image
              src={template.image_url}
              alt={template.name}
              fill
              className="object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Package className="w-12 h-12 text-muted-foreground/30" />
            </div>
          )}
          
          {isPremium && (
            <div className="absolute top-2 left-2">
              <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white">
                <Crown className="w-3 h-3 mr-1 fill-current" />
                Premium
              </Badge>
            </div>
          )}
          
          {isFree && (
            <div className="absolute top-2 left-2">
              <Badge className="bg-green-500 text-white">
                Free
              </Badge>
            </div>
          )}
          
          {showFavorite && (
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <FavoriteButton
                itemId={template.id}
                itemType="template"
                itemName={template.name}
                variant="ghost"
                className="bg-white/80 hover:bg-white/90"
              />
            </div>
          )}
        </div>
      </div>

      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <Link href={`/templates/${template.id}`}>
              <CardTitle className="text-lg hover:text-primary transition-colors line-clamp-2">
                {template.name}
              </CardTitle>
            </Link>
            {showCategory && (
              <CardDescription className="text-sm text-muted-foreground">
                {template.category}
              </CardDescription>
            )}
          </div>
          <div className="text-right">
            <div className="font-bold">
              {isFree ? 'Free' : formatCurrency(template.price)}
            </div>
          </div>
        </div>
        
        <p className="text-sm text-muted-foreground line-clamp-2 mt-2">
          {template.description}
        </p>
      </CardHeader>

      <CardContent className="pt-0">
        {/* Stats */}
        <div className="flex items-center justify-between text-sm text-muted-foreground mb-4">
          <div className="flex items-center gap-1">
            <Star className="w-4 h-4 text-yellow-400 fill-current" />
            {template.average_rating.toFixed(1)}
          </div>
          <div className="flex items-center gap-1">
            <Download className="w-4 h-4" />
            {formatNumber(template.total_installs)}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button className="flex-1" size="sm" asChild>
            <Link href={`/templates/${template.id}`}>
              {isFree ? 'Install Free' : 'View Details'}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setShowPreview(true)}
          >
            <Eye className="w-4 h-4 mr-2" />
            Preview
          </Button>
        </div>
      </CardContent>
    </Card>

    {/* Template Preview Modal */}
    <TemplatePreviewModal
      templateId={template.id}
      isOpen={showPreview}
      onClose={() => setShowPreview(false)}
      onInstall={(config) => {
        console.log('Installing template with config:', config)
        // Handle installation logic here
      }}
    />
  </>
  )
}