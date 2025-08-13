'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PremiumTemplateCard } from '@/components/premium-template-card'
import { TemplatePriceBadge } from '@/components/template-price-badge'
import { ReviewsList } from '@/components/reviews-list'
import { 
  Search, 
  Star, 
  Download, 
  Clock, 
  Filter,
  Mail,
  Webhook,
  Database,
  Zap,
  ArrowRight,
  Loader2
} from 'lucide-react'

interface Template {
  id: string
  name: string
  description: string
  category: string
  subcategory: string | null
  workflow_json: any
  icon_url: string | null
  preview_images: string[]
  tags: string[]
  difficulty: string
  estimated_time: number
  price: number
  install_count: number
  rating: number
  is_featured: boolean
  is_active: boolean
}

const mockTemplates: Template[] = [
  // FREE TEMPLATES
  {
    id: '1',
    name: 'Email Notification',
    description: 'Send email notifications when specific events occur in your workflows',
    category: 'notifications',
    subcategory: null,
    workflow_json: {},
    icon_url: null,
    preview_images: [],
    tags: ['email', 'notification', 'basic'],
    difficulty: 'beginner',
    estimated_time: 5,
    price: 0,
    install_count: 1247,
    rating: 4.8,
    is_featured: true,
    is_active: true
  },
  {
    id: '2',
    name: 'HTTP API to Slack',
    description: 'Forward HTTP requests to Slack channels with custom formatting',
    category: 'integrations',
    subcategory: null,
    workflow_json: {},
    icon_url: null,
    preview_images: [],
    tags: ['webhook', 'slack', 'api'],
    difficulty: 'intermediate',
    estimated_time: 10,
    price: 0,
    install_count: 856,
    rating: 4.6,
    is_featured: true,
    is_active: true
  },
  {
    id: '3',
    name: 'Database Backup',
    description: 'Automated daily database backup to cloud storage with notifications',
    category: 'data',
    subcategory: null,
    workflow_json: {},
    icon_url: null,
    preview_images: [],
    tags: ['database', 'backup', 'automation'],
    difficulty: 'advanced',
    estimated_time: 15,
    price: 0,
    install_count: 423,
    rating: 4.9,
    is_featured: false,
    is_active: true
  },
  {
    id: '4',
    name: 'Lead Processing',
    description: 'Capture leads from forms and process them through your CRM pipeline',
    category: 'crm',
    subcategory: null,
    workflow_json: {},
    icon_url: null,
    preview_images: [],
    tags: ['crm', 'leads', 'forms'],
    difficulty: 'intermediate',
    estimated_time: 12,
    price: 0,
    install_count: 692,
    rating: 4.5,
    is_featured: false,
    is_active: true
  },
  // PREMIUM TEMPLATES
  {
    id: '101',
    name: 'Multi-Channel Inventory Sync Pro',
    description: 'Advanced inventory synchronization across Shopify, Amazon, eBay, and WooCommerce with conflict resolution and automated alerts',
    category: 'E-commerce',
    subcategory: 'Inventory Management',
    workflow_json: {},
    icon_url: null,
    preview_images: [],
    tags: ['multi-channel', 'inventory', 'sync', 'e-commerce', 'pro'],
    difficulty: 'advanced',
    estimated_time: 45,
    price: 25,
    install_count: 89,
    rating: 4.9,
    is_featured: true,
    is_active: true
  },
  {
    id: '102',
    name: 'Advanced Customer Segmentation AI',
    description: 'ML-powered customer segmentation using RFM analysis, behavioral data, and predictive modeling for targeted campaigns',
    category: 'E-commerce',
    subcategory: 'Customer Analytics',
    workflow_json: {},
    icon_url: null,
    preview_images: [],
    tags: ['ai', 'customer-segmentation', 'rfm', 'analytics', 'ml'],
    difficulty: 'advanced',
    estimated_time: 60,
    price: 35,
    install_count: 67,
    rating: 4.8,
    is_featured: true,
    is_active: true
  },
  {
    id: '103',
    name: 'Advanced Lead Scoring AI Pro',
    description: 'Machine learning-powered lead qualification using 50+ data points, behavioral analysis, and predictive scoring',
    category: 'CRM & Sales',
    subcategory: 'Lead Management',
    workflow_json: {},
    icon_url: null,
    preview_images: [],
    tags: ['ai', 'lead-scoring', 'ml', 'crm', 'enterprise'],
    difficulty: 'advanced',
    estimated_time: 75,
    price: 50,
    install_count: 43,
    rating: 4.9,
    is_featured: true,
    is_active: true
  },
  {
    id: '104',
    name: 'Cross-Platform Campaign Manager Pro',
    description: 'Unified campaign management across Facebook Ads, Google Ads, LinkedIn Ads, and email marketing with ROI tracking',
    category: 'Marketing',
    subcategory: 'Campaign Management',
    workflow_json: {},
    icon_url: null,
    preview_images: [],
    tags: ['cross-platform', 'ads', 'campaign', 'marketing', 'pro'],
    difficulty: 'advanced',
    estimated_time: 55,
    price: 35,
    install_count: 78,
    rating: 4.7,
    is_featured: true,
    is_active: true
  },
  {
    id: '105',
    name: 'Multi-Cloud Deployment Pipeline Enterprise',
    description: 'Enterprise-grade CI/CD pipeline supporting AWS, Azure, and GCP deployments with blue-green deployments and monitoring',
    category: 'DevOps & IT',
    subcategory: 'Deployment',
    workflow_json: {},
    icon_url: null,
    preview_images: [],
    tags: ['multi-cloud', 'cicd', 'deployment', 'enterprise', 'devops'],
    difficulty: 'advanced',
    estimated_time: 90,
    price: 50,
    install_count: 34,
    rating: 4.9,
    is_featured: true,
    is_active: true
  },
  // Additional free templates
  {
    id: '5',
    name: 'Social Media Monitor',
    description: 'Monitor mentions of your brand across social media platforms',
    category: 'social',
    subcategory: null,
    workflow_json: {},
    icon_url: null,
    preview_images: [],
    tags: ['social', 'monitoring', 'brand'],
    difficulty: 'intermediate',
    estimated_time: 8,
    price: 0,
    install_count: 334,
    rating: 4.3,
    is_featured: false,
    is_active: true
  },
  {
    id: '6',
    name: 'Invoice Generator',
    description: 'Generate and send invoices automatically when orders are completed',
    category: 'finance',
    subcategory: null,
    workflow_json: {},
    icon_url: null,
    preview_images: [],
    tags: ['invoice', 'finance', 'automation'],
    difficulty: 'advanced',
    estimated_time: 20,
    price: 0,
    install_count: 567,
    rating: 4.7,
    is_featured: false,
    is_active: true
  }
]

