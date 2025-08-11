import { Handler, HandlerEvent } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import { rateLimitByTenant, RATE_LIMIT_CONFIGS, getRateLimitHeaders } from '../../src/lib/security/rate-limit'
import { z } from 'zod'
import * as crypto from 'crypto'

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = supabaseUrl && supabaseServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null

// Request validation schema
const DocumentValidationSchema = z.object({
  tenantId: z.string(),
  country: z.enum(['MX', 'CO', 'US', 'OTHER']),
  documentType: z.enum(['CFDI', 'DIAN', 'INVOICE', 'RECEIPT', 'CONTRACT']),
  fileName: z.string(),
  fileData: z.string(), // Base64 encoded file
  workflowId: z.string().optional(),
  executionId: z.string().optional(),
  metadata: z.record(z.any()).optional()
})

interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
  extractedData: Record<string, any>
  validationScore: number // 0-100
}

interface DocumentMetadata {
  originalFileName: string
  contentType: string
  country: string
  documentType: string
  uploadedBy?: string
  workflowId?: string
  executionId?: string
  customMetadata?: Record<string, any>
}

export const handler: Handler = async (event: HandlerEvent) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  }

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' }
  }

  if (event.httpMethod !== 'POST') {
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

    if (!event.body) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Request body is required' })
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

    // Validate request
    const request = DocumentValidationSchema.parse(JSON.parse(event.body))
    
    // Rate limiting by tenant
    const rateLimitResult = rateLimitByTenant(request.tenantId, RATE_LIMIT_CONFIGS.NORMAL)
    
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

    console.log(`Processing document validation for tenant ${request.tenantId}, type: ${request.documentType}, country: ${request.country}`)

    // Decode file data
    const fileBuffer = Buffer.from(request.fileData, 'base64')
    const fileSizeBytes = fileBuffer.length

    // Validate file size (max 10MB)
    if (fileSizeBytes > 10 * 1024 * 1024) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'File size exceeds 10MB limit' })
      }
    }

    // Calculate SHA-256 hash
    const sha256Hash = crypto.createHash('sha256').update(fileBuffer).digest('hex')
    
    // Check if file already exists with same hash
    const { data: existingFile } = await supabase
      .from('evidence_files')
      .select('id, storage_path')
      .eq('tenant_id', request.tenantId)
      .eq('sha256', sha256Hash)
      .single()

    if (existingFile) {
      return {
        statusCode: 200,
        headers: { ...headers, ...getRateLimitHeaders(rateLimitResult) },
        body: JSON.stringify({
          success: true,
          message: 'File already exists',
          fileId: existingFile.id,
          sha256: sha256Hash,
          isDuplicate: true
        })
      }
    }

    // Generate storage path
    const date = new Date()
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const fileName = `${request.tenantId}/${year}/${month}/${Date.now()}-${request.fileName}`
    const storagePath = `evidence/${fileName}`

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('evidence')
      .upload(storagePath, fileBuffer, {
        contentType: getContentType(request.fileName),
        duplex: 'half'
      })

    if (uploadError) {
      console.error('Storage upload error:', uploadError)
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to upload file to storage' })
      }
    }

    // Validate document based on type and country
    const validationResult = await validateDocument(
      fileBuffer,
      request.documentType,
      request.country,
      request.fileName
    )

    // Create evidence record
    const evidenceData = {
      tenant_id: request.tenantId,
      country: request.country,
      workflow_id: request.workflowId,
      execution_id: request.executionId,
      file_name: request.fileName,
      file_type: getFileExtension(request.fileName),
      storage_path: storagePath,
      sha256: sha256Hash,
      size_bytes: fileSizeBytes,
      validation_status: validationResult.isValid ? 'valid' : 'invalid',
      validation_score: validationResult.validationScore,
      validation_errors: validationResult.errors,
      validation_warnings: validationResult.warnings,
      extracted_data: validationResult.extractedData,
      document_type: request.documentType,
      created_by: user.id,
      meta: {
        ...request.metadata,
        content_type: getContentType(request.fileName),
        upload_source: 'api'
      }
    }

    const { data: evidenceFile, error: evidenceError } = await supabase
      .from('evidence_files')
      .insert(evidenceData)
      .select()
      .single()

    if (evidenceError) {
      console.error('Evidence file creation error:', evidenceError)
      
      // Clean up uploaded file
      await supabase.storage
        .from('evidence')
        .remove([storagePath])
        
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to create evidence record' })
      }
    }

    // Trigger accounting integration if validation passed
    if (validationResult.isValid && request.country in ['MX', 'CO']) {
      triggerAccountingIntegration(evidenceFile.id, request.tenantId, validationResult.extractedData)
        .catch(error => {
          console.error('Accounting integration failed:', error)
          // Don't fail the main operation
        })
    }

    return {
      statusCode: 200,
      headers: { ...headers, ...getRateLimitHeaders(rateLimitResult) },
      body: JSON.stringify({
        success: true,
        fileId: evidenceFile.id,
        storagePath,
        sha256: sha256Hash,
        sizeBytes: fileSizeBytes,
        validation: {
          isValid: validationResult.isValid,
          score: validationResult.validationScore,
          errors: validationResult.errors,
          warnings: validationResult.warnings,
          extractedData: validationResult.extractedData
        },
        timestamp: new Date().toISOString()
      })
    }

  } catch (error) {
    console.error('Document validation error:', error)
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
 * Validate document based on type and country regulations
 */
async function validateDocument(
  fileBuffer: Buffer,
  documentType: string,
  country: string,
  fileName: string
): Promise<ValidationResult> {
  const fileExtension = getFileExtension(fileName).toLowerCase()
  const errors: string[] = []
  const warnings: string[] = []
  let extractedData: Record<string, any> = {}
  let validationScore = 0

  try {
    switch (documentType) {
      case 'CFDI':
        return await validateCFDI(fileBuffer, fileExtension)
      
      case 'DIAN':
        return await validateDIAN(fileBuffer, fileExtension)
      
      case 'INVOICE':
      case 'RECEIPT':
        return await validateGenericInvoice(fileBuffer, fileExtension)
      
      default:
        return await validateGenericDocument(fileBuffer, fileExtension)
    }
    
  } catch (error) {
    errors.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    return {
      isValid: false,
      errors,
      warnings,
      extractedData,
      validationScore: 0
    }
  }
}

/**
 * Validate Mexican CFDI document
 */
async function validateCFDI(fileBuffer: Buffer, fileExtension: string): Promise<ValidationResult> {
  const errors: string[] = []
  const warnings: string[] = []
  let extractedData: Record<string, any> = {}
  let validationScore = 50 // Base score for having a document

  if (fileExtension !== 'xml') {
    errors.push('CFDI documents must be XML format')
    return { isValid: false, errors, warnings, extractedData, validationScore: 0 }
  }

  try {
    const xmlContent = fileBuffer.toString('utf-8')
    
    // Basic XML structure validation
    if (!xmlContent.includes('cfdi:Comprobante')) {
      errors.push('Invalid CFDI structure: missing cfdi:Comprobante element')
    } else {
      validationScore += 20
    }

    // Check for required attributes
    const requiredElements = [
      'Version=',
      'Fecha=',
      'Folio=',
      'cfdi:Emisor',
      'cfdi:Receptor'
    ]

    for (const element of requiredElements) {
      if (xmlContent.includes(element)) {
        validationScore += 5
      } else {
        errors.push(`Missing required element: ${element}`)
      }
    }

    // Extract basic data (simplified extraction)
    extractedData = extractCFDIData(xmlContent)

    // Validate SAT seal (simplified check)
    if (xmlContent.includes('Sello=') && xmlContent.includes('SelloCFD=')) {
      validationScore += 10
    } else {
      warnings.push('Digital seals may be missing or incomplete')
    }

    const isValid = errors.length === 0
    const finalScore = isValid ? Math.min(validationScore, 100) : Math.max(validationScore - 20, 0)

    return {
      isValid,
      errors,
      warnings,
      extractedData,
      validationScore: finalScore
    }

  } catch (error) {
    errors.push(`XML parsing error: ${error instanceof Error ? error.message : 'Invalid XML'}`)
    return { isValid: false, errors, warnings, extractedData, validationScore: 0 }
  }
}

/**
 * Validate Colombian DIAN document
 */
async function validateDIAN(fileBuffer: Buffer, fileExtension: string): Promise<ValidationResult> {
  const errors: string[] = []
  const warnings: string[] = []
  let extractedData: Record<string, any> = {}
  let validationScore = 50

  if (fileExtension !== 'xml') {
    errors.push('DIAN documents must be XML format')
    return { isValid: false, errors, warnings, extractedData, validationScore: 0 }
  }

  try {
    const xmlContent = fileBuffer.toString('utf-8')
    
    // Check for DIAN-specific elements
    if (xmlContent.includes('fe:Invoice') || xmlContent.includes('Invoice')) {
      validationScore += 20
    } else {
      errors.push('Invalid DIAN structure: missing Invoice element')
    }

    // Extract basic data
    extractedData = extractDIANData(xmlContent)

    const isValid = errors.length === 0
    return {
      isValid,
      errors,
      warnings,
      extractedData,
      validationScore: isValid ? Math.min(validationScore, 100) : 0
    }

  } catch (error) {
    errors.push(`XML parsing error: ${error instanceof Error ? error.message : 'Invalid XML'}`)
    return { isValid: false, errors, warnings, extractedData, validationScore: 0 }
  }
}

/**
 * Validate generic invoice document
 */
async function validateGenericInvoice(fileBuffer: Buffer, fileExtension: string): Promise<ValidationResult> {
  const errors: string[] = []
  const warnings: string[] = []
  let extractedData: Record<string, any> = {}
  let validationScore = 70 // Higher base score for generic documents

  // Accept PDF, XML, or image formats
  const validFormats = ['pdf', 'xml', 'jpg', 'jpeg', 'png']
  if (!validFormats.includes(fileExtension)) {
    warnings.push(`Unusual file format for invoice: ${fileExtension}`)
  }

  // Basic file validation
  if (fileBuffer.length > 0) {
    validationScore += 20
  }

  // Extract basic metadata
  extractedData = {
    fileType: fileExtension,
    fileSize: fileBuffer.length,
    documentType: 'INVOICE',
    processedAt: new Date().toISOString()
  }

  return {
    isValid: true,
    errors,
    warnings,
    extractedData,
    validationScore: Math.min(validationScore, 100)
  }
}

/**
 * Validate generic document
 */
async function validateGenericDocument(fileBuffer: Buffer, fileExtension: string): Promise<ValidationResult> {
  return {
    isValid: true,
    errors: [],
    warnings: [],
    extractedData: {
      fileType: fileExtension,
      fileSize: fileBuffer.length,
      processedAt: new Date().toISOString()
    },
    validationScore: 60
  }
}

/**
 * Extract data from CFDI XML (simplified)
 */
function extractCFDIData(xmlContent: string): Record<string, any> {
  const data: Record<string, any> = {}
  
  // Extract version
  const versionMatch = xmlContent.match(/Version="([^"]+)"/)
  if (versionMatch) data.version = versionMatch[1]
  
  // Extract date
  const dateMatch = xmlContent.match(/Fecha="([^"]+)"/)
  if (dateMatch) data.fecha = dateMatch[1]
  
  // Extract folio
  const folioMatch = xmlContent.match(/Folio="([^"]+)"/)
  if (folioMatch) data.folio = folioMatch[1]
  
  // Extract total
  const totalMatch = xmlContent.match(/Total="([^"]+)"/)
  if (totalMatch) data.total = parseFloat(totalMatch[1])
  
  // Extract currency
  const currencyMatch = xmlContent.match(/Moneda="([^"]+)"/)
  if (currencyMatch) data.moneda = currencyMatch[1]
  
  return data
}

