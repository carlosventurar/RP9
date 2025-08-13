// RP9 Orchestrator - Tenant Promotion Service (Shared → Dedicated)
import { dbService } from './database'
import { dockerService } from './docker'
import { logger, createTenantLogger, auditLog } from '@/utils/logger'
import { TenantInstance } from '@/types'

interface PromotionWindow {
  scheduled_at: Date
  ttl_minutes: number
  reason?: string
}

interface PromotionPlan {
  tenant: TenantInstance
  new_resources: {
    cpu_cores: number
    memory_mb: number
    workers: number
    storage_gb: number
  }
  db_name: string
  migration_steps: string[]
  estimated_downtime_minutes: number
}

export class PromotionService {
  // =============================================================================
  // MAIN PROMOTION LOGIC
  // =============================================================================

  async promoteToDeadicated(
    tenantId: string,
    window?: PromotionWindow
  ): Promise<{
    success: boolean
    promotion_id: string
    estimated_completion: string
    plan: PromotionPlan
  }> {
    const tenantLogger = createTenantLogger(tenantId)
    
    try {
      // Get tenant details
      const tenant = await dbService.getTenantInstance(tenantId)
      if (!tenant) {
        throw new Error('Tenant not found')
      }

      if (tenant.mode !== 'shared') {
        throw new Error('Tenant is not in shared mode')
      }

      if (tenant.status !== 'active') {
        throw new Error('Tenant is not active')
      }

      tenantLogger.info({ 
        tenant_name: tenant.name,
        current_plan: tenant.plan 
      }, 'Starting promotion to dedicated')

      // Create promotion plan
      const plan = await this.createPromotionPlan(tenant)
      
      // Schedule promotion window if provided
      const scheduledAt = window?.scheduled_at || new Date(Date.now() + 5 * 60 * 1000) // Default: 5 minutes
      const ttlMinutes = window?.ttl_minutes || 10

      // Generate promotion ID for tracking
      const promotionId = `promotion_${tenantId}_${Date.now()}`

      // Update tenant status to migrating
      await dbService.updateTenantInstance(tenantId, {
        status: 'migrating',
        metadata: {
          ...tenant.metadata,
          promotion_id: promotionId,
          promotion_scheduled_at: scheduledAt.toISOString(),
          promotion_ttl_minutes: ttlMinutes,
          promotion_reason: window?.reason || 'Manual promotion request'
        }
      })

      // Execute promotion immediately if scheduled for now
      if (scheduledAt.getTime() <= Date.now() + 60000) { // Within 1 minute
        await this.executePromotion(tenant, plan, promotionId)
      } else {
        tenantLogger.info({ 
          scheduled_at: scheduledAt.toISOString(),
          promotion_id: promotionId
        }, 'Promotion scheduled for later execution')
      }

      const estimatedCompletion = new Date(
        scheduledAt.getTime() + plan.estimated_downtime_minutes * 60 * 1000
      ).toISOString()

      auditLog('tenant_promotion_initiated', tenantId, {
        promotion_id: promotionId,
        scheduled_at: scheduledAt.toISOString(),
        estimated_completion: estimatedCompletion
      })

      return {
        success: true,
        promotion_id: promotionId,
        estimated_completion: estimatedCompletion,
        plan
      }

    } catch (error) {
      tenantLogger.error({ error }, 'Failed to initiate promotion')
      throw error
    }
  }

  // =============================================================================
  // PROMOTION PLANNING
  // =============================================================================

  private async createPromotionPlan(tenant: TenantInstance): Promise<PromotionPlan> {
    // Determine dedicated resources based on current plan
    const dedicatedResources = this.getResourcesByPlan(tenant.plan)
    
    // Generate unique database name
    const dbName = `n8n_${tenant.subdomain}_${Date.now()}`

    // Define migration steps
    const migrationSteps = [
      '1. Create dedicated PostgreSQL database',
      '2. Export workflows and credentials from shared instance',
      '3. Create Docker container with dedicated resources',
      '4. Import data to dedicated database',
      '5. Configure Traefik routing to new container',
      '6. Verify container health and connectivity',
      '7. Update DNS/routing (atomic switch)',
      '8. Cleanup shared instance data'
    ]

    // Estimate downtime based on tenant size
    const estimatedDowntime = this.estimateDowntime(tenant)

    return {
      tenant,
      new_resources: dedicatedResources,
      db_name: dbName,
      migration_steps: migrationSteps,
      estimated_downtime_minutes: estimatedDowntime
    }
  }

