// RP9 Orchestrator - Auto-scaling Service
import { dbService } from './database'
import { dockerService } from './docker'
import { logger, createTenantLogger } from '@/utils/logger'
import { TenantInstance, AutoscaleEvent } from '@/types'

interface AutoscaleThresholds {
  queue_wait_p95_threshold: number
  cpu_threshold: number
  memory_threshold: number
  executions_min_threshold: number
}

interface TenantMetrics {
  tenant_id: string
  subdomain: string
  queue_wait_p95_seconds: number
  cpu_percent: number
  memory_percent: number
  executions_per_minute: number
}

export class AutoscalerService {
  private thresholds: AutoscaleThresholds

  constructor() {
    this.thresholds = {
      queue_wait_p95_threshold: parseFloat(process.env.AUTOSCALE_QUEUE_WAIT_P95_THRESHOLD || '5.0'),
      cpu_threshold: parseFloat(process.env.AUTOSCALE_CPU_THRESHOLD || '80.0'),
      memory_threshold: parseFloat(process.env.AUTOSCALE_MEMORY_THRESHOLD || '85.0'),
      executions_min_threshold: parseFloat(process.env.AUTOSCALE_EXECUTIONS_MIN_THRESHOLD || '10')
    }

    logger.info({ thresholds: this.thresholds }, 'Autoscaler service initialized')
  }

  // =============================================================================
  // MAIN AUTOSCALING LOGIC
  // =============================================================================

  async runAutoscaling(): Promise<{
    tenants_checked: number
    actions_taken: number
    actions: Array<{ tenant_id: string; action: string; reason: string }>
  }> {
    logger.info('Starting autoscaling run')

    try {
      // Get all active dedicated tenants
      const tenants = await dbService.listTenantInstances({
        mode: 'dedicated',
        status: 'active'
      })

      let actionsTaken = 0
      const actions: Array<{ tenant_id: string; action: string; reason: string }> = []

      for (const tenant of tenants) {
        try {
          const tenantLogger = createTenantLogger(tenant.tenant_id)
          
          // Get current metrics for the tenant
          const metrics = await this.getTenantMetrics(tenant)
          
          // Analyze metrics and determine if scaling is needed
          const scaleAction = await this.analyzeScalingNeed(tenant, metrics)
          
          if (scaleAction) {
            // Execute the scaling action
            await this.executeScaleAction(tenant, scaleAction, metrics)
            
            actionsTaken++
            actions.push({
              tenant_id: tenant.tenant_id,
              action: scaleAction.action,
              reason: scaleAction.reason
            })

            tenantLogger.info({
              action: scaleAction.action,
              reason: scaleAction.reason,
              metrics
            }, 'Autoscale action executed')
          }

        } catch (tenantError) {
          logger.error({
            error: tenantError,
            tenant_id: tenant.tenant_id
          }, 'Failed to process tenant for autoscaling')
        }
      }

      logger.info({
        tenants_checked: tenants.length,
        actions_taken: actionsTaken
      }, 'Autoscaling run completed')

      return {
        tenants_checked: tenants.length,
        actions_taken: actionsTaken,
        actions
      }

    } catch (error) {
      logger.error({ error }, 'Autoscaling run failed')
      throw error
    }
  }

  // =============================================================================
  // METRICS COLLECTION
  // =============================================================================

  private async getTenantMetrics(tenant: TenantInstance): Promise<TenantMetrics> {
    // En una implementación real, estas métricas vendrían de:
    // 1. n8n API para queue metrics
    // 2. Docker stats para CPU/memory  
    // 3. n8n database para executions
    // 4. Redis para queue depth

    try {
      // Mock metrics para desarrollo - reemplazar con implementación real
      const mockMetrics = this.generateRealisticMetrics(tenant)

      // TODO: Implementar collectors reales
      // const queueMetrics = await this.getN8nQueueMetrics(tenant)
      // const containerStats = await dockerService.getContainerStatus(tenant.container_id!)
      // const executionMetrics = await this.getN8nExecutionMetrics(tenant)

      return mockMetrics

    } catch (error) {
      logger.error({
        error,
        tenant_id: tenant.tenant_id
      }, 'Failed to get tenant metrics')

      // Return safe defaults if metrics collection fails
      return {
        tenant_id: tenant.tenant_id,
        subdomain: tenant.subdomain,
        queue_wait_p95_seconds: 0,
        cpu_percent: 0,
        memory_percent: 0,
        executions_per_minute: 0
      }
    }
  }

