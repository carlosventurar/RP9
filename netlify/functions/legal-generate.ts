import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import * as Handlebars from 'handlebars'
import { marked } from 'marked'
import * as fs from 'fs/promises'
import * as path from 'path'

// Types
interface DocumentGenerationRequest {
  document_type: 'tos' | 'privacy' | 'msa' | 'dpa' | 'sla'
  language: 'es' | 'en'
  variables: Record<string, any>
  output_format: 'html' | 'pdf' | 'markdown'
  tenant_id?: string
}

interface DocumentGenerationResponse {
  success: boolean
  document_url?: string
  document_html?: string
  document_markdown?: string
  generation_id: string
  metadata: {
    document_type: string
    language: string
    generated_at: string
    expires_at: string
    variables_hash: string
  }
}

// Validation schema
const generationSchema = z.object({
  document_type: z.enum(['tos', 'privacy', 'msa', 'dpa', 'sla']),
  language: z.enum(['es', 'en']).default('es'),
  variables: z.record(z.any()).default({}),
  output_format: z.enum(['html', 'pdf', 'markdown']).default('html'),
  tenant_id: z.string().uuid().optional()
})

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Rate limiting store
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

// Rate limiting function
function checkRateLimit(clientId: string, maxRequests = 50, windowMs = 3600000): boolean {
  const now = Date.now()
  const clientData = rateLimitStore.get(clientId)
  
  if (!clientData || now > clientData.resetTime) {
    rateLimitStore.set(clientId, { count: 1, resetTime: now + windowMs })
    return true
  }
  
  if (clientData.count >= maxRequests) {
    return false
  }
  
  clientData.count++
  return true
}

// Get client IP from event
function getClientIP(event: HandlerEvent): string {
  return event.headers['x-forwarded-for']?.split(',')[0] || 
         event.headers['x-real-ip'] || 
         '127.0.0.1'
}

