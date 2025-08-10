'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [filteredTemplates, setFilteredTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [difficultyFilter, setDifficultyFilter] = useState<string>('all')
  const [installLoading, setInstallLoading] = useState<string | null>(null)

  useEffect(() => {
    // Simulate API call - in production this would fetch from Supabase
    const fetchTemplates = async () => {
      setLoading(true)
      try {
        // TODO: Replace with actual API call to /api/templates
        // const response = await fetch('/api/templates')
        // const data = await response.json()
        // setTemplates(data.data || [])
        
        // For now, use mock data
        setTimeout(() => {
          setTemplates(mockTemplates)
          setFilteredTemplates(mockTemplates)
          setLoading(false)
        }, 800)
      } catch (error) {
        console.error('Failed to fetch templates:', error)
        setTemplates(mockTemplates)
        setFilteredTemplates(mockTemplates)
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
      // TODO: Implement actual template installation
      // const response = await fetch('/api/templates/install', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ templateId: template.id })
      // })
      
      // Simulate installation
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // Show success message
      alert(`Template "${template.name}" installed successfully! Check your workflows page.`)
    } catch (error) {
      console.error('Failed to install template:', error)
      alert('Failed to install template. Please try again.')
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
                <Card key={template.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1 flex-1">
                        <CardTitle className="text-lg leading-tight flex items-center gap-2">
                          {categoryIcons[template.category as keyof typeof categoryIcons] && 
                            React.createElement(categoryIcons[template.category as keyof typeof categoryIcons], {
                              className: "h-4 w-4"
                            })
                          }
                          {template.name}
                        </CardTitle>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge 
                            variant="outline" 
                            className={difficultyColors[template.difficulty as keyof typeof difficultyColors]}
                          >
                            {template.difficulty}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            <Clock className="h-3 w-3 mr-1" />
                            {template.estimated_time}min
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            <Star className="h-3 w-3 mr-1" />
                            {template.rating}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
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

                    <div className="flex items-center justify-between pt-2 border-t">
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Download className="h-3 w-3" />
                        {template.install_count.toLocaleString()} installs
                      </div>
                      <Button 
                        size="sm"
                        onClick={() => handleInstallTemplate(template)}
                        disabled={installLoading === template.id}
                      >
                        {installLoading === template.id ? (
                          <Loader2 className="h-3 w-3 animate-spin mr-1" />
                        ) : (
                          <Download className="h-3 w-3 mr-1" />
                        )}
                        Install
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>
        </div>
      )}

      {/* All Templates */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">All Templates</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredTemplates.map((template) => (
            <Card key={template.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1 flex-1">
                    <CardTitle className="text-base leading-tight flex items-center gap-2">
                      {categoryIcons[template.category as keyof typeof categoryIcons] && 
                        React.createElement(categoryIcons[template.category as keyof typeof categoryIcons], {
                          className: "h-4 w-4"
                        })
                      }
                      {template.name}
                    </CardTitle>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge 
                        variant="outline" 
                        className={difficultyColors[template.difficulty as keyof typeof difficultyColors]}
                      >
                        {template.difficulty}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        <Clock className="h-3 w-3 mr-1" />
                        {template.estimated_time}min
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <CardDescription className="line-clamp-2 text-sm">
                  {template.description}
                </CardDescription>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Download className="h-3 w-3" />
                    {template.install_count.toLocaleString()}
                  </div>
                  <Button 
                    size="sm"
                    variant="outline"
                    onClick={() => handleInstallTemplate(template)}
                    disabled={installLoading === template.id}
                  >
                    {installLoading === template.id ? (
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    ) : (
                      <ArrowRight className="h-3 w-3 mr-1" />
                    )}
                    Install
                  </Button>
                </div>
              </CardContent>
            </Card>
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