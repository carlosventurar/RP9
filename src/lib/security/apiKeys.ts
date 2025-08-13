import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'

export type ApiKeyRecord = {
  id: string
  tenant_id: string
  prefix: string
  hash: Buffer
  scopes: string[]
  status: 'active' | 'revoked'
  last_used_at?: string
  created_at: string
}

export type ApiKeyScope = 'read' | 'execute' | 'metrics' | 'admin' | 'billing'

/**
 * Generate a new API key with secure random values
 */
export function generateApiKey(prefix: string = 'rp9'): { 
  display: string
  prefix: string
  secret: string
  hash: Buffer 
} {
  const raw = crypto.randomBytes(24).toString('base64url')
  const shortPrefix = raw.slice(0, 8)
  const secret = `${prefix}_sk_${raw}`
  const hash = crypto.createHash('sha256').update(secret).digest()
  
  return { 
    display: secret, 
    prefix: shortPrefix, 
    secret, 
    hash 
  }
}

/**
 * Verify API key against stored record
 */
export function verifyApiKey(secret: string, record: ApiKeyRecord): boolean {
  const hash = crypto.createHash('sha256').update(secret).digest()
  return record.status === 'active' && crypto.timingSafeEqual(hash, record.hash)
}

/**
 * Check if API key has required scope
 */
export function hasScope(record: ApiKeyRecord, requiredScope: ApiKeyScope): boolean {
  return record.scopes.includes(requiredScope) || record.scopes.includes('admin')
}

/**
 * Create API key in database
 */
export async function createApiKey(
  supabase: any,
  tenantId: string,
  scopes: ApiKeyScope[],
  description?: string
): Promise<{ apiKey: string; record: ApiKeyRecord }> {
  const { display, prefix, hash } = generateApiKey()
  
  const { data, error } = await supabase
    .from('api_keys')
    .insert({
      tenant_id: tenantId,
      prefix,
      hash: Array.from(hash), // Convert Buffer to array for storage
      scopes,
      status: 'active',
      description
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create API key: ${error.message}`)
  }

  return {
    apiKey: display,
    record: {
      ...data,
      hash: Buffer.from(data.hash) // Convert back to Buffer
    }
  }
}

/**
 * Get API key record by prefix
 */
export async function getApiKeyByPrefix(
  supabase: any,
  prefix: string
): Promise<ApiKeyRecord | null> {
  const { data, error } = await supabase
    .from('api_keys')
    .select('*')
    .eq('prefix', prefix)
    .eq('status', 'active')
    .single()

  if (error || !data) {
    return null
  }

  return {
    ...data,
    hash: Buffer.from(data.hash)
  }
}

/**
 * Revoke API key
 */
export async function revokeApiKey(
  supabase: any,
  tenantId: string,
  prefix: string
): Promise<boolean> {
  const { error } = await supabase
    .from('api_keys')
    .update({ 
      status: 'revoked',
      revoked_at: new Date().toISOString()
    })
    .eq('tenant_id', tenantId)
    .eq('prefix', prefix)

  return !error
}

/**
 * Update last used timestamp for API key
 */
export async function updateLastUsed(
  supabase: any,
  prefix: string
): Promise<void> {
  await supabase
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('prefix', prefix)
}

/**
 * List API keys for tenant
 */
export async function listApiKeys(
  supabase: any,
  tenantId: string
): Promise<Omit<ApiKeyRecord, 'hash'>[]> {
  const { data, error } = await supabase
    .from('api_keys')
    .select('id, tenant_id, prefix, scopes, status, last_used_at, created_at, description')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to list API keys: ${error.message}`)
  }

  return data || []
}

/**
 * Rotate API key (generate new secret, keep same prefix and scopes)
 */
export async function rotateApiKey(
  supabase: any,
  tenantId: string,
  prefix: string
): Promise<{ apiKey: string; record: ApiKeyRecord }> {
  // Get current key record
  const currentKey = await getApiKeyByPrefix(supabase, prefix)
  if (!currentKey) {
    throw new Error('API key not found')
  }

  // Generate new secret
  const { hash } = generateApiKey()
  const newSecret = `rp9_sk_${prefix}_${crypto.randomBytes(16).toString('base64url')}`
  const newHash = crypto.createHash('sha256').update(newSecret).digest()

  // Update in database
  const { data, error } = await supabase
    .from('api_keys')
    .update({ 
      hash: Array.from(newHash),
      last_rotated_at: new Date().toISOString()
    })
    .eq('tenant_id', tenantId)
    .eq('prefix', prefix)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to rotate API key: ${error.message}`)
  }

  return {
    apiKey: newSecret,
    record: {
      ...data,
      hash: Buffer.from(data.hash)
    }
  }
}

/**
 * Middleware function to authenticate and authorize API requests
 */
export async function authenticateApiKey(
  supabase: any,
  authorization: string | undefined,
  requiredScope?: ApiKeyScope
): Promise<{ 
  success: boolean
  tenant_id?: string
  scopes?: string[]
  error?: string 
}> {
  if (!authorization) {
    return { success: false, error: 'No authorization header' }
  }

  // Extract API key from Authorization header
  const match = authorization.match(/^Bearer\s+(.+)$/)
  if (!match) {
    return { success: false, error: 'Invalid authorization format' }
  }

  const apiKey = match[1]
  
  // Parse API key to get prefix
  const keyMatch = apiKey.match(/^rp9_sk_([^_]+)/)
  if (!keyMatch) {
    return { success: false, error: 'Invalid API key format' }
  }

  const prefix = keyMatch[1]
  
  // Get API key record
  const record = await getApiKeyByPrefix(supabase, prefix)
  if (!record) {
    return { success: false, error: 'Invalid API key' }
  }

  // Verify the key
  if (!verifyApiKey(apiKey, record)) {
    return { success: false, error: 'Invalid API key' }
  }

  // Check required scope
  if (requiredScope && !hasScope(record, requiredScope)) {
    return { success: false, error: 'Insufficient permissions' }
  }

  // Update last used timestamp (fire and forget)
  updateLastUsed(supabase, prefix).catch(console.error)

  return {
    success: true,
    tenant_id: record.tenant_id,
    scopes: record.scopes
  }
}

/**
 * Extract tenant ID from authenticated API key
 */
export function extractPrefix(apiKey: string): string | null {
  const match = apiKey.match(/^rp9_sk_([^_]+)/)
  return match ? match[1] : null
}

/**
 * Available scopes for API keys
 */
export const API_KEY_SCOPES: Record<ApiKeyScope, string> = {
  read: 'Read workflows, templates, and data',
  execute: 'Execute workflows and trigger actions',
  metrics: 'Access metrics and analytics',
  admin: 'Full administrative access',
  billing: 'Access billing and subscription data'
}