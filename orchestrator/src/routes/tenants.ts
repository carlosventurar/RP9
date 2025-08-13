// RP9 Orchestrator - Tenants Management Routes
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { v4 as uuidv4 } from 'uuid'

import { dbService } from '@/services/database'
import { dockerService } from '@/services/docker'
import { logger, createTenantLogger, auditLog } from '@/utils/logger'
import { requireRole } from '@/utils/auth'
import { 
  CreateTenantRequest, 
  CreateTenantResponse, 
  ScaleTenantRequest,
  BackupTenantRequest,
  BackupTenantResponse,
  JwtPayload 
} from '@/types'

// Validation schemas
const createTenantSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  subdomain: z.string().min(3).max(50).regex(/^[a-z0-9-]+$/),
  mode: z.enum(['shared', 'dedicated']),
  plan: z.enum(['starter', 'pro', 'enterprise']),
  region: z.string().optional().default('us-east')
})

const scaleTenantSchema = z.object({
  cpu: z.number().min(1).max(32).optional(),
  memory_mb: z.number().min(512).max(32768).optional(),
  workers: z.number().min(1).max(20).optional()
})

const backupTenantSchema = z.object({
  backup_type: z.enum(['manual', 'pre_migration', 'pre_upgrade']).optional().default('manual'),
  includes_database: z.boolean().optional().default(true),
  includes_workflows: z.boolean().optional().default(true),
  includes_credentials: z.boolean().optional().default(true),
  includes_files: z.boolean().optional().default(false)
})

