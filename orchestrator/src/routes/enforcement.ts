// RP9 Orchestrator - Enforcement Routes
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { requireRole } from '@/utils/auth'
import { logger } from '@/utils/logger'
import { enforcementService } from '@/services/enforcement'

export async function enforcementRoutes(fastify: FastifyInstance) {

  // =============================================================================
  // POST /enforcement/run - Execute enforcement logic
  // =============================================================================
  
  fastify.post('/run', {
    preHandler: requireRole(['admin', 'service_role'])
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const correlationId = request.correlationId || 'unknown'
    
    try {
      logger.info({ correlation_id: correlationId }, 'Enforcement run triggered')

      const result = await enforcementService.runEnforcement()

      logger.info({
        correlation_id: correlationId,
        result
      }, 'Enforcement run completed')

      return {
        success: true,
        data: result,
        timestamp: new Date().toISOString()
      }

    } catch (error) {
      logger.error({ 
        error, 
        correlation_id: correlationId 
      }, 'Enforcement run failed')
      
      return reply.status(500).send({
        error: 'Internal server error',
        message: 'Enforcement run failed',
        correlation_id: correlationId,
        timestamp: new Date().toISOString()
      })
    }
  })
}