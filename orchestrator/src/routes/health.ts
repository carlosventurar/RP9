// RP9 Orchestrator - Health Check Routes
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { dbService } from '@/services/database'
import { dockerService } from '@/services/docker'
import { logger } from '@/utils/logger'

export async function healthRoutes(fastify: FastifyInstance) {
  
  // Basic health check
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    return {
      status: 'ok',
      service: 'rp9-orchestrator',
      version: process.env.npm_package_version || '1.0.0',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    }
  })

  // Detailed health check
  fastify.get('/detailed', async (request: FastifyRequest, reply: FastifyReply) => {
    const startTime = Date.now()
    
    try {
      // Check all service dependencies
      const [dbHealthy, dockerHealthy] = await Promise.all([
        dbService.healthCheck(),
        dockerService.healthCheck()
      ])

      const dockerStats = dockerHealthy ? await dockerService.getDockerStats() : null
      const responseTime = Date.now() - startTime

      const status = dbHealthy && dockerHealthy ? 'healthy' : 'degraded'
      const statusCode = status === 'healthy' ? 200 : 503

      const healthData = {
        status,
        service: 'rp9-orchestrator',
        version: process.env.npm_package_version || '1.0.0',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        response_time_ms: responseTime,
        dependencies: {
          database: {
            status: dbHealthy ? 'healthy' : 'unhealthy',
            checked_at: new Date().toISOString()
          },
          docker: {
            status: dockerHealthy ? 'healthy' : 'unhealthy',
            stats: dockerStats,
            checked_at: new Date().toISOString()
          }
        },
        system: {
          memory: {
            used: process.memoryUsage().heapUsed,
            total: process.memoryUsage().heapTotal,
            external: process.memoryUsage().external
          },
          cpu: {
            load_average: process.cpuUsage()
          },
          process: {
            pid: process.pid,
            node_version: process.version,
            platform: process.platform
          }
        }
      }

      return reply.status(statusCode).send(healthData)

    } catch (error) {
      logger.error({ error }, 'Health check failed')
      
      return reply.status(503).send({
        status: 'unhealthy',
        service: 'rp9-orchestrator',
        timestamp: new Date().toISOString(),
        error: 'Health check failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  })

  // Readiness probe (for Kubernetes/Docker)
  fastify.get('/ready', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const dbHealthy = await dbService.healthCheck()
      
      if (!dbHealthy) {
        return reply.status(503).send({
          status: 'not_ready',
          reason: 'Database not available',
          timestamp: new Date().toISOString()
        })
      }

      return {
        status: 'ready',
        timestamp: new Date().toISOString()
      }

    } catch (error) {
      logger.error({ error }, 'Readiness check failed')
      
      return reply.status(503).send({
        status: 'not_ready',
        reason: 'Service not ready',
        timestamp: new Date().toISOString()
      })
    }
  })

  // Liveness probe (for Kubernetes/Docker)
  fastify.get('/live', async (request: FastifyRequest, reply: FastifyReply) => {
    return {
      status: 'alive',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    }
  })
}