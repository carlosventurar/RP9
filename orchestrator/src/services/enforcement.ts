// RP9 Orchestrator - Enforcement Service
import Stripe from 'stripe'
import { dbService } from './database'
import { logger, createTenantLogger } from '@/utils/logger'
import { config } from '@/utils/config'
import { TenantInstance, TenantQuotas, EnforcementEvent } from '@/types'

interface UsageMetrics {
  tenant_id: string
  executions_monthly: number
  concurrent_executions: number
  cpu_usage_percent: number
  memory_usage_mb: number
  storage_usage_gb: number
  api_calls_hourly: number
}

interface EnforcementAction {
  tenant_id: string
  limit_type: string
  action: 'warning' | 'throttle' | 'suspend' | 'overage_billing'
  severity: 'info' | 'warning' | 'critical'
  current_usage: number
  limit_value: number
  usage_percentage: number
  message: string
}

export class EnforcementService {
  private stripe: Stripe

  constructor() {
    this.stripe = new Stripe(config.stripe_secret_key, {
      apiVersion: '2023-10-16'
    })
    
    logger.info('Enforcement service initialized')
  }

  // =============================================================================
  // MAIN ENFORCEMENT LOGIC
  // =============================================================================

  async runEnforcement(): Promise<{
    tenants_checked: number
    violations_found: number
    actions_taken: number
    actions: EnforcementAction[]
  }> {
    logger.info('Starting enforcement run')

    try {
      // Get all active tenants
      const tenants = await dbService.listTenantInstances({
        status: 'active'
      })

      let violationsFound = 0
      let actionsTaken = 0
      const actions: EnforcementAction[] = []

      for (const tenant of tenants) {
        try {
          const tenantLogger = createTenantLogger(tenant.tenant_id)
          
          // Get tenant quotas/limits
          const quotas = await dbService.getTenantQuotas(tenant.tenant_id)
          if (!quotas) {
            tenantLogger.warn('No quotas found for tenant, skipping enforcement')
            continue
          }

          // Skip if enforcement is disabled
          if (!quotas.enforcement_enabled) {
            continue
          }

          // Sync quotas with Stripe (get latest entitlements)
          await this.syncStripeEntitlements(tenant.tenant_id, tenant.plan, quotas)

          // Get current usage metrics
          const usage = await this.getTenantUsage(tenant)

          // Check all limits and generate enforcement actions
          const tenantActions = await this.checkLimits(tenant, quotas, usage)

          // Execute enforcement actions
          for (const action of tenantActions) {
            await this.executeEnforcementAction(action)
            actionsTaken++
          }

          violationsFound += tenantActions.length
          actions.push(...tenantActions)

          if (tenantActions.length > 0) {
            tenantLogger.info({
              violations: tenantActions.length,
              actions: tenantActions.map(a => ({ limit: a.limit_type, action: a.action }))
            }, 'Enforcement actions executed for tenant')
          }

        } catch (tenantError) {
          logger.error({
            error: tenantError,
            tenant_id: tenant.tenant_id
          }, 'Failed to process tenant for enforcement')
        }
      }

      logger.info({
        tenants_checked: tenants.length,
        violations_found: violationsFound,
        actions_taken: actionsTaken
      }, 'Enforcement run completed')

      return {
        tenants_checked: tenants.length,
        violations_found: violationsFound,
        actions_taken: actionsTaken,
        actions
      }

    } catch (error) {
      logger.error({ error }, 'Enforcement run failed')
      throw error
    }
  }

  // =============================================================================
  // STRIPE ENTITLEMENTS SYNC
  // =============================================================================