const categoryIcons = {
  'E-commerce': Mail,
  'CRM & Sales': Zap, 
  'Marketing': Star,
  'DevOps & IT': Database,
  'Finance & Operations': Clock,
  // Legacy categories for backward compatibility
  notifications: Mail,
  integrations: Webhook,
  data: Database,
  crm: Zap,
  social: Star,
  finance: Clock
}

const difficultyColors = {
  beginner: 'bg-green-500/20 text-green-300 border-green-500/50',
  intermediate: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/50',
  advanced: 'bg-red-500/20 text-red-300 border-red-500/50'
}

// Transform marketplace item to template format for backward compatibility
function transformMarketplaceItem(item: any): Template {
  return {
    id: item.id,
    name: item.title,
    description: item.short_desc,
    category: item.catalog_categories?.name || item.category_key,
    subcategory: null,
    workflow_json: {},
    icon_url: item.primary_image,
    preview_images: item.images || [],
    tags: item.tags_array || [],
    difficulty: item.metadata?.complexity || 'intermediate',
    estimated_time: item.metadata?.setup_time_minutes || 15,
    price: item.one_off_price_cents ? item.one_off_price_cents / 100 : 0,
    install_count: item.install_count || 0,
    rating: item.rating_avg || 0,
    is_featured: item.is_featured || false,
    is_active: item.status === 'approved'
  }
}

