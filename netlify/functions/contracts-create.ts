import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

// Types
interface ContractCreationRequest {
  tenant_id: string
  contract_type: 'msa' | 'dpa' | 'sla'
  client_info: {
    company_name: string
    address: string
    tax_id: string
    representative: string
    email: string
    industry?: string
  }
  contract_terms: Record<string, any>
  language?: 'es' | 'en'
}

// Validation schema
const contractSchema = z.object({
  tenant_id: z.string().uuid(),
  contract_type: z.enum(['msa', 'dpa', 'sla']),
  client_info: z.object({
    company_name: z.string().min(1),
    address: z.string().min(1),
    tax_id: z.string().min(1),
    representative: z.string().min(1),
    email: z.string().email(),
    industry: z.string().optional()
  }),
  contract_terms: z.record(z.any()).default({}),
  language: z.enum(['es', 'en']).default('es')
})

// Initialize Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Rate limiting
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

function checkRateLimit(clientId: string, maxRequests = 10, windowMs = 3600000): boolean {
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

function getClientIP(event: HandlerEvent): string {
  return event.headers['x-forwarded-for']?.split(',')[0] || 
         event.headers['x-real-ip'] || 
         '127.0.0.1'
}

// Generate contract variables
function generateContractVariables(
  contractType: string,
  clientInfo: any,
  contractTerms: any,
  language: string
): Record<string, any> {
  const currentDate = new Date().toISOString().split('T')[0]
  
  return {
    // Client information
    client_company: clientInfo.company_name,
    client_address: clientInfo.address,
    client_tax_id: clientInfo.tax_id,
    client_representative: clientInfo.representative,
    client_email: clientInfo.email,
    client_industry: clientInfo.industry || 'Tecnología',
    client_contact: clientInfo.representative,
    client_phone: contractTerms.client_phone || '+52 55 0000 0000',
    
    // Contract metadata
    contract_type: contractType,
    signature_date: currentDate,
    effective_date: contractTerms.effective_date || currentDate,
    contract_duration: contractTerms.duration || '12 meses',
    language_code: language,
    
    // Commercial terms
    base_plan: contractTerms.plan || 'Pro',
    base_price: contractTerms.base_price || '$1,999',
    currency: contractTerms.currency || 'MXN',
    payment_method: contractTerms.payment_method || 'Transferencia bancaria',
    payment_terms: contractTerms.payment_terms || '30',
    billing_cycle: contractTerms.billing_cycle || 'mensual',
    
    // SLA terms
    sla_percentage: contractTerms.sla_percentage || '99.9',
    support_level: contractTerms.support_level || 'Premium',
    support_p1_response: contractTerms.support_p1 || '4 horas',
    support_p2_response: contractTerms.support_p2 || '8 horas',
    support_p3_response: contractTerms.support_p3 || '24 horas',
    
    // Legal terms
    jurisdiction: contractTerms.jurisdiction || 'CDMX, México',
    governing_law: contractTerms.governing_law || 'México',
    court_jurisdiction: contractTerms.court_jurisdiction || 'Ciudad de México',
    arbitration_rules: contractTerms.arbitration_rules || 'ICC',
    arbitration_venue: contractTerms.arbitration_venue || 'Ciudad de México',
    arbitration_language: contractTerms.arbitration_language || 'Español',
    
    // Data processing terms (for DPA)
    data_categories: contractTerms.data_categories || ['user_data', 'workflow_data'],
    processing_purposes: contractTerms.processing_purposes || ['service_delivery', 'support'],
    retention_period: contractTerms.retention_period || '30 días tras terminación',
    
    // Termination terms
    initial_term: contractTerms.initial_term || '12 meses',
    renewal_term: contractTerms.renewal_term || '12 meses',
    termination_notice: contractTerms.termination_notice || '30',
    termination_for_convenience: contractTerms.termination_for_convenience !== false,
    
    // Liability and insurance
    liability_cap: contractTerms.liability_cap || '$50,000 USD',
    liability_period: contractTerms.liability_period || '12',
    confidentiality_liability: contractTerms.confidentiality_liability || '$100,000 USD',
    data_breach_liability: contractTerms.data_breach_liability || '$200,000 USD',
    
    // Geographic and regulatory
    geographic_scope: contractTerms.geographic_scope || 'México y Latinoamérica',
    applicable_regulations: contractTerms.applicable_regulations || 'LFPDPPP, Código de Comercio',
    
    // Company information
    company_signatory: 'Director Legal',
    company_title: 'Director Legal y Compliance',
    client_signatory: clientInfo.representative,
    client_title: contractTerms.client_title || 'Representante Legal',
    
    // Technical specifications
    authorized_countries: contractTerms.authorized_countries || ['MX', 'US'],
    transfer_safeguards: contractTerms.transfer_safeguards || 'Cláusulas Contractuales Estándar',
    security_certifications: 'SOC2 Type II, ISO 27001',
    audit_frequency: 'anual',
    
    // Default values
    opt_out: contractTerms.opt_out || false,
    aggregated_data_allowed: contractTerms.aggregated_data_allowed !== false,
    price_protection: contractTerms.price_protection || false,
    max_price_increase: contractTerms.max_price_increase || '15',
    
    // Service levels
    response_time: contractTerms.response_time || '200',
    maintenance_hours: contractTerms.maintenance_hours || '4',
    maintenance_notice: contractTerms.maintenance_notice || '48',
    
    // Contact information
    account_manager: 'Gerente de Cuenta Enterprise',
    am_email: 'enterprise@rp9portal.com',
    am_phone: '+52 55 1234 5678'
  }
}

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': process.env.NODE_ENV === 'production' 
      ? 'https://rp9portal.com' 
      : '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  }

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' }
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method not allowed' })
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
          message: 'Too many contract creation requests'
        })
      }
    }

    // Parse and validate request
    if (!event.body) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Missing request body' })
      }
    }

    const requestData = JSON.parse(event.body)
    const validation = contractSchema.safeParse(requestData)
    
    if (!validation.success) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'Validation failed',
          details: validation.error.issues
        })
      }
    }

    const { tenant_id, contract_type, client_info, contract_terms, language } = validation.data

    // Generate contract variables
    const variables = generateContractVariables(contract_type, client_info, contract_terms, language!)

    // Create contract record
    const contractId = `${contract_type.toUpperCase()}-${Date.now()}`
    const { data: contract, error: contractError } = await supabase
      .from('contracts')
      .insert({
        id: contractId,
        tenant_id,
        contract_type,
        title: `${contract_type.toUpperCase()} - ${client_info.company_name}`,
        status: 'draft',
        variables,
        created_at: new Date().toISOString()
      })
      .select()
      .single()

    if (contractError) {
      throw new Error(`Failed to create contract: ${contractError.message}`)
    }

    // Generate document content
    const generateResponse = await fetch(`${process.env.NETLIFY_URL || 'http://localhost:8888'}/.netlify/functions/legal-generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        document_type: contract_type,
        language,
        variables,
        output_format: 'html',
        tenant_id
      })
    })

    let documentUrl: string | undefined
    let generatedContent: string | undefined

    if (generateResponse.ok) {
      const generateResult = await generateResponse.json()
      documentUrl = generateResult.document_url
      generatedContent = generateResult.document_html
      
      // Update contract with generated content
      await supabase
        .from('contracts')
        .update({
          generated_content: generatedContent,
          html_url: documentUrl
        })
        .eq('id', contractId)
    }

    // Success response
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        contract: {
          id: contractId,
          type: contract_type,
          status: 'draft',
          client_company: client_info.company_name,
          created_at: contract.created_at,
          document_url: documentUrl,
          variables
        }
      })
    }

  } catch (error) {
    console.error('Error in contracts-create:', error)
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: 'Contract creation failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
}

export { contractSchema, generateContractVariables }