'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { 
  Play, 
  Save, 
  Copy, 
  Trash2, 
  Edit, 
  Plus, 
  Sparkles, 
  Clock, 
  Settings, 
  Download,
  Upload,
  RefreshCw,
  Loader2,
  AlertTriangle,
  CheckCircle,
  Star,
  MoreHorizontal
} from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'

interface PromptTemplate {
  id: string
  name: string
  description: string
  category: string
  prompt: string
  variables: Array<{
    name: string
    description: string
    defaultValue?: string
    required: boolean
  }>
  tags: string[]
  isPublic: boolean
  tenantId: string
  createdAt: string
  updatedAt: string
  usageCount: number
  rating?: number
}

interface PlaygroundExecution {
  id: string
  templateId?: string
  prompt: string
  variables: Record<string, any>
  response: string
  provider: string
  model: string
  tokensUsed: number
  costUsd: number
  executionTime: number
  timestamp: string
  status: 'success' | 'error'
  error?: string
}

interface PromptPlaygroundProps {
  tenantId: string
  onTemplateSelect?: (template: PromptTemplate) => void
}

export function PromptPlayground({ tenantId, onTemplateSelect }: PromptPlaygroundProps) {
  const [activeTab, setActiveTab] = useState('editor')
  const [currentPrompt, setCurrentPrompt] = useState('')
  const [promptVariables, setPromptVariables] = useState<Record<string, string>>({})
  const [selectedModel, setSelectedModel] = useState('gpt-4')
  const [isExecuting, setIsExecuting] = useState(false)
  const [templates, setTemplates] = useState<PromptTemplate[]>([])
  const [executions, setExecutions] = useState<PlaygroundExecution[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<PromptTemplate | null>(null)
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [templateToDelete, setTemplateToDelete] = useState<string | null>(null)
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    description: '',
    category: 'general',
    tags: '',
    isPublic: false
  })

  // Load templates and execution history
  useEffect(() => {
    loadTemplates()
    loadExecutionHistory()
  }, [tenantId])

  const loadTemplates = async () => {
    try {
      const token = localStorage.getItem('supabase_token')
      const response = await fetch(`/api/ai/prompt-templates?tenantId=${tenantId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setTemplates(data.templates || [])
      }
    } catch (error) {
      console.error('Error loading templates:', error)
    }
  }

  const loadExecutionHistory = async () => {
    try {
      const token = localStorage.getItem('supabase_token')
      const response = await fetch(`/api/ai/playground-history?tenantId=${tenantId}&limit=20`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setExecutions(data.executions || [])
      }
    } catch (error) {
      console.error('Error loading execution history:', error)
    }
  }

  const executePrompt = async () => {
    if (!currentPrompt.trim()) {
      toast.error('Por favor ingresa un prompt')
      return
    }

    setIsExecuting(true)
    const startTime = Date.now()

    try {
      const token = localStorage.getItem('supabase_token')
      
      // Process variables in prompt
      let processedPrompt = currentPrompt
      Object.entries(promptVariables).forEach(([key, value]) => {
        const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g')
        processedPrompt = processedPrompt.replace(regex, value)
      })

      const response = await fetch('/api/ai/playground-execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          tenantId,
          prompt: processedPrompt,
          variables: promptVariables,
          model: selectedModel,
          templateId: selectedTemplate?.id
        })
      })

      const executionTime = Date.now() - startTime

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Error ejecutando prompt')
      }

      const data = await response.json()
      
      // Add to execution history
      const newExecution: PlaygroundExecution = {
        id: Date.now().toString(),
        templateId: selectedTemplate?.id,
        prompt: processedPrompt,
        variables: promptVariables,
        response: data.response,
        provider: data.provider || 'openai',
        model: selectedModel,
        tokensUsed: data.tokensUsed || 0,
        costUsd: data.costUsd || 0,
        executionTime,
        timestamp: new Date().toISOString(),
        status: 'success'
      }

      setExecutions([newExecution, ...executions])
      setActiveTab('history')

      toast.success('Prompt ejecutado exitosamente', {
        description: `${data.tokensUsed || 0} tokens usados en ${executionTime}ms`
      })

    } catch (error: any) {
      console.error('Error executing prompt:', error)
      
      // Add error to execution history
      const errorExecution: PlaygroundExecution = {
        id: Date.now().toString(),
        templateId: selectedTemplate?.id,
        prompt: currentPrompt,
        variables: promptVariables,
        response: '',
        provider: 'openai',
        model: selectedModel,
        tokensUsed: 0,
        costUsd: 0,
        executionTime: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        status: 'error',
        error: error.message
      }

      setExecutions([errorExecution, ...executions])
      
      toast.error('Error ejecutando prompt', {
        description: error.message
      })
    } finally {
      setIsExecuting(false)
    }
  }

  const saveTemplate = async () => {
    try {
      const token = localStorage.getItem('supabase_token')
      
      // Extract variables from prompt
      const variableMatches = currentPrompt.match(/{{[^}]+}}/g) || []
      const variables = variableMatches.map(match => {
        const name = match.replace(/[{}]/g, '').trim()
        return {
          name,
          description: `Variable: ${name}`,
          defaultValue: promptVariables[name] || '',
          required: true
        }
      })

      const templateData = {
        name: newTemplate.name,
        description: newTemplate.description,
        category: newTemplate.category,
        prompt: currentPrompt,
        variables,
        tags: newTemplate.tags.split(',').map(tag => tag.trim()).filter(Boolean),
        isPublic: newTemplate.isPublic,
        tenantId
      }

      const response = await fetch('/api/ai/prompt-templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(templateData)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Error guardando template')
      }

      const data = await response.json()
      setTemplates([data.template, ...templates])
      setShowSaveDialog(false)
      setNewTemplate({
        name: '',
        description: '',
        category: 'general',
        tags: '',
        isPublic: false
      })

      toast.success('Template guardado exitosamente')

    } catch (error: any) {
      console.error('Error saving template:', error)
      toast.error('Error guardando template', {
        description: error.message
      })
    }
  }

  const deleteTemplate = async (templateId: string) => {
    try {
      const token = localStorage.getItem('supabase_token')
      
      const response = await fetch(`/api/ai/prompt-templates/${templateId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Error eliminando template')
      }

      setTemplates(templates.filter(t => t.id !== templateId))
      if (selectedTemplate?.id === templateId) {
        setSelectedTemplate(null)
      }

      toast.success('Template eliminado')

    } catch (error: any) {
      console.error('Error deleting template:', error)
      toast.error('Error eliminando template', {
        description: error.message
      })
    }
  }

  const loadTemplate = (template: PromptTemplate) => {
    setSelectedTemplate(template)
    setCurrentPrompt(template.prompt)
    
    // Initialize variables with default values
    const initialVariables: Record<string, string> = {}
    template.variables.forEach(variable => {
      initialVariables[variable.name] = variable.defaultValue || ''
    })
    setPromptVariables(initialVariables)
    
    setActiveTab('editor')
    
    if (onTemplateSelect) {
      onTemplateSelect(template)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Copiado al portapapeles')
  }

  const extractVariables = () => {
    const matches = currentPrompt.match(/{{[^}]+}}/g) || []
    const variables: Record<string, string> = {}
    
    matches.forEach(match => {
      const varName = match.replace(/[{}]/g, '').trim()
      if (!promptVariables[varName]) {
        variables[varName] = ''
      }
    })
    
    setPromptVariables({ ...promptVariables, ...variables })
  }

  // Extract variables when prompt changes
  useEffect(() => {
    extractVariables()
  }, [currentPrompt])

  const getExecutionStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'error':
        return <AlertTriangle className="h-4 w-4 text-red-500" />
      default:
        return <Clock className="h-4 w-4 text-gray-500" />
    }
  }

  const formatCost = (cost: number) => {
    return cost < 0.01 ? '< $0.01' : `$${cost.toFixed(3)}`
  }

  const categories = ['general', 'workflow', 'debugging', 'optimization', 'analysis', 'custom']

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">AI Prompt Playground</h2>
          <p className="text-muted-foreground">
            Experimenta con prompts, guarda templates y revisa el historial
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSaveDialog(true)}
            disabled={!currentPrompt.trim()}
          >
            <Save className="h-4 w-4 mr-2" />
            Guardar Template
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="editor">Editor</TabsTrigger>
          <TabsTrigger value="templates">Templates ({templates.length})</TabsTrigger>
          <TabsTrigger value="history">Historial ({executions.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="editor" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Prompt Editor */}
            <div className="lg:col-span-2 space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Prompt Editor</CardTitle>
                    <div className="flex items-center gap-2">
                      <Select value={selectedModel} onValueChange={setSelectedModel}>
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="gpt-4">GPT-4</SelectItem>
                          <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                          <SelectItem value="claude-3-sonnet">Claude 3 Sonnet</SelectItem>
                          <SelectItem value="claude-3-haiku">Claude 3 Haiku</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {selectedTemplate && (
                    <CardDescription>
                      Usando template: {selectedTemplate.name}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  <Textarea
                    placeholder="Escribe tu prompt aquí... Usa {{variable}} para variables dinámicas"
                    value={currentPrompt}
                    onChange={(e) => setCurrentPrompt(e.target.value)}
                    className="min-h-32"
                  />
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      {currentPrompt.length} caracteres
                    </span>
                    <Button
                      onClick={executePrompt}
                      disabled={isExecuting || !currentPrompt.trim()}
                      className="min-w-24"
                    >
                      {isExecuting ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Play className="h-4 w-4 mr-2" />
                      )}
                      {isExecuting ? 'Ejecutando...' : 'Ejecutar'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Variables Panel */}
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Variables</CardTitle>
                  <CardDescription>
                    Define valores para las variables en tu prompt
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {Object.keys(promptVariables).length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No hay variables detectadas.
                      <br />
                      Usa `{`{{nombre}}`}` en tu prompt.
                    </p>
                  ) : (
                    Object.entries(promptVariables).map(([key, value]) => (
                      <div key={key} className="space-y-1">
                        <label className="text-sm font-medium">{key}</label>
                        <Input
                          placeholder={`Valor para ${key}`}
                          value={value}
                          onChange={(e) => setPromptVariables({
                            ...promptVariables,
                            [key]: e.target.value
                          })}
                        />
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="templates" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Select defaultValue="all">
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Categoría" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {categories.map(cat => (
                    <SelectItem key={cat} value={cat}>
                      {cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" size="sm">
              <Upload className="h-4 w-4 mr-2" />
              Importar
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map(template => (
              <Card key={template.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-base">{template.name}</CardTitle>
                      <CardDescription className="text-sm">
                        {template.description}
                      </CardDescription>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => loadTemplate(template)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Usar Template
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => copyToClipboard(template.prompt)}>
                          <Copy className="h-4 w-4 mr-2" />
                          Copiar Prompt
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => {
                            setTemplateToDelete(template.id)
                            setShowDeleteDialog(true)
                          }}
                          className="text-red-600"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {template.category}
                      </Badge>
                      {template.isPublic && (
                        <Badge variant="secondary" className="text-xs">
                          Público
                        </Badge>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>{template.variables.length} variables</span>
                      <span>{template.usageCount} usos</span>
                      {template.rating && (
                        <div className="flex items-center gap-1">
                          <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                          <span>{template.rating}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-1">
                      {template.tags.slice(0, 3).map(tag => (
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
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {templates.length === 0 && (
            <Card>
              <CardContent className="text-center py-12">
                <Sparkles className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No hay templates guardados</h3>
                <p className="text-muted-foreground mb-4">
                  Crea tu primer template desde el editor para reutilizar prompts
                </p>
                <Button onClick={() => setActiveTab('editor')}>
                  <Plus className="h-4 w-4 mr-2" />
                  Crear Template
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={loadExecutionHistory}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Actualizar
              </Button>
            </div>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
          </div>

          <div className="space-y-3">
            {executions.map(execution => (
              <Card key={execution.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2">
                        {getExecutionStatusIcon(execution.status)}
                        <span className="font-medium">
                          {execution.templateId ? 
                            templates.find(t => t.id === execution.templateId)?.name || 'Template' 
                            : 'Prompt personalizado'
                          }
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {execution.model}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(execution.timestamp).toLocaleString()}
                        </span>
                      </div>
                      
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {execution.prompt.length > 100 
                          ? execution.prompt.substring(0, 100) + '...'
                          : execution.prompt
                        }
                      </p>

                      {execution.status === 'success' && (
                        <p className="text-sm bg-muted p-2 rounded line-clamp-3">
                          {execution.response.length > 200
                            ? execution.response.substring(0, 200) + '...'
                            : execution.response
                          }
                        </p>
                      )}

                      {execution.status === 'error' && (
                        <p className="text-sm text-red-600 bg-red-50 p-2 rounded">
                          {execution.error}
                        </p>
                      )}

                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>{execution.tokensUsed} tokens</span>
                        <span>{formatCost(execution.costUsd)}</span>
                        <span>{execution.executionTime}ms</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(execution.prompt)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      {execution.status === 'success' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(execution.response)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {executions.length === 0 && (
            <Card>
              <CardContent className="text-center py-12">
                <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No hay historial</h3>
                <p className="text-muted-foreground mb-4">
                  Ejecuta prompts desde el editor para ver el historial aquí
                </p>
                <Button onClick={() => setActiveTab('editor')}>
                  <Play className="h-4 w-4 mr-2" />
                  Ejecutar Prompt
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Save Template Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Guardar Template</DialogTitle>
            <DialogDescription>
              Guarda este prompt como template para reutilizar
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Nombre</label>
              <Input
                placeholder="Nombre del template"
                value={newTemplate.name}
                onChange={(e) => setNewTemplate({...newTemplate, name: e.target.value})}
              />
            </div>

            <div>
              <label className="text-sm font-medium">Descripción</label>
              <Textarea
                placeholder="Describe para qué sirve este template"
                value={newTemplate.description}
                onChange={(e) => setNewTemplate({...newTemplate, description: e.target.value})}
              />
            </div>

            <div>
              <label className="text-sm font-medium">Categoría</label>
              <Select value={newTemplate.category} onValueChange={(value) => 
                setNewTemplate({...newTemplate, category: value})
              }>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(cat => (
                    <SelectItem key={cat} value={cat}>
                      {cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">Tags (separados por comas)</label>
              <Input
                placeholder="ai, automation, workflow"
                value={newTemplate.tags}
                onChange={(e) => setNewTemplate({...newTemplate, tags: e.target.value})}
              />
            </div>

            <div className="flex items-center justify-between">
              <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={saveTemplate} disabled={!newTemplate.name.trim()}>
                <Save className="h-4 w-4 mr-2" />
                Guardar Template
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar template?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El template será eliminado permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                if (templateToDelete) {
                  deleteTemplate(templateToDelete)
                  setTemplateToDelete(null)
                  setShowDeleteDialog(false)
                }
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default PromptPlayground