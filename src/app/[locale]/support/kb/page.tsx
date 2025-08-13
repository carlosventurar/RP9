'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ArrowLeft, Search, BookOpen, ThumbsUp, ThumbsDown, Star, Eye, Filter, TrendingUp, MessageSquare } from 'lucide-react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

interface KBArticle {
  id: string
  slug: string
  title: string
  excerpt: string
  category: string
  tags: string[]
  author: string
  status: 'published' | 'draft' | 'archived'
  language: string
  views_count: number
  helpful_count: number
  not_helpful_count: number
  created_at: string
  updated_at: string
}

interface Category {
  id: string
  name: string
  description: string
  icon: string
  article_count: number
}

const categories: Category[] = [
  {
    id: 'getting-started',
    name: 'Primeros Pasos',
    description: 'Guías básicas para comenzar con RP9',
    icon: '🚀',
    article_count: 8
  },
  {
    id: 'workflows',
    name: 'Workflows',
    description: 'Creación y gestión de workflows con n8n',
    icon: '⚡',
    article_count: 12
  },
  {
    id: 'integrations',
    name: 'Integraciones',
    description: 'Conectar servicios externos y APIs',
    icon: '🔗',
    article_count: 15
  },
  {
    id: 'troubleshooting',
    name: 'Solución de Problemas',
    description: 'Resolver errores comunes y problemas',
    icon: '🔧',
    article_count: 10
  },
  {
    id: 'billing',
    name: 'Facturación',
    description: 'Gestión de planes, pagos y facturación',
    icon: '💳',
    article_count: 6
  },
  {
    id: 'api',
    name: 'API',
    description: 'Documentación de API y desarrollo',
    icon: '⚙️',
    article_count: 9
  }
]

const mockArticles: KBArticle[] = [
  {
    id: '1',
    slug: 'como-crear-primer-workflow',
    title: 'Cómo crear tu primer workflow en RP9',
    excerpt: 'Una guía paso a paso para crear y configurar tu primer workflow automatizado usando n8n.',
    category: 'getting-started',
    tags: ['workflow', 'tutorial', 'n8n', 'básico'],
    author: 'Equipo RP9',
    status: 'published',
    language: 'es',
    views_count: 1247,
    helpful_count: 98,
    not_helpful_count: 3,
    created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: '2',
    slug: 'configurar-webhook-stripe',
    title: 'Configurar webhooks de Stripe para procesar pagos',
    excerpt: 'Aprende cómo configurar webhooks de Stripe para automatizar el procesamiento de pagos y suscripciones.',
    category: 'integrations',
    tags: ['stripe', 'webhook', 'pagos', 'integración'],
    author: 'María González',
    status: 'published',
    language: 'es',
    views_count: 892,
    helpful_count: 76,
    not_helpful_count: 2,
    created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: '3',
    slug: 'resolver-error-timeout-workflow',
    title: 'Resolver errores de timeout en workflows',
    excerpt: 'Soluciones comunes para workflows que fallan por timeout y cómo optimizar el rendimiento.',
    category: 'troubleshooting',
    tags: ['error', 'timeout', 'rendimiento', 'debugging'],
    author: 'Carlos Ruiz',
    status: 'published',
    language: 'es',
    views_count: 634,
    helpful_count: 45,
    not_helpful_count: 8,
    created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: '4',
    slug: 'entender-planes-facturacion',
    title: 'Entender los planes de facturación y límites',
    excerpt: 'Explicación detallada de nuestros planes, límites de uso y cómo funcionan los cargos por consumo.',
    category: 'billing',
    tags: ['facturación', 'planes', 'límites', 'consumo'],
    author: 'Ana López',
    status: 'published',
    language: 'es',
    views_count: 1156,
    helpful_count: 89,
    not_helpful_count: 5,
    created_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: '5',
    slug: 'api-autenticacion-tokens',
    title: 'Autenticación con tokens de API',
    excerpt: 'Cómo generar y usar tokens de API para acceder programáticamente a RP9.',
    category: 'api',
    tags: ['api', 'autenticación', 'tokens', 'desarrollo'],
    author: 'David Chen',
    status: 'published',
    language: 'es',
    views_count: 423,
    helpful_count: 32,
    not_helpful_count: 1,
    created_at: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: '6',
    slug: 'conectar-google-sheets',
    title: 'Conectar Google Sheets con workflows',
    excerpt: 'Tutorial completo para integrar Google Sheets y automatizar la gestión de datos.',
    category: 'integrations',
    tags: ['google-sheets', 'integración', 'datos', 'automatización'],
    author: 'Laura Silva',
    status: 'published',
    language: 'es',
    views_count: 789,
    helpful_count: 67,
    not_helpful_count: 4,
    created_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString()
  }
]

