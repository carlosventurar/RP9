// RP9 Orchestrator - Database Service
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { Pool } from 'pg'
import { config } from '@/utils/config'
import { logger } from '@/utils/logger'
import { 
  TenantInstance, 
  TenantQuotas, 
  TenantBackup, 
  AutoscaleEvent,
  EnforcementEvent
} from '@/types'

export class DatabaseService {
  private supabase: SupabaseClient
  private pgPool: Pool

  constructor() {
    // Supabase client para operaciones high-level
    this.supabase = createClient(
      config.supabase_url,
      config.supabase_service_role_key,
      {
        auth: { persistSession: false }
      }
    )

    // PostgreSQL pool para operaciones directas
    this.pgPool = new Pool({
      connectionString: config.postgres_url,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    })

    logger.info('Database service initialized')
  }

  // =============================================================================
  // TENANT INSTANCES
  // =============================================================================

  async createTenantInstance(data: Partial<TenantInstance>): Promise<TenantInstance> {
    const { data: tenant, error } = await this.supabase
      .from('tenant_instances')
      .insert(data)
      .select()
      .single()

    if (error) {
      logger.error({ error, data }, 'Failed to create tenant instance')
      throw new Error(`Failed to create tenant instance: ${error.message}`)
    }

    logger.info({ tenant_id: tenant.tenant_id }, 'Tenant instance created')
    return tenant
  }

  async getTenantInstance(tenantId: string): Promise<TenantInstance | null> {
    const { data: tenant, error } = await this.supabase
      .from('tenant_instances')
      .select('*')
      .eq('tenant_id', tenantId)
      .single()

    if (error && error.code !== 'PGRST116') {
      logger.error({ error, tenant_id: tenantId }, 'Failed to get tenant instance')
      throw new Error(`Failed to get tenant instance: ${error.message}`)
    }

    return tenant
  }

  async updateTenantInstance(
    tenantId: string, 
    updates: Partial<TenantInstance>
  ): Promise<TenantInstance> {
    const { data: tenant, error } = await this.supabase
      .from('tenant_instances')
      .update(updates)
      .eq('tenant_id', tenantId)
      .select()
      .single()

    if (error) {
      logger.error({ error, tenant_id: tenantId, updates }, 'Failed to update tenant instance')
      throw new Error(`Failed to update tenant instance: ${error.message}`)
    }

    logger.info({ tenant_id: tenantId, updates }, 'Tenant instance updated')
    return tenant
  }

  async listTenantInstances(filters: {
    mode?: 'shared' | 'dedicated'
    status?: string
    plan?: string
    limit?: number
    offset?: number
  } = {}): Promise<TenantInstance[]> {
    let query = this.supabase
      .from('tenant_instances')
      .select('*')

    if (filters.mode) query = query.eq('mode', filters.mode)
    if (filters.status) query = query.eq('status', filters.status)
    if (filters.plan) query = query.eq('plan', filters.plan)
    if (filters.limit) query = query.limit(filters.limit)
    if (filters.offset) query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1)

    const { data: tenants, error } = await query.order('created_at', { ascending: false })

    if (error) {
      logger.error({ error, filters }, 'Failed to list tenant instances')
      throw new Error(`Failed to list tenant instances: ${error.message}`)
    }

