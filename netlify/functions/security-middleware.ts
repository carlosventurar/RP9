import { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import { verifySignature } from '../../src/lib/security/hmac'
import { authenticateApiKey } from '../../src/lib/security/apiKeys'
import { rateLimitMiddlewarePhase9 } from '../../src/lib/security/rate-limit'
import { createAuditLogger, AUDIT_ACTIONS } from '../../src/lib/security/audit'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Comprehensive security middleware for Phase 9
 * Validates HMAC, API keys, rate limits, and IP allowlists
 */
export const handler: Handler = async (event) => {
  const headers = event.headers
  const body = event.body || ''
  
  try {
    // 1. HMAC Verification (if X-RP9-Signature present)
    const signature = headers['x-rp9-signature']
    const timestamp = headers['x-rp9-timestamp']
    
    if (signature && timestamp) {
      const isValidHMAC = verifySignature(
        body,
        timestamp,
        signature,
        process.env.HMAC_SECRET!
      )
      
      if (!isValidHMAC) {
        return {
          statusCode: 401,
          body: JSON.stringify({ error: 'Invalid HMAC signature' })
        }
      }
    }

    // 2. API Key Authentication
    const authorization = headers.authorization
    let tenantId = 'unknown'
    let apiKeyPrefix: string | undefined
    
    if (authorization) {
      const authResult = await authenticateApiKey(supabase, authorization, 'read')
      
      if (!authResult.success) {
        return {
          statusCode: 401,
          body: JSON.stringify({ error: authResult.error })
        }
      }
      
      tenantId = authResult.tenant_id!
      
      // Extract API key prefix for rate limiting
      const match = authorization.match(/Bearer\s+rp9_sk_([^_]+)/)
      apiKeyPrefix = match ? match[1] : undefined
    }

    // 3. Rate Limiting
    const clientIP = headers['x-forwarded-for']?.split(',')[0] || 'unknown'
    const rateLimitResult = await rateLimitMiddlewarePhase9(
      supabase,
      tenantId,
      apiKeyPrefix,
      clientIP
    )
    
    if (!rateLimitResult.success) {
      // Log rate limit exceeded
      const audit = createAuditLogger(supabase, {
        tenant_id: tenantId,
        ip: clientIP,
        api_key_prefix: apiKeyPrefix
      })
      
      await audit.logBlocked(
        AUDIT_ACTIONS.RATE_LIMIT_EXCEEDED,
        'api_endpoint',
        event.path,
        `Limit: ${rateLimitResult.limit}/min`
      )
      
      return {
        statusCode: 429,
        headers: {
          'X-RateLimit-Limit': rateLimitResult.limit.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': Math.ceil(rateLimitResult.resetTime / 1000).toString(),
          'Retry-After': rateLimitResult.retryAfter?.toString() || '60'
        },
        body: JSON.stringify({ 
          error: 'Rate limit exceeded',
          retryAfter: rateLimitResult.retryAfter 
        })
      }
    }

    // 4. IP Allowlist Check (if configured)
    if (process.env.IP_ALLOWLIST_ENABLED === 'true') {
      const { data: allowedIPs } = await supabase
        .from('ip_allowlist')
        .select('cidr')
        .eq('tenant_id', tenantId)
      
      if (allowedIPs && allowedIPs.length > 0) {
        const isIPAllowed = allowedIPs.some((entry: any) => {
          // Simple CIDR check - in production use proper CIDR library
          return entry.cidr === clientIP || entry.cidr.startsWith(clientIP.split('.').slice(0, 3).join('.'))
        })
        
        if (!isIPAllowed) {
          const audit = createAuditLogger(supabase, {
            tenant_id: tenantId,
            ip: clientIP,
            api_key_prefix: apiKeyPrefix
          })
          
          await audit.logBlocked(
            AUDIT_ACTIONS.SECURITY_IP_BLOCKED,
            'ip_allowlist',
            clientIP,
            'IP not in allowlist'
          )
          
          return {
            statusCode: 403,
            body: JSON.stringify({ error: 'IP address not allowed' })
          }
        }
      }
    }

    // 5. Success - return security context
    return {
      statusCode: 200,
      headers: {
        'X-RateLimit-Limit': rateLimitResult.limit.toString(),
        'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
        'X-RateLimit-Reset': Math.ceil(rateLimitResult.resetTime / 1000).toString(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        authenticated: !!authorization,
        tenantId,
        rateLimit: {
          remaining: rateLimitResult.remaining,
          limit: rateLimitResult.limit,
          resetTime: rateLimitResult.resetTime
        },
        security: {
          hmacVerified: !!signature,
          ipAllowed: true,
          timestamp: new Date().toISOString()
        }
      })
    }

  } catch (error) {
    console.error('Security middleware error:', error)
    
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Internal security error',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
}

export default handler