import { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

// Validación de entrada para feedback
const feedbackSchema = z.object({
  articleId: z.string().uuid(),
  rating: z.number().int().min(1).max(5).optional(),
  isHelpful: z.boolean().optional(),
  comment: z.string().max(1000).optional(),
  userEmail: z.string().email().optional(),
  userAgent: z.string().optional()
}).refine(data => data.rating !== undefined || data.isHelpful !== undefined, {
  message: "Debe proporcionar al menos un rating o indicar si fue útil"
})

// Función para detectar spam básico
function detectSpam(comment: string = '', userAgent: string = '', ipAddress: string = ''): boolean {
  const spamKeywords = ['viagra', 'casino', 'loan', 'bitcoin', 'crypto', 'investment', 'earn money']
  const commentLower = comment.toLowerCase()
  
  // Verificar palabras spam
  const hasSpamKeywords = spamKeywords.some(keyword => commentLower.includes(keyword))
  
  // Verificar si el comentario es demasiado corto pero sospechoso
  if (comment.length < 10 && /[a-z]+\.[a-z]+/.test(commentLower)) {
    return true
  }
  
  // Verificar user agent sospechoso
  if (userAgent.includes('bot') || userAgent.includes('crawler')) {
    return true
  }
  
  return hasSpamKeywords
}

// Función para obtener IP real del request
function getRealIP(event: any): string {
  return event.headers['cf-connecting-ip'] || 
         event.headers['x-forwarded-for']?.split(',')[0] || 
         event.headers['x-real-ip'] || 
         event.headers['x-client-ip'] || 
         'unknown'
}

// Función para limitar rate por IP
async function checkRateLimit(supabase: any, ipAddress: string): Promise<boolean> {
  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    
    const { data, error } = await supabase
      .from('kb_feedback')
      .select('id')
      .eq('ip_address', ipAddress)
      .gte('created_at', oneHourAgo)
    
    if (error) {
      console.error('Error checking rate limit:', error)
      return false // En caso de error, permitir (fail open)
    }
    
    // Máximo 10 feedback por IP por hora
    return data.length >= 10
  } catch (error) {
    console.error('Rate limit check failed:', error)
    return false
  }
}

export const handler: Handler = async (event) => {
  // Solo permitir POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Allow': 'POST',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ error: 'Método no permitido' })
    }
  }

  try {
    // Validar variables de entorno
    const supabaseUrl = process.env.SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Configuración de Supabase faltante')
    }

    // Obtener información del request
    const userAgent = event.headers['user-agent'] || ''
    const ipAddress = getRealIP(event)

    // Parsear y validar entrada
    const body = JSON.parse(event.body || '{}')
    const validatedData = feedbackSchema.parse({
      ...body,
      userAgent
    })

    // Inicializar Supabase
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Verificar rate limiting
    const isRateLimited = await checkRateLimit(supabase, ipAddress)
    if (isRateLimited) {
      return {
        statusCode: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': '3600' // 1 hora
        },
        body: JSON.stringify({
          ok: false,
          error: 'Demasiados feedback enviados. Intenta más tarde.',
          retryAfter: 3600
        })
      }
    }

    // Verificar que el artículo existe
    const { data: article, error: articleError } = await supabase
      .from('kb_articles')
      .select('id, title, status')
      .eq('id', validatedData.articleId)
      .single()

    if (articleError || !article) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ok: false,
          error: 'Artículo no encontrado'
        })
      }
    }

    if (article.status !== 'published') {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ok: false,
          error: 'Artículo no disponible'
        })
      }
    }

    // Detectar spam
    const isSpam = detectSpam(validatedData.comment || '', userAgent, ipAddress)
    
    if (isSpam) {
      // Log spam pero no fallar
      console.warn('Spam feedback detected', {
        articleId: validatedData.articleId,
        ipAddress,
        userAgent,
        comment: validatedData.comment
      })
      
      // Responder como exitoso para no dar pistas al spammer
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ok: true,
          message: 'Feedback registrado'
        })
      }
    }

    // Insertar feedback
    const feedbackData = {
      article_id: validatedData.articleId,
      rating: validatedData.rating || null,
      is_helpful: validatedData.isHelpful ?? null,
      comment: validatedData.comment || null,
      user_email: validatedData.userEmail || null,
      user_agent: userAgent,
      ip_address: ipAddress
    }

    const { data: feedback, error: insertError } = await supabase
      .from('kb_feedback')
      .insert(feedbackData)
      .select()
      .single()

    if (insertError) {
      throw new Error(`Error al guardar feedback: ${insertError.message}`)
    }

    // Actualizar contadores en el artículo
    if (validatedData.isHelpful !== undefined) {
      const incrementField = validatedData.isHelpful ? 'helpful_count' : 'not_helpful_count'
      
      await supabase
        .from('kb_articles')
        .update({
          [incrementField]: article[incrementField] + 1
        })
        .eq('id', validatedData.articleId)
    }

    // Log exitoso
    console.log('KB feedback created successfully', {
      feedbackId: feedback.id,
      articleId: validatedData.articleId,
      rating: validatedData.rating,
      isHelpful: validatedData.isHelpful,
      hasComment: !!validatedData.comment,
      ipAddress
    })

    // Respuesta exitosa
    return {
      statusCode: 201,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ok: true,
        feedback: {
          id: feedback.id,
          rating: feedback.rating,
          isHelpful: feedback.is_helpful,
          hasComment: !!feedback.comment,
          createdAt: feedback.created_at
        },
        message: 'Gracias por tu feedback'
      })
    }

  } catch (error: any) {
    console.error('Error in kb-feedback function:', error)

    // Manejo de errores de validación
    if (error instanceof z.ZodError) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ok: false,
          error: 'Datos de entrada inválidos',
          details: error.errors
        })
      }
    }

    // Error genérico
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ok: false,
        error: 'Error interno del servidor',
        message: error.message
      })
    }
  }
}