'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Star,
  Download,
  ShoppingCart,
  Heart,
  Package,
  DollarSign,
  Users,
  Zap,
  Crown,
  Check,
  ArrowRight
} from 'lucide-react'

interface Template {
  id: string
  name: string
  price: number
  category: string
  rating: number
}

interface Collection {
  id: string
  name: string
  description: string
  creator_name: string
  is_featured: boolean
  bundle_price: number | null
  original_price: number
  discount_percentage: number
  savings: number
  image_url: string
  tags: string[]
  template_count: number
  templates: Template[]
  total_installs: number
  average_rating: number
  review_count: number
  created_at: string
}

interface CollectionCardProps {
  collection: Collection
  variant?: 'default' | 'compact' | 'featured'
  showTemplates?: boolean
  className?: string
}

export function CollectionCard({ 
  collection, 
  variant = 'default',
  showTemplates = false,
  className = ''
}: CollectionCardProps) {
  const [isFavorited, setIsFavorited] = useState(false)
  const [isHovered, setIsHovered] = useState(false)

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

  const isFree = !collection.bundle_price || collection.bundle_price === 0
  const hasDiscount = collection.discount_percentage > 0

  if (variant === 'compact') {
    return (
      <Card className={`hover:shadow-md transition-all duration-200 ${className}`}>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-gradient-to-br from-blue-50 to-purple-50 flex-shrink-0">
              {collection.image_url ? (
                <Image
                  src={collection.image_url}
                  alt={collection.name}
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Package className="w-6 h-6 text-muted-foreground" />
                </div>
              )}
              {collection.is_featured && (
                <div className="absolute -top-1 -right-1">
                  <Crown className="w-4 h-4 text-yellow-500 fill-current" />
                </div>
              )}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <Link href={`/collections/${collection.id}`}>
                    <h4 className="font-semibold text-sm hover:text-primary transition-colors line-clamp-1">
                      {collection.name}
                    </h4>
                  </Link>
                  <p className="text-xs text-muted-foreground mt-1">
                    {collection.template_count} templates • {formatNumber(collection.total_installs)} installs
                  </p>
                </div>
                
                <div className="text-right flex-shrink-0 ml-2">
                  {isFree ? (
                    <Badge variant="secondary" className="bg-green-50 text-green-700">
                      Free
                    </Badge>
                  ) : (
                    <div className="text-right">
                      <div className="font-bold text-sm">{formatCurrency(collection.bundle_price!)}</div>
                      {hasDiscount && (
                        <div className="text-xs text-muted-foreground line-through">
                          {formatCurrency(collection.original_price)}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (variant === 'featured') {
    return (
      <Card 
        className={`overflow-hidden hover:shadow-xl transition-all duration-300 border-2 border-primary/20 ${className}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="relative">
          <div className="aspect-[16/10] relative bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
            {collection.image_url ? (
              <Image
                src={collection.image_url}
                alt={collection.name}
                fill
                className="object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Package className="w-16 h-16 text-muted-foreground/30" />
              </div>
            )}
            
            {/* Featured Badge */}
            <div className="absolute top-3 left-3">
              <Badge className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white border-0">
                <Crown className="w-3 h-3 mr-1 fill-current" />
                Featured
              </Badge>
            </div>
            
            {/* Discount Badge */}
            {hasDiscount && (
              <div className="absolute top-3 right-3">
                <Badge variant="destructive" className="animate-pulse">
                  -{collection.discount_percentage}%
                </Badge>
              </div>
            )}
            
            {/* Favorite Button */}
            <Button
              variant="ghost"
              size="icon"
              className="absolute bottom-3 right-3 w-8 h-8 bg-white/80 hover:bg-white/90"
              onClick={() => setIsFavorited(!isFavorited)}
            >
              <Heart className={`w-4 h-4 ${isFavorited ? 'text-red-500 fill-current' : 'text-muted-foreground'}`} />
            </Button>
          </div>
        </div>

        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <Link href={`/collections/${collection.id}`}>
                <CardTitle className="text-lg hover:text-primary transition-colors line-clamp-2">
                  {collection.name}
                </CardTitle>
              </Link>
              <CardDescription className="mt-1 line-clamp-2">
                {collection.description}
              </CardDescription>
            </div>
          </div>
          
          <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2">
            <div className="flex items-center gap-1">
              <Star className="w-3 h-3 text-yellow-400 fill-current" />
              {collection.average_rating.toFixed(1)}
            </div>
            <div className="flex items-center gap-1">
              <Download className="w-3 h-3" />
              {formatNumber(collection.total_installs)}
            </div>
            <div className="flex items-center gap-1">
              <Package className="w-3 h-3" />
              {collection.template_count} templates
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          {/* Tags */}
          <div className="flex flex-wrap gap-1 mb-4">
            {collection.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
            {collection.tags.length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{collection.tags.length - 3}
              </Badge>
            )}
          </div>

          {/* Pricing */}
          <div className="flex items-center justify-between mb-4">
            {isFree ? (
              <div>
                <Badge className="bg-green-500 text-white">Free Collection</Badge>
                <p className="text-xs text-muted-foreground mt-1">No cost to install</p>
              </div>
            ) : (
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-primary">
                    {formatCurrency(collection.bundle_price!)}
                  </span>
                  {hasDiscount && (
                    <span className="text-sm text-muted-foreground line-through">
                      {formatCurrency(collection.original_price)}
                    </span>
                  )}
                </div>
                {hasDiscount && (
                  <p className="text-xs text-green-600 font-medium">
                    Save {formatCurrency(collection.savings)} ({collection.discount_percentage}% off)
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button className="flex-1" asChild>
              <Link href={`/collections/${collection.id}`}>
                {isFree ? (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Install Free
                  </>
                ) : (
                  <>
                    <ShoppingCart className="w-4 h-4 mr-2" />
                    Buy Bundle
                  </>
                )}
              </Link>
            </Button>
            <Button variant="outline" size="icon">
              <Heart className={`w-4 h-4 ${isFavorited ? 'text-red-500 fill-current' : ''}`} />
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Default variant
  return (
    <Card 
      className={`overflow-hidden hover:shadow-lg transition-all duration-200 ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="relative">
        <div className="aspect-[4/3] relative bg-gradient-to-br from-slate-50 to-slate-100">
          {collection.image_url ? (
            <Image
              src={collection.image_url}
              alt={collection.name}
              fill
              className="object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Package className="w-12 h-12 text-muted-foreground/30" />
            </div>
          )}
          
          {collection.is_featured && (
            <div className="absolute top-2 left-2">
              <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white">
                <Crown className="w-3 h-3 mr-1 fill-current" />
                Featured
              </Badge>
            </div>
          )}
          
          {hasDiscount && (
            <div className="absolute top-2 right-2">
              <Badge variant="destructive">
                -{collection.discount_percentage}%
              </Badge>
            </div>
          )}
        </div>
      </div>

      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <Link href={`/collections/${collection.id}`}>
              <CardTitle className="text-lg hover:text-primary transition-colors line-clamp-2">
                {collection.name}
              </CardTitle>
            </Link>
            <CardDescription className="text-sm text-muted-foreground">
              by {collection.creator_name}
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="w-8 h-8 flex-shrink-0"
            onClick={() => setIsFavorited(!isFavorited)}
          >
            <Heart className={`w-4 h-4 ${isFavorited ? 'text-red-500 fill-current' : 'text-muted-foreground'}`} />
          </Button>
        </div>
        
        <p className="text-sm text-muted-foreground line-clamp-2 mt-2">
          {collection.description}
        </p>
      </CardHeader>

      <CardContent className="pt-0">
        {/* Stats */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
          <div className="flex items-center gap-1">
            <Star className="w-4 h-4 text-yellow-400 fill-current" />
            {collection.average_rating.toFixed(1)} ({collection.review_count})
          </div>
          <div className="flex items-center gap-1">
            <Download className="w-4 h-4" />
            {formatNumber(collection.total_installs)}
          </div>
          <div className="flex items-center gap-1">
            <Package className="w-4 h-4" />
            {collection.template_count}
          </div>
        </div>

        {/* Templates Preview */}
        {showTemplates && collection.templates.length > 0 && (
          <div className="mb-4">
            <p className="text-sm font-medium mb-2">Included Templates:</p>
            <div className="space-y-2">
              {collection.templates.slice(0, 3).map((template) => (
                <div key={template.id} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground line-clamp-1">{template.name}</span>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <Star className="w-3 h-3 text-yellow-400 fill-current" />
                      {template.rating}
                    </div>
                    {template.price > 0 && (
                      <span className="font-medium">{formatCurrency(template.price)}</span>
                    )}
                  </div>
                </div>
              ))}
              {collection.template_count > 3 && (
                <p className="text-xs text-muted-foreground">
                  +{collection.template_count - 3} more templates...
                </p>
              )}
            </div>
            <Separator className="mt-3" />
          </div>
        )}

        {/* Tags */}
        <div className="flex flex-wrap gap-1 mb-4">
          {collection.tags.slice(0, 4).map((tag) => (
            <Badge key={tag} variant="secondary" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>

        {/* Pricing */}
        <div className="flex items-center justify-between mb-4">
          {isFree ? (
            <div>
              <Badge className="bg-green-500 text-white">Free</Badge>
            </div>
          ) : (
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-bold">
                  {formatCurrency(collection.bundle_price!)}
                </span>
                {hasDiscount && (
                  <span className="text-sm text-muted-foreground line-through">
                    {formatCurrency(collection.original_price)}
                  </span>
                )}
              </div>
              {hasDiscount && (
                <p className="text-xs text-green-600">
                  Save {formatCurrency(collection.savings)}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button className="flex-1" size="sm" asChild>
            <Link href={`/collections/${collection.id}`}>
              {isFree ? 'Install Free' : 'View Bundle'}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}