// Generate hash for variables (for caching)
async function generateHash(data: string): Promise<string> {
  const encoder = new TextEncoder()
  const dataBuffer = encoder.encode(data)
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

// Load template file
async function loadTemplate(documentType: string, language: string): Promise<string> {
  try {
    const templatePath = path.join(process.cwd(), 'templates', 'legal', `${documentType}_${language}.md`)
    const template = await fs.readFile(templatePath, 'utf-8')
    return template
  } catch (error) {
    console.error(`Template not found: ${documentType}_${language}.md`)
    throw new Error(`Template not found for ${documentType} in ${language}`)
  }
}

// Default variables for document generation
function getDefaultVariables(documentType: string, language: string): Record<string, any> {
  const currentDate = new Date().toISOString().split('T')[0]
  
  const defaults = {
    // Company information
    company_name: 'RP9 Portal',
    company_address: 'Ciudad de México, México',
    company_tax_id: 'RFC-EXAMPLE-123',
    company_phone: '+52 55 1234 5678',
    company_email: 'contacto@rp9portal.com',
    legal_email: 'legal@rp9portal.com',
    support_email: 'soporte@rp9portal.com',
    privacy_email: 'privacidad@rp9portal.com',
    dpo_email: 'dpo@rp9portal.com',
    website_url: 'https://rp9portal.com',
    
    // Document metadata
    version: '2025-01',
    effective_date: currentDate,
    last_modified: currentDate,
    generation_date: new Date().toISOString(),
    jurisdiction: 'CDMX, México',
    language_code: language,
    document_id: `${documentType}-${language}-${Date.now()}`,
    
    // Service information
    sla_percentage: '99.9',
    support_coverage: '24/7 para incidentes críticos',
    support_p1: '4 horas',
    support_p2: '8 horas', 
    support_p3: 'siguiente día hábil',
    support_url: 'https://soporte.rp9portal.com',
    business_hours: 'Lunes a Viernes 9:00-18:00 GMT-6',
    
    // Plans and pricing
    plan_starter: 'Starter',
    plan_pro: 'Pro', 
    plan_enterprise: 'Enterprise',
    starter_users: '5',
    pro_users: '25',
    billing_cycle: 'mensual',
    billing_day: '1',
    grace_period: '7',
    notice_days: '3',
    
    // SLA and credits
    sla_penalties: [
      { uptime_min: '99.0', uptime_max: '99.5', credit_percent: '5' },
      { uptime_min: '98.0', uptime_max: '99.0', credit_percent: '10' },
      { uptime_min: '0', uptime_max: '98.0', credit_percent: '20' }
    ],
    
    // Legal and compliance
    data_regulations: language === 'es' ? 'LGPD, LFPDPPP' : 'GDPR, CCPA',
    data_retention: '30',
    termination_notice: '30',
    liability_months: '12',
    max_liability: '$10,000 USD',
    carveout_multiplier: '2',
    
    // Privacy specific
    payment_processor: 'Stripe',
    analytics_provider: 'Mixpanel',
    security_certifications: 'SOC2 Type II',
    audit_frequency: 'trimestral',
    pentest_frequency: 'anual',
    logs_retention: '90',
    billing_retention: '7',
    backup_retention: '30',
    support_retention: '3',
    response_time: '30',
    min_age: '18',
    notice_period: '30',
    
    // Subprocessors
    subprocessors: [
      {
        name: 'Supabase',
        location: 'Estados Unidos',
        purpose: 'Base de datos y autenticación',
        certifications: 'SOC2 Type II',
        data_categories: 'Datos de usuario, workflows'
      },
      {
        name: 'Stripe',
        location: 'Estados Unidos', 
        purpose: 'Procesamiento de pagos',
        certifications: 'PCI DSS Level 1',
        data_categories: 'Información de pago'
      },
      {
        name: 'Netlify',
        location: 'Estados Unidos',
        purpose: 'Hosting y CDN',
        certifications: 'SOC2 Type II',
        data_categories: 'Logs de aplicación'
      }
    ],
    subprocessors_url: 'https://rp9portal.com/legal/subprocessors',
    subprocessor_notice: '30',
    
    // Contact information
    tax_id_field: language === 'es' ? 'RFC' : 'Tax ID',
    privacy_portal_url: 'https://rp9portal.com/privacy',
    cookie_settings_url: 'https://rp9portal.com/cookies',
    policy_archive_url: 'https://rp9portal.com/legal/archive',
    
    // Regulatory
    data_authority: language === 'es' ? 'INAI' : 'Data Protection Authority',
    authority_url: 'https://home.inai.org.mx',
    authority_phone: '+52 55 5004 2400',
    
    // Generation metadata
    opt_out: false,
    aggregated_data_allowed: true,
    termination_for_convenience: true,
    enterprise_notice: '90',
    maintenance_notice: '24',
    feature_notice: '30'
  }
  
  // Document-specific defaults
  if (documentType === 'msa') {
    return {
      ...defaults,
      client_company: 'Cliente Empresa S.A.',
      client_address: 'Dirección del Cliente',
      client_tax_id: 'RFC-CLIENT-123',
      client_representative: 'Representante Legal',
      client_industry: 'Tecnología',
      contract_duration: '1 año',
      signature_date: currentDate,
      base_plan: 'Pro',
      base_price: '$1,999',
      currency: 'MXN',
      payment_method: 'Tarjeta de crédito',
      payment_terms: '30',
      geographic_scope: 'México y Latinoamérica',
      support_level: 'Premium',
      price_increase_notice: '60',
      max_price_increase: '15',
      response_time: '200',
      maintenance_hours: '4',
      initial_term: '12 meses',
      renewal_term: '12 meses',
      non_renewal_notice: '60',
      cure_period: '30',
      data_migration_period: '60',
      escalation_l1: '5',
      escalation_l2: '10',
      mediation_body: 'CANACO CDMX',
      arbitration_rules: 'ICC',
      arbitration_venue: 'Ciudad de México',
      arbitration_language: 'Español',
      governing_law: 'México',
      court_jurisdiction: 'Ciudad de México',
      applicable_regulations: 'LFPDPPP, Código de Comercio',
      technical_notice: '15',
      contract_id: `MSA-${Date.now()}`,
      account_manager: 'Gerente de Cuenta',
      am_email: 'am@rp9portal.com',
      am_phone: '+52 55 1234 5678'
    }
  }
  
  return defaults
}

// Compile template with variables
function compileTemplate(template: string, variables: Record<string, any>): string {
  // Register Handlebars helpers
  Handlebars.registerHelper('if', function(conditional, options) {
    if (conditional) {
      return options.fn(this)
    } else {
      return options.inverse(this)
    }
  })
  
  Handlebars.registerHelper('unless', function(conditional, options) {
    if (!conditional) {
      return options.fn(this)
    } else {
      return options.inverse(this)
    }
  })
  
  Handlebars.registerHelper('each', function(context, options) {
    let ret = ''
    if (context && context.length > 0) {
      for (let i = 0; i < context.length; i++) {
        ret += options.fn(context[i])
      }
    }
    return ret
  })
  
  const compiled = Handlebars.compile(template)
  return compiled(variables)
}

// Convert markdown to HTML
function markdownToHtml(markdown: string): string {
  // Configure marked for better PDF generation
  marked.setOptions({
    breaks: true,
    gfm: true
  })
  
  return marked(markdown)
}

// Generate PDF from HTML (placeholder - in production use Puppeteer or similar)
async function generatePdf(html: string): Promise<string> {
  // This is a placeholder - in production you would use:
  // - Puppeteer for server-side PDF generation
  // - jsPDF for client-side generation
  // - External PDF API service
  
  console.log('PDF generation not implemented - returning HTML placeholder')
  
  // For now, return a base64 encoded HTML as placeholder
  const pdfPlaceholder = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Legal Document PDF</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
    h1, h2, h3 { color: #333; }
    .header { border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
    .footer { border-top: 1px solid #ccc; padding-top: 20px; margin-top: 30px; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Documento Legal - PDF</h1>
    <p>Generado el: ${new Date().toLocaleString()}</p>
  </div>
  ${html}
  <div class="footer">
    <p>Este documento fue generado automáticamente por RP9 Portal.</p>
  </div>
</body>
</html>`
  
  return Buffer.from(pdfPlaceholder).toString('base64')
}

// Store generated document (placeholder)
async function storeDocument(
  content: string, 
  format: string, 
  metadata: any
): Promise<string> {
  // In production, you would upload to cloud storage (S3, CloudFlare R2, etc.)
  // For now, return a placeholder URL
  const documentId = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  
  // Store metadata in Supabase for tracking
  try {
    await supabase
      .from('legal_documents')
      .insert({
        id: documentId,
        document_type: metadata.document_type,
        version: metadata.version || '2025-01',
        language: metadata.language,
        title: `Generated ${metadata.document_type.toUpperCase()}`,
        content: content,
        template_variables: metadata.variables || {},
        requires_signature: false,
        status: 'generated',
        created_at: new Date().toISOString()
      })
  } catch (error) {
    console.error('Error storing document metadata:', error)
  }
  
  return `https://documents.rp9portal.com/${documentId}.${format}`
}

// Main handler
export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': process.env.NODE_ENV === 'production' 
      ? 'https://rp9portal.com' 
      : '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  }

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    }
  }

  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ 
        error: 'Method not allowed',
        message: 'Only POST requests are accepted' 
      })
    }
  }

  try {
    // Rate limiting
    const clientIP = getClientIP(event)
    if (!checkRateLimit(clientIP)) {
      return {
        statusCode: 429,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'Rate limit exceeded',
          message: 'Too many document generation requests. Please try again later.'
        })
      }
    }

    // Parse and validate request
    if (!event.body) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'Missing request body',
          message: 'Request body is required'
        })
      }
    }

    let requestData: DocumentGenerationRequest
    try {
      requestData = JSON.parse(event.body)
    } catch (error) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'Invalid JSON',
          message: 'Request body must be valid JSON'
        })
      }
    }

    // Validate request data
    const validation = generationSchema.safeParse(requestData)
    if (!validation.success) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'Validation failed',
          message: 'Invalid request data',
          details: validation.error.issues
        })
      }
    }

    const { document_type, language, variables, output_format, tenant_id } = validation.data

    // Load template
    const template = await loadTemplate(document_type, language)
    
    // Merge with default variables
    const defaultVars = getDefaultVariables(document_type, language)
    const allVariables = { ...defaultVars, ...variables }
    
    // Add generation metadata
    const generationId = `gen_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const variablesHash = await generateHash(JSON.stringify(allVariables))
    
    allVariables.document_hash = variablesHash
    allVariables.generation_id = generationId
    
    // Compile template
    const compiledMarkdown = compileTemplate(template, allVariables)
    
    // Generate output based on format
    let documentUrl: string | undefined
    let documentHtml: string | undefined
    let documentMarkdown: string | undefined
    
    const metadata = {
      document_type,
      language,
      generated_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
      variables_hash: variablesHash,
      version: allVariables.version,
      variables: allVariables
    }
    
    switch (output_format) {
      case 'markdown':
        documentMarkdown = compiledMarkdown
        documentUrl = await storeDocument(compiledMarkdown, 'md', metadata)
        break
        
      case 'html':
        documentHtml = markdownToHtml(compiledMarkdown)
        documentUrl = await storeDocument(documentHtml, 'html', metadata)
        break
        
      case 'pdf':
        const html = markdownToHtml(compiledMarkdown)
        const pdfBase64 = await generatePdf(html)
        documentUrl = await storeDocument(pdfBase64, 'pdf', metadata)
        break
    }

    // Log generation for audit
    console.log(`Document generated: ${document_type} (${language}) for ${tenant_id || 'anonymous'}`)

    // Success response
    const response: DocumentGenerationResponse = {
      success: true,
      generation_id: generationId,
      metadata,
      ...(documentUrl && { document_url: documentUrl }),
      ...(documentHtml && { document_html: documentHtml }),
      ...(documentMarkdown && { document_markdown: documentMarkdown })
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(response)
    }

  } catch (error) {
    console.error('Error in legal-generate:', error)
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: 'Document generation failed',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        ...(process.env.NODE_ENV === 'development' && { 
          details: error instanceof Error ? error.stack : String(error)
        })
      })
    }
  }
}

// Export for testing
export { 
  generationSchema, 
  getDefaultVariables, 
  compileTemplate,
  checkRateLimit 
}