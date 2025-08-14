import { FastifyRequest, FastifyReply } from 'fastify'
import { createClient } from '@supabase/supabase-js'
import { config } from '@/utils/config'
import { logger, logError } from '@/utils/logger'

const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY)

export interface AuthenticatedRequest extends FastifyRequest {
  user: {
    id: string
    email: string
  }
  tenant?: {
    id: string
    name: string
    plan: string
  }
  byok?: {
    provider: string
    key: string
  }
}

export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  // Skip auth for health endpoints
  if (request.routerPath?.startsWith('/health')) {
    return
  }

  try {
    // Extract token from Authorization header
    const authHeader = request.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      reply.code(401).send({
        error: 'Unauthorized',
        message: 'Bearer token required'
      })
      return
    }

    const token = authHeader.replace('Bearer ', '')

    // Verify token with Supabase
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      reply.code(401).send({
        error: 'Unauthorized',
        message: 'Invalid token'
      })
      return
    }

    // Add user to request
    const authRequest = request as AuthenticatedRequest
    authRequest.user = {
      id: user.id,
      email: user.email || ''
    }

    // Extract BYOK headers if present
    const byokProvider = request.headers['x-byok-provider'] as string
    const byokKey = request.headers['x-byok-key'] as string

    if (byokProvider && byokKey) {
      if (!config.ALLOW_BYOK) {
        reply.code(403).send({
          error: 'Forbidden',
          message: 'BYOK not enabled for this service'
        })
        return
      }

      // Validate BYOK provider
      const validProviders = ['openai', 'anthropic']
      if (!validProviders.includes(byokProvider)) {
        reply.code(400).send({
          error: 'Bad Request',
          message: `Invalid BYOK provider. Supported: ${validProviders.join(', ')}`
        })
        return
      }

      authRequest.byok = {
        provider: byokProvider,
        key: byokKey
      }

      logger.info({
        userId: user.id,
        byokProvider
      }, 'BYOK authentication detected')
    }

    // For requests that include tenantId, verify tenant access
    const body = request.body as any
    const query = request.query as any
    const tenantId = body?.tenantId || query?.tenantId

    if (tenantId) {
      const { data: tenant, error: tenantError } = await supabase
        .from('tenants')
        .select('id, name, plan')
        .eq('id', tenantId)
        .or(`owner_user_id.eq.${user.id},id.in.(select tenant_id from tenant_members where user_id = '${user.id}')`)
        .single()

      if (tenantError || !tenant) {
        reply.code(403).send({
          error: 'Forbidden',
          message: 'Access denied to tenant'
        })
        return
      }

      authRequest.tenant = tenant
    }

  } catch (error: any) {
    logError(error, { 
      url: request.url,
      method: request.method,
      headers: request.headers
    })
    
    reply.code(500).send({
      error: 'Internal Server Error',
      message: 'Authentication service error'
    })
  }
}