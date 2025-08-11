import { Handler, HandlerEvent } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import { rateLimitByTenant, RATE_LIMIT_CONFIGS, getRateLimitHeaders } from '../../src/lib/security/rate-limit'

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = supabaseUrl && supabaseServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null

interface FinanceKPIs {
  period: string
  totalDocuments: number
  validDocuments: number
  invalidDocuments: number
  validationRate: number
  avgValidationScore: number
  totalFileSize: number
  avgFileSize: number
  documentsByType: Array<{
    type: string
    count: number
    validationRate: number
  }>
  documentsByCountry: Array<{
    country: string
    count: number
    validationRate: number
  }>
  validationErrors: Array<{
    error: string
    count: number
  }>
  timeSavings: {
    totalDocuments: number
    avgProcessingTimeMinutes: number
    totalTimeSavedHours: number
  }
  complianceMetrics: {
    cfdiDocuments: number
    cfdiValidRate: number
    dianDocuments: number
    dianValidRate: number
  }
  storageMetrics: {
    totalStorageUsedMB: number
    avgDocumentSizeMB: number
    documentsWithHash: number
    hashVerificationRate: number
  }
}

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

    // Get tenant for user
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id, name')
      .eq('owner_user_id', user.id)
      .single()

    if (tenantError || !tenant) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Tenant not found' })
      }
    }

    // Rate limiting by tenant
    const rateLimitResult = rateLimitByTenant(tenant.id, RATE_LIMIT_CONFIGS.NORMAL)
    
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

    // Parse query parameters
    const queryParams = event.queryStringParameters || {}
    const period = queryParams.period || '7d' // 7d, 30d, 90d
    const includeDetails = queryParams.details === 'true'

    console.log(`Fetching Finance KPIs for tenant ${tenant.id}, period: ${period}`)

    // Calculate date range
    const endDate = new Date()
    const startDate = new Date()
    
    switch (period) {
      case '24h':
        startDate.setHours(startDate.getHours() - 24)
        break
      case '7d':
        startDate.setDate(startDate.getDate() - 7)
        break
      case '30d':
        startDate.setDate(startDate.getDate() - 30)
        break
      case '90d':
        startDate.setDate(startDate.getDate() - 90)
        break
      default:
        startDate.setDate(startDate.getDate() - 7)
    }

    // Fetch metrics
    const kpis = await calculateFinanceKPIs(tenant.id, startDate, endDate, includeDetails)

    return {
      statusCode: 200,
      headers: { ...headers, ...getRateLimitHeaders(rateLimitResult) },
      body: JSON.stringify({
        success: true,
        data: kpis,
        tenant: tenant.id,
        period,
        dateRange: {
          start: startDate.toISOString(),
          end: endDate.toISOString()
        }
      })
    }

  } catch (error) {
    console.error('Finance KPI error:', error)
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

async function calculateFinanceKPIs(
  tenantId: string, 
  startDate: Date, 
  endDate: Date,
  includeDetails: boolean = false
): Promise<FinanceKPIs> {
  
  if (!supabase) {
    throw new Error('Supabase not initialized')
  }

  // Base query for evidence files in period
  const { data: documents, error: documentsError } = await supabase
    .from('evidence_files')
    .select('*')
    .eq('tenant_id', tenantId)
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString())

  if (documentsError) {
    console.error('Error fetching evidence files:', documentsError)
    throw new Error('Failed to fetch finance documents')
  }

  const allDocuments = documents || []
  
  // Calculate basic metrics
  const totalDocuments = allDocuments.length
  const validDocuments = allDocuments.filter(doc => doc.validation_status === 'valid').length
  const invalidDocuments = totalDocuments - validDocuments
  const validationRate = totalDocuments > 0 ? (validDocuments / totalDocuments) * 100 : 0

  // Calculate average validation score
  const scoresWithValues = allDocuments.filter(doc => doc.validation_score != null)
  const avgValidationScore = scoresWithValues.length > 0 
    ? scoresWithValues.reduce((sum, doc) => sum + doc.validation_score, 0) / scoresWithValues.length
    : 0

  // Calculate file sizes
  const totalFileSize = allDocuments.reduce((sum, doc) => sum + (doc.size_bytes || 0), 0)
  const avgFileSize = totalDocuments > 0 ? totalFileSize / totalDocuments : 0

  // Documents by type
  const documentsByType = calculateDocumentsByType(allDocuments)
  
  // Documents by country
  const documentsByCountry = calculateDocumentsByCountry(allDocuments)
  
  // Most common validation errors
  const validationErrors = calculateValidationErrors(allDocuments)
  
  // Time savings calculation (estimate)
  const timeSavings = calculateTimeSavings(allDocuments)
  
  // Compliance metrics
  const complianceMetrics = calculateComplianceMetrics(allDocuments)
  
  // Storage metrics
  const storageMetrics = calculateStorageMetrics(allDocuments)

  return {
    period: `${startDate.toISOString()}_${endDate.toISOString()}`,
    totalDocuments,
    validDocuments,
    invalidDocuments,
    validationRate: Math.round(validationRate * 100) / 100,
    avgValidationScore: Math.round(avgValidationScore * 100) / 100,
    totalFileSize,
    avgFileSize: Math.round(avgFileSize),
    documentsByType,
    documentsByCountry,
    validationErrors,
    timeSavings,
    complianceMetrics,
    storageMetrics
  }
}

