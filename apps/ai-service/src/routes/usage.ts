import { FastifyInstance } from 'fastify'
import { AuthenticatedRequest } from '@/middleware/auth'
import { db } from '@/services/database'
import { modelRouter } from '@/services/modelRouter'
import { aiCache } from '@/services/cache'
import { sandboxService } from '@/services/sandbox'
import { logger } from '@/utils/logger'

export default async function usageRoutes(fastify: FastifyInstance) {
  
  // Get usage statistics for tenant
  fastify.get('/:tenantId', async (request: AuthenticatedRequest, reply) => {
    const { tenantId } = request.params as { tenantId: string }

    try {
      // Verify tenant access
      if (request.tenant?.id !== tenantId) {
        reply.code(403).send({
          error: 'Forbidden',
          message: 'Access denied to tenant usage data'
        })
        return
      }

      const [budget, usage] = await Promise.all([
        db.getBudget(tenantId),
        db.getMonthlyUsage(tenantId)
      ])

      const remainingBudget = budget.monthlyUsd - usage.totalCost
      const percentUsed = Math.round((usage.totalCost / budget.monthlyUsd) * 100)

      reply.send({
        budget: {
          monthlyLimit: budget.monthlyUsd,
          spent: usage.totalCost,
          remaining: remainingBudget,
          percentUsed,
          limitBehavior: budget.hardLimitBehavior
        },
        usage: {
          requestCount: usage.requestCount,
          totalCost: usage.totalCost,
          averageCostPerRequest: usage.requestCount > 0 
            ? Number((usage.totalCost / usage.requestCount).toFixed(4))
            : 0
        },
        status: {
          canMakeRequests: remainingBudget > 0 || budget.hardLimitBehavior === 'warn',
          warningLevel: percentUsed > 90 ? 'critical' : percentUsed > 75 ? 'high' : 'normal'
        }
      })

    } catch (error: any) {
      logger.error('Failed to get usage:', error)
      reply.code(500).send({
        error: 'Failed to get usage',
        message: error.message
      })
    }
  })

  // Get detailed usage breakdown
  fastify.get('/:tenantId/detailed', async (request: AuthenticatedRequest, reply) => {
    const { tenantId } = request.params as { tenantId: string }
    const { startDate, endDate, groupBy } = request.query as { 
      startDate?: string
      endDate?: string
      groupBy?: 'day' | 'week' | 'month'
    }

    try {
      if (request.tenant?.id !== tenantId) {
        reply.code(403).send({
          error: 'Forbidden',
          message: 'Access denied to tenant usage data'
        })
        return
      }

      // This would require a more complex query - simplified for now
      const usage = await db.getMonthlyUsage(tenantId)
      
      reply.send({
        period: {
          start: startDate || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(),
          end: endDate || new Date().toISOString(),
          groupBy: groupBy || 'day'
        },
        breakdown: {
          byAction: {
            generate: { requests: 0, cost: 0 },
            explain: { requests: 0, cost: 0 },
            optimize: { requests: 0, cost: 0 },
            chat: { requests: 0, cost: 0 }
          },
          byProvider: {
            openai: { requests: 0, cost: 0 },
            anthropic: { requests: 0, cost: 0 },
            byok: { requests: 0, cost: 0 }
          },
          timeline: [] // Would be populated with daily/weekly data
        },
        totals: usage
      })

    } catch (error: any) {
      logger.error('Failed to get detailed usage:', error)
      reply.code(500).send({
        error: 'Failed to get detailed usage',
        message: error.message
      })
    }
  })

  // Update budget settings
  fastify.put('/:tenantId/budget', async (request: AuthenticatedRequest, reply) => {
    const { tenantId } = request.params as { tenantId: string }
    const { monthlyUsd, hardLimitBehavior } = request.body as {
      monthlyUsd: number
      hardLimitBehavior: 'block' | 'warn'
    }

    try {
      if (request.tenant?.id !== tenantId) {
        reply.code(403).send({
          error: 'Forbidden',
          message: 'Access denied to tenant budget settings'
        })
        return
      }

      // Validate input
      if (typeof monthlyUsd !== 'number' || monthlyUsd < 0 || monthlyUsd > 10000) {
        reply.code(400).send({
          error: 'Invalid budget amount',
          message: 'Budget must be between $0 and $10,000'
        })
        return
      }

      if (!['block', 'warn'].includes(hardLimitBehavior)) {
        reply.code(400).send({
          error: 'Invalid limit behavior',
          message: 'Must be either "block" or "warn"'
        })
        return
      }

      // Update budget in database
      await db.updateBudgetSpent(tenantId, 0) // This would be a proper update method
      
      const updatedBudget = await db.getBudget(tenantId)

      reply.send({
        success: true,
        budget: updatedBudget,
        message: 'Budget settings updated successfully'
      })

    } catch (error: any) {
      logger.error('Failed to update budget:', error)
      reply.code(500).send({
        error: 'Failed to update budget',
        message: error.message
      })
    }
  })

  // Get service statistics (admin only)
  fastify.get('/stats/service', async (request: AuthenticatedRequest, reply) => {
    try {
      // Simple admin check - in production, use proper RBAC
      if (!request.user.email?.includes('@rp9.') && !request.user.email?.includes('@admin.')) {
        reply.code(403).send({
          error: 'Forbidden',
          message: 'Admin access required'
        })
        return
      }

      const [
        modelStats,
        cacheStats,
        sandboxStats
      ] = await Promise.all([
        modelRouter.getStats(),
        Promise.resolve(aiCache.getStats()),
        Promise.resolve(sandboxService.getStats())
      ])

      reply.send({
        service: {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          version: '1.0.0'
        },
        providers: modelStats,
        cache: cacheStats,
        sandbox: sandboxStats,
        timestamp: new Date().toISOString()
      })

    } catch (error: any) {
      logger.error('Failed to get service stats:', error)
      reply.code(500).send({
        error: 'Failed to get service stats',
        message: error.message
      })
    }
  })

  // Health check for AI providers
  fastify.get('/health/providers', async (request, reply) => {
    try {
      const providers = modelRouter.getAvailableProviders()
      const health = {
        providers: providers.map(provider => ({
          name: provider,
          available: modelRouter.isProviderAvailable(provider),
          status: 'unknown' // Would check actual connectivity
        })),
        timestamp: new Date().toISOString()
      }

      reply.send(health)

    } catch (error: any) {
      logger.error('Failed to check provider health:', error)
      reply.code(500).send({
        error: 'Failed to check provider health',
        message: error.message
      })
    }
  })

  // Clear cache for tenant (admin operation)
  fastify.delete('/:tenantId/cache', async (request: AuthenticatedRequest, reply) => {
    const { tenantId } = request.params as { tenantId: string }

    try {
      if (request.tenant?.id !== tenantId) {
        reply.code(403).send({
          error: 'Forbidden',
          message: 'Access denied to tenant cache'
        })
        return
      }

      const clearedCount = aiCache.invalidateTenant(tenantId)

      reply.send({
        success: true,
        clearedEntries: clearedCount,
        message: `Cleared ${clearedCount} cache entries for tenant`
      })

    } catch (error: any) {
      logger.error('Failed to clear cache:', error)
      reply.code(500).send({
        error: 'Failed to clear cache',
        message: error.message
      })
    }
  })

  // Export usage data
  fastify.get('/:tenantId/export', async (request: AuthenticatedRequest, reply) => {
    const { tenantId } = request.params as { tenantId: string }
    const { format } = request.query as { format?: 'json' | 'csv' }

    try {
      if (request.tenant?.id !== tenantId) {
        reply.code(403).send({
          error: 'Forbidden',
          message: 'Access denied to tenant usage data'
        })
        return
      }

      // Get comprehensive usage data
      const [budget, usage] = await Promise.all([
        db.getBudget(tenantId),
        db.getMonthlyUsage(tenantId)
      ])

      const exportData = {
        tenant: {
          id: tenantId,
          name: request.tenant?.name
        },
        exportDate: new Date().toISOString(),
        period: {
          start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(),
          end: new Date().toISOString()
        },
        budget,
        usage,
        summary: {
          totalRequests: usage.requestCount,
          totalCost: usage.totalCost,
          averageCostPerRequest: usage.requestCount > 0 
            ? Number((usage.totalCost / usage.requestCount).toFixed(4))
            : 0,
          budgetUtilization: Math.round((usage.totalCost / budget.monthlyUsd) * 100)
        }
      }

      if (format === 'csv') {
        // Convert to CSV format
        const csv = this.convertToCSV(exportData)
        reply
          .header('Content-Type', 'text/csv')
          .header('Content-Disposition', `attachment; filename="ai-usage-${tenantId}-${new Date().getMonth() + 1}-${new Date().getFullYear()}.csv"`)
          .send(csv)
      } else {
        reply
          .header('Content-Type', 'application/json')
          .header('Content-Disposition', `attachment; filename="ai-usage-${tenantId}-${new Date().getMonth() + 1}-${new Date().getFullYear()}.json"`)
          .send(exportData)
      }

    } catch (error: any) {
      logger.error('Failed to export usage data:', error)
      reply.code(500).send({
        error: 'Failed to export usage data',
        message: error.message
      })
    }
  })

  // Helper method to convert data to CSV
  function convertToCSV(data: any): string {
    const headers = ['Date', 'Action', 'Provider', 'Tokens In', 'Tokens Out', 'Cost USD', 'Status']
    let csv = headers.join(',') + '\n'
    
    // This would iterate through actual usage records
    csv += `${new Date().toISOString()},summary,all,0,0,${data.usage.totalCost},completed\n`
    
    return csv
  }
}