import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

// const supabase = createClient() // Moved inside handlers

const analyzeSchema = z.object({
  tenantId: z.string().uuid(),
  workflowId: z.string().optional(),
  analysisType: z.enum(['optimization', 'fix', 'enhancement', 'refactor']).default('optimization'),
  includeFiles: z.boolean().default(true)
})

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    // Get auth token from headers
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authorization token required' },
        { status: 401 }
      )
    }

    const token = authHeader.replace('Bearer ', '')

    // Verify token with Supabase
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      )
    }

    // Parse and validate request body
    const body = await request.json()
    const validatedData = analyzeSchema.parse(body)

    // Check tenant access
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id, plan')
      .eq('id', validatedData.tenantId)
      .or(`owner_user_id.eq.${user.id},id.in.(select tenant_id from tenant_members where user_id = '${user.id}')`)
      .single()

    if (tenantError || !tenant) {
      return NextResponse.json(
        { error: 'Access denied to tenant' },
        { status: 403 }
      )
    }

    // Get workflow data if workflowId provided
    let workflowData = null
    if (validatedData.workflowId) {
      const { data: workflow } = await supabase
        .from('workflows')
        .select('id, name, data, metadata')
        .eq('id', validatedData.workflowId)
        .eq('tenant_id', validatedData.tenantId)
        .single()

      workflowData = workflow
    }

    // Forward request to AI service if available
    const aiServiceUrl = process.env.AI_BACKEND_URL
    
    if (aiServiceUrl) {
      try {
        const aiResponse = await fetch(`${aiServiceUrl}/analyze/changes`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            tenantId: validatedData.tenantId,
            workflowId: validatedData.workflowId,
            analysisType: validatedData.analysisType,
            includeFiles: validatedData.includeFiles,
            workflowData,
            userId: user.id
          })
        })

        if (aiResponse.ok) {
          const data = await aiResponse.json()
          return NextResponse.json(data)
        }
      } catch (error) {
        console.warn('AI service unavailable, using fallback analysis:', error)
      }
    }

    // Fallback: Generate mock suggestions for demo
    const mockSuggestions = generateMockSuggestions(validatedData.analysisType, workflowData)

    // Log the analysis request
    await supabase
      .from('ai_usage')
      .insert({
        tenant_id: validatedData.tenantId,
        user_id: user.id,
        action: 'analyze-changes',
        provider: 'mock',
        model: 'mock-analyzer',
        prompt_tokens: 100,
        completion_tokens: 500,
        total_tokens: 600,
        cost_usd: 0.01,
        metadata: {
          analysisType: validatedData.analysisType,
          workflowId: validatedData.workflowId,
          suggestionsGenerated: mockSuggestions.length
        }
      })

    return NextResponse.json({
      success: true,
      suggestions: mockSuggestions,
      analysisType: validatedData.analysisType,
      workflowAnalyzed: !!workflowData,
      totalSuggestions: mockSuggestions.length
    })

  } catch (error: any) {
    console.error('Analyze Changes API Error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Validation error',
          details: error.errors
        },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
      },
      { status: 500 }
    )
  }
}

