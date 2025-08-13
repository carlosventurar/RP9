'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import { 
  Play,
  Download, 
  Star, 
  Clock, 
  Users,
  Shield,
  Eye,
  ShoppingCart,
  CreditCard,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  ThumbsUp,
  ThumbsDown,
  Share2,
  BookOpen,
  Code2,
  Zap,
  Loader2
} from 'lucide-react'

interface TemplateDetail {
  item: {
    id: string
    slug: string
    title: string
    short_desc: string
    long_desc: string
    images: string[]
    primary_image: string | null
    tier: string
    currency: string
    one_off_price_cents: number | null
    subscription_price_cents: number | null
    price_display: string
    is_free: boolean
    has_subscription: boolean
    has_bundle_discount: boolean
    rating_avg: number
    rating_count: number
    install_count: number
    view_count: number
    popularity_score: number
    setup_complexity: string
    setup_time_minutes: number
    integrations: string[]
    tags_array: string[]
    requirements_array: string[]
    creator: {
      name: string
      country: string
      status: string
    } | null
    category: {
      key: string
      name: string
      description: string
      icon: string
    } | null
    version: string
    created_at: string
  }
  versions: Array<{
    id: number
    version: string
    changelog: string
    created_at: string
  }>
  reviews: {
    items: Array<{
      id: number
      rating: number
      title: string
      comment: string
      pros: string
      cons: string
      is_verified: boolean
      helpful_count: number
      created_at: string
    }>
    summary: {
      total_count: number
      average_rating: number
      rating_distribution: { [key: string]: number }
    }
  }
  adoption: {
    total_executions_30d: number
    total_outcomes_30d: number
    install_count: number
    adoption_score: number
  }
  related_items: Array<{
    id: string
    slug: string
    title: string
    short_desc: string
    images: string[]
    currency: string
    one_off_price_cents: number | null
    subscription_price_cents: number | null
    rating_avg: number
    install_count: number
  }>
  preview_token?: {
    id: string
    remaining: number
    expires_at: string
    daily_limit: number
  }
  purchase_info?: {
    purchased: boolean
    purchase_type: string
    license_key: string
    expires_at: string | null
  }
  install_info?: {
    installed: boolean
    workflow_id: string
    version_installed: string
    auto_update_enabled: boolean
    has_pending_update: boolean
    pending_update_version: string | null
    performance: {
      executions_30d: number
      outcomes_30d: number
      success_rate: number
      last_execution_at: string | null
    }
    status: string
  }
  tenant_context?: {
    can_preview: boolean
    already_purchased: boolean
    already_installed: boolean
  }
}

