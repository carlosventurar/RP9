import { createClient } from '@/lib/supabase/server'
import { Database } from '@/lib/supabase/types'
import { NextRequest } from 'next/server'

export interface AuthUser {
  id: string
  email: string
  tenantId: string
  tenantSlug: string
  plan: 'starter' | 'pro' | 'enterprise' | 'custom'
}

export interface TenantData {
  id: string
  name: string
  slug: string
  plan: 'starter' | 'pro' | 'enterprise' | 'custom'
  n8n_base_url: string | null
  n8n_api_key: string | null
  settings: any
  metadata: any
}

export async function getAuthUser(request?: NextRequest): Promise<AuthUser | null> {
  try {
    const supabase = createClient()
    
    const { data: { user }, error } = await supabase.auth.getUser()
    
    if (error || !user) {
      console.error('Auth error:', error)
      return null
    }

    // Get tenant information for the user
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id, name, slug, plan, n8n_base_url, n8n_api_key, settings, metadata')
      .eq('owner_user_id', user.id)
      .single()

    if (tenantError || !tenant) {
      console.error('Tenant error:', tenantError)
      
      // If no tenant exists, create a default one
      if (tenantError?.code === 'PGRST116') { // No rows returned
        const defaultTenant = await createDefaultTenant(user.id, user.email!)
        if (defaultTenant) {
          return {
            id: user.id,
            email: user.email!,
            tenantId: defaultTenant.id,
            tenantSlug: defaultTenant.slug,
            plan: defaultTenant.plan
          }
        }
      }
      return null
    }

    return {
      id: user.id,
      email: user.email!,
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      plan: tenant.plan
    }

  } catch (error) {
    console.error('Failed to get auth user:', error)
    return null
  }
}

export async function getTenantData(tenantId: string): Promise<TenantData | null> {
  try {
    const supabase = createClient()
    
    const { data: tenant, error } = await supabase
      .from('tenants')
      .select('id, name, slug, plan, n8n_base_url, n8n_api_key, settings, metadata')
      .eq('id', tenantId)
      .single()

    if (error || !tenant) {
      console.error('Failed to get tenant data:', error)
      return null
    }

    return tenant

  } catch (error) {
    console.error('Failed to get tenant data:', error)
    return null
  }
}

async function createDefaultTenant(userId: string, email: string): Promise<TenantData | null> {
  try {
    const supabase = createClient()
    
    // Generate a unique slug from email
    const emailBase = email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '')
    const slug = `${emailBase}-${Date.now()}`
    
    const { data: tenant, error } = await supabase
      .from('tenants')
      .insert({
        name: `${emailBase}'s Organization`,
        slug: slug,
        plan: 'starter',
        owner_user_id: userId,
        n8n_base_url: process.env.N8N_BASE_URL,
        n8n_api_key: process.env.N8N_API_KEY,
        settings: {
          allowedTags: ['Crossnet'],
          nameFilter: 'Crossnet',
          filterMode: 'name'
        },
        metadata: {
          created_by: 'auto',
          source: 'first_login'
        }
      })
      .select()
      .single()

    if (error) {
      console.error('Failed to create default tenant:', error)
      return null
    }

    return tenant

  } catch (error) {
    console.error('Failed to create default tenant:', error)
    return null
  }
}

export async function logAuditEvent(
  tenantId: string,
  userId: string,
  action: string,
  resource: string,
  resourceId?: string,
  details?: any,
  ipAddress?: string,
  userAgent?: string
) {
  try {
    const supabase = createClient()
    
    await supabase
      .from('audit_logs')
      .insert({
        tenant_id: tenantId,
        user_id: userId,
        action,
        resource,
        resource_id: resourceId,
        ip_address: ipAddress,
        user_agent: userAgent,
        details: details || {}
      })

  } catch (error) {
    console.error('Failed to log audit event:', error)
  }
}