export default function KnowledgeBasePage() {
  const t = useTranslations('support')
  const [articles, setArticles] = useState<KBArticle[]>(mockArticles)
  const [filteredArticles, setFilteredArticles] = useState<KBArticle[]>(mockArticles)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [sortBy, setSortBy] = useState('popular') // popular, recent, helpful
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    filterAndSortArticles()
  }, [searchTerm, selectedCategory, sortBy, articles])

  const filterAndSortArticles = () => {
    let filtered = [...articles]

    // Filtrar por búsqueda
    if (searchTerm) {
      const search = searchTerm.toLowerCase()
      filtered = filtered.filter(article => 
        article.title.toLowerCase().includes(search) ||
        article.excerpt.toLowerCase().includes(search) ||
        article.tags.some(tag => tag.toLowerCase().includes(search))
      )
    }

    // Filtrar por categoría
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(article => article.category === selectedCategory)
    }

    // Ordenar
    switch (sortBy) {
      case 'popular':
        filtered.sort((a, b) => b.views_count - a.views_count)
        break
      case 'recent':
        filtered.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
        break
      case 'helpful':
        filtered.sort((a, b) => (b.helpful_count / (b.helpful_count + b.not_helpful_count)) - (a.helpful_count / (a.helpful_count + a.not_helpful_count)))
        break
    }

    setFilteredArticles(filtered)
  }

  const handleFeedback = async (articleId: string, isHelpful: boolean) => {
    try {
      // TODO: Implementar llamada real a la API
      const response = await fetch('/.netlify/functions/support/kb-feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          articleId,
          isHelpful
        })
      })

      if (response.ok) {
        // Actualizar contadores localmente
        setArticles(prev => prev.map(article => {
          if (article.id === articleId) {
            return {
              ...article,
              helpful_count: isHelpful ? article.helpful_count + 1 : article.helpful_count,
              not_helpful_count: !isHelpful ? article.not_helpful_count + 1 : article.not_helpful_count
            }
          }
          return article
        }))
      }
    } catch (error) {
      console.error('Error sending feedback:', error)
    }
  }

  const getHelpfulPercentage = (article: KBArticle) => {
    const total = article.helpful_count + article.not_helpful_count
    if (total === 0) return 0
    return Math.round((article.helpful_count / total) * 100)
  }

  const formatTimeAgo = (date: string) => {
    return formatDistanceToNow(new Date(date), { 
      addSuffix: true,
      locale: es
    })
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/support">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver a Soporte
          </Link>
        </Button>
      </div>

      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <BookOpen className="h-8 w-8" />
            Base de Conocimiento
          </h1>
          <p className=\"text-muted-foreground mt-2\">
            Encuentra respuestas a preguntas frecuentes y aprende a usar RP9 al máximo
          </p>
        </div>

        {/* Búsqueda y filtros */}
        <Card>
          <CardContent className=\"p-6\">
            <div className=\"space-y-4\">
              {/* Barra de búsqueda */}
              <div className=\"relative\">
                <Search className=\"h-4 w-4 absolute left-3 top-3 text-muted-foreground\" />
                <Input
                  placeholder=\"Buscar artículos, guías, tutoriales...\"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className=\"pl-10 text-base\"
                />
              </div>

              {/* Filtros */}
              <div className=\"flex flex-wrap gap-4 items-center\">
                <div className=\"flex items-center gap-2\">
                  <Filter className=\"h-4 w-4 text-muted-foreground\" />
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger className=\"w-48\">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value=\"all\">Todas las categorías</SelectItem>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.icon} {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className=\"flex items-center gap-2\">
                  <span className=\"text-sm text-muted-foreground\">Ordenar por:</span>
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className=\"w-40\">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value=\"popular\">
                        <div className=\"flex items-center gap-2\">
                          <Eye className=\"h-4 w-4\" />
                          Más visto
                        </div>
                      </SelectItem>
                      <SelectItem value=\"recent\">
                        <div className=\"flex items-center gap-2\">
                          <TrendingUp className=\"h-4 w-4\" />
                          Más reciente
                        </div>
                      </SelectItem>
                      <SelectItem value=\"helpful\">
                        <div className=\"flex items-center gap-2\">
                          <ThumbsUp className=\"h-4 w-4\" />
                          Más útil
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Estadísticas */}
              <div className=\"flex items-center gap-6 text-sm text-muted-foreground pt-2 border-t\">
                <span>{filteredArticles.length} artículos encontrados</span>
                <span>{categories.reduce((sum, cat) => sum + cat.article_count, 0)} artículos totales</span>
                <span>{categories.length} categorías</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue=\"articles\" className=\"space-y-6\">
          <TabsList>
            <TabsTrigger value=\"articles\">Artículos ({filteredArticles.length})</TabsTrigger>
            <TabsTrigger value=\"categories\">Categorías ({categories.length})</TabsTrigger>
          </TabsList>

          {/* Lista de artículos */}
          <TabsContent value=\"articles\" className=\"space-y-4\">
            {filteredArticles.length === 0 ? (
              <Card>
                <CardContent className=\"p-8 text-center\">
                  <BookOpen className=\"h-12 w-12 mx-auto mb-4 text-muted-foreground\" />
                  <h3 className=\"text-lg font-semibold mb-2\">No se encontraron artículos</h3>
                  <p className=\"text-muted-foreground mb-4\">
                    {searchTerm || selectedCategory !== 'all'
                      ? 'Intenta ajustar los filtros de búsqueda'
                      : 'Aún no hay artículos disponibles'}
                  </p>
                  <Button variant=\"outline\" onClick={() => {
                    setSearchTerm('')
                    setSelectedCategory('all')
                  }}>
                    Limpiar filtros
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className=\"grid grid-cols-1 lg:grid-cols-2 gap-6\">
                {filteredArticles.map((article) => {
                  const category = categories.find(c => c.id === article.category)
                  const helpfulPercentage = getHelpfulPercentage(article)
                  
                  return (
                    <Card key={article.id} className=\"hover:shadow-md transition-shadow group\">
                      <CardContent className=\"p-6\">
                        <div className=\"space-y-3\">
                          {/* Header */}
                          <div className=\"flex items-start justify-between\">
                            <div className=\"flex items-center gap-2\">
                              {category && (
                                <Badge variant=\"secondary\">
                                  {category.icon} {category.name}
                                </Badge>
                              )}
                              <div className=\"flex items-center gap-1 text-sm text-muted-foreground\">
                                <Eye className=\"h-3 w-3\" />
                                {article.views_count}
                              </div>
                            </div>
                            {helpfulPercentage > 0 && (
                              <div className=\"flex items-center gap-1 text-sm text-green-600\">
                                <ThumbsUp className=\"h-3 w-3\" />
                                {helpfulPercentage}%
                              </div>
                            )}
                          </div>

                          {/* Título y excerpt */}
                          <div>
                            <h3 className=\"font-semibold text-lg mb-2 group-hover:text-primary transition-colors\">
                              <Link href={`/support/kb/${article.slug}`}>
                                {article.title}
                              </Link>
                            </h3>
                            <p className=\"text-muted-foreground text-sm leading-relaxed\">
                              {article.excerpt}
                            </p>
                          </div>

                          {/* Tags */}
                          {article.tags.length > 0 && (
                            <div className=\"flex flex-wrap gap-1\">
                              {article.tags.slice(0, 4).map((tag) => (
                                <Badge key={tag} variant=\"outline\" className=\"text-xs\">
                                  {tag}
                                </Badge>
                              ))}
                              {article.tags.length > 4 && (
                                <Badge variant=\"outline\" className=\"text-xs text-muted-foreground\">
                                  +{article.tags.length - 4}
                                </Badge>
                              )}
                            </div>
                          )}

                          {/* Footer */}
                          <div className=\"flex items-center justify-between pt-2 border-t\">
                            <div className=\"text-xs text-muted-foreground\">
                              Por {article.author} • Actualizado {formatTimeAgo(article.updated_at)}
                            </div>
                            <div className=\"flex items-center gap-2\">
                              <Button
                                variant=\"ghost\"
                                size=\"sm\"
                                onClick={() => handleFeedback(article.id, true)}
                                className=\"h-8 px-2\"
                              >
                                <ThumbsUp className=\"h-3 w-3 mr-1\" />
                                {article.helpful_count}
                              </Button>
                              <Button
                                variant=\"ghost\"
                                size=\"sm\"
                                onClick={() => handleFeedback(article.id, false)}
                                className=\"h-8 px-2\"
                              >
                                <ThumbsDown className=\"h-3 w-3 mr-1\" />
                                {article.not_helpful_count}
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </TabsContent>

          {/* Lista de categorías */}
          <TabsContent value=\"categories\" className=\"space-y-4\">
            <div className=\"grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6\">
              {categories.map((category) => (
                <Card key={category.id} className=\"hover:shadow-md transition-shadow\">
                  <CardContent className=\"p-6\">
                    <div className=\"text-center space-y-3\">
                      <div className=\"text-4xl\">{category.icon}</div>
                      <div>
                        <h3 className=\"font-semibold text-lg\">{category.name}</h3>
                        <p className=\"text-sm text-muted-foreground mt-1\">
                          {category.description}
                        </p>
                      </div>
                      <div className=\"flex items-center justify-between text-sm\">
                        <span className=\"text-muted-foreground\">
                          {category.article_count} artículos
                        </span>
                        <Button 
                          variant=\"outline\" 
                          size=\"sm\"
                          onClick={() => {
                            setSelectedCategory(category.id)
                            // Cambiar a tab de artículos automáticamente
                            document.querySelector('[value=\"articles\"]')?.click()
                          }}
                        >
                          Explorar
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        {/* CTA */}
        <Card>
          <CardContent className=\"p-6 text-center\">
            <h3 className=\"text-lg font-semibold mb-2 flex items-center justify-center gap-2\">
              <MessageSquare className=\"h-5 w-5\" />
              ¿No encuentras lo que buscas?
            </h3>
            <p className=\"text-muted-foreground mb-4\">
              Nuestro equipo de soporte está aquí para ayudarte con cualquier pregunta
            </p>
            <div className=\"flex justify-center gap-3\">
              <Button asChild>
                <Link href=\"/support/new\">Crear Ticket de Soporte</Link>
              </Button>
              <Button variant=\"outline\" asChild>
                <Link href=\"/support\">Ver Todos los Tickets</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}