function generateMockSuggestions(analysisType: string, workflowData: any) {
  const suggestions = []

  // Generate different suggestions based on analysis type
  switch (analysisType) {
    case 'optimization':
      suggestions.push({
        id: crypto.randomUUID(),
        title: 'Optimizar timeouts de conexión',
        description: 'Ajustar timeouts para mejorar reliability y reducir fallos',
        category: 'optimization',
        priority: 'medium',
        estimatedTime: 15,
        autoApplicable: true,
        createdAt: new Date().toISOString(),
        benefits: [
          'Reducir fallos por timeout',
          'Mejorar experiencia del usuario',
          'Optimizar uso de recursos del sistema'
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
            fileName: workflowData ? `${workflowData.name.toLowerCase()}-config.json` : 'workflow-config.json',
            fileType: 'config',
            changeType: 'modify',
            language: 'json',
            impact: 'medium',
            confidence: 85,
            reason: 'Incrementar timeout de conexión de 30s a 60s',
            oldContent: '{\n  "timeout": 30000,\n  "retries": 3,\n  "maxConcurrent": 5\n}',
            newContent: '{\n  "timeout": 60000,\n  "retries": 5,\n  "maxConcurrent": 10,\n  "backoff": "exponential"\n}',
            diff: [
              { type: 'unchanged', content: '{', oldLineNumber: 1, newLineNumber: 1 },
              { type: 'removed', content: '  "timeout": 30000,', oldLineNumber: 2 },
              { type: 'removed', content: '  "retries": 3,', oldLineNumber: 3 },
              { type: 'removed', content: '  "maxConcurrent": 5', oldLineNumber: 4 },
              { type: 'added', content: '  "timeout": 60000,', newLineNumber: 2 },
              { type: 'added', content: '  "retries": 5,', newLineNumber: 3 },
              { type: 'added', content: '  "maxConcurrent": 10,', newLineNumber: 4 },
              { type: 'added', content: '  "backoff": "exponential"', newLineNumber: 5 },
              { type: 'unchanged', content: '}', oldLineNumber: 5, newLineNumber: 6 }
            ]
          }
        ]
      })
      break

    case 'fix':
      suggestions.push({
        id: crypto.randomUUID(),
        title: 'Corregir manejo de errores HTTP',
        description: 'Agregar manejo robusto de errores para requests HTTP',
        category: 'fix',
        priority: 'high',
        estimatedTime: 25,
        autoApplicable: true,
        createdAt: new Date().toISOString(),
        benefits: [
          'Prevenir fallos silenciosos',
          'Mejor debugging y logs',
          'Recuperación automática de errores'
        ],
        risks: [
          'Cambios en flujo de ejecución',
          'Posible impacto en performance'
        ],
        prerequisites: [
          'Identificar endpoints críticos',
          'Definir estrategia de retry'
        ],
        files: [
          {
            fileName: 'http-nodes.json',
            fileType: 'workflow',
            changeType: 'modify',
            language: 'json',
            impact: 'high',
            confidence: 92,
            reason: 'Agregar validación de status codes y retry logic',
            oldContent: '{\n  "httpRequest": {\n    "url": "{{$node.url}}",\n    "method": "POST"\n  }\n}',
            newContent: '{\n  "httpRequest": {\n    "url": "{{$node.url}}",\n    "method": "POST",\n    "timeout": 30000,\n    "retryOnFail": true,\n    "maxRetries": 3,\n    "retryInterval": 1000,\n    "errorHandling": {\n      "continueOnFail": true,\n      "statusCodes": [200, 201, 202]\n    }\n  }\n}',
            diff: [
              { type: 'unchanged', content: '{', oldLineNumber: 1, newLineNumber: 1 },
              { type: 'unchanged', content: '  "httpRequest": {', oldLineNumber: 2, newLineNumber: 2 },
              { type: 'unchanged', content: '    "url": "{{$node.url}}",', oldLineNumber: 3, newLineNumber: 3 },
              { type: 'removed', content: '    "method": "POST"', oldLineNumber: 4 },
              { type: 'added', content: '    "method": "POST",', newLineNumber: 4 },
              { type: 'added', content: '    "timeout": 30000,', newLineNumber: 5 },
              { type: 'added', content: '    "retryOnFail": true,', newLineNumber: 6 },
              { type: 'added', content: '    "maxRetries": 3,', newLineNumber: 7 },
              { type: 'added', content: '    "retryInterval": 1000,', newLineNumber: 8 },
              { type: 'added', content: '    "errorHandling": {', newLineNumber: 9 },
              { type: 'added', content: '      "continueOnFail": true,', newLineNumber: 10 },
              { type: 'added', content: '      "statusCodes": [200, 201, 202]', newLineNumber: 11 },
              { type: 'added', content: '    }', newLineNumber: 12 },
              { type: 'unchanged', content: '  }', oldLineNumber: 5, newLineNumber: 13 },
              { type: 'unchanged', content: '}', oldLineNumber: 6, newLineNumber: 14 }
            ]
          }
        ]
      })
      break

    case 'enhancement':
      suggestions.push({
        id: crypto.randomUUID(),
        title: 'Agregar logging detallado',
        description: 'Implementar logging estructurado para mejor observabilidad',
        category: 'enhancement',
        priority: 'medium',
        estimatedTime: 20,
        autoApplicable: true,
        createdAt: new Date().toISOString(),
        benefits: [
          'Mejor debugging de issues',
          'Métricas de performance',
          'Auditoría de ejecuciones'
        ],
        risks: [
          'Aumento en uso de storage',
          'Posible impacto en performance'
        ],
        prerequisites: [
          'Definir niveles de log',
          'Configurar rotación de logs'
        ],
        files: [
          {
            fileName: 'logging-config.json',
            fileType: 'config',
            changeType: 'create',
            language: 'json',
            impact: 'low',
            confidence: 88,
            reason: 'Crear configuración centralizada de logging',
            newContent: '{\n  "logging": {\n    "level": "info",\n    "format": "structured",\n    "outputs": ["console", "file"],\n    "rotation": {\n      "maxSize": "100MB",\n      "maxFiles": 5\n    },\n    "fields": {\n      "timestamp": true,\n      "workflowId": true,\n      "executionId": true,\n      "userId": true,\n      "tenantId": true\n    }\n  }\n}',
            diff: [
              { type: 'added', content: '{', newLineNumber: 1 },
              { type: 'added', content: '  "logging": {', newLineNumber: 2 },
              { type: 'added', content: '    "level": "info",', newLineNumber: 3 },
              { type: 'added', content: '    "format": "structured",', newLineNumber: 4 },
              { type: 'added', content: '    "outputs": ["console", "file"],', newLineNumber: 5 },
              { type: 'added', content: '    "rotation": {', newLineNumber: 6 },
              { type: 'added', content: '      "maxSize": "100MB",', newLineNumber: 7 },
              { type: 'added', content: '      "maxFiles": 5', newLineNumber: 8 },
              { type: 'added', content: '    },', newLineNumber: 9 },
              { type: 'added', content: '    "fields": {', newLineNumber: 10 },
              { type: 'added', content: '      "timestamp": true,', newLineNumber: 11 },
              { type: 'added', content: '      "workflowId": true,', newLineNumber: 12 },
              { type: 'added', content: '      "executionId": true,', newLineNumber: 13 },
              { type: 'added', content: '      "userId": true,', newLineNumber: 14 },
              { type: 'added', content: '      "tenantId": true', newLineNumber: 15 },
              { type: 'added', content: '    }', newLineNumber: 16 },
              { type: 'added', content: '  }', newLineNumber: 17 },
              { type: 'added', content: '}', newLineNumber: 18 }
            ]
          }
        ]
      })
      break

    case 'refactor':
      suggestions.push({
        id: crypto.randomUUID(),
        title: 'Modularizar nodos complejos',
        description: 'Dividir nodos grandes en componentes más pequeños y reutilizables',
        category: 'refactor',
        priority: 'low',
        estimatedTime: 45,
        autoApplicable: false,
        createdAt: new Date().toISOString(),
        benefits: [
          'Mejor mantenibilidad',
          'Reutilización de componentes',
          'Testing más fácil'
        ],
        risks: [
          'Cambios significativos en estructura',
          'Requiere testing extensivo',
          'Posibles breaking changes'
        ],
        prerequisites: [
          'Backup completo del workflow',
          'Plan de testing detallado',
          'Revisión de dependencias'
        ],
        files: [
          {
            fileName: 'data-processing-node.json',
            fileType: 'workflow',
            changeType: 'modify',
            language: 'json',
            impact: 'high',
            confidence: 75,
            reason: 'Dividir nodo de procesamiento de datos en sub-componentes',
            oldContent: '{\n  "node": {\n    "type": "dataProcessor",\n    "operations": ["validate", "transform", "enrich", "save"]\n  }\n}',
            newContent: '{\n  "nodes": [\n    {\n      "type": "dataValidator",\n      "operation": "validate"\n    },\n    {\n      "type": "dataTransformer", \n      "operation": "transform"\n    },\n    {\n      "type": "dataEnricher",\n      "operation": "enrich"\n    },\n    {\n      "type": "dataSaver",\n      "operation": "save"\n    }\n  ]\n}',
            diff: [
              { type: 'removed', content: '{', oldLineNumber: 1 },
              { type: 'removed', content: '  "node": {', oldLineNumber: 2 },
              { type: 'removed', content: '    "type": "dataProcessor",', oldLineNumber: 3 },
              { type: 'removed', content: '    "operations": ["validate", "transform", "enrich", "save"]', oldLineNumber: 4 },
              { type: 'removed', content: '  }', oldLineNumber: 5 },
              { type: 'removed', content: '}', oldLineNumber: 6 },
              { type: 'added', content: '{', newLineNumber: 1 },
              { type: 'added', content: '  "nodes": [', newLineNumber: 2 },
              { type: 'added', content: '    {', newLineNumber: 3 },
              { type: 'added', content: '      "type": "dataValidator",', newLineNumber: 4 },
              { type: 'added', content: '      "operation": "validate"', newLineNumber: 5 },
              { type: 'added', content: '    },', newLineNumber: 6 },
              { type: 'added', content: '    {', newLineNumber: 7 },
              { type: 'added', content: '      "type": "dataTransformer",', newLineNumber: 8 },
              { type: 'added', content: '      "operation": "transform"', newLineNumber: 9 },
              { type: 'added', content: '    },', newLineNumber: 10 },
              { type: 'added', content: '    {', newLineNumber: 11 },
              { type: 'added', content: '      "type": "dataEnricher",', newLineNumber: 12 },
              { type: 'added', content: '      "operation": "enrich"', newLineNumber: 13 },
              { type: 'added', content: '    },', newLineNumber: 14 },
              { type: 'added', content: '    {', newLineNumber: 15 },
              { type: 'added', content: '      "type": "dataSaver",', newLineNumber: 16 },
              { type: 'added', content: '      "operation": "save"', newLineNumber: 17 },
              { type: 'added', content: '    }', newLineNumber: 18 },
              { type: 'added', content: '  ]', newLineNumber: 19 },
              { type: 'added', content: '}', newLineNumber: 20 }
            ]
          }
        ]
      })
      break
  }

  return suggestions
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}