function calculateDocumentsByType(documents: any[]): Array<{type: string, count: number, validationRate: number}> {
  const typeGroups = documents.reduce((groups, doc) => {
    const type = doc.document_type || 'Unknown'
    if (!groups[type]) {
      groups[type] = []
    }
    groups[type].push(doc)
    return groups
  }, {} as Record<string, any[]>)

  return Object.entries(typeGroups).map(([type, docs]) => ({
    type,
    count: docs.length,
    validationRate: docs.length > 0 
      ? Math.round((docs.filter(doc => doc.validation_status === 'valid').length / docs.length) * 100 * 100) / 100
      : 0
  })).sort((a, b) => b.count - a.count)
}

function calculateDocumentsByCountry(documents: any[]): Array<{country: string, count: number, validationRate: number}> {
  const countryGroups = documents.reduce((groups, doc) => {
    const country = doc.country || 'Unknown'
    if (!groups[country]) {
      groups[country] = []
    }
    groups[country].push(doc)
    return groups
  }, {} as Record<string, any[]>)

  return Object.entries(countryGroups).map(([country, docs]) => ({
    country,
    count: docs.length,
    validationRate: docs.length > 0 
      ? Math.round((docs.filter(doc => doc.validation_status === 'valid').length / docs.length) * 100 * 100) / 100
      : 0
  })).sort((a, b) => b.count - a.count)
}

function calculateValidationErrors(documents: any[]): Array<{error: string, count: number}> {
  const errorCounts: Record<string, number> = {}
  
  documents.forEach(doc => {
    if (doc.validation_errors && Array.isArray(doc.validation_errors)) {
      doc.validation_errors.forEach((error: string) => {
        errorCounts[error] = (errorCounts[error] || 0) + 1
      })
    }
  })

  return Object.entries(errorCounts)
    .map(([error, count]) => ({ error, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10) // Top 10 errors
}

function calculateTimeSavings(documents: any[]): {
  totalDocuments: number
  avgProcessingTimeMinutes: number
  totalTimeSavedHours: number
} {
  const totalDocuments = documents.length
  
  // Estimate: manual validation takes 5-15 minutes per document
  // Automated validation takes ~30 seconds
  const manualProcessingMinutes = 10 // Average
  const automatedProcessingMinutes = 0.5 // 30 seconds
  const timeSavedPerDocument = manualProcessingMinutes - automatedProcessingMinutes
  
  const totalTimeSavedHours = (totalDocuments * timeSavedPerDocument) / 60

  return {
    totalDocuments,
    avgProcessingTimeMinutes: manualProcessingMinutes,
    totalTimeSavedHours: Math.round(totalTimeSavedHours * 100) / 100
  }
}

function calculateComplianceMetrics(documents: any[]): {
  cfdiDocuments: number
  cfdiValidRate: number
  dianDocuments: number
  dianValidRate: number
} {
  const cfdiDocs = documents.filter(doc => doc.document_type === 'CFDI')
  const dianDocs = documents.filter(doc => doc.document_type === 'DIAN')
  
  const cfdiValidDocs = cfdiDocs.filter(doc => doc.validation_status === 'valid')
  const dianValidDocs = dianDocs.filter(doc => doc.validation_status === 'valid')

  return {
    cfdiDocuments: cfdiDocs.length,
    cfdiValidRate: cfdiDocs.length > 0 ? Math.round((cfdiValidDocs.length / cfdiDocs.length) * 100 * 100) / 100 : 0,
    dianDocuments: dianDocs.length,
    dianValidRate: dianDocs.length > 0 ? Math.round((dianValidDocs.length / dianDocs.length) * 100 * 100) / 100 : 0
  }
}

function calculateStorageMetrics(documents: any[]): {
  totalStorageUsedMB: number
  avgDocumentSizeMB: number
  documentsWithHash: number
  hashVerificationRate: number
} {
  const totalBytes = documents.reduce((sum, doc) => sum + (doc.size_bytes || 0), 0)
  const totalStorageUsedMB = Math.round((totalBytes / (1024 * 1024)) * 100) / 100
  const avgDocumentSizeMB = documents.length > 0 
    ? Math.round((totalBytes / documents.length / (1024 * 1024)) * 100) / 100
    : 0
  
  const documentsWithHash = documents.filter(doc => doc.sha256).length
  const hashVerificationRate = documents.length > 0 
    ? Math.round((documentsWithHash / documents.length) * 100 * 100) / 100
    : 0

  return {
    totalStorageUsedMB,
    avgDocumentSizeMB,
    documentsWithHash,
    hashVerificationRate
  }
}