  private async syncStripeEntitlements(
    tenantId: string,
    plan: string,
    currentQuotas: TenantQuotas
  ): Promise<void> {
    try {
      // In a real implementation, we would:
      // 1. Fetch customer from Stripe using tenant metadata
      // 2. Get active subscriptions and their entitlements
      // 3. Update quotas based on Stripe data

      // For now, we'll use plan-based defaults and mock some Stripe data
      const stripeEntitlements = await this.getStripeEntitlements(tenantId, plan)
      
      if (stripeEntitlements) {
        await dbService.updateTenantQuotas(tenantId, {
          ...stripeEntitlements,
          stripe_entitlements: {
            synced_at: new Date().toISOString(),
            plan,
            source: 'stripe_api'
          },
          last_sync_at: new Date().toISOString()
        })

        logger.info({
          tenant_id: tenantId,
          plan,
          entitlements: stripeEntitlements
        }, 'Stripe entitlements synced')
      }

    } catch (error) {
      logger.error({
        error,
        tenant_id: tenantId
      }, 'Failed to sync Stripe entitlements')
    }
  }

  private async getStripeEntitlements(tenantId: string, plan: string): Promise<Partial<TenantQuotas> | null> {
    try {
      // Mock Stripe entitlements based on plan
      // In real implementation, fetch from Stripe API
      const entitlementsByPlan: Record<string, Partial<TenantQuotas>> = {
        starter: {
          executions_monthly: 1000,
          concurrent_executions: 2,
          cpu_limit_percent: 100,
          memory_limit_mb: 1024,
          storage_limit_gb: 5,
          api_calls_hourly: 100,
          webhook_endpoints: 5
        },
        pro: {
          executions_monthly: 10000,
          concurrent_executions: 10,
          cpu_limit_percent: 200,
          memory_limit_mb: 2048,
          storage_limit_gb: 20,
          api_calls_hourly: 1000,
          webhook_endpoints: 20
        },
        enterprise: {
          executions_monthly: 100000,
          concurrent_executions: 50,
          cpu_limit_percent: 400,
          memory_limit_mb: 4096,
          storage_limit_gb: 100,
          api_calls_hourly: 10000,
          webhook_endpoints: 100
        }
      }

      return entitlementsByPlan[plan] || entitlementsByPlan.starter

    } catch (error) {
      logger.error({
        error,
        tenant_id: tenantId,
        plan
      }, 'Failed to get Stripe entitlements')
      
      return null
    }
  }

  // =============================================================================
  // USAGE METRICS COLLECTION
  // =============================================================================

  private async getTenantUsage(tenant: TenantInstance): Promise<UsageMetrics> {
    try {
      // In a real implementation, we would collect usage from:
      // 1. n8n database for executions
      // 2. Docker stats for CPU/memory
      // 3. Storage usage from file system
      // 4. API gateway logs for API calls

      // For now, generate realistic mock usage data
      return this.generateMockUsage(tenant)

    } catch (error) {
      logger.error({
        error,
        tenant_id: tenant.tenant_id
      }, 'Failed to get tenant usage')

      // Return zero usage if collection fails
      return {
        tenant_id: tenant.tenant_id,
        executions_monthly: 0,
        concurrent_executions: 0,
        cpu_usage_percent: 0,
        memory_usage_mb: 0,
        storage_usage_gb: 0,
        api_calls_hourly: 0
      }
    }
  }

  private generateMockUsage(tenant: TenantInstance): UsageMetrics {
    // Generate realistic usage based on tenant plan
    const planMultipliers = {
      starter: { base: 0.3, variance: 0.4 },
      pro: { base: 0.5, variance: 0.3 },
      enterprise: { base: 0.7, variance: 0.2 }
    }

    const multiplier = planMultipliers[tenant.plan as keyof typeof planMultipliers] || planMultipliers.starter
    const usage = multiplier.base + (Math.random() - 0.5) * multiplier.variance

    return {
      tenant_id: tenant.tenant_id,
      executions_monthly: Math.floor(usage * 1000 * (tenant.plan === 'enterprise' ? 100 : tenant.plan === 'pro' ? 10 : 1)),
      concurrent_executions: Math.floor(usage * tenant.workers * 2),
      cpu_usage_percent: Math.min(100, usage * 120),
      memory_usage_mb: Math.floor(usage * tenant.memory_mb),
      storage_usage_gb: Math.floor(usage * tenant.storage_gb * 0.8),
      api_calls_hourly: Math.floor(usage * 50 * (tenant.plan === 'enterprise' ? 200 : tenant.plan === 'pro' ? 20 : 2))
    }
  }

