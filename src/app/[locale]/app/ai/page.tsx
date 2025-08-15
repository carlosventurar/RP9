'use client'

import { useState, useRef, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  Brain, 
  Send, 
  Loader2, 
  Sparkles, 
  Code, 
  Bug, 
  Zap, 
  MessageSquare,
  Clock,
  CheckCircle,
  AlertTriangle,
  Copy,
  Download,
  Star
} from 'lucide-react'
import { toast } from 'sonner'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  type?: 'generate' | 'debug' | 'optimize' | 'chat'
  metadata?: {
    workflowId?: string
    executionId?: string
    suggestions?: number
    rating?: number
  }
}

interface AIAction {
  id: string
  title: string
  description: string
  icon: React.ComponentType
  color: string
  examples: string[]
}

export default function AIAssistantPage() {
  const t = useTranslations('ai')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [conversationId, setConversationId] = useState<string>()
  const [activeAction, setActiveAction] = useState<string>()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const aiActions: AIAction[] = [
    {
      id: 'generate',
      title: t('actions.generate.title'),
      description: t('actions.generate.description'),
      icon: Sparkles,
      color: 'bg-purple-500',
      examples: [
        'Crear un workflow para enviar emails automáticos cuando llega un lead',
        'Automatizar la creación de facturas desde HubSpot a QuickBooks',
        'Workflow para notificaciones de Slack cuando se crea un ticket'
      ]
    },
    {
      id: 'debug',
      title: t('actions.debug.title'),
      description: t('actions.debug.description'),
      icon: Bug,
      color: 'bg-red-500',
      examples: [
        'Mi workflow falla con error 429 en las API calls',
        'El webhook no está recibiendo los datos correctamente',
        'Error de timeout en la integración con Salesforce'
      ]
    },
    {
      id: 'optimize',
      title: t('actions.optimize.title'),
      description: t('actions.optimize.description'),
      icon: Zap,
      color: 'bg-yellow-500',
      examples: [
        'Mi workflow tarda mucho en ejecutarse',
        'Optimizar el uso de API calls para reducir costos',
        'Mejorar la confiabilidad de mi automatización'
      ]
    },
    {
      id: 'chat',
      title: t('actions.chat.title'),
      description: t('actions.chat.description'),
      icon: MessageSquare,
      color: 'bg-blue-500',
      examples: [
        '¿Cuáles son las mejores prácticas para workflows n8n?',
        '¿Cómo integrar Google Sheets con mi CRM?',
        'Explícame los diferentes tipos de triggers'
      ]
    }
  ]

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const sendMessage = async (message: string, actionType?: string) => {
    if (!message.trim() || isLoading) return

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
      type: actionType as any
    }

    setMessages(prev => [...prev, userMessage])
    setInputMessage('')
    setIsLoading(true)

    try {
      // Determinar endpoint basado en el tipo de acción
      let endpoint = '/api/ai/chat'
      if (actionType === 'generate') endpoint = '/api/ai/generate-workflow'
      else if (actionType === 'debug') endpoint = '/api/ai/explain-error'
      else if (actionType === 'optimize') endpoint = '/api/ai/optimize'

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('supabase_token')}`
        },
        body: JSON.stringify({
          message,
          prompt: message,
          tenantId: localStorage.getItem('tenant_id'),
          conversationId,
          context: {
            activeAction: actionType,
            timestamp: new Date().toISOString()
          }
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Error en la comunicación con IA')
      }

      const data = await response.json()

      // Crear mensaje de respuesta del asistente
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response || data.analysis?.explanation || 'Respuesta procesada exitosamente',
        timestamp: new Date().toISOString(),
        type: actionType as any,
        metadata: {
          workflowId: data.workflowId,
          executionId: data.executionId,
          suggestions: data.analysis?.suggestions?.length,
          rating: data.analysis?.overallScore
        }
      }

      setMessages(prev => [...prev, assistantMessage])
      
      if (data.conversationId) {
        setConversationId(data.conversationId)
      }

      // Manejar respuestas especiales según el tipo
      if (actionType === 'generate' && data.workflow) {
        // Mostrar opción de instalar workflow
        toast.success('Workflow generado exitosamente', {
          action: {
            label: 'Instalar',
            onClick: () => installWorkflow(data.workflowId, data.workflow)
          }
        })
      }

    } catch (error: any) {
      console.error('AI Assistant Error:', error)
      
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Lo siento, hubo un error: ${error.message}. Por favor intenta nuevamente.`,
        timestamp: new Date().toISOString()
      }

      setMessages(prev => [...prev, errorMessage])
      toast.error('Error en AI Assistant', {
        description: error.message
      })
    } finally {
      setIsLoading(false)
      setActiveAction(undefined)
    }
  }

  const installWorkflow = async (workflowId: string, workflowData: any) => {
    try {
      const response = await fetch('/api/workflows', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('supabase_token')}`
        },
        body: JSON.stringify({
          workflowData,
          source: 'ai_generated',
          sourceId: workflowId
        })
      })

      if (response.ok) {
        toast.success('Workflow instalado exitosamente')
      } else {
        throw new Error('Error instalando workflow')
      }
    } catch (error) {
      toast.error('Error instalando workflow')
    }
  }

  const handleActionClick = (action: AIAction) => {
    setActiveAction(action.id)
  }

  const handleExampleClick = (example: string, actionType: string) => {
    setInputMessage(example)
    setActiveAction(actionType)
  }

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Copiado al portapapeles')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 p-4 space-y-6">
      {/* Header */}
      <div className="text-center py-8">
        <div className="inline-flex items-center gap-3 mb-4">
          <div className="p-3 bg-gradient-to-r from-purple-500 to-blue-600 rounded-xl shadow-lg">
            <Brain className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              AI Assistant
            </h1>
            <p className="text-gray-600">{t('subtitle')}</p>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sidebar con acciones */}
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('actions.title')}</CardTitle>
              <CardDescription>{t('actions.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {aiActions.map((action) => (
                <div key={action.id} className="space-y-2">
                  <Button
                    variant={activeAction === action.id ? 'default' : 'outline'}
                    className="w-full justify-start gap-3 h-auto p-4"
                    onClick={() => handleActionClick(action)}
                  >
                    <div className={`p-2 rounded-lg ${action.color}`}>
                      <action.icon className="h-4 w-4 text-white" />
                    </div>
                    <div className="text-left">
                      <div className="font-medium">{action.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {action.description}
                      </div>
                    </div>
                  </Button>
                  
                  {activeAction === action.id && (
                    <div className="ml-4 space-y-1">
                      <p className="text-sm font-medium text-gray-700">
                        Ejemplos:
                      </p>
                      {action.examples.map((example, index) => (
                        <button
                          key={index}
                          onClick={() => handleExampleClick(example, action.id)}
                          className="text-xs text-left w-full p-2 rounded bg-gray-50 hover:bg-gray-100 transition-colors"
                        >
                          {example}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Chat principal */}
        <div className="lg:col-span-2">
          <Card className="h-[700px] flex flex-col">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Brain className="h-5 w-5 text-purple-600" />
                  <CardTitle className="text-lg">Conversación</CardTitle>
                  {conversationId && (
                    <Badge variant="outline" className="text-xs">
                      ID: {conversationId.slice(-6)}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  {messages.length > 0 && formatTimestamp(messages[messages.length - 1]?.timestamp)}
                </div>
              </div>
            </CardHeader>

            {/* Messages */}
            <CardContent className="flex-1 flex flex-col">
              <ScrollArea className="flex-1 pr-4">
                <div className="space-y-4">
                  {messages.length === 0 && (
                    <div className="text-center py-12 space-y-4">
                      <div className="p-4 bg-gradient-to-r from-purple-500 to-blue-600 rounded-full w-16 h-16 flex items-center justify-center mx-auto">
                        <Brain className="h-8 w-8 text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg mb-2">
                          ¡Hola! Soy tu AI Assistant
                        </h3>
                        <p className="text-muted-foreground">
                          Selecciona una acción en el menú lateral o escríbeme directamente.
                          Puedo ayudarte a generar workflows, debuggear errores, optimizar tu código y más.
                        </p>
                      </div>
                    </div>
                  )}

                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex gap-3 ${
                        message.role === 'user' ? 'flex-row-reverse' : ''
                      }`}
                    >
                      <div
                        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                          message.role === 'user'
                            ? 'bg-blue-600'
                            : 'bg-gradient-to-r from-purple-500 to-blue-600'
                        }`}
                      >
                        {message.role === 'user' ? (
                          <MessageSquare className="h-4 w-4 text-white" />
                        ) : (
                          <Brain className="h-4 w-4 text-white" />
                        )}
                      </div>

                      <div
                        className={`flex-1 max-w-[80%] ${
                          message.role === 'user' ? 'text-right' : ''
                        }`}
                      >
                        <div
                          className={`rounded-lg px-4 py-3 ${
                            message.role === 'user'
                              ? 'bg-blue-600 text-white ml-auto'
                              : 'bg-white border border-gray-200'
                          }`}
                        >
                          <div className="whitespace-pre-wrap text-sm">
                            {message.content}
                          </div>
                          
                          {message.metadata && (
                            <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                              {message.metadata.workflowId && (
                                <div className="flex items-center gap-2 text-xs">
                                  <Code className="h-3 w-3" />
                                  Workflow ID: {message.metadata.workflowId}
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => copyToClipboard(message.metadata.workflowId!)}
                                  >
                                    <Copy className="h-3 w-3" />
                                  </Button>
                                </div>
                              )}
                              
                              {message.metadata.suggestions && (
                                <div className="flex items-center gap-2 text-xs">
                                  <Sparkles className="h-3 w-3" />
                                  {message.metadata.suggestions} sugerencias generadas
                                </div>
                              )}
                              
                              {message.metadata.rating && (
                                <div className="flex items-center gap-2 text-xs">
                                  <Star className="h-3 w-3" />
                                  Score: {message.metadata.rating}/100
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        
                        <div
                          className={`flex items-center gap-2 mt-1 text-xs text-muted-foreground ${
                            message.role === 'user' ? 'justify-end' : ''
                          }`}
                        >
                          <span>{formatTimestamp(message.timestamp)}</span>
                          {message.type && (
                            <Badge variant="outline" className="text-xs px-1 py-0">
                              {message.type}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}

                  {isLoading && (
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-gradient-to-r from-purple-500 to-blue-600">
                        <Brain className="h-4 w-4 text-white" />
                      </div>
                      <div className="flex-1">
                        <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Pensando...
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <div ref={messagesEndRef} />
              </ScrollArea>

              <Separator className="my-4" />

              {/* Input */}
              <div className="space-y-3">
                {activeAction && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      {aiActions.find(a => a.id === activeAction)?.icon && (
                        <div className={`p-1 rounded ${aiActions.find(a => a.id === activeAction)?.color}`}>
                          {(() => {
                            const Icon = aiActions.find(a => a.id === activeAction)?.icon!
                            return <Icon className="h-3 w-3 text-white" />
                          })()}
                        </div>
                      )}
                      Modo: {aiActions.find(a => a.id === activeAction)?.title}
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setActiveAction(undefined)}
                    >
                      Cancelar
                    </Button>
                  </div>
                )}

                <div className="flex gap-2">
                  <Textarea
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    placeholder={
                      activeAction 
                        ? `Describe qué necesitas para ${aiActions.find(a => a.id === activeAction)?.title.toLowerCase()}...`
                        : "Escribe tu mensaje o pregunta..."
                    }
                    className="flex-1 min-h-[60px] max-h-[120px]"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        sendMessage(inputMessage, activeAction)
                      }
                    }}
                  />
                  <Button
                    onClick={() => sendMessage(inputMessage, activeAction)}
                    disabled={!inputMessage.trim() || isLoading}
                    size="sm"
                    className="px-4"
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}