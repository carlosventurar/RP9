import { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

// Configuración Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Configuración externa
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL
const PUBLIC_ENABLED = process.env.FEATURE_REQUESTS_PUBLIC_ENABLED === 'true'
const VOTING_ENABLED = process.env.FEATURE_REQUESTS_VOTING_ENABLED === 'true'
const ANONYMOUS_ENABLED = process.env.FEATURE_REQUESTS_ANONYMOUS_ENABLED === 'true'

// Schemas de validación
const createRequestSchema = z.object({
  action: z.literal('create'),
  title: z.string().min(5).max(200),
  description: z.string().min(10).max(2000),
  category: z.enum(['integration', 'workflow', 'ui_ux', 'performance', 'security', 'api', 'mobile', 'other']),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  tenantId: z.string().uuid().optional(),
  userEmail: z.string().email().optional(),
  userName: z.string().max(100).optional(),
  anonymous: z.boolean().default(false),
  tags: z.array(z.string().max(50)).max(10).default([]),
  businessJustification: z.string().max(1000).optional(),
  expectedBenefit: z.string().max(500).optional()
})

const voteSchema = z.object({
  action: z.literal('vote'),
  requestId: z.string().uuid(),
  tenantId: z.string().uuid().optional(),
  userEmail: z.string().email().optional(),
  voteType: z.enum(['up', 'down', 'remove']).default('up')
})

const updateRequestSchema = z.object({
  action: z.literal('update'),
  requestId: z.string().uuid(),
  status: z.enum(['open', 'under_review', 'planned', 'in_progress', 'completed', 'declined']).optional(),
  adminNotes: z.string().max(1000).optional(),
  estimatedDevelopment: z.string().max(100).optional(),
  plannedRelease: z.string().optional(),
  declineReason: z.string().max(500).optional(),
  priority: z.enum(['low', 'medium', 'high']).optional()
})

const listRequestsSchema = z.object({
  action: z.literal('list'),
  status: z.enum(['open', 'under_review', 'planned', 'in_progress', 'completed', 'declined']).optional(),
  category: z.enum(['integration', 'workflow', 'ui_ux', 'performance', 'security', 'api', 'mobile', 'other']).optional(),
  tenantId: z.string().uuid().optional(),
  sortBy: z.enum(['created', 'votes', 'priority', 'title']).default('votes'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0)
})

const analyticsSchema = z.object({
  action: z.literal('analytics'),
  timeframe: z.enum(['week', 'month', 'quarter', 'year']).default('month'),
  includeVotes: z.boolean().default(true),
  includeCategories: z.boolean().default(true)
})

// Types
interface CreateRequestData {
  title: string
  description: string
  category: string
  priority: string
  tenantId?: string
  userEmail?: string
  userName?: string
  anonymous: boolean
  tags: string[]
  businessJustification?: string
  expectedBenefit?: string
}

interface VoteData {
  requestId: string
  tenantId?: string
  userEmail?: string
  voteType: 'up' | 'down' | 'remove'
}

interface UpdateRequestData {
  requestId: string
  status?: string
  adminNotes?: string
  estimatedDevelopment?: string
  plannedRelease?: string
  declineReason?: string
  priority?: string
}

interface ListRequestsData {
  status?: string
  category?: string
  tenantId?: string
  sortBy: string
  sortOrder: string
  limit: number
  offset: number
}

// Funciones auxiliares
async function validateRateLimit(identifier: string, action: string): Promise<boolean> {
  const key = `rate_limit:${action}:${identifier}`
  const window = action === 'create' ? 3600 : 60 // 1 hora para crear, 1 min para votar
  const maxRequests = action === 'create' ? 3 : 30

  // TODO: Implementar rate limiting real con Redis
  // Por ahora usar simple check en memoria/DB
  const { data: existing } = await supabase
    .from('rate_limits')
    .select('count, window_start')
    .eq('key', key)
    .single()

  const now = Date.now()
  const windowMs = window * 1000

  if (existing) {
    const windowStart = new Date(existing.window_start).getTime()
    if (now - windowStart < windowMs) {
      if (existing.count >= maxRequests) {
        return false
      }
      // Incrementar contador
      await supabase
        .from('rate_limits')
        .update({ count: existing.count + 1 })
        .eq('key', key)
    } else {
      // Nueva ventana
      await supabase
        .from('rate_limits')
        .upsert({
          key,
          count: 1,
          window_start: new Date(now).toISOString()
        })
    }
  } else {
    // Primera vez
    await supabase
      .from('rate_limits')
      .insert({
        key,
        count: 1,
        window_start: new Date(now).toISOString()
      })
  }

  return true
}

async function detectSpam(title: string, description: string): Promise<boolean> {
  const spamKeywords = [
    'free money', 'click here', 'urgent', 'act now', 'limited time',
    'make money fast', 'work from home', 'no cost', 'risk free'
  ]
  
  const content = (title + ' ' + description).toLowerCase()
  
  // Check for spam keywords
  const hasSpamKeywords = spamKeywords.some(keyword => content.includes(keyword))
  
  // Check for excessive caps
  const capsRatio = (content.match(/[A-Z]/g) || []).length / content.length
  const excessiveCaps = capsRatio > 0.5
  
  // Check for repeated characters
  const hasRepeatedChars = /(.)\1{4,}/.test(content)
  
  return hasSpamKeywords || excessiveCaps || hasRepeatedChars
}

async function getTenantInfo(tenantId: string) {
  const { data: tenant, error } = await supabase
    .from('tenants')
    .select('name, plan, email')
    .eq('id', tenantId)
    .single()

  if (error) return null
  return tenant
}

async function createFeatureRequest(data: CreateRequestData) {
  // Validaciones de seguridad
  if (!PUBLIC_ENABLED && !data.tenantId) {
    throw new Error('Public feature requests are disabled')
  }

  if (data.anonymous && !ANONYMOUS_ENABLED) {
    throw new Error('Anonymous requests are disabled')
  }

  // Rate limiting
  const identifier = data.tenantId || data.userEmail || 'anonymous'
  if (!await validateRateLimit(identifier, 'create')) {
    throw new Error('Rate limit exceeded. Please try again later.')
  }

  // Spam detection
  if (await detectSpam(data.title, data.description)) {
    throw new Error('Request appears to be spam and has been blocked')
  }

  // Obtener info del tenant si existe
  let tenantInfo = null
  if (data.tenantId) {
    tenantInfo = await getTenantInfo(data.tenantId)
  }

  // Crear feature request
  const { data: featureRequest, error } = await supabase
    .from('feature_requests')
    .insert({
      title: data.title,
      description: data.description,
      category: data.category,
      priority: data.priority,
      tenant_id: data.tenantId,
      user_email: data.anonymous ? null : data.userEmail,
      user_name: data.anonymous ? 'Usuario Anónimo' : (data.userName || 'Usuario'),
      anonymous: data.anonymous,
      tags: data.tags,
      business_justification: data.businessJustification,
      expected_benefit: data.expectedBenefit,
      status: 'open',
      vote_count: 0,
      created_at: new Date().toISOString(),
      metadata: {
        tenant_info: tenantInfo,
        user_agent: '', // TODO: Get from headers
        ip_hash: '', // TODO: Hash IP for tracking
        spam_score: 0
      }
    })
    .select()
    .single()

  if (error) throw new Error(`Failed to create feature request: ${error.message}`)

  // Notificar al equipo
  await notifyNewFeatureRequest(featureRequest, tenantInfo)

  return featureRequest
}

async function voteOnRequest(data: VoteData) {
  if (!VOTING_ENABLED) {
    throw new Error('Voting is disabled')
  }

  // Rate limiting
  const identifier = data.tenantId || data.userEmail || 'anonymous'
  if (!await validateRateLimit(identifier, 'vote')) {
    throw new Error('Rate limit exceeded for voting')
  }

  // Verificar que el request existe
  const { data: request, error: requestError } = await supabase
    .from('feature_requests')
    .select('id, title, vote_count')
    .eq('id', data.requestId)
    .single()

  if (requestError || !request) {
    throw new Error('Feature request not found')
  }

  // Verificar si ya votó
  const { data: existingVote } = await supabase
    .from('feature_request_votes')
    .select('id, vote_type')
    .eq('request_id', data.requestId)
    .eq('tenant_id', data.tenantId || null)
    .eq('user_email', data.userEmail || null)
    .single()

  let voteChange = 0

  if (data.voteType === 'remove') {
    if (existingVote) {
      // Remover voto existente
      await supabase
        .from('feature_request_votes')
        .delete()
        .eq('id', existingVote.id)

      voteChange = existingVote.vote_type === 'up' ? -1 : 1
    }
  } else {
    if (existingVote) {
      if (existingVote.vote_type === data.voteType) {
        throw new Error('You have already voted')
      }
      
      // Cambiar voto existente
      await supabase
        .from('feature_request_votes')
        .update({
          vote_type: data.voteType,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingVote.id)

      voteChange = data.voteType === 'up' ? 2 : -2 // Cambio de down a up o viceversa
    } else {
      // Nuevo voto
      await supabase
        .from('feature_request_votes')
        .insert({
          request_id: data.requestId,
          tenant_id: data.tenantId,
          user_email: data.userEmail,
          vote_type: data.voteType,
          created_at: new Date().toISOString()
        })

      voteChange = data.voteType === 'up' ? 1 : -1
    }
  }

  // Actualizar contador de votos
  const newVoteCount = Math.max(0, request.vote_count + voteChange)
  
  const { data: updatedRequest, error: updateError } = await supabase
    .from('feature_requests')
    .update({
      vote_count: newVoteCount,
      updated_at: new Date().toISOString()
    })
    .eq('id', data.requestId)
    .select()
    .single()

  if (updateError) throw new Error(`Failed to update vote count: ${updateError.message}`)

  return {
    request: updatedRequest,
    voteChange,
    newVoteCount
  }
}

async function updateFeatureRequest(data: UpdateRequestData) {
  const { requestId, ...updateData } = data

  // Verificar que existe
  const { data: existingRequest, error: fetchError } = await supabase
    .from('feature_requests')
    .select('*, tenants(name)')
    .eq('id', requestId)
    .single()

  if (fetchError || !existingRequest) {
    throw new Error('Feature request not found')
  }

  // Actualizar
  const { data: updatedRequest, error } = await supabase
    .from('feature_requests')
    .update({
      ...updateData,
      updated_at: new Date().toISOString()
    })
    .eq('id', requestId)
    .select()
    .single()

  if (error) throw new Error(`Failed to update feature request: ${error.message}`)

  // Notificar cambios importantes de estado
  if (updateData.status && updateData.status !== existingRequest.status) {
    await notifyStatusChange(updatedRequest, existingRequest, updateData.status)
  }

  return updatedRequest
}

async function listFeatureRequests(data: ListRequestsData) {
  let query = supabase
    .from('feature_requests')
    .select(`
      *,
      tenants(name, plan),
      feature_request_votes(vote_type)
    `)

  // Aplicar filtros
  if (data.status) {
    query = query.eq('status', data.status)
  }

  if (data.category) {
    query = query.eq('category', data.category)
  }

  if (data.tenantId) {
    query = query.eq('tenant_id', data.tenantId)
  }

  // Ordenamiento
  const orderColumn = data.sortBy === 'votes' ? 'vote_count' : 
                     data.sortBy === 'created' ? 'created_at' : 
                     data.sortBy === 'priority' ? 'priority' : 'title'

  const { data: requests, error, count } = await query
    .order(orderColumn, { ascending: data.sortOrder === 'asc' })
    .range(data.offset, data.offset + data.limit - 1)

  if (error) throw new Error(`Failed to fetch feature requests: ${error.message}`)

  // Agregar info de votación del usuario si está autenticado
  // TODO: Implementar basado en tenantId o userEmail

  return {
    requests: requests || [],
    totalCount: count || 0,
    hasMore: (requests?.length || 0) === data.limit
  }
}

async function getAnalytics(timeframe: string, includeVotes: boolean, includeCategories: boolean) {
  const timeframeMap = {
    week: 7,
    month: 30,
    quarter: 90,
    year: 365
  }

  const days = timeframeMap[timeframe] || 30
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  // Estadísticas básicas
  const { data: requests, error } = await supabase
    .from('feature_requests')
    .select('category, status, vote_count, created_at, tenant_id')
    .gte('created_at', startDate)

  if (error) throw new Error(`Failed to fetch analytics: ${error.message}`)

  const analytics = {
    totalRequests: requests.length,
    byStatus: {} as Record<string, number>,
    byCategory: {} as Record<string, number>,
    totalVotes: 0,
    averageVotes: 0,
    topRequests: [],
    growthTrend: 'stable'
  }

  // Agrupar por estado
  requests.forEach(req => {
    analytics.byStatus[req.status] = (analytics.byStatus[req.status] || 0) + 1
    if (includeCategories) {
      analytics.byCategory[req.category] = (analytics.byCategory[req.category] || 0) + 1
    }
    analytics.totalVotes += req.vote_count
  })

  analytics.averageVotes = requests.length > 0 ? 
    Math.round(analytics.totalVotes / requests.length * 10) / 10 : 0

  // Top requests si se incluyen votos
  if (includeVotes) {
    const { data: topRequests } = await supabase
      .from('feature_requests')
      .select('id, title, vote_count, status')
      .gte('created_at', startDate)
      .order('vote_count', { ascending: false })
      .limit(5)

    analytics.topRequests = topRequests || []
  }

  return analytics
}

// Funciones de notificación
async function notifyNewFeatureRequest(request: any, tenantInfo: any) {
  if (!SLACK_WEBHOOK_URL) return

  const slackMessage = {
    text: `💡 New Feature Request: ${request.title}`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*💡 New Feature Request*\n\n*Title:* ${request.title}\n*Category:* ${request.category.replace('_', ' ').toUpperCase()}\n*Priority:* ${request.priority.toUpperCase()}\n*From:* ${tenantInfo ? `${tenantInfo.name} (${tenantInfo.plan})` : request.user_name || 'Anonymous'}`
        }
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Description:*\n${request.description.substring(0, 200)}${request.description.length > 200 ? '...' : ''}`
        }
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "Review Request"
            },
            url: `${process.env.FRONTEND_URL}/admin/feature-requests/${request.id}`
          },
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "View Public Portal"
            },
            url: `${process.env.FRONTEND_URL}/feature-requests`
          }
        ]
      }
    ]
  }

  try {
    await fetch(SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(slackMessage)
    })
  } catch (error) {
    console.error('Error sending feature request notification:', error)
  }
}

