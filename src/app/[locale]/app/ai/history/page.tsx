'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  Brain, 
  Search, 
  Filter, 
  Clock, 
  MessageSquare,
  Sparkles,
  Bug,
  Zap,
  Star,
  Trash2,
  Eye,
  MoreHorizontal
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface ConversationSummary {
  id: string
  type: 'generate' | 'debug' | 'optimize' | 'chat'
  title: string
  preview: string
  messagesCount: number
  createdAt: string
  updatedAt: string
  metadata: {
    rating?: number
    workflowsGenerated?: number
    errorsAnalyzed?: number
    optimizationsSuggested?: number
  }
}

const conversationTypeConfig = {
  generate: {
    label: 'Generación',
    icon: Sparkles,
    color: 'bg-purple-500',
    badgeColor: 'bg-purple-100 text-purple-800'
  },
  debug: {
    label: 'Debug',
    icon: Bug,
    color: 'bg-red-500',
    badgeColor: 'bg-red-100 text-red-800'
  },
  optimize: {
    label: 'Optimización',
    icon: Zap,
    color: 'bg-yellow-500',
    badgeColor: 'bg-yellow-100 text-yellow-800'
  },
  chat: {
    label: 'Chat',
    icon: MessageSquare,
    color: 'bg-blue-500',
    badgeColor: 'bg-blue-100 text-blue-800'
  }
}

