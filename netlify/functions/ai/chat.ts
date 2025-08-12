import { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface ChatRequest {
  message: string
  tenantId: string
  conversationId?: string
  context?: {
    currentWorkflow?: any
    recentErrors?: any[]
    userRole?: string
    preferences?: Record<string, any>
  }
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: string
  metadata?: Record<string, any>
}

const systemPrompts = {
  assistant_chat: `Eres el AI Assistant de RP9, un experto en automatización empresarial con n8n. Tu personalidad es profesional pero amigable, y siempre respondes en español.

CAPACIDADES:
1. **Soporte técnico**: Ayudo con configuración, debugging y optimización de workflows
2. **Consultoría**: Sugiero mejores prácticas y arquitecturas de automatización
3. **Educación**: Explico conceptos complejos de forma simple
4. **Generación**: Puedo crear workflows, documentación y scripts

CONTEXTO DE RP9:
- Plataforma de automatización empresarial basada en n8n
- Enfoque en LatAm con soporte primario en español
- Integra con múltiples APIs: CRMs, ERPs, contabilidad, etc.
- Planes: Starter, Pro, Enterprise con diferentes límites

PERSONALIDAD:
- Profesional pero cercano
- Proactivo en sugerir mejoras
- Paciente para explicar conceptos técnicos
- Orientado a soluciones prácticas

EJEMPLOS DE RESPUESTA:
- Si pregunta técnica → Explicación clara + pasos específicos
- Si necesita workflow → Ofrezco generarlo o mejorarlo
- Si reporta error → Solicito logs y analizo el problema
- Si busca consejo → Doy recomendaciones basadas en mejores prácticas

LÍMITES:
- No puedo ejecutar código directamente
- No tengo acceso a credenciales del usuario
- No puedo modificar workflows sin confirmación
- Siempre sugiero validar cambios en entorno de pruebas`
}

async function callOpenAI(
  message: string, 
  conversationHistory: ChatMessage[], 
  context?: any
): Promise<string> {
  const messages = [
    {
      role: 'system',
      content: systemPrompts.assistant_chat
    }
  ]

  // Agregar contexto si está disponible
  if (context) {
    messages.push({
      role: 'system',
      content: `Contexto actual del usuario:
      
${JSON.stringify(context, null, 2)}

Usa esta información para proporcionar respuestas más relevantes y personalizadas.`
    })
  }

  // Agregar historial de conversación (último 10 mensajes)
  const recentHistory = conversationHistory.slice(-10)
  messages.push(...recentHistory.map(msg => ({
    role: msg.role,
    content: msg.content
  })))

  // Agregar mensaje actual del usuario
  messages.push({
    role: 'user',
    content: message
  })

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.AI_MODEL_PRIMARY || 'gpt-4-turbo-preview',
      messages,
      temperature: 0.7,
      max_tokens: 1000
    })
  })

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.statusText}`)
  }

  const data = await response.json()
  return data.choices[0].message.content
}

function detectIntent(message: string): {
  intent: 'question' | 'help' | 'generate' | 'debug' | 'optimize' | 'general'
  confidence: number
} {
  const message_lower = message.toLowerCase()

  // Patrones para detectar intención
  const patterns = {
    generate: [
      'generar', 'crear', 'hacer', 'construir', 'workflow', 'automatización',
      'puedes crear', 'necesito un workflow', 'automatizar'
    ],
    debug: [
      'error', 'fallo', 'problema', 'no funciona', 'debugging', 'arreglar',
      'ayuda con', 'qué pasa', 'por qué no'
    ],
    optimize: [
      'optimizar', 'mejorar', 'más rápido', 'performance', 'lento',
      'eficiencia', 'mejor práctica'
    ],
    question: [
      'qué es', 'cómo', 'cuándo', 'dónde', 'por qué', 'explicar',
      'diferencia', 'significa'
    ],
    help: [
      'ayuda', 'ayudar', 'soporte', 'asistencia', 'guía', 'tutorial'
    ]
  }

  let bestMatch = { intent: 'general' as const, confidence: 0 }

  for (const [intent, keywords] of Object.entries(patterns)) {
    const matches = keywords.filter(keyword => message_lower.includes(keyword))
    const confidence = matches.length / keywords.length

    if (confidence > bestMatch.confidence) {
      bestMatch = { intent: intent as any, confidence }
    }
  }

  return bestMatch
}

async function getConversationHistory(conversationId: string, tenantId: string): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from('ai_conversations')
    .select('messages')
    .eq('id', conversationId)
    .eq('tenant_id', tenantId)
    .single()

  if (error || !data) {
    return []
  }

  return data.messages || []
}

async function createOrUpdateConversation(
  conversationId: string | undefined,
  tenantId: string,
  userId: string,
  userMessage: string,
  assistantResponse: string,
  context?: any
): Promise<string> {
  const timestamp = new Date().toISOString()
  
  if (conversationId) {
    // Actualizar conversación existente
    const currentHistory = await getConversationHistory(conversationId, tenantId)
    
    const updatedMessages = [
      ...currentHistory,
      {
        role: 'user' as const,
        content: userMessage,
        timestamp,
        metadata: { context }
      },
      {
        role: 'assistant' as const,
        content: assistantResponse,
        timestamp: new Date().toISOString()
      }
    ]

    await supabase
      .from('ai_conversations')
      .update({
        messages: updatedMessages,
        updated_at: new Date().toISOString()
      })
      .eq('id', conversationId)
      .eq('tenant_id', tenantId)

    return conversationId
  } else {
    // Crear nueva conversación
    const { data, error } = await supabase
      .from('ai_conversations')
      .insert({
        tenant_id: tenantId,
        user_id: userId,
        type: 'chat',
        messages: [
          {
            role: 'user',
            content: userMessage,
            timestamp,
            metadata: { context }
          },
          {
            role: 'assistant',
            content: assistantResponse,
            timestamp: new Date().toISOString()
          }
        ],
        metadata: { context }
      })
      .select('id')
      .single()

    if (error) {
      throw new Error(`Error creating conversation: ${error.message}`)
    }

    return data.id
  }
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
      message, 
      tenantId, 
      conversationId,
      context 
    }: ChatRequest = JSON.parse(event.body || '{}')

    if (!message || !tenantId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'message y tenantId son requeridos' })
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

    // Verificar límites de chat por plan
    const planLimits = {
      starter: { chatMessagesPerDay: 50 },
      pro: { chatMessagesPerDay: 500 },
      enterprise: { chatMessagesPerDay: -1 } // ilimitado
    }

    const currentLimit = planLimits[tenant.plan as keyof typeof planLimits] || planLimits.starter

    if (currentLimit.chatMessagesPerDay > 0) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const { data: todayChats } = await supabase
        .from('ai_conversations')
        .select('messages')
        .eq('tenant_id', tenantId)
        .eq('type', 'chat')
        .gte('updated_at', today.toISOString())

      const todayMessageCount = todayChats?.reduce((total, conv) => 
        total + (conv.messages?.filter((m: any) => m.role === 'user').length || 0), 0
      ) || 0

      if (todayMessageCount >= currentLimit.chatMessagesPerDay) {
        return {
          statusCode: 429,
          headers,
          body: JSON.stringify({ 
            error: 'Límite diario de mensajes de chat alcanzado',
            currentUsage: todayMessageCount,
            limit: currentLimit.chatMessagesPerDay
          })
        }
      }
    }

    // Obtener historial de conversación si existe
    const conversationHistory = conversationId ? 
      await getConversationHistory(conversationId, tenantId) : []

    // Detectar intención del mensaje
    const intent = detectIntent(message)

    // Enriquecer contexto con información del tenant y usuario
    const enrichedContext = {
      ...context,
      tenant: {
        plan: tenant.plan,
        id: tenantId
      },
      user: {
        id: user.id,
        email: user.email
      },
      intent,
      conversationLength: conversationHistory.length
    }

    // Generar respuesta con IA
    const assistantResponse = await callOpenAI(
      message, 
      conversationHistory, 
      enrichedContext
    )

    // Guardar conversación
    const finalConversationId = await createOrUpdateConversation(
      conversationId,
      tenantId,
      user.id,
      message,
      assistantResponse,
      enrichedContext
    )

    return {
      statusCode: 200,
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        conversationId: finalConversationId,
        response: assistantResponse,
        intent: intent,
        context: {
          messageCount: conversationHistory.length + 2,
          remainingMessages: currentLimit.chatMessagesPerDay === -1 ? 
            'unlimited' : 
            currentLimit.chatMessagesPerDay - (conversationHistory.filter(m => m.role === 'user').length + 1)
        }
      })
    }

  } catch (error: any) {
    console.error('AI Chat Error:', error)
    
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