  // =============================================================================
  // LIMITS CHECKING
  // =============================================================================

  private async checkLimits(
    tenant: TenantInstance,
    quotas: TenantQuotas,
    usage: UsageMetrics
  ): Promise<EnforcementAction[]> {
    const actions: EnforcementAction[] = []

    // Check executions monthly
    const execUsagePercent = (usage.executions_monthly / quotas.executions_monthly) * 100
    if (execUsagePercent >= 80) {
      actions.push({
        tenant_id: tenant.tenant_id,
        limit_type: 'executions_monthly',
        action: execUsagePercent >= 100 ? 'suspend' : execUsagePercent >= 95 ? 'throttle' : 'warning',
        severity: execUsagePercent >= 100 ? 'critical' : execUsagePercent >= 95 ? 'warning' : 'info',
        current_usage: usage.executions_monthly,
        limit_value: quotas.executions_monthly,
        usage_percentage: execUsagePercent,
        message: `Monthly executions at ${execUsagePercent.toFixed(1)}% of limit`
      })
    }

    // Check concurrent executions
    const concurrentUsagePercent = (usage.concurrent_executions / quotas.concurrent_executions) * 100
    if (concurrentUsagePercent >= 90) {
      actions.push({
        tenant_id: tenant.tenant_id,
        limit_type: 'concurrent_executions',
        action: concurrentUsagePercent >= 100 ? 'throttle' : 'warning',
        severity: concurrentUsagePercent >= 100 ? 'critical' : 'warning',
        current_usage: usage.concurrent_executions,
        limit_value: quotas.concurrent_executions,
        usage_percentage: concurrentUsagePercent,
        message: `Concurrent executions at ${concurrentUsagePercent.toFixed(1)}% of limit`
      })
    }

    // Check CPU usage
    const cpuUsagePercent = (usage.cpu_usage_percent / quotas.cpu_limit_percent) * 100
    if (cpuUsagePercent >= 90) {
      actions.push({
        tenant_id: tenant.tenant_id,
        limit_type: 'cpu_usage',
        action: cpuUsagePercent >= 100 ? 'throttle' : 'warning',
        severity: cpuUsagePercent >= 100 ? 'critical' : 'warning',
        current_usage: usage.cpu_usage_percent,
        limit_value: quotas.cpu_limit_percent,
        usage_percentage: cpuUsagePercent,
        message: `CPU usage at ${cpuUsagePercent.toFixed(1)}% of allocated limit`
      })
    }

    // Check memory usage
    const memoryUsagePercent = (usage.memory_usage_mb / quotas.memory_limit_mb) * 100
    if (memoryUsagePercent >= 85) {
      actions.push({
        tenant_id: tenant.tenant_id,
        limit_type: 'memory_usage',
        action: memoryUsagePercent >= 100 ? 'throttle' : 'warning',
        severity: memoryUsagePercent >= 100 ? 'critical' : 'warning',
        current_usage: usage.memory_usage_mb,
        limit_value: quotas.memory_limit_mb,
        usage_percentage: memoryUsagePercent,
        message: `Memory usage at ${memoryUsagePercent.toFixed(1)}% of allocated limit`
      })
    }

    // Check storage usage
    const storageUsagePercent = (usage.storage_usage_gb / quotas.storage_limit_gb) * 100
    if (storageUsagePercent >= 90) {
      actions.push({
        tenant_id: tenant.tenant_id,
        limit_type: 'storage',
        action: storageUsagePercent >= 100 ? 'suspend' : 'warning',
        severity: storageUsagePercent >= 100 ? 'critical' : 'warning',
        current_usage: usage.storage_usage_gb,
        limit_value: quotas.storage_limit_gb,
        usage_percentage: storageUsagePercent,
        message: `Storage usage at ${storageUsagePercent.toFixed(1)}% of limit`
      })
    }

    // Check API calls
    const apiUsagePercent = (usage.api_calls_hourly / quotas.api_calls_hourly) * 100
    if (apiUsagePercent >= 90) {
      actions.push({
        tenant_id: tenant.tenant_id,
        limit_type: 'api_calls',
        action: apiUsagePercent >= 100 ? 'throttle' : 'warning',
        severity: apiUsagePercent >= 100 ? 'critical' : 'warning',
        current_usage: usage.api_calls_hourly,
        limit_value: quotas.api_calls_hourly,
        usage_percentage: apiUsagePercent,
        message: `API calls at ${apiUsagePercent.toFixed(1)}% of hourly limit`
      })
    }

    return actions
  }

