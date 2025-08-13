// RP9 Orchestrator - Autoscaling Routes
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { requireRole } from '@/utils/auth'
import { logger } from '@/utils/logger'
import { autoscalerService } from '@/services/autoscaler'

export async function autoscaleRoutes(fastify: FastifyInstance) {

  // =============================================================================
  // POST /autoscale/run - Execute autoscaling logic
  // =============================================================================
  
  fastify.post('/run', {
    preHandler: requireRole(['admin', 'service_role'])
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const correlationId = request.correlationId || 'unknown'
    
    try {
      logger.info({ correlation_id: correlationId }, 'Autoscaling run triggered')

      const result = await autoscalerService.runAutoscaling()

      logger.info({
        correlation_id: correlationId,
        result
      }, 'Autoscaling run completed')

      return {
        success: true,
        data: result,
        timestamp: new Date().toISOString()
      }

    } catch (error) {
      logger.error({ 
        error, 
        correlation_id: correlationId 
      }, 'Autoscaling run failed')
      
      return reply.status(500).send({
        error: 'Internal server error',
        message: 'Autoscaling run failed',
        correlation_id: correlationId,
        timestamp: new Date().toISOString()
      })
    }
  })
}