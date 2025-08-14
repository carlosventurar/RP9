'use client'

import { useState, useCallback } from 'react'
import { toast } from 'sonner'

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

interface UseAIChangesOptions {
  tenantId: string
  workflowId?: string
  onChangesApplied?: (suggestion: AIChangeSuggestion) => void
}

export function useAIChanges({ tenantId, workflowId, onChangesApplied }: UseAIChangesOptions) {
  const [suggestions, setSuggestions] = useState<AIChangeSuggestion[]>([])
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isApplying, setIsApplying] = useState(false)

  // Generate suggestions based on workflow analysis
  const generateSuggestions = useCallback(async (analysisType: string = 'optimization') => {
    setIsAnalyzing(true)

    try {
      const token = localStorage.getItem('supabase_token')
      
      const response = await fetch('/api/ai/analyze-changes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          tenantId,
          workflowId,
          analysisType,
          includeFiles: true
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Error generando sugerencias')
      }

      const data = await response.json()
      setSuggestions(data.suggestions || [])

      toast.success('Sugerencias generadas', {
        description: `${data.suggestions?.length || 0} cambios sugeridos`
      })

    } catch (error: any) {
      console.error('Error generating suggestions:', error)
      toast.error('Error generando sugerencias', {
        description: error.message
      })
    } finally {
      setIsAnalyzing(false)
    }
  }, [tenantId, workflowId])

  // Apply selected changes
  const applyChanges = useCallback(async (suggestionId: string, fileNames: string[]) => {
    setIsApplying(true)

    try {
      const token = localStorage.getItem('supabase_token')
      
      const response = await fetch('/api/ai/apply-changes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          tenantId,
          workflowId,
          suggestionId,
          fileNames,
          confirmChanges: true
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Error aplicando cambios')
      }

      const data = await response.json()
      
      // Remove applied suggestion
      const appliedSuggestion = suggestions.find(s => s.id === suggestionId)
      setSuggestions(prev => prev.filter(s => s.id !== suggestionId))

      if (appliedSuggestion && onChangesApplied) {
        onChangesApplied(appliedSuggestion)
      }

      toast.success('Cambios aplicados exitosamente', {
        description: `${fileNames.length} archivo(s) actualizado(s)`
      })

      return data

    } catch (error: any) {
      console.error('Error applying changes:', error)
      throw error
    } finally {
      setIsApplying(false)
    }
  }, [tenantId, workflowId, suggestions, onChangesApplied])

  // Reject a suggestion
  const rejectSuggestion = useCallback(async (suggestionId: string) => {
    try {
      const token = localStorage.getItem('supabase_token')
      
      const response = await fetch('/api/ai/reject-suggestion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          tenantId,
          suggestionId,
          reason: 'user_rejected'
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Error rechazando sugerencia')
      }

      // Remove rejected suggestion
      setSuggestions(prev => prev.filter(s => s.id !== suggestionId))

      toast.success('Sugerencia rechazada')

    } catch (error: any) {
      console.error('Error rejecting suggestion:', error)
      toast.error('Error rechazando sugerencia', {
        description: error.message
      })
    }
  }, [tenantId])

  // Request more information about a suggestion
  const requestMoreInfo = useCallback(async (suggestionId: string) => {
    try {
      const token = localStorage.getItem('supabase_token')
      
      const response = await fetch('/api/ai/explain-suggestion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          tenantId,
          suggestionId,
          includeCodeExamples: true,
          includeReferences: true
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Error obteniendo información')
      }

      const data = await response.json()

      // Show detailed explanation in a modal or toast
      toast.info('Explicación detallada', {
        description: data.explanation?.substring(0, 100) + '...',
        duration: 5000
      })

      return data

    } catch (error: any) {
      console.error('Error requesting more info:', error)
      toast.error('Error obteniendo información', {
        description: error.message
      })
      throw error
    }
  }, [tenantId])

  // Generate diff for specific changes
  const generateDiff = useCallback((oldContent: string, newContent: string): DiffLine[] => {
    const oldLines = oldContent.split('\n')
    const newLines = newContent.split('\n')
    const diff: DiffLine[] = []

    // Simple diff algorithm (could be improved with more sophisticated algorithms)
    let oldIndex = 0
    let newIndex = 0

    while (oldIndex < oldLines.length || newIndex < newLines.length) {
      if (oldIndex >= oldLines.length) {
        // Remaining lines are additions
        diff.push({
          type: 'added',
          content: newLines[newIndex],
          newLineNumber: newIndex + 1
        })
        newIndex++
      } else if (newIndex >= newLines.length) {
        // Remaining lines are deletions
        diff.push({
          type: 'removed',
          content: oldLines[oldIndex],
          oldLineNumber: oldIndex + 1
        })
        oldIndex++
      } else if (oldLines[oldIndex] === newLines[newIndex]) {
        // Lines are the same
        diff.push({
          type: 'unchanged',
          content: oldLines[oldIndex],
          oldLineNumber: oldIndex + 1,
          newLineNumber: newIndex + 1
        })
        oldIndex++
        newIndex++
      } else {
        // Lines are different - for simplicity, treat as remove + add
        diff.push({
          type: 'removed',
          content: oldLines[oldIndex],
          oldLineNumber: oldIndex + 1
        })
        diff.push({
          type: 'added',
          content: newLines[newIndex],
          newLineNumber: newIndex + 1
        })
        oldIndex++
        newIndex++
      }
    }

    return diff
  }, [])

  // Load suggestions from storage/API
  const loadSuggestions = useCallback(async () => {
    try {
      const token = localStorage.getItem('supabase_token')
      
      const response = await fetch(`/api/ai/suggestions?tenantId=${tenantId}&workflowId=${workflowId || ''}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setSuggestions(data.suggestions || [])
      }
    } catch (error) {
      console.error('Error loading suggestions:', error)
    }
  }, [tenantId, workflowId])

  // Clear all suggestions
  const clearSuggestions = useCallback(() => {
    setSuggestions([])
  }, [])

  // Create mock suggestion for demo purposes
  const createMockSuggestion = useCallback((): AIChangeSuggestion => {
    const mockId = crypto.randomUUID()
    
    return {
      id: mockId,
      title: 'Optimizar configuración de timeout',
      description: 'Ajustar timeouts para mejorar reliability y performance del workflow',
      category: 'optimization',
      priority: 'medium',
      estimatedTime: 15,
      autoApplicable: true,
      createdAt: new Date().toISOString(),
      benefits: [
        'Reducir fallos por timeout',
        'Mejorar experiencia del usuario',
        'Optimizar uso de recursos'
      ],
      risks: [
        'Posibles cambios en comportamiento',
        'Requiere testing adicional'
      ],
      prerequisites: [
        'Revisar logs de ejecución actuales',
        'Confirmar límites del sistema'
      ],
      files: [
        {
          fileName: 'workflow.json',
          fileType: 'workflow',
          changeType: 'modify',
          language: 'json',
          impact: 'medium',
          confidence: 85,
          reason: 'Incrementar timeout de 30s a 60s para operaciones complejas',
          oldContent: '{\n  "timeout": 30000,\n  "retries": 3\n}',
          newContent: '{\n  "timeout": 60000,\n  "retries": 5,\n  "backoff": "exponential"\n}',
          diff: [
            {
              type: 'removed',
              content: '  "timeout": 30000,',
              oldLineNumber: 2
            },
            {
              type: 'removed',
              content: '  "retries": 3',
              oldLineNumber: 3
            },
            {
              type: 'added',
              content: '  "timeout": 60000,',
              newLineNumber: 2
            },
            {
              type: 'added',
              content: '  "retries": 5,',
              newLineNumber: 3
            },
            {
              type: 'added',
              content: '  "backoff": "exponential"',
              newLineNumber: 4
            }
          ]
        }
      ]
    }
  }, [])

  return {
    suggestions,
    isAnalyzing,
    isApplying,
    generateSuggestions,
    applyChanges,
    rejectSuggestion,
    requestMoreInfo,
    generateDiff,
    loadSuggestions,
    clearSuggestions,
    createMockSuggestion
  }
}