  // =============================================================================
  // ENFORCEMENT ACTION EXECUTION
  // =============================================================================

  private async executeEnforcementAction(action: EnforcementAction): Promise<void> {
    const tenantLogger = createTenantLogger(action.tenant_id)

    try {
      // Create enforcement event record
      const event = await dbService.createEnforcementEvent({
        tenant_id: action.tenant_id,
        limit_type: action.limit_type,
        current_usage: action.current_usage,
        limit_value: action.limit_value,
        usage_percentage: action.usage_percentage,
        action: action.action,
        severity: action.severity,
        status: 'active',
        notification_sent: false,
        metadata: {
          message: action.message,
          executed_at: new Date().toISOString()
        }
      })

      // Execute the actual enforcement action
      switch (action.action) {
        case 'warning':
          await this.sendWarningNotification(action, event.id)
          break
          
        case 'throttle':
          await this.applyThrottling(action, event.id)
          break
          
        case 'suspend':
          await this.suspendTenant(action, event.id)
          break
          
        case 'overage_billing':
          await this.createOverageBilling(action, event.id)
          break
      }

      tenantLogger.info({
        event_id: event.id,
        action: action.action,
        limit_type: action.limit_type,
        usage_percentage: action.usage_percentage
      }, 'Enforcement action executed')

    } catch (error) {
      tenantLogger.error({
        error,
        action: action.action,
        limit_type: action.limit_type
      }, 'Failed to execute enforcement action')
      
      throw error
    }
  }

  private async sendWarningNotification(action: EnforcementAction, eventId: string): Promise<void> {
    // TODO: Implement notification system (email, Slack, in-app)
    logger.info({
      tenant_id: action.tenant_id,
      event_id: eventId,
      message: action.message
    }, 'Warning notification sent (placeholder)')
  }

  private async applyThrottling(action: EnforcementAction, eventId: string): Promise<void> {
    // TODO: Implement actual throttling mechanisms
    // - Rate limiting at API gateway level
    // - Container resource constraints
    // - Queue processing limits
    logger.info({
      tenant_id: action.tenant_id,
      event_id: eventId,
      limit_type: action.limit_type
    }, 'Throttling applied (placeholder)')
  }

  private async suspendTenant(action: EnforcementAction, eventId: string): Promise<void> {
    try {
      // Update tenant status to suspended
      await dbService.updateTenantInstance(action.tenant_id, {
        status: 'suspended',
        metadata: {
          suspended_at: new Date().toISOString(),
          suspension_reason: action.message,
          enforcement_event_id: eventId
        }
      })

      logger.info({
        tenant_id: action.tenant_id,
        event_id: eventId,
        reason: action.message
      }, 'Tenant suspended due to limit violation')

    } catch (error) {
      logger.error({
        error,
        tenant_id: action.tenant_id,
        event_id: eventId
      }, 'Failed to suspend tenant')
      
      throw error
    }
  }

  private async createOverageBilling(action: EnforcementAction, eventId: string): Promise<void> {
    // TODO: Implement overage billing through Stripe
    // - Create usage record
    // - Bill for overage at defined rates
    logger.info({
      tenant_id: action.tenant_id,
      event_id: eventId,
      limit_type: action.limit_type,
      overage: action.current_usage - action.limit_value
    }, 'Overage billing created (placeholder)')
  }
}

export const enforcementService = new EnforcementService()