  private generateRealisticMetrics(tenant: TenantInstance): TenantMetrics {
    // Generate realistic metrics for testing
    const baseLoad = Math.random() * 0.8 + 0.1 // 10-90% base load
    
    return {
      tenant_id: tenant.tenant_id,
      subdomain: tenant.subdomain,
      queue_wait_p95_seconds: Math.random() * 10, // 0-10 seconds
      cpu_percent: baseLoad * 100, // 10-90%
      memory_percent: (baseLoad * 0.8 + 0.2) * 100, // 20-100%
      executions_per_minute: Math.floor(Math.random() * 20) // 0-20 per minute
    }
  }

  // =============================================================================
  // SCALING DECISION LOGIC
  // =============================================================================

  private async analyzeScalingNeed(
    tenant: TenantInstance,
    metrics: TenantMetrics
  ): Promise<{
    action: 'scale_up' | 'scale_down' | 'add_worker' | 'remove_worker'
    reason: string
    changes: Record<string, number>
  } | null> {

    const triggers: Array<{
      action: 'scale_up' | 'scale_down' | 'add_worker' | 'remove_worker'
      reason: string
      changes: Record<string, number>
    }> = []

    // Check queue wait time (highest priority)
    if (metrics.queue_wait_p95_seconds > this.thresholds.queue_wait_p95_threshold) {
      triggers.push({
        action: 'add_worker',
        reason: `Queue wait p95 ${metrics.queue_wait_p95_seconds.toFixed(2)}s > ${this.thresholds.queue_wait_p95_threshold}s`,
        changes: { workers: Math.min(tenant.workers + 1, 8) }
      })
    }

    // Check CPU usage
    if (metrics.cpu_percent > this.thresholds.cpu_threshold) {
      triggers.push({
        action: 'scale_up',
        reason: `CPU usage ${metrics.cpu_percent.toFixed(1)}% > ${this.thresholds.cpu_threshold}%`,
        changes: { cpu_cores: Math.min(tenant.cpu_cores + 1, 8) }
      })
    }

    // Check memory usage  
    if (metrics.memory_percent > this.thresholds.memory_threshold) {
      triggers.push({
        action: 'scale_up',
        reason: `Memory usage ${metrics.memory_percent.toFixed(1)}% > ${this.thresholds.memory_threshold}%`,
        changes: { memory_mb: Math.min(tenant.memory_mb * 1.5, 16384) }
      })
    }

    // Check executions per minute for worker scaling
    if (metrics.executions_per_minute > this.thresholds.executions_min_threshold && tenant.workers < 4) {
      triggers.push({
        action: 'add_worker',
        reason: `Executions/min ${metrics.executions_per_minute} > ${this.thresholds.executions_min_threshold}`,
        changes: { workers: tenant.workers + 1 }
      })
    }

    // Scale down conditions (less aggressive)
    if (metrics.cpu_percent < 20 && metrics.memory_percent < 30 && tenant.cpu_cores > 1) {
      triggers.push({
        action: 'scale_down',
        reason: `Low resource usage: CPU ${metrics.cpu_percent.toFixed(1)}%, Memory ${metrics.memory_percent.toFixed(1)}%`,
        changes: { 
          cpu_cores: Math.max(tenant.cpu_cores - 1, 1),
          memory_mb: Math.max(tenant.memory_mb * 0.8, 1024)
        }
      })
    }

    if (metrics.queue_wait_p95_seconds < 1 && metrics.executions_per_minute < 2 && tenant.workers > 1) {
      triggers.push({
        action: 'remove_worker',
        reason: `Low queue usage: wait ${metrics.queue_wait_p95_seconds.toFixed(2)}s, exec/min ${metrics.executions_per_minute}`,
        changes: { workers: Math.max(tenant.workers - 1, 1) }
      })
    }

    // Return highest priority trigger
    if (triggers.length > 0) {
      return triggers[0]
    }

    return null
  }

  // =============================================================================
  // SCALING EXECUTION
  // =============================================================================