export default function TemplatesPage() {
  const { token, isAuthenticated } = useAuth()
  const [templates, setTemplates] = useState<Template[]>([])
  const [filteredTemplates, setFilteredTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [difficultyFilter, setDifficultyFilter] = useState<string>('all')
  const [installLoading, setInstallLoading] = useState<string | null>(null)

  useEffect(() => {
    const fetchTemplates = async () => {
      setLoading(true)
      try {
        // Use new marketplace API
        const params = new URLSearchParams({
          sort: 'featured',
          limit: '50'
        })
        
        const response = await fetch(`/.netlify/functions/marketplace-list?${params}`)
        const data = await response.json()
        
        if (data.success && data.data?.items) {
          // Transform marketplace items to template format
          const transformedTemplates = data.data.items.map(transformMarketplaceItem)
          setTemplates(transformedTemplates)
          setFilteredTemplates(transformedTemplates)
        } else {
          console.error('Marketplace API Error:', data.error)
          // Fallback to mock data if API fails
          setTemplates(mockTemplates)
          setFilteredTemplates(mockTemplates)
        }
      } catch (error) {
        console.error('Failed to fetch templates:', error)
        // Fallback to mock data if API fails
        setTemplates(mockTemplates)
        setFilteredTemplates(mockTemplates)
      } finally {
        setLoading(false)
      }
    }

    fetchTemplates()
  }, [])

  useEffect(() => {
    let filtered = templates

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(template =>
        template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        template.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        template.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
      )
    }

    // Filter by category
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(template => template.category === categoryFilter)
    }

    // Filter by difficulty
    if (difficultyFilter !== 'all') {
      filtered = filtered.filter(template => template.difficulty === difficultyFilter)
    }

    setFilteredTemplates(filtered)
  }, [templates, searchTerm, categoryFilter, difficultyFilter])

  const handleInstallTemplate = async (template: Template) => {
    setInstallLoading(template.id)
    try {
      // Check if user is authenticated
      if (!isAuthenticated || !token) {
        alert('Please log in to install templates')
        return
      }
      
      // Get tenant_id from auth (assuming it's available)
      // In production, get this from the authenticated user context
      const tenant_id = 'user-tenant-placeholder' // TODO: get from auth context
      
      const response = await fetch('/.netlify/functions/marketplace-install', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          item_slug: template.id, // Using id as slug fallback
          tenant_id,
          user_id: 'user-placeholder', // TODO: get from auth context
          custom_name: `${template.name} (Installed)`
        })
      })
      
      const data = await response.json()
      
      if (data.success) {
        alert(`Template "${template.name}" installed successfully!\n\nWorkflow ID: ${data.data.workflow_id}\nn8n URL: ${data.data.n8n_url}`)
        
        // Update install count locally
        setTemplates(prev => prev.map(t => 
          t.id === template.id 
            ? { ...t, install_count: t.install_count + 1 }
            : t
        ))
      } else {
        if (data.requires_purchase) {
          alert(`This is a premium template. Please purchase it first.\n\nPrice: $${(data.item.one_off_price_cents || 0) / 100}`)
        } else {
          throw new Error(data.error || 'Installation failed')
        }
      }
    } catch (error) {
      console.error('Failed to install template:', error)
      alert(`Failed to install template: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setInstallLoading(null)
    }
  }

  const categories = Array.from(new Set(templates.map(t => t.category)))

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Templates</h1>
        <p className="text-muted-foreground">
          Quick-start templates to accelerate your automation workflows
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search templates..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map(category => (
              <SelectItem key={category} value={category}>
                {category.charAt(0).toUpperCase() + category.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={difficultyFilter} onValueChange={setDifficultyFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Difficulty" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Levels</SelectItem>
            <SelectItem value="beginner">Beginner</SelectItem>
            <SelectItem value="intermediate">Intermediate</SelectItem>
            <SelectItem value="advanced">Advanced</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Featured Templates */}
      {filteredTemplates.some(t => t.is_featured) && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Featured Templates</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredTemplates
              .filter(template => template.is_featured)
              .map((template) => (
                <PremiumTemplateCard
                  key={template.id}
                  template={template}
                  onInstall={handleInstallTemplate}
                  onPurchaseSuccess={(templateId) => {
                    console.log('Template purchased:', templateId)
                    // Refresh templates or update state
                  }}
                />
              ))}
          </div>
        </div>
      )}

      {/* All Templates */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">All Templates</h2>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{filteredTemplates.length} templates</span>
            <span>•</span>
            <span>{filteredTemplates.filter(t => t.price === 0).length} free</span>
            <span>•</span>
            <span>{filteredTemplates.filter(t => t.price > 0).length} premium</span>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredTemplates.map((template) => (
            <PremiumTemplateCard
              key={template.id}
              template={template}
              onInstall={handleInstallTemplate}
              onPurchaseSuccess={(templateId) => {
                console.log('Template purchased:', templateId)
                // Refresh templates or update state
              }}
              size="default"
            />
          ))}
        </div>
      </div>

      {filteredTemplates.length === 0 && !loading && (
        <div className="text-center py-12">
          <div className="text-muted-foreground mb-4">
            No templates match your filters
          </div>
          <Button 
            variant="outline" 
            onClick={() => {
              setSearchTerm('')
              setCategoryFilter('all')
              setDifficultyFilter('all')
            }}
          >
            Clear Filters
          </Button>
        </div>
      )}
    </div>
  )
}