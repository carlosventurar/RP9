import Fastify from 'fastify'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import helmet from '@fastify/helmet'
import { config } from '@/utils/config'
import { logger } from '@/utils/logger'
import { errorHandler } from '@/middleware/errorHandler'
import { authMiddleware } from '@/middleware/auth'

// Routes
import aiRoutes from '@/routes/ai'
import healthRoutes from '@/routes/health'
import usageRoutes from '@/routes/usage'
import playgroundRoutes from '@/routes/playground'

async function start() {
  const fastify = Fastify({
    logger: logger,
    trustProxy: true
  })

  try {
    // Register plugins
    await fastify.register(helmet, {
      contentSecurityPolicy: false
    })

    await fastify.register(cors, {
      origin: config.CORS_ORIGINS,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-BYOK-Provider', 'X-BYOK-Key']
    })

    await fastify.register(rateLimit, {
      max: config.RATE_LIMIT_MAX,
      timeWindow: config.RATE_LIMIT_WINDOW,
      errorResponseBuilder: (request, context) => {
        return {
          error: 'Rate limit exceeded',
          message: `Too many requests. Try again in ${Math.round(context.ttl / 1000)} seconds.`,
          retryAfter: Math.round(context.ttl / 1000)
        }
      }
    })

    // Global middleware
    fastify.addHook('preHandler', authMiddleware)
    fastify.setErrorHandler(errorHandler)

    // Register routes
    await fastify.register(healthRoutes, { prefix: '/health' })
    await fastify.register(usageRoutes, { prefix: '/usage' })
    await fastify.register(aiRoutes, { prefix: '/ai' })
    await fastify.register(playgroundRoutes)

    // Health check endpoint
    fastify.get('/', async (request, reply) => {
      return { 
        service: 'RP9 AI Assistant',
        version: '1.0.0',
        status: 'healthy',
        timestamp: new Date().toISOString()
      }
    })

    // Start server
    const address = await fastify.listen({
      port: config.PORT,
      host: config.HOST
    })

    logger.info(`🤖 AI Service started at ${address}`)
    logger.info(`🔑 Providers: ${config.ENABLED_PROVIDERS.join(', ')}`)
    logger.info(`💰 Budget enforcement: ${config.BUDGET_ENFORCEMENT}`)
    logger.info(`🛡️ BYOK enabled: ${config.ALLOW_BYOK}`)

  } catch (err) {
    logger.error('Error starting server:', err)
    process.exit(1)
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down gracefully...')
  process.exit(0)
})

process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down gracefully...')
  process.exit(0)
})

start()