  private async executeScaleAction(
    tenant: TenantInstance,
    scaleAction: {
      action: 'scale_up' | 'scale_down' | 'add_worker' | 'remove_worker'
      reason: string
      changes: Record<string, number>
    },
    metrics: TenantMetrics
  ): Promise<void> {

    const tenantLogger = createTenantLogger(tenant.tenant_id)

    // Create autoscale event record
    const event = await dbService.createAutoscaleEvent({
      tenant_id: tenant.tenant_id,
      trigger_type: this.determineTriggerType(scaleAction.reason),
      trigger_value: this.extractTriggerValue(metrics, scaleAction.reason),
      trigger_threshold: this.getThresholdForTrigger(scaleAction.reason),
      action: scaleAction.action,
      action_details: scaleAction.changes,
      status: 'in_progress',
      resources_before: {
        cpu_cores: tenant.cpu_cores,
        memory_mb: tenant.memory_mb,
        workers: tenant.workers
      },
      metadata: {
        reason: scaleAction.reason,
        metrics: metrics
      }
    })

    try {
      // Execute Docker scaling if needed
      if (scaleAction.action === 'scale_up' || scaleAction.action === 'scale_down') {
        if (tenant.container_id) {
          await dockerService.scaleContainer(
            tenant.container_id,
            tenant.tenant_id,
            {
              cpu_cores: scaleAction.changes.cpu_cores || tenant.cpu_cores,
              memory_mb: scaleAction.changes.memory_mb || tenant.memory_mb
            }
          )
        }
      }

      // Update tenant instance record
      const updates: Partial<TenantInstance> = {}
      if (scaleAction.changes.cpu_cores) updates.cpu_cores = scaleAction.changes.cpu_cores
      if (scaleAction.changes.memory_mb) updates.memory_mb = scaleAction.changes.memory_mb
      if (scaleAction.changes.workers) updates.workers = scaleAction.changes.workers

      if (Object.keys(updates).length > 0) {
        await dbService.updateTenantInstance(tenant.tenant_id, updates)
      }

      // Update event as completed
      await dbService.updateAutoscaleEvent(event.id, {
        status: 'completed',
        completed_at: new Date().toISOString(),
        success: true,
        resources_after: {
          cpu_cores: scaleAction.changes.cpu_cores || tenant.cpu_cores,
          memory_mb: scaleAction.changes.memory_mb || tenant.memory_mb,
          workers: scaleAction.changes.workers || tenant.workers
        }
      })

      tenantLogger.info({
        event_id: event.id,
        action: scaleAction.action,
        changes: scaleAction.changes
      }, 'Autoscale action completed successfully')

    } catch (error) {
      // Update event as failed
      await dbService.updateAutoscaleEvent(event.id, {
        status: 'failed',
        completed_at: new Date().toISOString(),
        success: false,
        error_message: error instanceof Error ? error.message : 'Unknown error'
      })

      tenantLogger.error({
        error,
        event_id: event.id,
        action: scaleAction.action
      }, 'Autoscale action failed')

      throw error
    }
  }

  // =============================================================================
  // HELPER METHODS
  // =============================================================================

  private determineTriggerType(reason: string): 'queue_wait_p95' | 'cpu_usage' | 'memory_usage' | 'executions_per_min' {
    if (reason.includes('Queue wait')) return 'queue_wait_p95'
    if (reason.includes('CPU')) return 'cpu_usage'
    if (reason.includes('Memory')) return 'memory_usage'
    if (reason.includes('Executions')) return 'executions_per_min'
    return 'cpu_usage'
  }

  private extractTriggerValue(metrics: TenantMetrics, reason: string): number {
    if (reason.includes('Queue wait')) return metrics.queue_wait_p95_seconds
    if (reason.includes('CPU')) return metrics.cpu_percent
    if (reason.includes('Memory')) return metrics.memory_percent
    if (reason.includes('Executions')) return metrics.executions_per_minute
    return 0
  }

  private getThresholdForTrigger(reason: string): number {
    if (reason.includes('Queue wait')) return this.thresholds.queue_wait_p95_threshold
    if (reason.includes('CPU')) return this.thresholds.cpu_threshold
    if (reason.includes('Memory')) return this.thresholds.memory_threshold
    if (reason.includes('Executions')) return this.thresholds.executions_min_threshold
    return 0
  }
}

export const autoscalerService = new AutoscalerService()