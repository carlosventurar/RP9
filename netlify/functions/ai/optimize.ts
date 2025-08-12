import { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface OptimizationRequest {
  workflowId: string
  tenantId: string
  workflowData: any
  executionHistory?: Array<{
    executionId: string
    duration: number
    status: string
    timestamp: string
    nodeStats?: Record<string, any>
  }>
}

interface OptimizationSuggestion {
  type: 'performance' | 'reliability' | 'cost' | 'maintainability'
  priority: 'low' | 'medium' | 'high' | 'critical'
  title: string
  description: string
  impact: {
    performance?: string
    cost?: string
    reliability?: string
  }
  implementation: {
    difficulty: 'easy' | 'medium' | 'hard'
    estimatedTime: number
    steps: string[]
    codeChanges?: Array<{
      nodeId: string
      nodeName: string
      currentConfig: any
      suggestedConfig: any
      reason: string
    }>
  }
  metrics: {
    expectedSpeedup?: string
    expectedCostReduction?: string
    expectedErrorReduction?: string
  }
}

const systemPrompts = {
  workflow_optimizer: `Eres un experto en optimización de workflows n8n. Tu trabajo es analizar workflows y proporcionar sugerencias específicas de optimización en español.

ÁREAS DE OPTIMIZACIÓN:
1. **Performance**: Reducir tiempo de ejecución, optimizar consultas, paralelización
2. **Reliability**: Manejo de errores, reintentos, validación de datos
3. **Cost**: Reducir uso de recursos, optimizar API calls, caching
4. **Maintainability**: Simplificar lógica, mejorar legibilidad, modularización

TIPOS DE OPTIMIZACIONES COMUNES:
- Batch processing para reducir API calls
- Caching de respuestas frecuentes
- Paralelización de tareas independientes
- Optimización de filtros y transformaciones de datos
- Mejora en manejo de errores y reintentos
- Simplificación de lógica compleja

ESTRUCTURA DEL RESPONSE:
{
  "overallScore": 85,
  "summary": {
    "performance": "good",
    "reliability": "excellent", 
    "cost": "fair",
    "maintainability": "good"
  },
  "suggestions": [
    {
      "type": "performance",
      "priority": "high",
      "title": "Título de la sugerencia",
      "description": "Descripción detallada",
      "impact": {
        "performance": "20% más rápido",
        "cost": "30% menos API calls"
      },
      "implementation": {
        "difficulty": "medium",
        "estimatedTime": 1800,
        "steps": ["paso 1", "paso 2"],
        "codeChanges": [
          {
            "nodeId": "node123",
            "nodeName": "HTTP Request",
            "currentConfig": {},
            "suggestedConfig": {},
            "reason": "Explicación del cambio"
          }
        ]
      },
      "metrics": {
        "expectedSpeedup": "2x más rápido",
        "expectedCostReduction": "30% menos requests"
      }
    }
  ],
  "bestPractices": ["práctica 1", "práctica 2"],
  "architecturalRecommendations": ["recomendación 1", "recomendación 2"]
}`
}

async function callOpenAI(workflowData: any, executionHistory?: any[]): Promise<any> {
  const analysisContext = {
    workflow: {
      nodeCount: workflowData.nodes?.length || 0,
      nodeTypes: workflowData.nodes?.map((n: any) => ({
        id: n.id,
        name: n.name,
        type: n.type,
        parameters: Object.keys(n.parameters || {})
      })) || [],
      connectionCount: workflowData.connections ? Object.keys(workflowData.connections).length : 0,
      hasWebhooks: workflowData.nodes?.some((n: any) => n.type === 'n8n-nodes-base.webhook'),
      hasHttpRequests: workflowData.nodes?.some((n: any) => n.type === 'n8n-nodes-base.httpRequest'),
      hasLoops: workflowData.nodes?.some((n: any) => n.type === 'n8n-nodes-base.splitInBatches'),
      hasConditionals: workflowData.nodes?.some((n: any) => n.type === 'n8n-nodes-base.if'),
      hasScheduleTrigger: workflowData.nodes?.some((n: any) => n.type === 'n8n-nodes-base.cron')
    },
    executionStats: executionHistory ? {
      totalExecutions: executionHistory.length,
      averageDuration: executionHistory.reduce((sum, exec) => sum + exec.duration, 0) / executionHistory.length,
      successRate: (executionHistory.filter(exec => exec.status === 'success').length / executionHistory.length) * 100,
      recentExecutions: executionHistory.slice(-10)
    } : null
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.AI_MODEL_PRIMARY || 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: systemPrompts.workflow_optimizer
        },
        {
          role: 'user',
          content: `Analiza este workflow n8n y proporciona sugerencias específicas de optimización:

Workflow JSON:
${JSON.stringify(workflowData, null, 2)}

Contexto de análisis:
${JSON.stringify(analysisContext, null, 2)}`
        }
      ],
      temperature: 0.4,
      max_tokens: 2500,
      response_format: { type: 'json_object' }
    })
  })

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.statusText}`)
  }

  const data = await response.json()
  return JSON.parse(data.choices[0].message.content)
}

async function getExecutionHistory(workflowId: string, tenantId: string, limit: number = 50): Promise<any[]> {
  try {
    // Obtener historial desde n8n
    const n8nResponse = await fetch(
      `${process.env.N8N_BASE_URL}/api/v1/executions?workflowId=${workflowId}&limit=${limit}`,
      {
        headers: {
          'X-N8N-API-KEY': process.env.N8N_API_KEY!,
        },
      }
    )

    if (n8nResponse.ok) {
      const data = await n8nResponse.json()
      return data.data || []
    }
  } catch (error) {
    console.warn('Could not fetch execution history from n8n:', error)
  }

  // Fallback: usar datos de nuestra base de datos
  const { data } = await supabase
    .from('usage_executions')
    .select('execution_id, duration_ms, status, started_at')
    .eq('workflow_id', workflowId)
    .eq('tenant_id', tenantId)
    .order('started_at', { ascending: false })
    .limit(limit)

  return data?.map(exec => ({
    executionId: exec.execution_id,
    duration: exec.duration_ms,
    status: exec.status,
    timestamp: exec.started_at
  })) || []
}

function analyzeWorkflowComplexity(workflowData: any): {
  complexity: 'low' | 'medium' | 'high'
  factors: string[]
  score: number
} {
  let score = 0
  const factors: string[] = []

  const nodeCount = workflowData.nodes?.length || 0
  
  // Factores de complejidad
  if (nodeCount > 20) {
    score += 30
    factors.push(`Workflow grande (${nodeCount} nodos)`)
  } else if (nodeCount > 10) {
    score += 15
    factors.push(`Workflow mediano (${nodeCount} nodos)`)
  }

  const hasLoops = workflowData.nodes?.some((n: any) => 
    n.type === 'n8n-nodes-base.splitInBatches' || 
    n.type === 'n8n-nodes-base.itemLists'
  )
  if (hasLoops) {
    score += 20
    factors.push('Contiene loops/batching')
  }

  const conditionalCount = workflowData.nodes?.filter((n: any) => 
    n.type === 'n8n-nodes-base.if' || 
    n.type === 'n8n-nodes-base.switch'
  ).length || 0
  if (conditionalCount > 3) {
    score += 15
    factors.push(`Múltiples condicionales (${conditionalCount})`)
  }

  const httpRequestCount = workflowData.nodes?.filter((n: any) => 
    n.type === 'n8n-nodes-base.httpRequest'
  ).length || 0
  if (httpRequestCount > 5) {
    score += 10
    factors.push(`Múltiples HTTP requests (${httpRequestCount})`)
  }

  let complexity: 'low' | 'medium' | 'high' = 'low'
  if (score > 50) complexity = 'high'
  else if (score > 25) complexity = 'medium'

  return { complexity, factors, score }
}

export const handler: Handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers }
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Método no permitido' })
    }
  }

  try {
    // Validar autenticación
    const authHeader = event.headers.authorization
    if (!authHeader) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Token de autorización requerido' })
      }
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Token inválido' })
      }
    }

    // Parsear request
    const { 
      workflowId, 
      tenantId, 
      workflowData,
      executionHistory 
    }: OptimizationRequest = JSON.parse(event.body || '{}')

    if (!workflowId || !tenantId || !workflowData) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'workflowId, tenantId y workflowData son requeridos' })
      }
    }

    // Verificar permisos del tenant
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id, plan')
      .eq('id', tenantId)
      .eq('owner_user_id', user.id)
      .single()

    if (tenantError || !tenant) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: 'Acceso denegado al tenant' })
      }
    }

    // Obtener historial de ejecuciones si no se proporcionó
    let execHistory = executionHistory
    if (!execHistory || execHistory.length === 0) {
      execHistory = await getExecutionHistory(workflowId, tenantId)
    }

    // Analizar complejidad del workflow
    const complexityAnalysis = analyzeWorkflowComplexity(workflowData)

    // Crear conversación para el análisis de optimización
    const { data: conversation, error: conversationError } = await supabase
      .from('ai_conversations')
      .insert({
        tenant_id: tenantId,
        user_id: user.id,
        type: 'optimize',
        messages: [{
          role: 'user',
          content: `Optimizar workflow ${workflowId}`,
          timestamp: new Date().toISOString(),
          metadata: { 
            workflowId, 
            complexity: complexityAnalysis,
            executionCount: execHistory?.length || 0
          }
        }],
        metadata: { 
          workflowId,
          complexity: complexityAnalysis,
          nodeCount: workflowData.nodes?.length || 0
        }
      })
      .select()
      .single()

    if (conversationError) {
      throw new Error(`Error creating conversation: ${conversationError.message}`)
    }

    // Analizar optimizaciones con IA
    const optimizationAnalysis = await callOpenAI(workflowData, execHistory)

    // Actualizar conversación con análisis
    await supabase
      .from('ai_conversations')
      .update({
        messages: [
          ...conversation.messages,
          {
            role: 'assistant',
            content: `Análisis de optimización completado`,
            timestamp: new Date().toISOString(),
            metadata: { 
              optimizationAnalysis,
              suggestionCount: optimizationAnalysis.suggestions?.length || 0
            }
          }
        ]
      })
      .eq('id', conversation.id)

    // Registrar el análisis de optimización
    await supabase
      .from('workflow_optimizations')
      .insert({
        tenant_id: tenantId,
        workflow_id: workflowId,
        conversation_id: conversation.id,
        overall_score: optimizationAnalysis.overallScore,
        complexity_analysis: complexityAnalysis,
        optimization_analysis: optimizationAnalysis,
        suggestions_count: optimizationAnalysis.suggestions?.length || 0,
        applied: false
      })

    return {
      statusCode: 200,
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        conversationId: conversation.id,
        workflowId,
        analysis: {
          ...optimizationAnalysis,
          complexity: complexityAnalysis,
          executionHistory: execHistory?.slice(0, 5) // Solo las más recientes para el response
        }
      })
    }

  } catch (error: any) {
    console.error('AI Optimization Error:', error)
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Error interno del servidor',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined
      })
    }
  }
}