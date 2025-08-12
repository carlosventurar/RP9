import type { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface UploadRequest {
  tenantId: string
  userId: string
  evidenceType: 'workflow_execution' | 'business_outcome' | 'integration_screenshot' | 'configuration_proof'
  fileName: string
  fileSize: number
  mimeType: string
  metadata?: {
    workflow_id?: string
    template_code?: string
    outcome_value?: number
    integration_name?: string
    [key: string]: any
  }
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' })
    }
  }

  try {
    // Parse multipart form data or JSON based on content type
    let uploadData: UploadRequest
    let fileBuffer: Buffer | null = null

    const contentType = event.headers['content-type'] || ''
    
    if (contentType.includes('multipart/form-data')) {
      // Handle file upload
      const body = event.body || ''
      const isBase64 = event.isBase64Encoded
      
      if (isBase64) {
        fileBuffer = Buffer.from(body, 'base64')
      } else {
        fileBuffer = Buffer.from(body, 'utf-8')
      }

      // Parse multipart data (simplified - in production use proper multipart parser)
      const boundary = contentType.split('boundary=')[1]
      if (!boundary) {
        throw new Error('No boundary found in multipart data')
      }

      // Extract metadata from headers or form fields
      // This is a simplified implementation - use proper multipart parser like 'formidable'
      uploadData = JSON.parse(event.headers['x-upload-metadata'] || '{}')
    } else {
      // Handle JSON metadata only (for generating signed URLs)
      uploadData = JSON.parse(event.body || '{}')
    }

    // Validate required fields
    if (!uploadData.tenantId || !uploadData.userId || !uploadData.evidenceType || !uploadData.fileName) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          error: 'Missing required fields: tenantId, userId, evidenceType, fileName' 
        })
      }
    }

    // Validate evidence type
    const validTypes = ['workflow_execution', 'business_outcome', 'integration_screenshot', 'configuration_proof']
    if (!validTypes.includes(uploadData.evidenceType)) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          error: `Invalid evidenceType. Must be one of: ${validTypes.join(', ')}` 
        })
      }
    }

    // Validate file size (max 10MB for images, 50MB for other files)
    const maxSize = uploadData.mimeType?.startsWith('image/') ? 10 * 1024 * 1024 : 50 * 1024 * 1024
    if (uploadData.fileSize > maxSize) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          error: `File too large. Max size: ${Math.floor(maxSize / 1024 / 1024)}MB` 
        })
      }
    }

    // Generate unique file path
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const fileExtension = uploadData.fileName.split('.').pop() || ''
    const uniqueFileName = `${uploadData.evidenceType}_${timestamp}_${crypto.randomUUID()}.${fileExtension}`
    const filePath = `evidence/${uploadData.tenantId}/${uniqueFileName}`

    let uploadResult = null
    let fileHash = ''

    if (fileBuffer) {
      // Calculate SHA-256 hash for integrity verification
      fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex')

      // Upload file to Supabase Storage
      const { data: uploadData_storage, error: uploadError } = await supabase.storage
        .from('evidence')
        .upload(filePath, fileBuffer, {
          contentType: uploadData.mimeType,
          upsert: false
        })

      if (uploadError) {
        console.error('Storage upload error:', uploadError)
        return {
          statusCode: 500,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            error: 'File upload failed',
            details: uploadError.message 
          })
        }
      }

      uploadResult = uploadData_storage

      // Get public URL for the uploaded file
      const { data: publicUrlData } = supabase.storage
        .from('evidence')
        .getPublicUrl(filePath)

      uploadResult.publicUrl = publicUrlData.publicUrl
    } else {
      // Generate signed upload URL for client-side upload
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from('evidence')
        .createSignedUploadUrl(filePath)

      if (signedUrlError) {
        return {
          statusCode: 500,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            error: 'Failed to generate upload URL',
            details: signedUrlError.message 
          })
        }
      }

      uploadResult = signedUrlData
    }

    // Create evidence record in database
    const evidenceRecord = {
      tenant_id: uploadData.tenantId,
      user_id: uploadData.userId,
      type: uploadData.evidenceType,
      file_name: uploadData.fileName,
      file_path: filePath,
      file_size: uploadData.fileSize,
      mime_type: uploadData.mimeType,
      file_hash: fileHash || null,
      metadata: {
        original_filename: uploadData.fileName,
        upload_timestamp: new Date().toISOString(),
        ...uploadData.metadata
      }
    }

    const { data: evidence, error: dbError } = await supabase
      .from('evidence_uploads')
      .insert(evidenceRecord)
      .select()

    if (dbError) {
      console.error('Database error:', dbError)
      
      // If file was uploaded but DB insert failed, try to clean up
      if (fileBuffer && uploadResult) {
        await supabase.storage
          .from('evidence')
          .remove([filePath])
      }

      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          error: 'Failed to save evidence record',
          details: dbError.message 
        })
      }
    }

    // Create activation event for evidence upload
    try {
      await supabase
        .from('activation_events')
        .insert({
          tenant_id: uploadData.tenantId,
          type: 'evidence_uploaded',
          meta: {
            evidence_type: uploadData.evidenceType,
            file_name: uploadData.fileName,
            file_size: uploadData.fileSize,
            ...uploadData.metadata
          }
        })
    } catch (eventError) {
      console.warn('Failed to create activation event:', eventError)
      // Don't fail the main operation
    }

    // Log to audit trail
    await supabase
      .from('audit_log')
      .insert({
        tenant_id: uploadData.tenantId,
        actor: uploadData.userId,
        action: 'evidence.uploaded',
        resource: `evidence/${evidence[0].id}`,
        meta: {
          evidence_type: uploadData.evidenceType,
          file_name: uploadData.fileName,
          file_path: filePath,
          file_size: uploadData.fileSize
        },
        hash: fileHash || 'no_hash' // Placeholder for hash generation
      })

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ok: true,
        evidence: evidence[0],
        upload: uploadResult,
        message: fileBuffer ? 'File uploaded successfully' : 'Upload URL generated'
      })
    }

  } catch (error) {
    console.error('Error in evidence upload:', error)
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
}