  private getResourcesByPlan(plan: string) {
    const resources = {
      starter: { cpu_cores: 1, memory_mb: 1024, workers: 1, storage_gb: 10 },
      pro: { cpu_cores: 2, memory_mb: 2048, workers: 2, storage_gb: 20 },
      enterprise: { cpu_cores: 4, memory_mb: 4096, workers: 4, storage_gb: 50 }
    }
    
    return resources[plan as keyof typeof resources] || resources.pro
  }

  private estimateDowntime(tenant: TenantInstance): number {
    // Base downtime: 5 minutes
    let downtime = 5

    // Add time based on tenant age (more data = longer migration)
    const tenantAge = Date.now() - new Date(tenant.created_at).getTime()
    const ageInDays = tenantAge / (1000 * 60 * 60 * 24)
    downtime += Math.min(5, ageInDays / 30) // Up to 5 minutes for old tenants

    // Add time based on plan complexity
    if (tenant.plan === 'enterprise') downtime += 3
    else if (tenant.plan === 'pro') downtime += 1

    return Math.ceil(downtime)
  }

  // =============================================================================
  // PROMOTION EXECUTION
  // =============================================================================

  private async executePromotion(
    tenant: TenantInstance,
    plan: PromotionPlan,
    promotionId: string
  ): Promise<void> {
    const tenantLogger = createTenantLogger(tenant.tenant_id)
    
    try {
      tenantLogger.info({ promotion_id: promotionId }, 'Executing tenant promotion')

      // Step 1: Export data from shared instance
      const exportData = await this.exportSharedInstanceData(tenant)
      
      // Step 2: Create dedicated container
      const containerId = await dockerService.createN8nContainer(
        tenant.tenant_id,
        tenant.subdomain,
        {
          cpu_cores: plan.new_resources.cpu_cores,
          memory_mb: plan.new_resources.memory_mb,
          workers: plan.new_resources.workers,
          db_name: plan.db_name
        }
      )

      // Step 3: Wait for container to be healthy
      await this.waitForContainerHealth(containerId, 60) // 60 seconds timeout

      // Step 4: Import data to dedicated instance
      await this.importDataToDedicated(tenant, exportData, containerId)

      // Step 5: Update tenant record
      await dbService.updateTenantInstance(tenant.tenant_id, {
        mode: 'dedicated',
        status: 'active',
        container_id: containerId,
        container_status: 'running',
        db_name: plan.db_name,
        n8n_url: `https://${tenant.subdomain}.rp9.io`,
        traefik_router: `n8n-${tenant.subdomain}-router`,
        cpu_cores: plan.new_resources.cpu_cores,
        memory_mb: plan.new_resources.memory_mb,
        workers: plan.new_resources.workers,
        storage_gb: plan.new_resources.storage_gb,
        metadata: {
          ...tenant.metadata,
          promoted_at: new Date().toISOString(),
          promotion_id: promotionId,
          previous_mode: 'shared'
        }
      })

      // Step 6: Cleanup shared instance data (optional, for data privacy)
      await this.cleanupSharedInstanceData(tenant)

      tenantLogger.info({ 
        promotion_id: promotionId,
        container_id: containerId,
        new_mode: 'dedicated'
      }, 'Tenant promotion completed successfully')

      auditLog('tenant_promotion_completed', tenant.tenant_id, {
        promotion_id: promotionId,
        container_id: containerId,
        resources: plan.new_resources
      })

    } catch (error) {
      tenantLogger.error({ 
        error,
        promotion_id: promotionId 
      }, 'Tenant promotion failed')

      // Rollback: Update status to failed
      await dbService.updateTenantInstance(tenant.tenant_id, {
        status: 'failed',
        metadata: {
          ...tenant.metadata,
          promotion_error: error instanceof Error ? error.message : 'Unknown error',
          promotion_failed_at: new Date().toISOString()
        }
      })

      throw error
    }
  }

  // =============================================================================
  // DATA MIGRATION HELPERS
  // =============================================================================

