'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ReviewModal } from '@/components/review-modal'
import { ReviewsList } from '@/components/reviews-list'
import {
  Star,
  Download,
  ShoppingCart,
  Heart,
  Package,
  DollarSign,
  Users,
  Crown,
  Check,
  Clock,
  Shield,
  Award,
  ArrowLeft,
  Share2,
  Flag,
  Loader2,
  ChevronRight,
  Zap,
  Gift,
  TrendingUp,
  Eye
} from 'lucide-react'

interface Template {
  id: string
  name: string
  price: number
  category: string
  rating: number
  installs: number
  description: string
}

interface Collection {
  id: string
  name: string
  description: string
  long_description: string
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
  features: string[]
  requirements: string[]
  included_support: string
  update_policy: string
}

interface Review {
  id: string
  user_name: string
  user_avatar: string
  rating: number
  comment: string
  helpful_count: number
  created_at: string
  verified_purchase: boolean
}

export default function CollectionDetailPage() {
  const params = useParams()
  const collectionId = Array.isArray(params.id) ? params.id[0] : params.id

  const [collection, setCollection] = useState<Collection | null>(null)
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isFavorited, setIsFavorited] = useState(false)
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'templates' | 'reviews'>('overview')

  useEffect(() => {
    const fetchCollection = async () => {
      try {
        setLoading(true)
        setError(null)

        // Fetch collection details
        const collectionResponse = await fetch(`/api/collections/${collectionId}?include_reviews=true`)
        const collectionData = await collectionResponse.json()

        if (collectionData.success) {
          setCollection(collectionData.data.collection)
        } else {
          throw new Error('Collection not found')
        }

        // Fetch reviews
        const reviewsResponse = await fetch(`/api/collections/${collectionId}/reviews?limit=5`)
        const reviewsData = await reviewsResponse.json()

        if (reviewsData.success) {
          setReviews(reviewsData.data.reviews)
        }

      } catch (err) {
        console.error('Error fetching collection:', err)
        setError(err instanceof Error ? err.message : 'Failed to load collection')
      } finally {
        setLoading(false)
      }
    }

    if (collectionId) {
      fetchCollection()
    }
  }, [collectionId])

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

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[600px]">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Loading collection...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error || !collection) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[600px]">
          <div className="text-center">
            <Package className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2">Collection not found</h2>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button asChild>
              <Link href="/collections">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Collections
              </Link>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const isFree = !collection.bundle_price || collection.bundle_price === 0
  const hasDiscount = collection.discount_percentage > 0

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6 text-sm text-muted-foreground">
        <Link href="/collections" className="hover:text-foreground">Collections</Link>
        <ChevronRight className="w-4 h-4" />
        <span className="line-clamp-1">{collection.name}</span>
      </div>

      {/* Header */}
      <div className="grid gap-8 md:grid-cols-2 mb-8">
        {/* Collection Image */}
        <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
          {collection.image_url ? (
            <Image
              src={collection.image_url}
              alt={collection.name}
              fill
              className="object-cover"
              priority
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Package className="w-20 h-20 text-muted-foreground/30" />
            </div>
          )}
          
          {collection.is_featured && (
            <div className="absolute top-4 left-4">
              <Badge className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white border-0">
                <Crown className="w-4 h-4 mr-1 fill-current" />
                Featured Collection
              </Badge>
            </div>
          )}
          
          {hasDiscount && (
            <div className="absolute top-4 right-4">
              <Badge variant="destructive" className="text-lg px-3 py-1">
                -{collection.discount_percentage}% OFF
              </Badge>
            </div>
          )}
        </div>

        {/* Collection Info */}
        <div>
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h1 className="text-3xl font-bold mb-2">{collection.name}</h1>
              <p className="text-muted-foreground">by {collection.creator_name}</p>
            </div>
            <div className="flex gap-2 ml-4">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setIsFavorited(!isFavorited)}
              >
                <Heart className={`w-4 h-4 ${isFavorited ? 'text-red-500 fill-current' : ''}`} />
              </Button>
              <Button variant="outline" size="icon">
                <Share2 className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <p className="text-lg text-muted-foreground mb-6">
            {collection.description}
          </p>

          {/* Stats */}
          <div className="flex items-center gap-6 mb-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <Star className="w-4 h-4 text-yellow-400 fill-current" />
                <span className="font-semibold">{collection.average_rating.toFixed(1)}</span>
              </div>
              <span className="text-muted-foreground">({collection.review_count} reviews)</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Download className="w-4 h-4" />
              {formatNumber(collection.total_installs)} installs
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Package className="w-4 h-4" />
              {collection.template_count} templates
            </div>
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-2 mb-6">
            {collection.tags.map((tag) => (
              <Badge key={tag} variant="secondary">
                {tag}
              </Badge>
            ))}
          </div>

          {/* Pricing */}
          <Card className="mb-6">
            <CardContent className="p-6">
              {isFree ? (
                <div className="text-center">
                  <Badge className="bg-green-500 text-white mb-3 text-lg px-4 py-2">
                    <Gift className="w-4 h-4 mr-2" />
                    Free Collection
                  </Badge>
                  <p className="text-muted-foreground mb-4">
                    Get all {collection.template_count} templates at no cost
                  </p>
                </div>
              ) : (
                <div>
                  <div className="text-center mb-4">
                    <div className="flex items-baseline justify-center gap-3 mb-2">
                      <span className="text-4xl font-bold text-primary">
                        {formatCurrency(collection.bundle_price!)}
                      </span>
                      {hasDiscount && (
                        <span className="text-lg text-muted-foreground line-through">
                          {formatCurrency(collection.original_price)}
                        </span>
                      )}
                    </div>
                    {hasDiscount && (
                      <div className="flex items-center justify-center gap-2 text-green-600">
                        <TrendingUp className="w-4 h-4" />
                        <span className="font-semibold">
                          Save {formatCurrency(collection.savings)} ({collection.discount_percentage}% off)
                        </span>
                      </div>
                    )}
                  </div>
                  
                  <div className="text-center text-sm text-muted-foreground mb-4">
                    vs {formatCurrency(collection.original_price)} when purchased individually
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3">
                <Button className="flex-1" size="lg">
                  {isFree ? (
                    <>
                      <Download className="w-5 h-5 mr-2" />
                      Install Free Collection
                    </>
                  ) : (
                    <>
                      <ShoppingCart className="w-5 h-5 mr-2" />
                      Buy Collection Bundle
                    </>
                  )}
                </Button>
                <Button variant="outline" onClick={() => setShowReviewModal(true)}>
                  <Star className="w-4 h-4 mr-2" />
                  Review
                </Button>
              </div>

              {/* Guarantees */}
              <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Shield className="w-3 h-3" />
                  <span>30-day money back</span>
                </div>
                <div className="flex items-center gap-1">
                  <Zap className="w-3 h-3" />
                  <span>Instant access</span>
                </div>
                <div className="flex items-center gap-1">
                  <Award className="w-3 h-3" />
                  <span>Premium support</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b mb-8">
        <nav className="flex gap-8">
          {(['overview', 'templates', 'reviews'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-4 text-sm font-medium capitalize transition-colors border-b-2 ${
                activeTab === tab
                  ? 'text-primary border-primary'
                  : 'text-muted-foreground border-transparent hover:text-foreground'
              }`}
            >
              {tab}
              {tab === 'templates' && ` (${collection.template_count})`}
              {tab === 'reviews' && ` (${collection.review_count})`}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-8">
            {/* Description */}
            <Card>
              <CardHeader>
                <CardTitle>About This Collection</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground leading-relaxed">
                  {collection.long_description}
                </p>
                
                {/* Features */}
                <div>
                  <h4 className="font-semibold mb-3">What's Included:</h4>
                  <ul className="space-y-2">
                    {collection.features.map((feature, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>

            {/* Template Preview */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Included Templates
                  <Badge variant="outline">{collection.template_count} templates</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2">
                  {collection.templates.slice(0, 4).map((template) => (
                    <div key={template.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="min-w-0 flex-1">
                        <h5 className="font-medium text-sm line-clamp-1">{template.name}</h5>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Star className="w-3 h-3 text-yellow-400 fill-current" />
                            {template.rating}
                          </div>
                          <div className="flex items-center gap-1">
                            <Eye className="w-3 h-3" />
                            {formatNumber(template.installs)}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold">
                          {template.price > 0 ? formatCurrency(template.price) : 'Free'}
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {template.category}
                        </Badge>
                      </div>
                    </div>
                  ))}
                  {collection.template_count > 4 && (
                    <div className="col-span-2 text-center p-4 border-2 border-dashed rounded-lg">
                      <p className="text-sm text-muted-foreground">
                        +{collection.template_count - 4} more templates included
                      </p>
                      <Button variant="outline" size="sm" className="mt-2">
                        View All Templates
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Requirements */}
            <Card>
              <CardHeader>
                <CardTitle>Requirements</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  {collection.requirements.map((req, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 bg-muted-foreground rounded-full flex-shrink-0 mt-2" />
                      <span>{req}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Support & Updates */}
            <Card>
              <CardHeader>
                <CardTitle>Support & Updates</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="flex items-start gap-2">
                  <Shield className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-medium">Support</div>
                    <div className="text-muted-foreground">{collection.included_support}</div>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Clock className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-medium">Updates</div>
                    <div className="text-muted-foreground">{collection.update_policy}</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Stats */}
            <Card>
              <CardHeader>
                <CardTitle>Collection Stats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Total Downloads</span>
                  <span className="font-semibold">{formatNumber(collection.total_installs)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Average Rating</span>
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 text-yellow-400 fill-current" />
                    <span className="font-semibold">{collection.average_rating.toFixed(1)}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Created</span>
                  <span className="font-semibold">
                    {new Date(collection.created_at).toLocaleDateString()}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {activeTab === 'templates' && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {collection.templates.map((template) => (
            <Card key={template.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="min-w-0 flex-1">
                    <h4 className="font-semibold line-clamp-1">{template.name}</h4>
                    <Badge variant="outline" className="text-xs mt-1">
                      {template.category}
                    </Badge>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">
                      {template.price > 0 ? formatCurrency(template.price) : 'Free'}
                    </div>
                  </div>
                </div>
                
                <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                  {template.description}
                </p>
                
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Star className="w-3 h-3 text-yellow-400 fill-current" />
                    {template.rating}
                  </div>
                  <div className="flex items-center gap-1">
                    <Download className="w-3 h-3" />
                    {formatNumber(template.installs)}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {activeTab === 'reviews' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold">
              Reviews ({collection.review_count})
            </h3>
            <Button onClick={() => setShowReviewModal(true)}>
              <Star className="w-4 h-4 mr-2" />
              Write Review
            </Button>
          </div>
          
          <ReviewsList 
            reviews={reviews}
            showTemplateInfo={false}
          />
        </div>
      )}

      {/* Review Modal */}
      <ReviewModal
        template={{ id: collection.id, name: collection.name }}
        isOpen={showReviewModal}
        onClose={() => setShowReviewModal(false)}
        onReviewSubmitted={(review) => {
          setReviews(prev => [review, ...prev])
          setShowReviewModal(false)
        }}
      />
    </div>
  )
}