export default function AIHistoryPage() {
  const t = useTranslations('ai.history')
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [filteredConversations, setFilteredConversations] = useState<ConversationSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<string>('updated_desc')

  useEffect(() => {
    fetchConversations()
  }, [])

  useEffect(() => {
    filterAndSortConversations()
  }, [conversations, searchTerm, typeFilter, sortBy])

  const fetchConversations = async () => {
    try {
      const response = await fetch('/api/ai/conversations', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('supabase_token')}`
        }
      })

      if (!response.ok) throw new Error('Error fetching conversations')

      const data = await response.json()
      setConversations(data.conversations || [])
    } catch (error: any) {
      console.error('Error fetching conversations:', error)
      toast.error('Error cargando historial', {
        description: error.message
      })
    } finally {
      setIsLoading(false)
    }
  }

  const filterAndSortConversations = () => {
    let filtered = conversations

    // Filtro por término de búsqueda
    if (searchTerm) {
      filtered = filtered.filter(conv => 
        conv.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        conv.preview.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Filtro por tipo
    if (typeFilter !== 'all') {
      filtered = filtered.filter(conv => conv.type === typeFilter)
    }

    // Ordenamiento
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'created_desc':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        case 'created_asc':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        case 'updated_desc':
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        case 'updated_asc':
          return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()
        case 'messages_desc':
          return b.messagesCount - a.messagesCount
        case 'messages_asc':
          return a.messagesCount - b.messagesCount
        default:
          return 0
      }
    })

    setFilteredConversations(filtered)
  }

  const deleteConversation = async (conversationId: string) => {
    if (!confirm('¿Estás seguro de que quieres eliminar esta conversación?')) {
      return
    }

    try {
      const response = await fetch(`/api/ai/conversations/${conversationId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('supabase_token')}`
        }
      })

      if (!response.ok) throw new Error('Error deleting conversation')

      setConversations(prev => prev.filter(c => c.id !== conversationId))
      toast.success('Conversación eliminada')
    } catch (error: any) {
      toast.error('Error eliminando conversación', {
        description: error.message
      })
    }
  }

  const viewConversation = (conversationId: string) => {
    window.open(`/ai?conversation=${conversationId}`, '_blank')
  }

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "d 'de' MMMM, yyyy 'a las' HH:mm", { locale: es })
  }

  const getRelativeTime = (dateString: string) => {
    const now = new Date()
    const date = new Date(dateString)
    const diffInHours = Math.abs(now.getTime() - date.getTime()) / (1000 * 60 * 60)

    if (diffInHours < 1) {
      return 'Hace menos de 1 hora'
    } else if (diffInHours < 24) {
      return `Hace ${Math.floor(diffInHours)} horas`
    } else if (diffInHours < 168) { // 7 días
      return `Hace ${Math.floor(diffInHours / 24)} días`
    } else {
      return formatDate(dateString)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 p-4">
        <div className="max-w-6xl mx-auto py-8">
          <div className="text-center space-y-4">
            <Brain className="h-12 w-12 mx-auto text-purple-600 animate-pulse" />
            <h2 className="text-2xl font-bold">Cargando historial...</h2>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 p-4 space-y-6">
      {/* Header */}
      <div className="text-center py-8">
        <div className="inline-flex items-center gap-3 mb-4">
          <div className="p-3 bg-gradient-to-r from-purple-500 to-blue-600 rounded-xl shadow-lg">
            <Clock className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              Historial de IA
            </h1>
            <p className="text-gray-600">
              Revisa tus conversaciones anteriores con el AI Assistant
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto space-y-6">
        {/* Filtros y búsqueda */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filtros y Búsqueda
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar conversaciones..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>

              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Tipo de conversación" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los tipos</SelectItem>
                  <SelectItem value="generate">Generación</SelectItem>
                  <SelectItem value="debug">Debug</SelectItem>
                  <SelectItem value="optimize">Optimización</SelectItem>
                  <SelectItem value="chat">Chat</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger>
                  <SelectValue placeholder="Ordenar por" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="updated_desc">Última actualización (desc)</SelectItem>
                  <SelectItem value="updated_asc">Última actualización (asc)</SelectItem>
                  <SelectItem value="created_desc">Fecha creación (desc)</SelectItem>
                  <SelectItem value="created_asc">Fecha creación (asc)</SelectItem>
                  <SelectItem value="messages_desc">Más mensajes</SelectItem>
                  <SelectItem value="messages_asc">Menos mensajes</SelectItem>
                </SelectContent>
              </Select>

              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <span>{filteredConversations.length} conversaciones</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Lista de conversaciones */}
        {filteredConversations.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center space-y-4">
                <Brain className="h-16 w-16 mx-auto text-gray-300" />
                <div>
                  <h3 className="font-semibold text-lg mb-2">
                    {conversations.length === 0 
                      ? 'No tienes conversaciones aún' 
                      : 'No se encontraron conversaciones'
                    }
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    {conversations.length === 0
                      ? 'Comienza tu primera conversación con el AI Assistant'
                      : 'Prueba con diferentes términos de búsqueda o filtros'
                    }
                  </p>
                  <Button onClick={() => window.location.href = '/ai'}>
                    <Brain className="h-4 w-4 mr-2" />
                    Ir a AI Assistant
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredConversations.map((conversation) => {
              const config = conversationTypeConfig[conversation.type]
              const IconComponent = config.icon

              return (
                <Card key={conversation.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className={`p-3 rounded-lg ${config.color} flex-shrink-0`}>
                        <IconComponent className="h-6 w-6 text-white" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="font-semibold text-lg truncate">
                                {conversation.title}
                              </h3>
                              <Badge className={config.badgeColor}>
                                {config.label}
                              </Badge>
                            </div>
                            
                            <p className="text-muted-foreground text-sm mb-3 line-clamp-2">
                              {conversation.preview}
                            </p>

                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <MessageSquare className="h-4 w-4" />
                                {conversation.messagesCount} mensajes
                              </div>
                              
                              <div className="flex items-center gap-1">
                                <Clock className="h-4 w-4" />
                                {getRelativeTime(conversation.updatedAt)}
                              </div>

                              {conversation.metadata.rating && (
                                <div className="flex items-center gap-1">
                                  <Star className="h-4 w-4" />
                                  {conversation.metadata.rating}/100
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 flex-shrink-0">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => viewConversation(conversation.id)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => deleteConversation(conversation.id)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        {/* Metadata adicional */}
                        {(conversation.metadata.workflowsGenerated || 
                          conversation.metadata.errorsAnalyzed || 
                          conversation.metadata.optimizationsSuggested) && (
                          <>
                            <Separator className="my-3" />
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              {conversation.metadata.workflowsGenerated && (
                                <span>{conversation.metadata.workflowsGenerated} workflows generados</span>
                              )}
                              {conversation.metadata.errorsAnalyzed && (
                                <span>{conversation.metadata.errorsAnalyzed} errores analizados</span>
                              )}
                              {conversation.metadata.optimizationsSuggested && (
                                <span>{conversation.metadata.optimizationsSuggested} optimizaciones sugeridas</span>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}