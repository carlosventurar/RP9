import { createClient } from '@supabase/supabase-js'

export interface AuditLogEntry {
  tenant_id: string
  user_id?: string
  action: string
  resource?: string
  resource_id?: string
  ip?: string
  user_agent?: string
  old?: any
  new?: any
  result: 'success' | 'error' | 'unauthorized' | 'blocked'
  metadata?: Record<string, any>
}

export interface AuditContext {
  tenant_id: string
  user_id?: string
  ip?: string
  user_agent?: string
  session_id?: string
  api_key_prefix?: string
}

/**
 * Standard audit actions for consistency
 */
export const AUDIT_ACTIONS = {
  // Authentication
  AUTH_LOGIN: 'auth.login',
  AUTH_LOGOUT: 'auth.logout',
  AUTH_FAILED: 'auth.failed',
  AUTH_2FA_ENABLE: 'auth.2fa.enable',
  AUTH_2FA_DISABLE: 'auth.2fa.disable',
  
  // API Keys
  API_KEY_CREATE: 'api_key.create',
  API_KEY_REVOKE: 'api_key.revoke',
  API_KEY_ROTATE: 'api_key.rotate',
  API_KEY_USE: 'api_key.use',
  
  // Workflows
  WORKFLOW_CREATE: 'workflow.create',
  WORKFLOW_UPDATE: 'workflow.update',
  WORKFLOW_DELETE: 'workflow.delete',
  WORKFLOW_EXECUTE: 'workflow.execute',
  WORKFLOW_ACTIVATE: 'workflow.activate',
  WORKFLOW_DEACTIVATE: 'workflow.deactivate',
  
  // Evidence
  EVIDENCE_UPLOAD: 'evidence.upload',
  EVIDENCE_DOWNLOAD: 'evidence.download',
  EVIDENCE_DELETE: 'evidence.delete',
  EVIDENCE_LEGAL_HOLD: 'evidence.legal_hold',
  
  // Billing
  BILLING_SUBSCRIPTION_CREATE: 'billing.subscription.create',
  BILLING_SUBSCRIPTION_UPDATE: 'billing.subscription.update',
  BILLING_SUBSCRIPTION_CANCEL: 'billing.subscription.cancel',
  BILLING_PAYMENT_SUCCESS: 'billing.payment.success',
  BILLING_PAYMENT_FAILED: 'billing.payment.failed',
  
  // Admin Actions
  ADMIN_TENANT_CREATE: 'admin.tenant.create',
  ADMIN_TENANT_SUSPEND: 'admin.tenant.suspend',
  ADMIN_USER_IMPERSONATE: 'admin.user.impersonate',
  ADMIN_SECURITY_SCAN: 'admin.security.scan',
  
  // Rate Limiting
  RATE_LIMIT_EXCEEDED: 'rate_limit.exceeded',
  RATE_LIMIT_RESET: 'rate_limit.reset',
  
  // Security
  SECURITY_HMAC_FAILED: 'security.hmac.failed',
  SECURITY_IP_BLOCKED: 'security.ip.blocked',
  SECURITY_INCIDENT_CREATED: 'security.incident.created'
} as const

export type AuditAction = typeof AUDIT_ACTIONS[keyof typeof AUDIT_ACTIONS]

/**
 * Create audit log entry in database
 */
