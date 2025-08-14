'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  Check, 
  X, 
  Copy, 
  Download, 
  Eye, 
  EyeOff, 
  RotateCcw, 
  Play,
  Zap,
  AlertTriangle,
  Info,
  FileText,
  Code,
  Settings,
  ChevronDown,
  ChevronRight,
  GitBranch,
  GitMerge
} from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { toast } from 'sonner'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'

interface DiffLine {
  type: 'added' | 'removed' | 'unchanged' | 'context'
  content: string
  lineNumber?: number
  oldLineNumber?: number
  newLineNumber?: number
}

interface FileDiff {
  fileName: string
  fileType: 'workflow' | 'config' | 'code' | 'documentation'
  oldContent?: string
  newContent: string
  diff: DiffLine[]
  changeType: 'create' | 'modify' | 'delete'
  language?: string
  reason: string
  impact: 'low' | 'medium' | 'high'
  confidence: number
}

interface AIChangeSuggestion {
  id: string
  title: string
  description: string
  category: 'optimization' | 'fix' | 'enhancement' | 'refactor'
  files: FileDiff[]
  estimatedTime: number
  benefits: string[]
  risks: string[]
  prerequisites: string[]
  autoApplicable: boolean
  priority: 'low' | 'medium' | 'high' | 'critical'
  createdAt: string
}

interface DiffViewerProps {
  suggestions: AIChangeSuggestion[]
  onApplyChanges?: (suggestionId: string, fileNames: string[]) => Promise<void>
  onRejectSuggestion?: (suggestionId: string) => void
  onRequestMoreInfo?: (suggestionId: string) => void
  readonly?: boolean
  theme?: 'light' | 'dark'
}

