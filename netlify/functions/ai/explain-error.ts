import { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface ErrorExplanationRequest {
  executionId: string
  workflowId: string
  tenantId: string
  errorLogs: any[]
  workflowData?: any
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
  }>
  preventionTips: string[]
  relatedDocumentation: Array<{
    title: string
    url: string
  }>
}

const systemPrompts = {
  error_analyzer: `Eres un experto en debugging y análisis de errores en n8n. Tu trabajo es analizar errores de ejecución y proporcionar explicaciones claras y soluciones prácticas en español.

REGLAS IMPORTANTES:
1. Siempre responde en español
2. Clasifica la severidad del error correctamente
3. Proporciona explicaciones que un usuario no técnico pueda entender
4. Sugiere múltiples opciones de solución, ordenadas por facilidad
5. Incluye pasos específicos y accionables
6. Menciona mejores prácticas para prevenir errores similares

TIPOS DE ERRORES COMUNES:
- Errores de conectividad (timeout, connection refused)
- Errores de autenticación (credenciales inválidas, tokens expirados)
- Errores de datos (formato incorrecto, campos faltantes)
- Errores de rate limiting (demasiadas requests)
- Errores de configuración (URLs incorrectas, parámetros faltantes)

ESTRUCTURA DEL RESPONSE:
{
  "errorType": "tipo_del_error",
  "severity": "low|medium|high|critical",
  "explanation": "Explicación clara del error",
  "possibleCauses": ["causa1", "causa2"],
  "suggestedFixes": [
    {
      "title": "Título de la solución",
      "description": "Descripción detallada",
      "difficulty": "easy|medium|hard",
      "estimatedTime": 300,
      "steps": ["paso 1", "paso 2"]
    }
  ],
  "preventionTips": ["tip1", "tip2"],
  "relatedDocumentation": [
    {
      "title": "Título del doc",
      "url": "https://docs.n8n.io/..."
    }
  ]
}`
}

async function callOpenAI(errorLogs: any[], workflowData?: any): Promise<ErrorAnalysis> {
  const errorContext = {
    logs: errorLogs,
    workflow: workflowData ? {
      nodeCount: workflowData.nodes?.length || 0,
      nodeTypes: workflowData.nodes?.map((n: any) => n.type) || [],
      hasWebhooks: workflowData.nodes?.some((n: any) => n.type === 'n8n-nodes-base.webhook'),
      hasHttpRequests: workflowData.nodes?.some((n: any) => n.type === 'n8n-nodes-base.httpRequest')
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
          content: systemPrompts.error_analyzer
        },
        {
          role: 'user',
          content: `Analiza este error de n8n y proporciona una explicación completa:

Logs de error:
${JSON.stringify(errorLogs, null, 2)}

Contexto del workflow:
${JSON.stringify(errorContext, null, 2)}`
        }
      ],
      temperature: 0.3, // Más conservador para análisis técnico
      max_tokens: 1500,
      response_format: { type: 'json_object' }
    })
  })

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.statusText}`)
  }

  const data = await response.json()
  return JSON.parse(data.choices[0].message.content)
}

function extractErrorInfo(errorLogs: any[]): {
  mainError: string
  errorCode?: string
  httpStatus?: number
  nodeName?: string
} {
  let mainError = 'Error desconocido'
  let errorCode: string | undefined
  let httpStatus: number | undefined
  let nodeName: string | undefined

  for (const log of errorLogs) {
    if (log.message) {
      mainError = log.message
    }
    
    if (log.error?.code) {
      errorCode = log.error.code
    }
    
    if (log.error?.status) {
      httpStatus = log.error.status
    }
    
    if (log.node) {
      nodeName = log.node
    }
    
    // Buscar el primer error significativo
    if (log.level === 'error' || log.type === 'error') {
      break
    }
  }

  return { mainError, errorCode, httpStatus, nodeName }
}

async function getWorkflowContext(workflowId: string, tenantId: string): Promise<any> {
  // Intentar obtener información del workflow desde n8n
  try {
    const n8nResponse = await fetch(
      `${process.env.N8N_BASE_URL}/api/v1/workflows/${workflowId}`,
      {
        headers: {
          'X-N8N-API-KEY': process.env.N8N_API_KEY!,
        },
      }
    )

    if (n8nResponse.ok) {
      return await n8nResponse.json()
    }
  } catch (error) {
    console.warn('Could not fetch workflow from n8n:', error)
  }

  // Fallback: buscar en nuestra base de datos
  const { data } = await supabase
    .from('ai_generated_workflows')
    .select('generated_json')
    .eq('workflow_id', workflowId)
    .eq('tenant_id', tenantId)
    .single()

  return data?.generated_json || null
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
      executionId, 
      workflowId, 
      tenantId, 
      errorLogs,
      workflowData 
    }: ErrorExplanationRequest = JSON.parse(event.body || '{}')

    if (!executionId || !workflowId || !tenantId || !errorLogs) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'executionId, workflowId, tenantId y errorLogs son requeridos' })
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

    // Obtener contexto del workflow si no se proporcionó
    let workflowContext = workflowData
    if (!workflowContext && workflowId) {
      workflowContext = await getWorkflowContext(workflowId, tenantId)
    }

    // Crear conversación para el análisis de error
    const { data: conversation, error: conversationError } = await supabase
      .from('ai_conversations')
      .insert({
        tenant_id: tenantId,
        user_id: user.id,
        type: 'debug',
        messages: [{
          role: 'user',
          content: `Analizar error en ejecución ${executionId}`,
          timestamp: new Date().toISOString(),
          metadata: { executionId, workflowId, errorCount: errorLogs.length }
        }],
        metadata: { executionId, workflowId, errorLogs: errorLogs.slice(0, 5) } // Límite para evitar payloads grandes
      })
      .select()
      .single()

    if (conversationError) {
      throw new Error(`Error creating conversation: ${conversationError.message}`)
    }

    // Analizar error con IA
    const errorAnalysis = await callOpenAI(errorLogs, workflowContext)

    // Extraer información básica del error
    const errorInfo = extractErrorInfo(errorLogs)

    // Actualizar conversación con análisis
    await supabase
      .from('ai_conversations')
      .update({
        messages: [
          ...conversation.messages,
          {
            role: 'assistant',
            content: `Análisis completado: ${errorAnalysis.errorType}`,
            timestamp: new Date().toISOString(),
            metadata: { 
              errorAnalysis: {
                ...errorAnalysis,
                basicInfo: errorInfo
              }
            }
          }
        ]
      })
      .eq('id', conversation.id)

    // Registrar el análisis de error (para métricas)
    await supabase
      .from('execution_errors')
      .insert({
        tenant_id: tenantId,
        execution_id: executionId,
        workflow_id: workflowId,
        error_type: errorAnalysis.errorType,
        severity: errorAnalysis.severity,
        main_error: errorInfo.mainError,
        error_code: errorInfo.errorCode,
        http_status: errorInfo.httpStatus,
        node_name: errorInfo.nodeName,
        analysis: errorAnalysis,
        resolved: false
      })
      .select()

    return {
      statusCode: 200,
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        conversationId: conversation.id,
        analysis: {
          ...errorAnalysis,
          basicInfo: errorInfo,
          executionId,
          workflowId
        }
      })
    }

  } catch (error: any) {
    console.error('AI Error Analysis Error:', error)
    
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