async function notifyStatusChange(request: any, previousRequest: any, newStatus: string) {
  if (!SLACK_WEBHOOK_URL) return

  const statusEmojis = {
    open: '🆕',
    under_review: '👀',
    planned: '📋',
    in_progress: '⚙️',
    completed: '✅',
    declined: '❌'
  }

  const slackMessage = {
    text: `${statusEmojis[newStatus]} Feature Request Status Updated: ${request.title}`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*${statusEmojis[newStatus]} Status Updated*\n\n*Request:* ${request.title}\n*Status:* ${previousRequest.status} → ${newStatus}\n*Votes:* ${request.vote_count}`
        }
      }
    ]
  }

  // Notificar al usuario si tiene email y no es anónimo
  if (!request.anonymous && request.user_email) {
    // TODO: Enviar email al usuario
    console.log(`Would notify ${request.user_email} about status change to ${newStatus}`)
  }

  try {
    await fetch(SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(slackMessage)
    })
  } catch (error) {
    console.error('Error sending status change notification:', error)
  }
}

// Handler principal
export const handler: Handler = async (event) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
  }

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' }
  }

  try {
    if (!event.body) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Request body is required' })
      }
    }

    const requestData = JSON.parse(event.body)
    
    // Determinar acción
    switch (requestData.action) {
      case 'create': {
        const validatedData = createRequestSchema.parse(requestData)
        const featureRequest = await createFeatureRequest(validatedData)
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            request: featureRequest,
            message: 'Feature request created successfully'
          })
        }
      }

      case 'vote': {
        const validatedData = voteSchema.parse(requestData)
        const result = await voteOnRequest(validatedData)
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            ...result,
            message: `Vote ${validatedData.voteType === 'remove' ? 'removed' : 'recorded'} successfully`
          })
        }
      }

      case 'update': {
        const validatedData = updateRequestSchema.parse(requestData)
        const featureRequest = await updateFeatureRequest(validatedData)
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            request: featureRequest,
            message: 'Feature request updated successfully'
          })
        }
      }

      case 'list': {
        const validatedData = listRequestsSchema.parse(requestData)
        const result = await listFeatureRequests(validatedData)
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            ...result
          })
        }
      }

      case 'analytics': {
        const validatedData = analyticsSchema.parse(requestData)
        const analytics = await getAnalytics(
          validatedData.timeframe,
          validatedData.includeVotes,
          validatedData.includeCategories
        )
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            analytics
          })
        }
      }

      default:
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Invalid action. Must be: create, vote, update, list, or analytics' })
        }
    }

  } catch (error) {
    console.error('Feature requests function error:', error)
    
    if (error instanceof z.ZodError) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Validation failed',
          details: error.errors
        })
      }
    }

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
}