export function DiffViewer({ 
  suggestions, 
  onApplyChanges, 
  onRejectSuggestion, 
  onRequestMoreInfo,
  readonly = false,
  theme = 'light'
}: DiffViewerProps) {
  const [selectedSuggestion, setSelectedSuggestion] = useState<string | null>(null)
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())
  const [viewMode, setViewMode] = useState<'unified' | 'split' | 'raw'>('unified')
  const [showWhitespace, setShowWhitespace] = useState(false)
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set())
  const [filterType, setFilterType] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'priority' | 'time' | 'impact' | 'confidence'>('priority')

  // Sort and filter suggestions
  const filteredSuggestions = useMemo(() => {
    let filtered = suggestions

    if (filterType !== 'all') {
      filtered = filtered.filter(s => s.category === filterType)
    }

    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'priority':
          const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 }
          return priorityOrder[b.priority] - priorityOrder[a.priority]
        case 'time':
          return a.estimatedTime - b.estimatedTime
        case 'impact':
          const impactOrder = { high: 3, medium: 2, low: 1 }
          return impactOrder[b.files[0]?.impact || 'low'] - impactOrder[a.files[0]?.impact || 'low']
        case 'confidence':
          return (b.files[0]?.confidence || 0) - (a.files[0]?.confidence || 0)
        default:
          return 0
      }
    })
  }, [suggestions, filterType, sortBy])

  const toggleFileSelection = (fileName: string) => {
    const newSelection = new Set(selectedFiles)
    if (newSelection.has(fileName)) {
      newSelection.delete(fileName)
    } else {
      newSelection.add(fileName)
    }
    setSelectedFiles(newSelection)
  }

  const toggleFileExpansion = (fileName: string) => {
    const newExpanded = new Set(expandedFiles)
    if (newExpanded.has(fileName)) {
      newExpanded.delete(fileName)
    } else {
      newExpanded.add(fileName)
    }
    setExpandedFiles(newExpanded)
  }

  const renderDiffLine = (line: DiffLine, index: number) => {
    const lineClass = {
      added: 'bg-green-50 border-green-200 text-green-800',
      removed: 'bg-red-50 border-red-200 text-red-800',
      unchanged: 'bg-gray-50 border-gray-200',
      context: 'bg-gray-50 border-gray-200 text-gray-600'
    }[line.type]

    const linePrefix = {
      added: '+',
      removed: '-',
      unchanged: ' ',
      context: ' '
    }[line.type]

    let content = line.content
    if (showWhitespace) {
      content = content.replace(/\t/g, '→').replace(/ /g, '·')
    }

    return (
      <div 
        key={index} 
        className={`flex border-l-2 ${lineClass} font-mono text-sm`}
      >
        <div className="w-12 px-2 py-1 text-xs text-gray-500 bg-gray-100 border-r">
          {line.oldLineNumber || ''}
        </div>
        <div className="w-12 px-2 py-1 text-xs text-gray-500 bg-gray-100 border-r">
          {line.newLineNumber || ''}
        </div>
        <div className="w-6 px-1 py-1 text-center font-bold">
          {linePrefix}
        </div>
        <div className="flex-1 px-2 py-1 overflow-x-auto">
          <code>{content}</code>
        </div>
      </div>
    )
  }

  const renderSplitDiff = (file: FileDiff) => {
    const oldLines = file.oldContent?.split('\n') || []
    const newLines = file.newContent.split('\n')

    return (
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <h4 className="text-sm font-medium text-red-600">Antes</h4>
          <div className="border rounded">
            {oldLines.map((line, index) => (
              <div key={index} className="flex border-b last:border-b-0">
                <div className="w-8 px-2 py-1 text-xs text-gray-500 bg-gray-100 border-r">
                  {index + 1}
                </div>
                <div className="flex-1 px-2 py-1 font-mono text-sm">
                  <code>{line}</code>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        <div className="space-y-1">
          <h4 className="text-sm font-medium text-green-600">Después</h4>
          <div className="border rounded">
            {newLines.map((line, index) => (
              <div key={index} className="flex border-b last:border-b-0">
                <div className="w-8 px-2 py-1 text-xs text-gray-500 bg-gray-100 border-r">
                  {index + 1}
                </div>
                <div className="flex-1 px-2 py-1 font-mono text-sm">
                  <code>{line}</code>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  const renderRawContent = (file: FileDiff) => {
    const syntaxHighlighterTheme = theme === 'dark' ? oneDark : oneLight
    
    return (
      <SyntaxHighlighter
        language={file.language || 'json'}
        style={syntaxHighlighterTheme}
        showLineNumbers
        wrapLines
        customStyle={{
          margin: 0,
          borderRadius: '0.375rem',
          fontSize: '0.875rem'
        }}
      >
        {file.newContent}
      </SyntaxHighlighter>
    )
  }

  const applyChanges = async (suggestionId: string) => {
    if (!onApplyChanges || selectedFiles.size === 0) return

    try {
      await onApplyChanges(suggestionId, Array.from(selectedFiles))
      toast.success('Cambios aplicados exitosamente', {
        description: `${selectedFiles.size} archivo(s) actualizado(s)`
      })
      setSelectedFiles(new Set())
    } catch (error: any) {
      toast.error('Error aplicando cambios', {
        description: error.message
      })
    }
  }

  const copyToClipboard = (content: string) => {
    navigator.clipboard.writeText(content)
    toast.success('Copiado al portapapeles')
  }

  const getPriorityColor = (priority: string) => {
    const colors = {
      critical: 'bg-red-100 text-red-800 border-red-200',
      high: 'bg-orange-100 text-orange-800 border-orange-200',
      medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      low: 'bg-green-100 text-green-800 border-green-200'
    }
    return colors[priority as keyof typeof colors] || colors.medium
  }

  const getCategoryIcon = (category: string) => {
    const icons = {
      optimization: Zap,
      fix: AlertTriangle,
      enhancement: Info,
      refactor: Code
    }
    const Icon = icons[category as keyof typeof icons] || Info
    return <Icon className="h-4 w-4" />
  }

  const getFileTypeIcon = (fileType: string) => {
    const icons = {
      workflow: GitBranch,
      config: Settings,
      code: Code,
      documentation: FileText
    }
    const Icon = icons[fileType as keyof typeof icons] || FileText
    return <Icon className="h-4 w-4" />
  }

  if (suggestions.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <GitMerge className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No hay cambios sugeridos</h3>
          <p className="text-muted-foreground">
            La IA no ha generado sugerencias de cambios para revisar
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Revisor de Cambios AI</h2>
          <p className="text-muted-foreground">
            Revisa y aplica cambios sugeridos por la inteligencia artificial
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Filtrar por tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="optimization">Optimización</SelectItem>
              <SelectItem value="fix">Corrección</SelectItem>
              <SelectItem value="enhancement">Mejora</SelectItem>
              <SelectItem value="refactor">Refactor</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Ordenar por" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="priority">Prioridad</SelectItem>
              <SelectItem value="impact">Impacto</SelectItem>
              <SelectItem value="confidence">Confianza</SelectItem>
              <SelectItem value="time">Tiempo est.</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Suggestions List */}
        <div className="lg:col-span-1 space-y-3">
          <h3 className="font-medium">Sugerencias ({filteredSuggestions.length})</h3>
          
          <div className="space-y-2">
            {filteredSuggestions.map(suggestion => (
              <Card 
                key={suggestion.id}
                className={`cursor-pointer transition-colors ${
                  selectedSuggestion === suggestion.id 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'hover:bg-gray-50'
                }`}
                onClick={() => setSelectedSuggestion(suggestion.id)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        {getCategoryIcon(suggestion.category)}
                        <CardTitle className="text-sm">{suggestion.title}</CardTitle>
                      </div>
                      <CardDescription className="text-xs">
                        {suggestion.description}
                      </CardDescription>
                    </div>
                    <Badge className={`text-xs ${getPriorityColor(suggestion.priority)}`}>
                      {suggestion.priority}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{suggestion.files.length} archivo(s)</span>
                    <span>~{suggestion.estimatedTime}min</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Diff Viewer */}
        <div className="lg:col-span-2">
          {selectedSuggestion ? (
            (() => {
              const suggestion = suggestions.find(s => s.id === selectedSuggestion)
              if (!suggestion) return null

              return (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          {getCategoryIcon(suggestion.category)}
                          {suggestion.title}
                        </CardTitle>
                        <CardDescription>
                          {suggestion.description}
                        </CardDescription>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowWhitespace(!showWhitespace)}
                        >
                          {showWhitespace ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                        
                        <Select value={viewMode} onValueChange={(value: any) => setViewMode(value)}>
                          <SelectTrigger className="w-24">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unified">Unificado</SelectItem>
                            <SelectItem value="split">Dividido</SelectItem>
                            <SelectItem value="raw">Código</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 mt-3">
                      <Badge variant="outline">
                        {suggestion.files.length} archivo(s)
                      </Badge>
                      <Badge variant="outline">
                        ~{suggestion.estimatedTime} minutos
                      </Badge>
                      {suggestion.autoApplicable && (
                        <Badge variant="outline" className="bg-green-50 text-green-700">
                          Auto-aplicable
                        </Badge>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent>
                    <Tabs defaultValue="files" className="space-y-4">
                      <TabsList>
                        <TabsTrigger value="files">Archivos</TabsTrigger>
                        <TabsTrigger value="benefits">Beneficios</TabsTrigger>
                        <TabsTrigger value="risks">Riesgos</TabsTrigger>
                      </TabsList>

                      <TabsContent value="files" className="space-y-4">
                        {suggestion.files.map(file => (
                          <Collapsible 
                            key={file.fileName}
                            open={expandedFiles.has(file.fileName)}
                            onOpenChange={() => toggleFileExpansion(file.fileName)}
                          >
                            <div className="border rounded-lg">
                              <CollapsibleTrigger className="w-full p-3 flex items-center justify-between hover:bg-gray-50">
                                <div className="flex items-center gap-3">
                                  <input
                                    type="checkbox"
                                    checked={selectedFiles.has(file.fileName)}
                                    onChange={() => toggleFileSelection(file.fileName)}
                                    onClick={(e) => e.stopPropagation()}
                                    disabled={readonly}
                                    className="rounded"
                                  />
                                  {getFileTypeIcon(file.fileType)}
                                  <span className="font-medium">{file.fileName}</span>
                                  <Badge variant="outline" className="text-xs">
                                    {file.changeType}
                                  </Badge>
                                  <Badge variant="outline" className={
                                    file.impact === 'high' ? 'bg-red-50 text-red-700' :
                                    file.impact === 'medium' ? 'bg-yellow-50 text-yellow-700' :
                                    'bg-green-50 text-green-700'
                                  }>
                                    {file.impact} impacto
                                  </Badge>
                                </div>
                                
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-muted-foreground">
                                    {file.confidence}% confianza
                                  </span>
                                  {expandedFiles.has(file.fileName) ? 
                                    <ChevronDown className="h-4 w-4" /> : 
                                    <ChevronRight className="h-4 w-4" />
                                  }
                                </div>
                              </CollapsibleTrigger>

                              <CollapsibleContent>
                                <div className="border-t p-3 space-y-3">
                                  <p className="text-sm text-muted-foreground">
                                    {file.reason}
                                  </p>

                                  <div className="space-y-2">
                                    {viewMode === 'unified' && (
                                      <div className="border rounded overflow-hidden">
                                        {file.diff.map((line, index) => renderDiffLine(line, index))}
                                      </div>
                                    )}

                                    {viewMode === 'split' && renderSplitDiff(file)}

                                    {viewMode === 'raw' && renderRawContent(file)}
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => copyToClipboard(file.newContent)}
                                    >
                                      <Copy className="h-3 w-3 mr-1" />
                                      Copiar
                                    </Button>
                                    
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => {
                                        const blob = new Blob([file.newContent], { type: 'text/plain' })
                                        const url = URL.createObjectURL(blob)
                                        const a = document.createElement('a')
                                        a.href = url
                                        a.download = file.fileName
                                        a.click()
                                        URL.revokeObjectURL(url)
                                      }}
                                    >
                                      <Download className="h-3 w-3 mr-1" />
                                      Descargar
                                    </Button>
                                  </div>
                                </div>
                              </CollapsibleContent>
                            </div>
                          </Collapsible>
                        ))}

                        {!readonly && (
                          <div className="flex items-center justify-between pt-4 border-t">
                            <div className="text-sm text-muted-foreground">
                              {selectedFiles.size} archivo(s) seleccionado(s)
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onRejectSuggestion?.(suggestion.id)}
                              >
                                <X className="h-4 w-4 mr-1" />
                                Rechazar
                              </Button>
                              
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onRequestMoreInfo?.(suggestion.id)}
                              >
                                <Info className="h-4 w-4 mr-1" />
                                Más info
                              </Button>
                              
                              <Button
                                onClick={() => applyChanges(suggestion.id)}
                                disabled={selectedFiles.size === 0}
                                size="sm"
                              >
                                <Check className="h-4 w-4 mr-1" />
                                Aplicar cambios
                              </Button>
                            </div>
                          </div>
                        )}
                      </TabsContent>

                      <TabsContent value="benefits">
                        <div className="space-y-2">
                          {suggestion.benefits.map((benefit, index) => (
                            <div key={index} className="flex items-start gap-2">
                              <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                              <span className="text-sm">{benefit}</span>
                            </div>
                          ))}
                        </div>
                      </TabsContent>

                      <TabsContent value="risks">
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <h4 className="font-medium text-red-600">Riesgos potenciales</h4>
                            {suggestion.risks.map((risk, index) => (
                              <div key={index} className="flex items-start gap-2">
                                <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                                <span className="text-sm">{risk}</span>
                              </div>
                            ))}
                          </div>

                          {suggestion.prerequisites.length > 0 && (
                            <div className="space-y-2">
                              <h4 className="font-medium">Prerrequisitos</h4>
                              {suggestion.prerequisites.map((prereq, index) => (
                                <div key={index} className="flex items-start gap-2">
                                  <Info className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                                  <span className="text-sm">{prereq}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                </Card>
              )
            })()
          ) : (
            <Card>
              <CardContent className="text-center py-12">
                <Eye className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Selecciona una sugerencia</h3>
                <p className="text-muted-foreground">
                  Haz clic en una sugerencia de la izquierda para ver los cambios detallados
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

export default DiffViewer