  private async exportSharedInstanceData(tenant: TenantInstance): Promise<{
    workflows: any[]
    credentials: any[]
    settings: any
    executions_count: number
  }> {
    // In a real implementation, this would:
    // 1. Connect to shared n8n instance API
    // 2. Export all workflows for this tenant
    // 3. Export all credentials (encrypted)
    // 4. Export tenant-specific settings
    // 5. Get execution count for sizing

    const mockExport = {
      workflows: [
        {
          id: 'workflow_1',
          name: 'Sample Workflow',
          active: true,
          nodes: [],
          connections: {},
          settings: {},
          staticData: {}
        }
      ],
      credentials: [
        {
          id: 'cred_1',
          name: 'Sample Credential',
          type: 'httpBasicAuth',
          data: 'encrypted_data_here'
        }
      ],
      settings: {
        timezone: 'America/Mexico_City',
        saveExecutionProgress: true,
        saveManualExecutions: true
      },
      executions_count: 150
    }

    logger.info({ 
      tenant_id: tenant.tenant_id,
      workflows: mockExport.workflows.length,
      credentials: mockExport.credentials.length,
      executions: mockExport.executions_count
    }, 'Shared instance data export completed (mock)')

    return mockExport
  }

  private async importDataToDedicated(
    tenant: TenantInstance,
    exportData: any,
    containerId: string
  ): Promise<void> {
    // In a real implementation, this would:
    // 1. Wait for dedicated n8n instance to be ready
    // 2. Import workflows via n8n API
    // 3. Import credentials (re-encrypt with instance key)
    // 4. Apply tenant-specific settings
    // 5. Verify import success

    logger.info({ 
      tenant_id: tenant.tenant_id,
      container_id: containerId,
      workflows_to_import: exportData.workflows.length,
      credentials_to_import: exportData.credentials.length
    }, 'Data import to dedicated instance completed (mock)')

    // Mock delay for import process
    await new Promise(resolve => setTimeout(resolve, 2000))
  }

  private async waitForContainerHealth(containerId: string, timeoutSeconds: number): Promise<void> {
    const startTime = Date.now()
    const timeout = timeoutSeconds * 1000

    while (Date.now() - startTime < timeout) {
      try {
        const status = await dockerService.getContainerStatus(containerId)
        
        if (status.status === 'running' && status.health === 'healthy') {
          logger.info({ container_id: containerId }, 'Container is healthy')
          return
        }

        if (status.status === 'failed') {
          throw new Error('Container failed to start')
        }

      } catch (error) {
        logger.warn({ 
          container_id: containerId,
          error: error instanceof Error ? error.message : 'Unknown error'
        }, 'Container health check failed, retrying...')
      }

      // Wait 5 seconds before next check
      await new Promise(resolve => setTimeout(resolve, 5000))
    }

    throw new Error(`Container health check timed out after ${timeoutSeconds} seconds`)
  }

  private async cleanupSharedInstanceData(tenant: TenantInstance): Promise<void> {
    // In a real implementation, this would:
    // 1. Delete tenant workflows from shared instance
    // 2. Delete tenant credentials from shared instance
    // 3. Clean up execution history
    // 4. Remove tenant-specific data

    logger.info({ 
      tenant_id: tenant.tenant_id 
    }, 'Shared instance cleanup completed (mock)')
  }

  // =============================================================================
  // ROLLBACK FUNCTIONALITY
  // =============================================================================

  async rollbackPromotion(tenantId: string, promotionId: string): Promise<void> {
    const tenantLogger = createTenantLogger(tenantId)
    
    try {
      const tenant = await dbService.getTenantInstance(tenantId)
      if (!tenant) {
        throw new Error('Tenant not found')
      }

      tenantLogger.info({ promotion_id: promotionId }, 'Rolling back promotion')

      // Stop and remove dedicated container if exists
      if (tenant.container_id) {
        await dockerService.removeContainer(tenant.container_id, tenantId)
      }

      // Revert tenant to shared mode
      await dbService.updateTenantInstance(tenantId, {
        mode: 'shared',
        status: 'active',
        container_id: null,
        container_status: null,
        db_name: null,
        n8n_url: process.env.SHARED_N8N_BASE_URL,
        traefik_router: null,
        metadata: {
          ...tenant.metadata,
          rolled_back_at: new Date().toISOString(),
          rollback_promotion_id: promotionId,
          rollback_reason: 'Manual rollback or promotion failure'
        }
      })

      auditLog('tenant_promotion_rolled_back', tenantId, {
        promotion_id: promotionId,
        rolled_back_at: new Date().toISOString()
      })

      tenantLogger.info({ promotion_id: promotionId }, 'Promotion rollback completed')

    } catch (error) {
      tenantLogger.error({ error, promotion_id: promotionId }, 'Failed to rollback promotion')
      throw error
    }
  }
}

export const promotionService = new PromotionService()