    return tenants || []
  }

  // =============================================================================
  // TENANT QUOTAS
  // =============================================================================

  async getTenantQuotas(tenantId: string): Promise<TenantQuotas | null> {
    const { data: quotas, error } = await this.supabase
      .from('tenant_quotas')
      .select('*')
      .eq('tenant_id', tenantId)
      .single()

    if (error && error.code !== 'PGRST116') {
      logger.error({ error, tenant_id: tenantId }, 'Failed to get tenant quotas')
      throw new Error(`Failed to get tenant quotas: ${error.message}`)
    }

    return quotas
  }

  async updateTenantQuotas(
    tenantId: string, 
    updates: Partial<TenantQuotas>
  ): Promise<TenantQuotas> {
    const { data: quotas, error } = await this.supabase
      .from('tenant_quotas')
      .upsert({ 
        tenant_id: tenantId,
        ...updates,
        updated_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) {
      logger.error({ error, tenant_id: tenantId, updates }, 'Failed to update tenant quotas')
      throw new Error(`Failed to update tenant quotas: ${error.message}`)
    }

    logger.info({ tenant_id: tenantId }, 'Tenant quotas updated')
    return quotas
  }

  // =============================================================================
  // BACKUPS
  // =============================================================================

  async createBackup(data: Partial<TenantBackup>): Promise<TenantBackup> {
    const { data: backup, error } = await this.supabase
      .from('tenant_backups')
      .insert(data)
      .select()
      .single()

    if (error) {
      logger.error({ error, data }, 'Failed to create backup record')
      throw new Error(`Failed to create backup record: ${error.message}`)
    }

    logger.info({ tenant_id: data.tenant_id, backup_id: backup.id }, 'Backup record created')
    return backup
  }

  async updateBackup(
    backupId: string, 
    updates: Partial<TenantBackup>
  ): Promise<TenantBackup> {
    const { data: backup, error } = await this.supabase
      .from('tenant_backups')
      .update(updates)
      .eq('id', backupId)
      .select()
      .single()

    if (error) {
      logger.error({ error, backup_id: backupId, updates }, 'Failed to update backup')
      throw new Error(`Failed to update backup: ${error.message}`)
    }

    return backup
  }

  async getBackupsForTenant(tenantId: string): Promise<TenantBackup[]> {
    const { data: backups, error } = await this.supabase
      .from('tenant_backups')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })

    if (error) {
      logger.error({ error, tenant_id: tenantId }, 'Failed to get backups for tenant')
      throw new Error(`Failed to get backups for tenant: ${error.message}`)
    }

    return backups || []
  }

  // =============================================================================
  // AUTOSCALE EVENTS
  // =============================================================================

  async createAutoscaleEvent(data: Partial<AutoscaleEvent>): Promise<AutoscaleEvent> {
    const { data: event, error } = await this.supabase
      .from('autoscale_events')
      .insert(data)
      .select()
      .single()

    if (error) {
      logger.error({ error, data }, 'Failed to create autoscale event')
      throw new Error(`Failed to create autoscale event: ${error.message}`)
    }

    logger.info({ tenant_id: data.tenant_id, event_id: event.id }, 'Autoscale event created')
    return event
  }

  async updateAutoscaleEvent(
    eventId: string, 
    updates: Partial<AutoscaleEvent>
  ): Promise<AutoscaleEvent> {
    const { data: event, error } = await this.supabase
      .from('autoscale_events')
      .update(updates)
      .eq('id', eventId)
      .select()
      .single()

    if (error) {
      logger.error({ error, event_id: eventId, updates }, 'Failed to update autoscale event')
      throw new Error(`Failed to update autoscale event: ${error.message}`)
    }

    return event
  }

  // =============================================================================
  // ENFORCEMENT EVENTS
  // =============================================================================

  async createEnforcementEvent(data: Partial<EnforcementEvent>): Promise<EnforcementEvent> {
    const { data: event, error } = await this.supabase
      .from('enforcement_events')
      .insert(data)
      .select()
      .single()

    if (error) {
      logger.error({ error, data }, 'Failed to create enforcement event')
      throw new Error(`Failed to create enforcement event: ${error.message}`)
    }

    logger.info({ tenant_id: data.tenant_id, event_id: event.id }, 'Enforcement event created')
    return event
  }

  async getActiveEnforcementEvents(tenantId: string): Promise<EnforcementEvent[]> {
    const { data: events, error } = await this.supabase
      .from('enforcement_events')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })

    if (error) {
      logger.error({ error, tenant_id: tenantId }, 'Failed to get active enforcement events')
      throw new Error(`Failed to get active enforcement events: ${error.message}`)
    }

    return events || []
  }

  // =============================================================================
  // MÉTRICAS Y VIEWS
  // =============================================================================

  async getTenantMetrics(tenantId?: string): Promise<any[]> {
    let query = this.supabase
      .from('tenant_metrics')
      .select('*')

    if (tenantId) {
      query = query.eq('tenant_id', tenantId)
    }

    const { data: metrics, error } = await query

    if (error) {
      logger.error({ error, tenant_id: tenantId }, 'Failed to get tenant metrics')
      throw new Error(`Failed to get tenant metrics: ${error.message}`)
    }

    return metrics || []
  }

  async getTenantCosts(tenantId?: string): Promise<any[]> {
    let query = this.supabase
      .from('tenant_costs')
      .select('*')

    if (tenantId) {
      query = query.eq('tenant_id', tenantId)
    }

    const { data: costs, error } = await query

    if (error) {
      logger.error({ error, tenant_id: tenantId }, 'Failed to get tenant costs')
      throw new Error(`Failed to get tenant costs: ${error.message}`)
    }

    return costs || []
  }

  // =============================================================================
  // HEALTH & MAINTENANCE
  // =============================================================================

  async healthCheck(): Promise<boolean> {
    try {
      const { data, error } = await this.supabase
        .from('tenant_instances')
        .select('count')
        .limit(1)
        .single()

      return !error
    } catch (error) {
      logger.error({ error }, 'Database health check failed')
      return false
    }
  }

  async cleanupOldEvents(): Promise<void> {
    try {
      const client = await this.pgPool.connect()
      await client.query('SELECT cleanup_old_events()')
      client.release()
      
      logger.info('Old events cleanup completed')
    } catch (error) {
      logger.error({ error }, 'Failed to cleanup old events')
      throw error
    }
  }

  async close(): Promise<void> {
    await this.pgPool.end()
    logger.info('Database service closed')
  }
}

export const dbService = new DatabaseService()