/**
 * Extract data from DIAN XML (simplified)
 */
function extractDIANData(xmlContent: string): Record<string, any> {
  const data: Record<string, any> = {}
  
  // Extract invoice number
  const invoiceMatch = xmlContent.match(/<cbc:ID>([^<]+)<\/cbc:ID>/)
  if (invoiceMatch) data.invoiceNumber = invoiceMatch[1]
  
  // Extract date
  const dateMatch = xmlContent.match(/<cbc:IssueDate>([^<]+)<\/cbc:IssueDate>/)
  if (dateMatch) data.issueDate = dateMatch[1]
  
  // Extract total
  const totalMatch = xmlContent.match(/<cbc:TaxInclusiveAmount[^>]*>([^<]+)<\/cbc:TaxInclusiveAmount>/)
  if (totalMatch) data.total = parseFloat(totalMatch[1])
  
  return data
}

/**
 * Get content type based on file extension
 */
function getContentType(fileName: string): string {
  const ext = getFileExtension(fileName).toLowerCase()
  const mimeTypes: Record<string, string> = {
    'pdf': 'application/pdf',
    'xml': 'application/xml',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  }
  
  return mimeTypes[ext] || 'application/octet-stream'
}

/**
 * Get file extension from filename
 */
function getFileExtension(fileName: string): string {
  const parts = fileName.split('.')
  return parts.length > 1 ? parts[parts.length - 1] : ''
}

/**
 * Trigger accounting integration asynchronously
 */
async function triggerAccountingIntegration(
  evidenceFileId: string,
  tenantId: string,
  extractedData: Record<string, any>
): Promise<void> {
  try {
    // This would call the accounting integration function
    console.log(`Would trigger accounting integration for file ${evidenceFileId}:`, extractedData)
    
    // For now, just log the action
    // In production, this would call QuickBooks/Siigo APIs
    
  } catch (error) {
    console.error('Accounting integration trigger failed:', error)
    throw error
  }
}