export async function createAuditLog(
  supabase: any,
  entry: AuditLogEntry
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('audit_logs')
      .insert({
        tenant_id: entry.tenant_id,
        user_id: entry.user_id || null,
        action: entry.action,
        resource: entry.resource || null,
        resource_id: entry.resource_id || null,
        ip: entry.ip || null,
        user_agent: entry.user_agent || null,
        old: entry.old || null,
        new: entry.new || null,
        result: entry.result,
        metadata: entry.metadata || null,
        created_at: new Date().toISOString()
      })
      .select('id')
      .single()

    if (error) {
      console.error('Audit log creation failed:', error)
      return { success: false, error: error.message }
    }

    return { success: true, id: data.id }
  } catch (error) {
    console.error('Audit log creation error:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}

/**
 * Audit logger class for easier usage
 */
export class AuditLogger {
  private supabase: any
  private context: AuditContext

  constructor(supabase: any, context: AuditContext) {
    this.supabase = supabase
    this.context = context
  }

  /**
   * Log successful action
   */
  async logSuccess(
    action: AuditAction,
    resource?: string,
    resourceId?: string,
    data?: { old?: any; new?: any; metadata?: Record<string, any> }
  ): Promise<void> {
    await this.log(action, 'success', resource, resourceId, data)
  }

  /**
   * Log failed action
   */
  async logError(
    action: AuditAction,
    resource?: string,
    resourceId?: string,
    error?: string,
    data?: { old?: any; new?: any; metadata?: Record<string, any> }
  ): Promise<void> {
    await this.log(action, 'error', resource, resourceId, {
      ...data,
      metadata: { ...data?.metadata, error }
    })
  }

  /**
   * Log unauthorized action
   */
  async logUnauthorized(
    action: AuditAction,
    resource?: string,
    resourceId?: string,
    reason?: string
  ): Promise<void> {
    await this.log(action, 'unauthorized', resource, resourceId, {
      metadata: { reason }
    })
  }

  /**
   * Log blocked action
   */
  async logBlocked(
    action: AuditAction,
    resource?: string,
    resourceId?: string,
    reason?: string
  ): Promise<void> {
    await this.log(action, 'blocked', resource, resourceId, {
      metadata: { reason }
    })
  }

  /**
   * Generic log method
   */
  private async log(
    action: AuditAction,
    result: AuditLogEntry['result'],
    resource?: string,
    resourceId?: string,
    data?: { old?: any; new?: any; metadata?: Record<string, any> }
  ): Promise<void> {
    const entry: AuditLogEntry = {
      tenant_id: this.context.tenant_id,
      user_id: this.context.user_id,
      action,
      resource,
      resource_id: resourceId,
      ip: this.context.ip,
      user_agent: this.context.user_agent,
      old: data?.old,
      new: data?.new,
      result,
      metadata: {
        ...data?.metadata,
        session_id: this.context.session_id,
        api_key_prefix: this.context.api_key_prefix,
        timestamp: new Date().toISOString()
      }
    }

    // Fire and forget - don't block main execution
    createAuditLog(this.supabase, entry).catch(error => {
      console.error('Async audit log failed:', error)
    })
  }
}

/**
 * Create audit logger instance
 */
export function createAuditLogger(supabase: any, context: AuditContext): AuditLogger {
  return new AuditLogger(supabase, context)
}

/**
 * Extract audit context from Netlify function event
 */
export function extractAuditContext(event: any, tenantId?: string): AuditContext {
  const headers = event.headers || {}
  
  return {
    tenant_id: tenantId || headers['x-tenant-id'] || headers['x-tenant'] || 'unknown',
    user_id: headers['x-user-id'] || undefined,
    ip: extractClientIP(headers),
    user_agent: headers['user-agent'] || headers['User-Agent'] || undefined,
    session_id: headers['x-session-id'] || undefined,
    api_key_prefix: headers['x-api-key-prefix'] || undefined
  }
}

/**
 * Extract client IP from headers
 */
function extractClientIP(headers: Record<string, any>): string {
  const possibleHeaders = [
    'x-forwarded-for',
    'cf-connecting-ip',
    'x-real-ip',
    'x-client-ip'
  ]
  
  for (const header of possibleHeaders) {
    const value = headers[header] || headers[header.toLowerCase()]
    if (value) {
      const ip = Array.isArray(value) ? value[0] : value
      return ip.split(',')[0].trim()
    }
  }
  
  return 'unknown'
}

/**
 * Query audit logs with filters
 */
export async function queryAuditLogs(
  supabase: any,
  filters: {
    tenant_id: string
    user_id?: string
    action?: string
    resource?: string
    result?: string
    start_date?: string
    end_date?: string
    limit?: number
    offset?: number
  }
): Promise<{ data: any[]; count: number; error?: string }> {
  try {
    let query = supabase
      .from('audit_logs')
      .select('*', { count: 'exact' })
      .eq('tenant_id', filters.tenant_id)

    if (filters.user_id) {
      query = query.eq('user_id', filters.user_id)
    }

    if (filters.action) {
      query = query.eq('action', filters.action)
    }

    if (filters.resource) {
      query = query.eq('resource', filters.resource)
    }

    if (filters.result) {
      query = query.eq('result', filters.result)
    }

    if (filters.start_date) {
      query = query.gte('created_at', filters.start_date)
    }

    if (filters.end_date) {
      query = query.lte('created_at', filters.end_date)
    }

    query = query
      .order('created_at', { ascending: false })
      .range(filters.offset || 0, (filters.offset || 0) + (filters.limit || 100) - 1)

    const { data, error, count } = await query

    if (error) {
      return { data: [], count: 0, error: error.message }
    }

    return { data: data || [], count: count || 0 }
  } catch (error) {
    return { 
      data: [], 
      count: 0, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}

/**
 * Clean up old audit logs (respecting legal hold)
 */
export async function cleanupAuditLogs(
  supabase: any,
  retentionDays: number = 90
): Promise<{ deleted: number; error?: string }> {
  try {
    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000)
    
    const { data, error } = await supabase
      .from('audit_logs')
      .delete()
      .lt('created_at', cutoffDate.toISOString())
      .select('id')

    if (error) {
      return { deleted: 0, error: error.message }
    }

    return { deleted: data?.length || 0 }
  } catch (error) {
    return { 
      deleted: 0, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}

/**
 * Audit middleware for Netlify functions
 */
export function createAuditMiddleware(supabase: any) {
  return (event: any, context: Partial<AuditContext> = {}) => {
    const auditContext = {
      ...extractAuditContext(event),
      ...context
    }
    
    return createAuditLogger(supabase, auditContext)
  }
}