export default function TemplateDetailPage({ params }: { params: { slug: string } }) {
  const { token, isAuthenticated } = useAuth()
  const [template, setTemplate] = useState<TemplateDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [previewResult, setPreviewResult] = useState<any>(null)
  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => {
    const fetchTemplateDetail = async () => {
      setLoading(true)
      try {
        const tenant_id = 'user-tenant-placeholder' // TODO: get from auth context
        const params = new URLSearchParams({
          slug: params.slug,
          ...(tenant_id && { tenant_id, generate_preview_token: 'true' })
        })

        const response = await fetch(`/.netlify/functions/marketplace-detail?${params}`)
        const data = await response.json()

        if (data.success) {
          setTemplate(data.data)
        } else {
          console.error('Failed to fetch template:', data.error)
        }
      } catch (error) {
        console.error('Error fetching template:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchTemplateDetail()
  }, [params.slug])

  const handlePreview = async () => {
    if (!template?.preview_token) return

    setActionLoading('preview')
    try {
      const response = await fetch('/.netlify/functions/marketplace-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_slug: params.slug,
          tenant_id: 'user-tenant-placeholder',
          preview_token_id: template.preview_token.id,
          execution_data: { test: true },
          mock_mode: true
        })
      })

      const data = await response.json()
      
      if (data.success) {
        setPreviewResult(data.data)
        setActiveTab('preview')
      } else {
        alert(`Preview failed: ${data.error}`)
      }
    } catch (error) {
      console.error('Preview error:', error)
      alert('Preview failed. Please try again.')
    } finally {
      setActionLoading(null)
    }
  }

  const handlePurchase = async (purchaseType: 'one_off' | 'subscription') => {
    setActionLoading('purchase')
    try {
      const response = await fetch('/.netlify/functions/marketplace-purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_slug: params.slug,
          tenant_id: 'user-tenant-placeholder',
          user_id: 'user-placeholder',
          purchase_type: purchaseType,
          success_url: `${window.location.origin}/templates/${params.slug}?purchase=success`,
          cancel_url: `${window.location.origin}/templates/${params.slug}?purchase=cancelled`
        })
      })

      const data = await response.json()

      if (data.success) {
        // Redirect to Stripe Checkout
        window.location.href = data.data.checkout_url
      } else {
        alert(`Purchase failed: ${data.error}`)
      }
    } catch (error) {
      console.error('Purchase error:', error)
      alert('Purchase failed. Please try again.')
    } finally {
      setActionLoading(null)
    }
  }

  const handleInstall = async () => {
    setActionLoading('install')
    try {
      const response = await fetch('/.netlify/functions/marketplace-install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_slug: params.slug,
          tenant_id: 'user-tenant-placeholder',
          user_id: 'user-placeholder',
          custom_name: `${template?.item.title} (Installed)`
        })
      })

      const data = await response.json()

      if (data.success) {
        alert(`Template installed successfully!\n\nWorkflow ID: ${data.data.workflow_id}\nn8n URL: ${data.data.n8n_url}`)
        // Refresh template data
        window.location.reload()
      } else {
        if (data.requires_purchase) {
          alert('This template requires a purchase. Please buy it first.')
        } else {
          alert(`Installation failed: ${data.error}`)
        }
      }
    } catch (error) {
      console.error('Install error:', error)
      alert('Installation failed. Please try again.')
    } finally {
      setActionLoading(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!template) {
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold mb-4">Template not found</h1>
        <p className="text-muted-foreground">The template you're looking for doesn't exist or is not available.</p>
      </div>
    )
  }

  const { item } = template

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant={item.tier === 'pro' ? 'default' : 'secondary'}>
                  {item.tier.toUpperCase()}
                </Badge>
                {item.category && (
                  <Badge variant="outline">
                    {item.category.name}
                  </Badge>
                )}
                {template.tenant_context?.already_purchased && (
                  <Badge variant="default" className="bg-green-500">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Owned
                  </Badge>
                )}
              </div>
              <h1 className="text-3xl font-bold">{item.title}</h1>
              <p className="text-muted-foreground text-lg">{item.short_desc}</p>
              
              {/* Stats */}
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  <span>{item.rating_avg.toFixed(1)}</span>
                  <span>({item.rating_count})</span>
                </div>
                <div className="flex items-center gap-1">
                  <Download className="h-4 w-4" />
                  <span>{item.install_count} installs</span>
                </div>
                <div className="flex items-center gap-1">
                  <Eye className="h-4 w-4" />
                  <span>{item.view_count} views</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  <span>{item.setup_time_minutes} min setup</span>
                </div>
              </div>
            </div>

            <Button variant="outline" size="sm">
              <Share2 className="h-4 w-4" />
            </Button>
          </div>

          {/* Gallery */}
          {item.images && item.images.length > 0 && (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
              {item.images.slice(0, 6).map((image, index) => (
                <img
                  key={index}
                  src={image}
                  alt={`${item.title} screenshot ${index + 1}`}
                  className="rounded-lg border aspect-video object-cover"
                />
              ))}
            </div>
          )}
        </div>

        {/* Sidebar - Pricing & Actions */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">{item.price_display}</CardTitle>
              {item.has_bundle_discount && (
                <CardDescription className="text-green-600">
                  Save 20% with annual subscription
                </CardDescription>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Action Buttons */}
              {!template.tenant_context?.already_purchased ? (
                <div className="space-y-2">
                  {item.one_off_price_cents && (
                    <Button 
                      className="w-full" 
                      onClick={() => handlePurchase('one_off')}
                      disabled={actionLoading === 'purchase'}
                    >
                      <CreditCard className="h-4 w-4 mr-2" />
                      Buy for {item.currency === 'usd' ? '$' : ''}{(item.one_off_price_cents / 100).toFixed(2)}
                    </Button>
                  )}
                  {item.subscription_price_cents && (
                    <Button 
                      variant="outline" 
                      className="w-full"
                      onClick={() => handlePurchase('subscription')}
                      disabled={actionLoading === 'purchase'}
                    >
                      <CreditCard className="h-4 w-4 mr-2" />
                      Subscribe {item.currency === 'usd' ? '$' : ''}{(item.subscription_price_cents / 100).toFixed(2)}/mo
                    </Button>
                  )}
                  {item.is_free && (
                    <Button 
                      className="w-full" 
                      onClick={handleInstall}
                      disabled={actionLoading === 'install'}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      {actionLoading === 'install' ? 'Installing...' : 'Install Free'}
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {!template.tenant_context?.already_installed ? (
                    <Button 
                      className="w-full" 
                      onClick={handleInstall}
                      disabled={actionLoading === 'install'}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      {actionLoading === 'install' ? 'Installing...' : 'Install Template'}
                    </Button>
                  ) : (
                    <div className="text-center py-2">
                      <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-2" />
                      <p className="text-sm font-medium">Already Installed</p>
                      {template.install_info && (
                        <p className="text-xs text-muted-foreground">
                          Version {template.install_info.version_installed}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Preview Button */}
              {template.preview_token && template.preview_token.remaining > 0 && (
                <>
                  <Separator />
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={handlePreview}
                    disabled={actionLoading === 'preview'}
                  >
                    <Play className="h-4 w-4 mr-2" />
                    {actionLoading === 'preview' ? 'Running Preview...' : `Preview (${template.preview_token.remaining} left)`}
                  </Button>
                </>
              )}

              {/* Creator Info */}
              {item.creator && (
                <>
                  <Separator />
                  <div className="text-sm">
                    <p className="font-medium">Created by</p>
                    <p className="text-muted-foreground">
                      {item.creator.name}
                      {item.creator.country && ` • ${item.creator.country}`}
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Install Status */}
          {template.install_info && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Installation Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span>Success Rate</span>
                  <span>{template.install_info.performance.success_rate}%</span>
                </div>
                <Progress value={template.install_info.performance.success_rate} />
                
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="font-medium">{template.install_info.performance.executions_30d}</p>
                    <p className="text-muted-foreground">Executions</p>
                  </div>
                  <div>
                    <p className="font-medium">{template.install_info.performance.outcomes_30d}</p>
                    <p className="text-muted-foreground">Outcomes</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Tabs Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
          <TabsTrigger value="reviews">Reviews</TabsTrigger>
          <TabsTrigger value="changelog">Changelog</TabsTrigger>
          <TabsTrigger value="support">Support</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Description */}
          <Card>
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap">{item.long_desc || item.short_desc}</p>
            </CardContent>
          </Card>

          {/* Features & Requirements */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Features & Integrations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {item.integrations.map((integration, index) => (
                    <Badge key={index} variant="secondary">
                      {integration}
                    </Badge>
                  ))}
                  {item.tags_array.map((tag, index) => (
                    <Badge key={`tag-${index}`} variant="outline">
                      #{tag}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Requirements</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4" />
                    <span>Setup time: {item.setup_time_minutes} minutes</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Zap className="h-4 w-4" />
                    <span>Complexity: {item.setup_complexity}</span>
                  </div>
                  {item.requirements_array.length > 0 && (
                    <div className="mt-3">
                      <p className="text-sm font-medium mb-2">Prerequisites:</p>
                      <ul className="text-sm space-y-1">
                        {item.requirements_array.map((req, index) => (
                          <li key={index} className="flex items-start gap-2">
                            <AlertCircle className="h-3 w-3 mt-0.5 text-yellow-500" />
                            {req}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="preview" className="space-y-6">
          {previewResult ? (
            <Card>
              <CardHeader>
                <CardTitle>Preview Results</CardTitle>
                <CardDescription>
                  {previewResult.mock_mode ? 'Mock data simulation' : 'Live execution'} • 
                  Duration: {previewResult.duration_ms}ms
                </CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
                  {JSON.stringify(previewResult.result, null, 2)}
                </pre>
                {previewResult.warnings && previewResult.warnings.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm font-medium mb-2">Warnings:</p>
                    <ul className="text-sm space-y-1">
                      {previewResult.warnings.map((warning: string, index: number) => (
                        <li key={index} className="flex items-start gap-2 text-yellow-600">
                          <AlertCircle className="h-3 w-3 mt-0.5" />
                          {warning}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Try Before You Buy</CardTitle>
                <CardDescription>
                  {template.preview_token 
                    ? `You have ${template.preview_token.remaining} free previews remaining today.`
                    : 'Preview not available for this template.'
                  }
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  Run a simulated version of this template to see how it works with mock data.
                </p>
                {template.preview_token && template.preview_token.remaining > 0 && (
                  <Button onClick={handlePreview} disabled={actionLoading === 'preview'}>
                    <Play className="h-4 w-4 mr-2" />
                    {actionLoading === 'preview' ? 'Running Preview...' : 'Run Preview'}
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="reviews" className="space-y-6">
          {/* Reviews Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Customer Reviews</CardTitle>
              <CardDescription>
                {template.reviews.summary.total_count} reviews • Average: {template.reviews.summary.average_rating.toFixed(1)} stars
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-5 gap-2 text-sm">
                {[5, 4, 3, 2, 1].map(stars => (
                  <div key={stars} className="flex items-center gap-2">
                    <span>{stars}★</span>
                    <Progress 
                      value={(template.reviews.summary.rating_distribution[stars.toString()] || 0) / template.reviews.summary.total_count * 100} 
                      className="flex-1"
                    />
                    <span className="text-muted-foreground">
                      {template.reviews.summary.rating_distribution[stars.toString()] || 0}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Individual Reviews */}
          {template.reviews.items.map((review) => (
            <Card key={review.id}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="flex">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className={`h-4 w-4 ${i < review.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} />
                      ))}
                    </div>
                    {review.is_verified && (
                      <Badge variant="secondary" className="text-xs">
                        <Shield className="h-3 w-3 mr-1" />
                        Verified
                      </Badge>
                    )}
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {new Date(review.created_at).toLocaleDateString()}
                  </span>
                </div>
                
                {review.title && <h4 className="font-medium mb-2">{review.title}</h4>}
                {review.comment && <p className="text-sm text-muted-foreground mb-3">{review.comment}</p>}
                
                {(review.pros || review.cons) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                    {review.pros && (
                      <div>
                        <p className="text-sm font-medium text-green-600 mb-1">Pros</p>
                        <p className="text-sm">{review.pros}</p>
                      </div>
                    )}
                    {review.cons && (
                      <div>
                        <p className="text-sm font-medium text-red-600 mb-1">Cons</p>
                        <p className="text-sm">{review.cons}</p>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-4">
                  <Button variant="ghost" size="sm">
                    <ThumbsUp className="h-3 w-3 mr-1" />
                    {review.helpful_count}
                  </Button>
                  <Button variant="ghost" size="sm">
                    <ThumbsDown className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="changelog" className="space-y-6">
          {template.versions.map((version, index) => (
            <Card key={version.id}>
              <CardHeader>
                <CardTitle className="text-lg">Version {version.version}</CardTitle>
                <CardDescription>
                  Released on {new Date(version.created_at).toLocaleDateString()}
                  {index === 0 && <Badge className="ml-2">Latest</Badge>}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap">{version.changelog || 'No changelog available for this version.'}</p>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="support" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Need Help?</CardTitle>
              <CardDescription>Get support for this template</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button variant="outline" asChild>
                  <a href="/support" target="_blank">
                    <BookOpen className="h-4 w-4 mr-2" />
                    Documentation
                  </a>
                </Button>
                <Button variant="outline" asChild>
                  <a href="/support/contact" target="_blank">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Contact Support
                  </a>
                </Button>
              </div>
              
              {item.creator && (
                <div className="border-t pt-4">
                  <p className="text-sm font-medium mb-2">Creator Support</p>
                  <p className="text-sm text-muted-foreground">
                    For template-specific questions, you can reach out to the creator {item.creator.name}.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Related Templates */}
      {template.related_items && template.related_items.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Related Templates</CardTitle>
            <CardDescription>Similar templates you might like</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {template.related_items.map((related) => (
                <Card key={related.id} className="cursor-pointer hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    {related.images && related.images[0] && (
                      <img
                        src={related.images[0]}
                        alt={related.title}
                        className="w-full aspect-video object-cover rounded mb-3"
                      />
                    )}
                    <h4 className="font-medium mb-1 text-sm">{related.title}</h4>
                    <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{related.short_desc}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">
                        {related.one_off_price_cents ? 
                          `$${(related.one_off_price_cents / 100).toFixed(2)}` : 
                          'Free'
                        }
                      </span>
                      <div className="flex items-center gap-1 text-xs">
                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                        <span>{related.rating_avg.toFixed(1)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}