'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  Search, 
  Filter, 
  Play, 
  Settings, 
  Star, 
  Download,
  Zap,
  DollarSign,
  Clock,
  Users
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Template {
  id: string
  code: string
  name: string
  description: string
  vertical: 'cc' | 'fin'
  level: 'mock' | 'real'
  price_usd: number
  nodes: any[]
  metadata: {
    demo?: boolean
    executes_immediately?: boolean
    requires_auth?: boolean
    oauth_provider?: string
    [key: string]: any
  }
  country?: string
  created_at: string
}

interface TemplateCatalogProps {
  country?: string
  vertical?: 'cc' | 'fin' | 'all'
  onInstall?: (template: Template) => void
  showPricing?: boolean
  maxItems?: number
}

export default function TemplateCatalog({ 
  country = 'MX', 
  vertical = 'all',
  onInstall,
  showPricing = true,
  maxItems = 12
}: TemplateCatalogProps) {
  const supabase = createClient()
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterVertical, setFilterVertical] = useState(vertical)
  const [filterLevel, setFilterLevel] = useState<'all' | 'mock' | 'real'>('all')
  const [installing, setInstalling] = useState<string | null>(null)

  useEffect(() => {
    loadTemplates()
  }, [country, filterVertical, filterLevel])

  const loadTemplates = async () => {
    setLoading(true)
    try {
      // First, try to get country-specific ordering
      const { data: countryOrder } = await supabase
        .from('country_template_order')
        .select('codes')
        .eq('country', country)
        .single()

      // Get all templates
      let query = supabase
        .from('template_catalog')
        .select('*')

      // Apply filters
      if (filterVertical !== 'all') {
        query = query.eq('vertical', filterVertical)
      }

      if (filterLevel !== 'all') {
        query = query.eq('level', filterLevel)
      }

      const { data: templatesData, error } = await query

      if (error) {
        console.error('Error loading templates:', error)
        return
      }

      // Sort templates by country preference if available
      let sortedTemplates = templatesData || []
      if (countryOrder?.codes) {
        sortedTemplates = sortedTemplates.sort((a, b) => {
          const indexA = countryOrder.codes.indexOf(a.code)
          const indexB = countryOrder.codes.indexOf(b.code)
          
          if (indexA === -1 && indexB === -1) return 0
          if (indexA === -1) return 1
          if (indexB === -1) return -1
          
          return indexA - indexB
        })
      }

      // Apply search filter
      if (searchTerm) {
        sortedTemplates = sortedTemplates.filter(template =>
          template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          template.description?.toLowerCase().includes(searchTerm.toLowerCase())
        )
      }

      // Apply max items limit
      if (maxItems && maxItems > 0) {
        sortedTemplates = sortedTemplates.slice(0, maxItems)
      }

      setTemplates(sortedTemplates)
    } catch (error) {
      console.error('Error loading templates:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleInstall = async (template: Template) => {
    setInstalling(template.id)
    
    try {
      if (template.level === 'mock') {
        // For mock templates, create and execute immediately
        const workflow = {
          name: template.name,
          active: false,
          nodes: template.nodes || [
            {
              id: '1',
              name: 'Manual Trigger',
              type: 'n8n-nodes-base.manualTrigger',
              typeVersion: 1,
              parameters: {},
              position: [0, 0]
            },
            {
              id: '2',
              name: 'Demo Data',
              type: 'n8n-nodes-base.set',
              typeVersion: 1,
              parameters: {
                keepOnlySet: true,
                values: {
                  string: [
                    { name: 'template', value: template.name },
                    { name: 'status', value: 'demo_executed' },
                    { name: 'timestamp', value: new Date().toISOString() }
                  ]
                }
              },
              position: [260, 0]
            }
          ]
        }

        const response = await fetch('/.netlify/functions/workflows', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ workflow })
        })

        if (response.ok) {
          // Execute immediately for demo
          const workflowData = await response.json()
          await fetch(`/.netlify/functions/workflows/${workflowData.id}/run`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' }
          })
        }
      } else {
        // For real templates, just install for configuration
        const workflow = {
          name: template.name,
          active: false,
          nodes: template.nodes || []
        }

        await fetch('/.netlify/functions/workflows', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ workflow })
        })
      }

      // Call parent callback if provided
      if (onInstall) {
        onInstall(template)
      }

      // Create activation event
      const { data: { user } } = await supabase.auth.getUser()
      const { data: tenant } = await supabase
        .from('tenants')
        .select('id')
        .eq('owner_user', user?.id)
        .single()

      if (tenant) {
        await supabase
          .from('activation_events')
          .insert({
            tenant_id: tenant.id,
            type: template.level === 'mock' ? 'demo_executed' : 'template_installed',
            meta: {
              template_code: template.code,
              template_name: template.name,
              vertical: template.vertical,
              level: template.level
            }
          })
      }

    } catch (error) {
      console.error('Error installing template:', error)
    } finally {
      setInstalling(null)
    }
  }

  const getVerticalLabel = (vertical: string) => {
    switch (vertical) {
      case 'cc': return 'Contact Center'
      case 'fin': return 'Finanzas'
      default: return vertical
    }
  }

  const getVerticalColor = (vertical: string) => {
    switch (vertical) {
      case 'cc': return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'fin': return 'bg-green-100 text-green-800 border-green-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getLevelBadge = (level: string, metadata: any) => {
    if (level === 'mock') {
      return (
        <Badge variant="secondary" className="bg-purple-100 text-purple-800">
          <Play className="w-3 h-3 mr-1" />
          Demo
        </Badge>
      )
    } else {
      return (
        <Badge variant="outline" className="border-orange-300 text-orange-700">
          <Settings className="w-3 h-3 mr-1" />
          Producción
        </Badge>
      )
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
          <div className="h-8 w-32 bg-gray-200 rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 w-32 bg-gray-200 rounded" />
                <div className="h-3 w-full bg-gray-200 rounded" />
              </CardHeader>
              <CardContent>
                <div className="h-20 w-full bg-gray-200 rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header and Filters */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Catálogo de Templates</h2>
          <p className="text-muted-foreground">
            Templates optimizados para {country} • {templates.length} disponibles
          </p>
        </div>
        
        <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar templates..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-full md:w-64"
            />
          </div>
          
          <Select value={filterVertical} onValueChange={(value: any) => setFilterVertical(value)}>
            <SelectTrigger className="w-full md:w-40">
              <SelectValue placeholder="Vertical" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="cc">Contact Center</SelectItem>
              <SelectItem value="fin">Finanzas</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterLevel} onValueChange={(value: any) => setFilterLevel(value)}>
            <SelectTrigger className="w-full md:w-40">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="mock">Demo</SelectItem>
              <SelectItem value="real">Producción</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {templates.map((template) => (
          <Card key={template.id} className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-base line-clamp-1">{template.name}</CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant="outline" 
                      className={getVerticalColor(template.vertical)}
                    >
                      {getVerticalLabel(template.vertical)}
                    </Badge>
                    {getLevelBadge(template.level, template.metadata)}
                  </div>
                </div>
                {showPricing && template.price_usd > 0 && (
                  <div className="text-right">
                    <div className="text-lg font-bold">${template.price_usd}</div>
                    <div className="text-xs text-muted-foreground">USD</div>
                  </div>
                )}
              </div>
              <CardDescription className="line-clamp-2">
                {template.description}
              </CardDescription>
            </CardHeader>
            
            <CardContent className="pt-0">
              <div className="space-y-3">
                {/* Template Features */}
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Zap className="w-3 h-3" />
                    {template.nodes?.length || 0} nodos
                  </div>
                  {template.metadata.executes_immediately && (
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Inmediato
                    </div>
                  )}
                  {template.level === 'real' && (
                    <div className="flex items-center gap-1">
                      <Settings className="w-3 h-3" />
                      Config requerida
                    </div>
                  )}
                </div>

                {/* Install Button */}
                <Button
                  onClick={() => handleInstall(template)}
                  disabled={installing === template.id}
                  className="w-full"
                  variant={template.level === 'mock' ? 'default' : 'outline'}
                >
                  {installing === template.id ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
                      Instalando...
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      {template.level === 'mock' ? (
                        <>
                          <Play className="w-4 h-4" />
                          Ejecutar Demo
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4" />
                          Instalar Template
                        </>
                      )}
                    </div>
                  )}
                </Button>

                {/* Additional Info */}
                {template.metadata.oauth_provider && (
                  <div className="text-xs text-muted-foreground p-2 bg-blue-50 rounded">
                    Requiere conexión con {template.metadata.oauth_provider}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty State */}
      {templates.length === 0 && !loading && (
        <div className="text-center py-12">
          <Filter className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium">No se encontraron templates</h3>
          <p className="text-muted-foreground">
            Intenta cambiar los filtros o términos de búsqueda
          </p>
        </div>
      )}
    </div>
  )
}