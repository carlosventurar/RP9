'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  Sparkles, 
  Bug, 
  Loader2, 
  CheckCircle, 
  AlertTriangle,
  Copy,
  Download,
  Play,
  Eye,
  ArrowRight
} from 'lucide-react'
import { toast } from 'sonner'

interface FixWithAIButtonProps {
  executionId: string
  workflowId: string
  errorLogs: any[]
  workflowData?: any
  size?: 'sm' | 'default' | 'lg'
  variant?: 'default' | 'outline' | 'ghost'
  className?: string
}

interface ErrorAnalysis {
  errorType: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  explanation: string
  possibleCauses: string[]
  suggestedFixes: Array<{
    title: string
    description: string
    difficulty: 'easy' | 'medium' | 'hard'
    estimatedTime: number
    steps: string[]
    autoApplicable: boolean
    codeChanges?: Array<{
      nodeId: string
      nodeName: string
      currentConfig: any
      suggestedConfig: any
      reason: string
    }>
  }>
  preventionTips: string[]
  relatedDocumentation: Array<{
    title: string
    url: string
  }>
}

export function FixWithAIButton({
  executionId,
  workflowId,
  errorLogs,
  workflowData,
  size = 'default',
  variant = 'default',
  className
}: FixWithAIButtonProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysis, setAnalysis] = useState<ErrorAnalysis | null>(null)
  const [showDialog, setShowDialog] = useState(false)
  const [selectedFix, setSelectedFix] = useState<number | null>(null)

  const analyzeError = async () => {
    setIsAnalyzing(true)
    
    try {
      const token = localStorage.getItem('supabase_token')
      const tenantId = localStorage.getItem('tenant_id')
      
      if (!token || !tenantId) {
        toast.error('Error de autenticación')
        return
      }

      const response = await fetch('/api/ai/explain-error', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          executionId,
          workflowId,
          tenantId,
          errorLogs,
          workflowData
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Error analizando el error')
      }

      const data = await response.json()
      setAnalysis(data.analysis)
      setShowDialog(true)

      toast.success('Análisis completado', {
        description: `Encontradas ${data.analysis.suggestedFixes?.length || 0} posibles soluciones`
      })

    } catch (error: any) {
      console.error('Error analyzing:', error)
      toast.error('Error en el análisis', {
        description: error.message
      })
    } finally {
      setIsAnalyzing(false)
    }
  }

  const applySuggestedFix = async (fixIndex: number) => {
    if (!analysis) return

    const fix = analysis.suggestedFixes[fixIndex]
    if (!fix.autoApplicable) {
      toast.info('Esta solución requiere aplicación manual', {
        description: 'Sigue los pasos mostrados para implementar la solución'
      })
      return
    }

    // TODO: Implement auto-apply functionality
    toast.info('Aplicación automática próximamente', {
      description: 'Por ahora, sigue los pasos manualmente'
    })
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Copiado al portapapeles')
  }

  const getSeverityColor = (severity: string) => {
    const colors = {
      low: 'bg-green-100 text-green-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-orange-100 text-orange-800',
      critical: 'bg-red-100 text-red-800'
    }
    return colors[severity as keyof typeof colors] || colors.medium
  }

  const getDifficultyColor = (difficulty: string) => {
    const colors = {
      easy: 'bg-green-100 text-green-800',
      medium: 'bg-yellow-100 text-yellow-800',
      hard: 'bg-red-100 text-red-800'
    }
    return colors[difficulty as keyof typeof colors] || colors.medium
  }

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`
    if (seconds < 3600) return `${Math.round(seconds / 60)}min`
    return `${Math.round(seconds / 3600)}h`
  }

  return (
    <>
      <Button
        onClick={analyzeError}
        disabled={isAnalyzing}
        size={size}
        variant={variant}
        className={className}
      >
        {isAnalyzing ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Sparkles className="mr-2 h-4 w-4" />
        )}
        {isAnalyzing ? 'Analizando...' : 'Fix con IA'}
      </Button>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bug className="h-5 w-5 text-red-500" />
              Análisis de Error con IA
            </DialogTitle>
            <DialogDescription>
              Execution ID: {executionId} | Workflow ID: {workflowId}
            </DialogDescription>
          </DialogHeader>

          {analysis && (
            <ScrollArea className="max-h-[60vh] pr-4">
              <div className="space-y-6">
                {/* Error Summary */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">Resumen del Error</CardTitle>
                      <Badge className={getSeverityColor(analysis.severity)}>
                        {analysis.severity.toUpperCase()}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div>
                        <span className="font-medium">Tipo: </span>
                        <span className="text-muted-foreground">{analysis.errorType}</span>
                      </div>
                      <div>
                        <span className="font-medium">Explicación: </span>
                        <p className="text-sm text-muted-foreground mt-1">
                          {analysis.explanation}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Possible Causes */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Posibles Causas</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {analysis.possibleCauses.map((cause, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                          <span className="text-sm">{cause}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                {/* Suggested Fixes */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">
                      Soluciones Sugeridas ({analysis.suggestedFixes.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {analysis.suggestedFixes.map((fix, index) => (
                        <Card 
                          key={index} 
                          className={`border ${selectedFix === index ? 'border-blue-500 bg-blue-50' : ''}`}
                        >
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-base">{fix.title}</CardTitle>
                              <div className="flex items-center gap-2">
                                <Badge className={getDifficultyColor(fix.difficulty)}>
                                  {fix.difficulty}
                                </Badge>
                                <Badge variant="outline">
                                  {formatTime(fix.estimatedTime)}
                                </Badge>
                                {fix.autoApplicable && (
                                  <Badge variant="outline" className="bg-green-50 text-green-700">
                                    Auto-aplicable
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <CardDescription>{fix.description}</CardDescription>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-3">
                              <div>
                                <h4 className="font-medium mb-2">Pasos a seguir:</h4>
                                <ol className="space-y-1">
                                  {fix.steps.map((step, stepIndex) => (
                                    <li key={stepIndex} className="flex items-start gap-2">
                                      <span className="flex-shrink-0 w-5 h-5 bg-blue-100 text-blue-800 rounded-full text-xs flex items-center justify-center font-medium">
                                        {stepIndex + 1}
                                      </span>
                                      <span className="text-sm">{step}</span>
                                    </li>
                                  ))}
                                </ol>
                              </div>

                              {fix.codeChanges && fix.codeChanges.length > 0 && (
                                <div>
                                  <h4 className="font-medium mb-2">Cambios de código:</h4>
                                  <div className="space-y-2">
                                    {fix.codeChanges.map((change, changeIndex) => (
                                      <div key={changeIndex} className="bg-muted p-3 rounded-md">
                                        <div className="flex items-center justify-between mb-2">
                                          <span className="font-medium text-sm">
                                            {change.nodeName} ({change.nodeId})
                                          </span>
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => copyToClipboard(JSON.stringify(change.suggestedConfig, null, 2))}
                                          >
                                            <Copy className="h-3 w-3" />
                                          </Button>
                                        </div>
                                        <p className="text-xs text-muted-foreground mb-2">
                                          {change.reason}
                                        </p>
                                        <div className="text-xs">
                                          <span className="text-red-600">- Actual</span> | 
                                          <span className="text-green-600"> + Sugerido</span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              <div className="flex items-center gap-2 pt-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setSelectedFix(selectedFix === index ? null : index)}
                                >
                                  <Eye className="h-3 w-3 mr-1" />
                                  {selectedFix === index ? 'Ocultar detalles' : 'Ver detalles'}
                                </Button>
                                
                                {fix.autoApplicable && (
                                  <Button
                                    size="sm"
                                    onClick={() => applySuggestedFix(index)}
                                  >
                                    <Play className="h-3 w-3 mr-1" />
                                    Aplicar automáticamente
                                  </Button>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Prevention Tips */}
                {analysis.preventionTips.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Prevención Futura</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {analysis.preventionTips.map((tip, index) => (
                          <li key={index} className="flex items-start gap-2">
                            <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                            <span className="text-sm">{tip}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}

                {/* Related Documentation */}
                {analysis.relatedDocumentation.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Documentación Relacionada</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {analysis.relatedDocumentation.map((doc, index) => (
                          <a
                            key={index}
                            href={doc.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 hover:underline"
                          >
                            <ArrowRight className="h-3 w-3" />
                            {doc.title}
                          </a>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

export default FixWithAIButton