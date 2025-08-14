import { FastifyInstance } from 'fastify'
import { createClient } from '@supabase/supabase-js'
import { config } from '@/utils/config'
import { logger } from '@/utils/logger'

const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY)

export default async function healthRoutes(fastify: FastifyInstance) {
  // Basic health check
  fastify.get('/', async (request, reply) => {
    return {
      status: 'healthy',
      service: 'RP9 AI Assistant',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    }
  })

  // Detailed health check with dependencies
  fastify.get('/detailed', async (request, reply) => {
    const checks = await Promise.allSettled([
      checkSupabase(),
      checkN8N(),
      checkAIProviders(),
      checkMemory(),
      checkDisk()
    ])

    const results = {
      status: 'healthy',
      service: 'RP9 AI Assistant',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      checks: {
        supabase: getCheckResult(checks[0]),
        n8n: getCheckResult(checks[1]),
        aiProviders: getCheckResult(checks[2]),
        memory: getCheckResult(checks[3]),
        disk: getCheckResult(checks[4])
      }
    }

    // Determine overall status
    const hasFailure = Object.values(results.checks).some(check => check.status === 'error')
    const hasWarning = Object.values(results.checks).some(check => check.status === 'warning')
    
    if (hasFailure) {
      results.status = 'unhealthy'
      reply.code(503)
    } else if (hasWarning) {
      results.status = 'degraded'
      reply.code(200)
    }

    return results
  })

  // Readiness check for Kubernetes
  fastify.get('/ready', async (request, reply) => {
    try {
      // Check critical dependencies
      await checkSupabase()
      await checkAIProviders()

      return {
        status: 'ready',
        timestamp: new Date().toISOString()
      }
    } catch (error: any) {
      reply.code(503).send({
        status: 'not ready',
        error: error.message,
        timestamp: new Date().toISOString()
      })
    }
  })

  // Liveness check for Kubernetes
  fastify.get('/live', async (request, reply) => {
    return {
      status: 'alive',
      timestamp: new Date().toISOString()
    }
  })
}

async function checkSupabase() {
  try {
    const { data, error } = await supabase
      .from('tenants')
      .select('count')
      .limit(1)
      .single()

    if (error) throw error

    return {
      status: 'healthy',
      message: 'Supabase connection successful',
      responseTime: Date.now()
    }
  } catch (error: any) {
    throw new Error(`Supabase health check failed: ${error.message}`)
  }
}

async function checkN8N() {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)

    const response = await fetch(`${config.N8N_BASE_URL}/healthz`, {
      method: 'GET',
      headers: {
        'X-N8N-API-KEY': config.N8N_API_KEY
      },
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    return {
      status: 'healthy',
      message: 'n8n connection successful',
      responseTime: Date.now()
    }
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new Error('n8n health check timeout')
    }
    throw new Error(`n8n health check failed: ${error.message}`)
  }
}

async function checkAIProviders() {
  const results: Record<string, any> = {}
  
  // Check OpenAI
  if (config.ENABLED_PROVIDERS.includes('openai') && config.OPENAI_API_KEY) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)

      const response = await fetch('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${config.OPENAI_API_KEY}`
        },
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (response.ok) {
        results.openai = { status: 'healthy', message: 'OpenAI API accessible' }
      } else {
        results.openai = { status: 'error', message: `OpenAI API error: ${response.status}` }
      }
    } catch (error: any) {
      results.openai = { status: 'error', message: `OpenAI API check failed: ${error.message}` }
    }
  }

  // Check Anthropic
  if (config.ENABLED_PROVIDERS.includes('anthropic') && config.ANTHROPIC_API_KEY) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': config.ANTHROPIC_API_KEY,
          'content-type': 'application/json',
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'test' }]
        }),
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (response.status === 200 || response.status === 400) {
        results.anthropic = { status: 'healthy', message: 'Anthropic API accessible' }
      } else {
        results.anthropic = { status: 'error', message: `Anthropic API error: ${response.status}` }
      }
    } catch (error: any) {
      results.anthropic = { status: 'error', message: `Anthropic API check failed: ${error.message}` }
    }
  }

  if (Object.keys(results).length === 0) {
    return { status: 'warning', message: 'No AI providers configured' }
  }

  const hasError = Object.values(results).some((r: any) => r.status === 'error')
  if (hasError) {
    throw new Error(`AI provider checks failed: ${JSON.stringify(results)}`)
  }

  return {
    status: 'healthy',
    message: 'All configured AI providers accessible',
    providers: results
  }
}

async function checkMemory() {
  const memUsage = process.memoryUsage()
  const totalHeapMB = Math.round(memUsage.heapTotal / 1024 / 1024)
  const usedHeapMB = Math.round(memUsage.heapUsed / 1024 / 1024)
  const usagePercent = Math.round((usedHeapMB / totalHeapMB) * 100)

  return {
    status: usagePercent > 90 ? 'warning' : 'healthy',
    message: `Memory usage: ${usedHeapMB}MB / ${totalHeapMB}MB (${usagePercent}%)`,
    details: {
      heapUsed: usedHeapMB,
      heapTotal: totalHeapMB,
      usagePercent,
      external: Math.round(memUsage.external / 1024 / 1024),
      rss: Math.round(memUsage.rss / 1024 / 1024)
    }
  }
}

async function checkDisk() {
  try {
    // Simple disk space check (this is basic, could be enhanced)
    const stats = await import('fs').then(fs => fs.promises.stat('.'))
    
    return {
      status: 'healthy',
      message: 'Disk accessible',
      details: {
        accessible: true
      }
    }
  } catch (error: any) {
    return {
      status: 'error',
      message: `Disk check failed: ${error.message}`
    }
  }
}

function getCheckResult(result: PromiseSettledResult<any>) {
  if (result.status === 'fulfilled') {
    return result.value
  } else {
    return {
      status: 'error',
      message: result.reason?.message || 'Check failed'
    }
  }
}