// RP9 Orchestrator - Main Application Entry Point
import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import { register as registerPrometheusMetrics } from 'prom-client'

import { config } from '@/utils/config'
import { logger } from '@/utils/logger'
import { authenticateJWT, addCorrelationId } from '@/utils/auth'
import { dbService } from '@/services/database'
import { dockerService } from '@/services/docker'

// Route handlers
import { healthRoutes } from '@/routes/health'
import { tenantsRoutes } from '@/routes/tenants'
import { autoscaleRoutes } from '@/routes/autoscale'
import { enforcementRoutes } from '@/routes/enforcement'
import { metricsRoutes } from '@/routes/metrics'

const app = Fastify({
  logger: logger,
  disableRequestLogging: process.env.NODE_ENV === 'production',
  trustProxy: true,
  bodyLimit: 1024 * 1024 * 5 // 5MB limit
})

// =============================================================================
// MIDDLEWARE SETUP
// =============================================================================

async function setupMiddleware() {
  // Security headers
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"]
      }
    }
  })

  // CORS configuration
  await app.register(cors, {
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin) return callback(null, true)
      
      const allowedOrigins = [
        'https://app.rp9.com',
        'https://rp9.netlify.app',
        ...(process.env.ALLOWED_ORIGINS?.split(',') || [])
      ]
      
      if (process.env.NODE_ENV === 'development') {
        allowedOrigins.push('http://localhost:3000', 'http://localhost:8080')
      }
      
      if (allowedOrigins.includes(origin)) {
        callback(null, true)
      } else {
        logger.warn({ origin }, 'CORS origin rejected')
        callback(new Error('Not allowed by CORS'), false)
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
  })

  // Rate limiting
  await app.register(rateLimit, {
    max: 100, // requests
    timeWindow: '1 minute',
    errorResponseBuilder: (request, context) => {
      return {
        error: 'Rate limit exceeded',
        message: `Too many requests, limit is ${context.max} per ${context.timeWindow}`,
        timestamp: new Date().toISOString()
      }
    }
  })

  // Global middleware
  app.addHook('preHandler', addCorrelationId)
  
  // Authentication for protected routes (skip health endpoints)
  app.addHook('preHandler', async (request, reply) => {
    if (request.url.startsWith('/health') || request.url.startsWith('/metrics')) {
      return
    }
    
    await authenticateJWT(request, reply)
  })

  logger.info('Middleware setup completed')
}

// =============================================================================
// ROUTES REGISTRATION
// =============================================================================

async function setupRoutes() {
  // Health and monitoring routes (no auth required)
  await app.register(healthRoutes, { prefix: '/health' })
  await app.register(metricsRoutes, { prefix: '/metrics' })

  // Core orchestrator routes (auth required)
  await app.register(tenantsRoutes, { prefix: '/tenants' })
  await app.register(autoscaleRoutes, { prefix: '/autoscale' })
  await app.register(enforcementRoutes, { prefix: '/enforcement' })

  // Global error handler
  app.setErrorHandler((error, request, reply) => {
    const correlationId = request.correlationId || 'unknown'
    
    logger.error({
      error: error.message,
      stack: error.stack,
      correlation_id: correlationId,
      url: request.url,
      method: request.method
    }, 'Unhandled error')

    // Don't leak error details in production
    const message = process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : error.message

    reply.status(error.statusCode || 500).send({
      error: 'Internal server error',
      message,
      correlation_id: correlationId,
      timestamp: new Date().toISOString()
    })
  })

  // 404 handler
  app.setNotFoundHandler((request, reply) => {
    reply.status(404).send({
      error: 'Not found',
      message: `Route ${request.method} ${request.url} not found`,
      timestamp: new Date().toISOString()
    })
  })

  logger.info('Routes setup completed')
}

// =============================================================================
// APPLICATION STARTUP
// =============================================================================

async function startServer() {
  try {
    // Setup middleware and routes
    await setupMiddleware()
    await setupRoutes()

    // Health checks
    const dbHealthy = await dbService.healthCheck()
    const dockerHealthy = await dockerService.healthCheck()

    if (!dbHealthy) {
      throw new Error('Database health check failed')
    }

    if (!dockerHealthy) {
      throw new Error('Docker health check failed')
    }

    // Start server
    const address = await app.listen({
      port: config.port,
      host: '0.0.0.0'
    })

    logger.info({
      address,
      port: config.port,
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0'
    }, 'RP9 Orchestrator started successfully')

    // Graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      logger.info({ signal }, 'Received shutdown signal')
      
      try {
        await app.close()
        await dbService.close()
        logger.info('Graceful shutdown completed')
        process.exit(0)
      } catch (error) {
        logger.error({ error }, 'Error during graceful shutdown')
        process.exit(1)
      }
    }

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
    process.on('SIGINT', () => gracefulShutdown('SIGINT'))

  } catch (error) {
    logger.error({ error }, 'Failed to start server')
    process.exit(1)
  }
}

// =============================================================================
// MAIN EXECUTION
// =============================================================================

if (require.main === module) {
  startServer()
}

export { app }
export default app