import { Handler, HandlerEvent } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import { rateLimitByUser, RATE_LIMIT_CONFIGS, getRateLimitHeaders } from '../../src/lib/security/rate-limit'
import * as crypto from 'crypto'

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = supabaseUrl && supabaseServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null

export const handler: Handler = async (event: HandlerEvent) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
  }

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' }
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    }
  }

  try {
    if (!supabase) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Service configuration error' })
      }
    }

    // Get user from JWT token
    const authHeader = event.headers.authorization || event.headers.Authorization
    if (!authHeader) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Authorization required' })
      }
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Invalid token' })
      }
    }

    // Get file ID from query parameters
    const fileId = event.queryStringParameters?.fileId
    if (!fileId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'File ID is required' })
      }
    }

    // Rate limiting by user
    const rateLimitResult = rateLimitByUser(user.id, RATE_LIMIT_CONFIGS.NORMAL)
    
    if (!rateLimitResult.allowed) {
      return {
        statusCode: 429,
        headers: { ...headers, ...getRateLimitHeaders(rateLimitResult) },
        body: JSON.stringify({ 
          error: 'Rate limit exceeded',
          remaining: rateLimitResult.remaining 
        })
      }
    }

    console.log(`Processing evidence download request for file ${fileId} by user ${user.id}`)

    // Get file record and verify user has access
    const { data: evidenceFile, error: evidenceError } = await supabase
      .from('evidence_files')
      .select(`
        id,
        tenant_id,
        file_name,
        storage_path,
        sha256,
        size_bytes,
        validation_status,
        document_type,
        country,
        created_at,
        tenants!inner(owner_user_id)
      `)
      .eq('id', fileId)
      .single()

    if (evidenceError || !evidenceFile) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'File not found' })
      }
    }

    // Verify user owns the tenant
    if (evidenceFile.tenants.owner_user_id !== user.id) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: 'Access denied' })
      }
    }

    // Get download URL from Supabase Storage
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('evidence')
      .createSignedUrl(evidenceFile.storage_path, 300) // 5 minutes expiry

    if (signedUrlError || !signedUrlData) {
      console.error('Error creating signed URL:', signedUrlError)
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to generate download URL' })
      }
    }

    // Download file to verify hash
    const downloadResponse = await fetch(signedUrlData.signedUrl)
    if (!downloadResponse.ok) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to retrieve file' })
      }
    }

    const fileBuffer = await downloadResponse.arrayBuffer()
    const actualHash = crypto.createHash('sha256').update(Buffer.from(fileBuffer)).digest('hex')

    // Verify hash matches stored hash
    if (actualHash !== evidenceFile.sha256) {
      console.error(`Hash mismatch for file ${fileId}: expected ${evidenceFile.sha256}, got ${actualHash}`)
      
      // Log security incident
      await logSecurityEvent(evidenceFile.tenant_id, user.id, 'hash_mismatch', {
        fileId,
        expectedHash: evidenceFile.sha256,
        actualHash,
        storagePath: evidenceFile.storage_path
      })

      return {
        statusCode: 409,
        headers,
        body: JSON.stringify({ 
          error: 'File integrity verification failed',
          details: 'The file appears to have been corrupted or tampered with'
        })
      }
    }

    // Log successful download
    await logDownloadEvent(evidenceFile.tenant_id, user.id, fileId, {
      fileName: evidenceFile.file_name,
      fileSize: evidenceFile.size_bytes,
      documentType: evidenceFile.document_type,
      hashVerified: true
    })

    // Create a new signed URL for the verified file
    const { data: verifiedUrlData, error: verifiedUrlError } = await supabase.storage
      .from('evidence')
      .createSignedUrl(evidenceFile.storage_path, 300) // 5 minutes expiry

    if (verifiedUrlError || !verifiedUrlData) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to generate verified download URL' })
      }
    }

    return {
      statusCode: 200,
      headers: { ...headers, ...getRateLimitHeaders(rateLimitResult) },
      body: JSON.stringify({
        success: true,
        downloadUrl: verifiedUrlData.signedUrl,
        expiresAt: new Date(Date.now() + 300000).toISOString(), // 5 minutes
        file: {
          id: evidenceFile.id,
          name: evidenceFile.file_name,
          size: evidenceFile.size_bytes,
          type: evidenceFile.document_type,
          country: evidenceFile.country,
          validationStatus: evidenceFile.validation_status,
          sha256: evidenceFile.sha256,
          hashVerified: true,
          createdAt: evidenceFile.created_at
        },
        timestamp: new Date().toISOString()
      })
    }

  } catch (error) {
    console.error('Evidence download error:', error)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
}

/**
 * Log download event for auditing
 */
async function logDownloadEvent(
  tenantId: string,
  userId: string,
  fileId: string,
  metadata: Record<string, any>
): Promise<void> {
  try {
    await supabase!
      .from('audit_logs')
      .insert({
        tenant_id: tenantId,
        user_id: userId,
        action: 'evidence_download',
        resource_type: 'evidence_file',
        resource_id: fileId,
        metadata,
        ip_address: 'unknown', // Could be extracted from headers in production
        user_agent: 'api',
        created_at: new Date().toISOString()
      })
  } catch (error) {
    console.error('Failed to log download event:', error)
    // Don't throw - logging failures shouldn't break downloads
  }
}

/**
 * Log security event for monitoring
 */
async function logSecurityEvent(
  tenantId: string,
  userId: string,
  eventType: string,
  metadata: Record<string, any>
): Promise<void> {
  try {
    await supabase!
      .from('security_events')
      .insert({
        tenant_id: tenantId,
        user_id: userId,
        event_type: eventType,
        severity: 'high',
        metadata,
        created_at: new Date().toISOString()
      })
  } catch (error) {
    console.error('Failed to log security event:', error)
    // Don't throw - logging failures shouldn't break the main flow
  }
}