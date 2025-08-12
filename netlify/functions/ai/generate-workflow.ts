import { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface WorkflowGenerationRequest {
  prompt: string
  tenantId: string
  userId: string
  context?: {
    existingWorkflows?: string[]
    integrations?: string[]
    complexity?: 'simple' | 'medium' | 'complex'
  }
}

interface WorkflowNode {
  id: string
  name: string
  type: string
  position: [number, number]
  parameters: Record<string, any>
}

interface GeneratedWorkflow {
  name: string
  nodes: WorkflowNode[]
  connections: Array<{
    node: string
    type: string
    index: number
  }>
  metadata: {
    description: string
    category: string
    difficulty: 'beginner' | 'intermediate' | 'advanced'
    estimatedExecutionTime: number
    requiredCredentials: string[]
  }
}

const systemPrompts = {
  workflow_generator: `Eres un experto en automatización con n8n. Tu trabajo es generar workflows completos y funcionales basados en prompts en español.

REGLAS IMPORTANTES:
1. Siempre genera workflows en formato n8n JSON válido
2. Usa nombres descriptivos en español para nodos
3. Incluye manejo de errores donde sea necesario
4. Optimiza para performance y mejores prácticas
5. Genera un checklist de credenciales necesarias
6. Estima tiempo de ejecución realista

ESTRUCTURA DEL RESPONSE:
{
  "workflow": { /* n8n workflow JSON */ },
  "metadata": {
    "description": "Descripción en español",
    "category": "categoria",
    "difficulty": "beginner|intermediate|advanced",
    "estimatedExecutionTime": 30000,
    "requiredCredentials": ["credential1", "credential2"],
    "setupInstructions": ["paso 1", "paso 2"]
  },
  "validationResults": {
    "isValid": true,
    "warnings": [],
    "suggestions": []
  }
}`
}

async function callOpenAI(prompt: string, context?: any): Promise<any> {
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
          content: systemPrompts.workflow_generator
        },
        {
          role: 'user',
          content: `Genera un workflow para: ${prompt}
          
          Contexto adicional: ${JSON.stringify(context || {}, null, 2)}`
        }
      ],
      temperature: 0.7,
      max_tokens: 2000,
      response_format: { type: 'json_object' }
    })
  })

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.statusText}`)
  }

  const data = await response.json()
  return JSON.parse(data.choices[0].message.content)
}

async function validateWorkflow(workflow: any): Promise<{
  isValid: boolean
  errors: string[]
  warnings: string[]
  suggestions: string[]
}> {
  const errors: string[] = []
  const warnings: string[] = []
  const suggestions: string[] = []

  // Validaciones básicas
  if (!workflow.nodes || !Array.isArray(workflow.nodes)) {
    errors.push('El workflow debe tener un array de nodos')
  }

  if (!workflow.connections) {
    warnings.push('No se definieron conexiones entre nodos')
  }

  // Validar que hay un nodo Start
  const hasStartNode = workflow.nodes?.some((node: any) => 
    node.type === 'n8n-nodes-base.start' || 
    node.type === 'n8n-nodes-base.manualTrigger' ||
    node.type === 'n8n-nodes-base.webhook'
  )

  if (!hasStartNode) {
    errors.push('El workflow debe tener al menos un nodo trigger (Start, Manual Trigger, o Webhook)')
  }

  // Sugerencias de mejores prácticas
  const nodeCount = workflow.nodes?.length || 0
  if (nodeCount > 20) {
    suggestions.push('Considera dividir workflows complejos en sub-workflows más pequeños')
  }

  const hasErrorHandling = workflow.nodes?.some((node: any) => 
    node.type === 'n8n-nodes-base.if' && 
    node.parameters?.conditions?.boolean?.[0]?.leftValue?.includes('error')
  )

  if (!hasErrorHandling && nodeCount > 5) {
    suggestions.push('Considera agregar manejo de errores para workflows complejos')
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    suggestions
  }
}

export const handler: Handler = async (event) => {
  // CORS headers
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
    const { prompt, tenantId, context }: WorkflowGenerationRequest = JSON.parse(event.body || '{}')

    if (!prompt || !tenantId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'prompt y tenantId son requeridos' })
      }
    }

    // Verificar permisos del tenant
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id, name, plan')
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

    // Verificar límites del plan
    const planLimits = {
      starter: { aiGenerationsPerMonth: 10 },
      pro: { aiGenerationsPerMonth: 100 },
      enterprise: { aiGenerationsPerMonth: -1 } // ilimitado
    }

    const currentLimit = planLimits[tenant.plan as keyof typeof planLimits] || planLimits.starter

    if (currentLimit.aiGenerationsPerMonth > 0) {
      const startOfMonth = new Date()
      startOfMonth.setDate(1)
      startOfMonth.setHours(0, 0, 0, 0)

      const { count } = await supabase
        .from('ai_generated_workflows')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .gte('created_at', startOfMonth.toISOString())

      if (count && count >= currentLimit.aiGenerationsPerMonth) {
        return {
          statusCode: 429,
          headers,
          body: JSON.stringify({ 
            error: 'Límite mensual de generaciones IA alcanzado',
            currentUsage: count,
            limit: currentLimit.aiGenerationsPerMonth
          })
        }
      }
    }

    // Crear conversación
    const { data: conversation, error: conversationError } = await supabase
      .from('ai_conversations')
      .insert({
        tenant_id: tenantId,
        user_id: user.id,
        type: 'generate',
        messages: [{ role: 'user', content: prompt, timestamp: new Date().toISOString() }],
        metadata: { context }
      })
      .select()
      .single()

    if (conversationError) {
      throw new Error(`Error creating conversation: ${conversationError.message}`)
    }

    // Generar workflow con IA
    const aiResponse = await callOpenAI(prompt, context)
    
    // Validar workflow generado
    const validationResults = await validateWorkflow(aiResponse.workflow)

    // Guardar workflow generado
    const { data: generatedWorkflow, error: workflowError } = await supabase
      .from('ai_generated_workflows')
      .insert({
        conversation_id: conversation.id,
        tenant_id: tenantId,
        prompt,
        generated_json: aiResponse.workflow,
        validation_results: validationResults,
        metadata: aiResponse.metadata
      })
      .select()
      .single()

    if (workflowError) {
      throw new Error(`Error saving workflow: ${workflowError.message}`)
    }

    // Actualizar conversación con respuesta
    await supabase
      .from('ai_conversations')
      .update({
        messages: [
          ...conversation.messages,
          { 
            role: 'assistant', 
            content: 'Workflow generado exitosamente',
            timestamp: new Date().toISOString(),
            workflowId: generatedWorkflow.id
          }
        ]
      })
      .eq('id', conversation.id)

    return {
      statusCode: 200,
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        conversationId: conversation.id,
        workflowId: generatedWorkflow.id,
        workflow: aiResponse.workflow,
        metadata: aiResponse.metadata,
        validation: validationResults
      })
    }

  } catch (error: any) {
    console.error('AI Generation Error:', error)
    
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