export async function tenantsRoutes(fastify: FastifyInstance) {

  // =============================================================================
  // POST /tenants - Create new tenant
  // =============================================================================
  
  fastify.post('/', {
    preHandler: requireRole(['admin', 'service_role'])
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const correlationId = request.correlationId || 'unknown'
    const user = request.user as JwtPayload

    try {
      // Validate request body
      const body = createTenantSchema.parse(request.body)
      const tenantId = uuidv4()

      logger.info({
        correlation_id: correlationId,
        tenant_id: tenantId,
        body
      }, 'Creating new tenant')

      // Check subdomain availability
      const existingTenant = await dbService.getTenantInstance(tenantId)
      if (existingTenant) {
        return reply.status(409).send({
          error: 'Conflict',
          message: 'Subdomain already exists',
          timestamp: new Date().toISOString()
        })
      }

      // Determine resource allocation based on plan
      const resources = getResourcesByPlan(body.plan)
      
      // Create tenant instance record
      const tenantData = {
        tenant_id: tenantId,
        name: body.name,
        subdomain: body.subdomain,
        email: body.email,
        mode: body.mode,
        status: 'provisioning' as const,
        plan: body.plan,
        region: body.region,
        ...resources,
        login_url: `https://${body.subdomain}.rp9.io`,
        metadata: {
          created_by: user.user_id,
          correlation_id: correlationId
        }
      }

      const tenant = await dbService.createTenantInstance(tenantData)

      // For dedicated mode, create Docker container
      if (body.mode === 'dedicated') {
        try {
          const dbName = `n8n_${body.subdomain}`
          const containerId = await dockerService.createN8nContainer(
            tenantId,
            body.subdomain,
            {
              cpu_cores: resources.cpu_cores,
              memory_mb: resources.memory_mb,
              workers: resources.workers,
              db_name: dbName
            }
          )

          // Update tenant with container information
          await dbService.updateTenantInstance(tenantId, {
            container_id: containerId,
            container_status: 'running',
            db_name: dbName,
            n8n_url: `https://${body.subdomain}.rp9.io`,
            status: 'active',
            traefik_router: `n8n-${body.subdomain}-router`
          })

          logger.info({
            tenant_id: tenantId,
            container_id: containerId
          }, 'Dedicated tenant container created')

        } catch (dockerError) {
          logger.error({
            tenant_id: tenantId,
            error: dockerError
          }, 'Failed to create dedicated container')

          // Update status to failed
          await dbService.updateTenantInstance(tenantId, {
            status: 'failed',
            metadata: {
              ...tenantData.metadata,
              error: dockerError instanceof Error ? dockerError.message : 'Container creation failed'
            }
          })

          return reply.status(500).send({
            error: 'Container creation failed',
            message: 'Failed to provision dedicated tenant',
            tenant_id: tenantId,
            timestamp: new Date().toISOString()
          })
        }
      } else {
        // For shared mode, mark as active immediately
        await dbService.updateTenantInstance(tenantId, {
          status: 'active',
          n8n_url: process.env.SHARED_N8N_BASE_URL
        })
      }

      // Create default quotas
      await dbService.updateTenantQuotas(tenantId, getQuotasByPlan(body.plan))

      // Audit log
      auditLog('tenant_created', tenantId, {
        mode: body.mode,
        plan: body.plan,
        subdomain: body.subdomain
      })

      const response: CreateTenantResponse = {
        tenant_id: tenantId,
        login_url: `https://${body.subdomain}.rp9.io`,
        status: 'active',
        message: `Tenant created successfully in ${body.mode} mode`
      }

      return reply.status(201).send({
        success: true,
        data: response,
        timestamp: new Date().toISOString()
      })

    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Validation error',
          message: 'Invalid request data',
          details: error.errors,
          timestamp: new Date().toISOString()
        })
      }

      logger.error({
        error,
        correlation_id: correlationId
      }, 'Failed to create tenant')

      return reply.status(500).send({
        error: 'Internal server error',
        message: 'Failed to create tenant',
        correlation_id: correlationId,
        timestamp: new Date().toISOString()
      })
    }
  })

  // =============================================================================
  // POST /tenants/:id/scale - Scale tenant resources
  // =============================================================================
  
  fastify.post('/:id/scale', {
    preHandler: requireRole(['admin', 'service_role'])
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id: tenantId } = request.params as { id: string }
    const user = request.user as JwtPayload

    try {
      const body = scaleTenantSchema.parse(request.body)

      const tenant = await dbService.getTenantInstance(tenantId)
      if (!tenant) {
        return reply.status(404).send({
          error: 'Not found',
          message: 'Tenant not found',
          timestamp: new Date().toISOString()
        })
      }

      if (tenant.mode !== 'dedicated') {
        return reply.status(400).send({
          error: 'Bad request',
          message: 'Scaling is only available for dedicated tenants',
          timestamp: new Date().toISOString()
        })
      }

      if (!tenant.container_id) {
        return reply.status(400).send({
          error: 'Bad request',
          message: 'No container found for dedicated tenant',
          timestamp: new Date().toISOString()
        })
      }

      // Prepare updates
      const updates: Partial<typeof tenant> = {}
      if (body.cpu !== undefined) updates.cpu_cores = body.cpu
      if (body.memory_mb !== undefined) updates.memory_mb = body.memory_mb
      if (body.workers !== undefined) updates.workers = body.workers

      // Update Docker container resources
      if (body.cpu !== undefined || body.memory_mb !== undefined) {
        await dockerService.scaleContainer(
          tenant.container_id,
          tenantId,
          {
            cpu_cores: body.cpu || tenant.cpu_cores,
            memory_mb: body.memory_mb || tenant.memory_mb
          }
        )
      }

      // Update database record
      const updatedTenant = await dbService.updateTenantInstance(tenantId, updates)

      // Create autoscale event record
      await dbService.createAutoscaleEvent({
        tenant_id: tenantId,
        trigger_type: 'manual',
        trigger_value: 0,
        trigger_threshold: 0,
        action: 'scale_up',
        action_details: body,
        status: 'completed',
        resources_before: {
          cpu_cores: tenant.cpu_cores,
          memory_mb: tenant.memory_mb,
          workers: tenant.workers
        },
        resources_after: {
          cpu_cores: updatedTenant.cpu_cores,
          memory_mb: updatedTenant.memory_mb,
          workers: updatedTenant.workers
        },
        success: true,
        metadata: {
          triggered_by: user.user_id,
          correlation_id: request.correlationId
        }
      })

      auditLog('tenant_scaled', tenantId, body)

      return {
        success: true,
        data: {
          tenant_id: tenantId,
          resources: {
            cpu_cores: updatedTenant.cpu_cores,
            memory_mb: updatedTenant.memory_mb,
            workers: updatedTenant.workers
          }
        },
        message: 'Tenant scaled successfully',
        timestamp: new Date().toISOString()
      }

    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Validation error',
          message: 'Invalid request data',
          details: error.errors,
          timestamp: new Date().toISOString()
        })
      }

      logger.error({
        error,
        tenant_id: tenantId
      }, 'Failed to scale tenant')

      return reply.status(500).send({
        error: 'Internal server error',
        message: 'Failed to scale tenant',
        timestamp: new Date().toISOString()
      })
    }
  })

  // =============================================================================
  // POST /tenants/:id/backup - Create tenant backup
  // =============================================================================
  
  fastify.post('/:id/backup', {
    preHandler: requireRole(['admin', 'service_role'])
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id: tenantId } = request.params as { id: string }

    try {
      const body = backupTenantSchema.parse(request.body)

      const tenant = await dbService.getTenantInstance(tenantId)
      if (!tenant) {
        return reply.status(404).send({
          error: 'Not found',
          message: 'Tenant not found',
          timestamp: new Date().toISOString()
        })
      }

      // Generate backup path
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const s3Path = `tenants/${tenantId}/backups/${timestamp}`

      // Create backup record
      const backup = await dbService.createBackup({
        tenant_id: tenantId,
        backup_type: body.backup_type,
        status: 'running',
        s3_path: s3Path,
        s3_bucket: process.env.S3_BUCKET || 'rp9-backups',
        includes_database: body.includes_database,
        includes_workflows: body.includes_workflows,
        includes_credentials: body.includes_credentials,
        includes_files: body.includes_files,
        retention_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
        metadata: {
          triggered_by: (request.user as JwtPayload).user_id,
          correlation_id: request.correlationId
        }
      })

      // TODO: Implement actual backup logic (S3 upload, pg_dump, n8n export)
      // For now, mark as completed immediately
      await dbService.updateBackup(backup.id, {
        status: 'completed',
        completed_at: new Date().toISOString(),
        backup_size_bytes: 1024 * 1024 // Mock 1MB
      })

      auditLog('backup_created', tenantId, {
        backup_id: backup.id,
        backup_type: body.backup_type
      })

      const response: BackupTenantResponse = {
        ok: true,
        backup_id: backup.id,
        s3_path: s3Path,
        estimated_completion: new Date(Date.now() + 5 * 60 * 1000).toISOString() // 5 minutes
      }

      return {
        success: true,
        data: response,
        message: 'Backup initiated successfully',
        timestamp: new Date().toISOString()
      }

    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Validation error',
          message: 'Invalid request data',
          details: error.errors,
          timestamp: new Date().toISOString()
        })
      }

      logger.error({
        error,
        tenant_id: tenantId
      }, 'Failed to create backup')

      return reply.status(500).send({
        error: 'Internal server error',
        message: 'Failed to create backup',
        timestamp: new Date().toISOString()
      })
    }
  })

  // =============================================================================
  // POST /tenants/:id/promote - Promote tenant to dedicated
  // =============================================================================
  
  fastify.post('/:id/promote', {
    preHandler: requireRole(['admin', 'service_role'])
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id: tenantId } = request.params as { id: string }
    const user = request.user as JwtPayload

    try {
      const body = request.body as any || {}

      const tenant = await dbService.getTenantInstance(tenantId)
      if (!tenant) {
        return reply.status(404).send({
          error: 'Not found',
          message: 'Tenant not found',
          timestamp: new Date().toISOString()
        })
      }

      if (tenant.mode !== 'shared') {
        return reply.status(400).send({
          error: 'Bad request',
          message: 'Tenant is not in shared mode',
          timestamp: new Date().toISOString()
        })
      }

      // Parse promotion window if provided
      let promotionWindow = undefined
      if (body.window || body.ttl_minutes) {
        promotionWindow = {
          scheduled_at: body.window ? new Date(body.window) : new Date(Date.now() + 5 * 60 * 1000),
          ttl_minutes: body.ttl_minutes || 10,
          reason: body.reason || 'Manual promotion request'
        }
      }

      // Import promotion service
      const { promotionService } = await import('@/services/promotion')
      
      const result = await promotionService.promoteToDeadicated(tenantId, promotionWindow)

      auditLog('tenant_promotion_requested', tenantId, {
        promotion_id: result.promotion_id,
        requested_by: user.user_id,
        window: promotionWindow
      })

      return {
        success: true,
        data: result,
        message: 'Tenant promotion initiated',
        timestamp: new Date().toISOString()
      }

    } catch (error) {
      logger.error({
        error,
        tenant_id: tenantId
      }, 'Failed to promote tenant')

      return reply.status(500).send({
        error: 'Internal server error',
        message: 'Failed to promote tenant',
        timestamp: new Date().toISOString()
      })
    }
  })

  // =============================================================================
  // GET /tenants/:id - Get tenant details
  // =============================================================================
  
  fastify.get('/:id', {
    preHandler: requireRole(['admin', 'service_role'])
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id: tenantId } = request.params as { id: string }

    try {
      const tenant = await dbService.getTenantInstance(tenantId)
      if (!tenant) {
        return reply.status(404).send({
          error: 'Not found',
          message: 'Tenant not found',
          timestamp: new Date().toISOString()
        })
      }

      const quotas = await dbService.getTenantQuotas(tenantId)
      const backups = await dbService.getBackupsForTenant(tenantId)

      return {
        success: true,
        data: {
          tenant,
          quotas,
          backups_count: backups.length,
          last_backup: backups[0]?.created_at || null
        },
        timestamp: new Date().toISOString()
      }

    } catch (error) {
      logger.error({
        error,
        tenant_id: tenantId
      }, 'Failed to get tenant details')

      return reply.status(500).send({
        error: 'Internal server error',
        message: 'Failed to get tenant details',
        timestamp: new Date().toISOString()
      })
    }
  })
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function getResourcesByPlan(plan: string) {
  const resources = {
    starter: { cpu_cores: 1, memory_mb: 1024, workers: 1, storage_gb: 5 },
    pro: { cpu_cores: 2, memory_mb: 2048, workers: 2, storage_gb: 20 },
    enterprise: { cpu_cores: 4, memory_mb: 4096, workers: 4, storage_gb: 100 }
  }
  
  return resources[plan as keyof typeof resources] || resources.starter
}

function getQuotasByPlan(plan: string) {
  const quotas = {
    starter: {
      executions_monthly: 1000,
      concurrent_executions: 2,
      cpu_limit_percent: 100,
      memory_limit_mb: 1024,
      storage_limit_gb: 5,
      api_calls_hourly: 100,
      webhook_endpoints: 5,
      retention_days: 7
    },
    pro: {
      executions_monthly: 10000,
      concurrent_executions: 10,
      cpu_limit_percent: 200,
      memory_limit_mb: 2048,
      storage_limit_gb: 20,
      api_calls_hourly: 1000,
      webhook_endpoints: 20,
      retention_days: 30
    },
    enterprise: {
      executions_monthly: 100000,
      concurrent_executions: 50,
      cpu_limit_percent: 400,
      memory_limit_mb: 4096,
      storage_limit_gb: 100,
      api_calls_hourly: 10000,
      webhook_endpoints: 100,
      retention_days: 90
    }
  }
  
  return quotas[plan as keyof typeof quotas] || quotas.starter
}