// Helper function to validate file type
function isValidFileType(mimeType: string, evidenceType: string): boolean {
  const imageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  const documentTypes = ['application/pdf', 'text/plain', 'application/json']
  const videoTypes = ['video/mp4', 'video/webm', 'video/quicktime']

  switch (evidenceType) {
    case 'integration_screenshot':
    case 'configuration_proof':
      return imageTypes.includes(mimeType)
    
    case 'workflow_execution':
      return [...imageTypes, ...documentTypes, ...videoTypes].includes(mimeType)
    
    case 'business_outcome':
      return [...imageTypes, ...documentTypes].includes(mimeType)
    
    default:
      return false
  }
}

// Helper function to generate evidence metadata based on type
function generateEvidenceMetadata(evidenceType: string, metadata: any = {}) {
  const baseMetadata = {
    uploaded_at: new Date().toISOString(),
    version: '1.0',
    source: 'onboarding_system'
  }

  switch (evidenceType) {
    case 'workflow_execution':
      return {
        ...baseMetadata,
        expected_fields: ['workflow_id', 'execution_id', 'status', 'duration'],
        validation_rules: {
          workflow_id: 'required',
          status: 'enum:success,failed,running'
        },
        ...metadata
      }

    case 'business_outcome':
      return {
        ...baseMetadata,
        expected_fields: ['outcome_type', 'value', 'currency', 'measurement_period'],
        validation_rules: {
          outcome_type: 'enum:revenue,cost_savings,efficiency_gain,customer_satisfaction',
          value: 'number'
        },
        ...metadata
      }

    case 'integration_screenshot':
      return {
        ...baseMetadata,
        expected_fields: ['integration_name', 'connection_status', 'timestamp'],
        validation_rules: {
          connection_status: 'enum:connected,failed,pending',
          integration_name: 'required'
        },
        ...metadata
      }

    case 'configuration_proof':
      return {
        ...baseMetadata,
        expected_fields: ['config_type', 'component', 'settings'],
        validation_rules: {
          config_type: 'enum:credentials,webhook,trigger,action',
          component: 'required'
        },
        ...metadata
      }

    default:
      return { ...baseMetadata, ...metadata }
  }
}