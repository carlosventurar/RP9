// Lead Submission API Endpoint
// POST /api/leads/submit - Creates lead in database and syncs to CRM

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { 
  getDefaultCRMProvider, 
  extractDomainFromEmail, 
  generateDealName, 
  getDealStageFromLead, 
  getDealProbability,
  estimateDealAmount 
} from '@/lib/crm/factory'
import { LeadFormData, LeadSubmissionResponse, CRMContact, CRMCompany, CRMDeal } from '@/lib/crm/types'

// Validation schema
const LeadSubmissionSchema = z.object({
  email: z.string().email('Invalid email address'),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  companyName: z.string().optional(),
  jobTitle: z.string().optional(),
  phone: z.string().optional(),
  website: z.string().url().optional().or(z.literal('')),
  industry: z.string().optional(),
  companySize: z.enum(['1-10', '11-50', '51-200', '201-1000', '1000+']).optional(),
  country: z.string().length(2).default('MX'),
  source: z.string(),
  message: z.string().optional(),
  demoRequested: z.boolean().default(false),
  pilotRequested: z.boolean().default(false),
  utmSource: z.string().optional(),
  utmMedium: z.string().optional(),
  utmCampaign: z.string().optional(),
  utmContent: z.string().optional(),
  utmTerm: z.string().optional(),
  roiCalculation: z.any().optional(),
  // Honeypot field for bot detection
  website_url: z.string().max(0).optional()
})

// Rate limiting helper (simple in-memory implementation)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const windowMs = 15 * 60 * 1000 // 15 minutes
  const maxRequests = 5
  
  const record = rateLimitMap.get(ip)
  
  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + windowMs })
    return true
  }
  
  if (record.count >= maxRequests) {
    return false
  }
  
  record.count++
  return true
}

async function calculateLeadScore(leadData: LeadFormData, supabase: any): Promise<{ score: number; grade: string }> {
  let score = 0
  
  // Base score
  score += 10
  
  // Company size scoring
  if (leadData.companySize) {
    const sizeScores = {
      '1-10': 5,
      '11-50': 15,
      '51-200': 25,
      '201-1000': 35,
      '1000+': 45
    }
    score += sizeScores[leadData.companySize] || 0
  }
  
  // Source scoring
  const sourceScores = {
    'roi-calculator': 25,
    'demo-request': 30,
    'pilot-request': 40,
    'webinar': 20,
    'partner': 15,
    'organic': 10,
    'paid-search': 12,
    'social': 8,
    'email': 15,
    'referral': 18
  }
  score += sourceScores[leadData.source as keyof typeof sourceScores] || 5
  
  // Intent signals
  if (leadData.demoRequested) score += 25
  if (leadData.pilotRequested) score += 35
  if (leadData.roiCalculation) score += 20
  
  // Job title scoring
  if (leadData.jobTitle) {
    const title = leadData.jobTitle.toLowerCase()
    if (title.includes('ceo') || title.includes('founder')) score += 20
    if (title.includes('operations') || title.includes('ops')) score += 25
    if (title.includes('cfo') || title.includes('finance')) score += 22
    if (title.includes('cto') || title.includes('technical')) score += 18
  }
  
  // Industry scoring
  const industryScores = {
    'technology': 15,
    'ecommerce': 20,
    'finance': 18,
    'manufacturing': 16,
    'healthcare': 12
  }
  if (leadData.industry) {
    score += industryScores[leadData.industry as keyof typeof industryScores] || 8
  }
  
  // Ensure score is within bounds
  score = Math.min(100, Math.max(0, score))
  
  // Determine grade
  let grade = 'D'
  if (score >= 80) grade = 'A'
  else if (score >= 60) grade = 'B'
  else if (score >= 40) grade = 'C'
  
  return { score, grade }
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { success: false, error: 'Rate limit exceeded. Try again later.' },
        { status: 429 }
      )
    }
    
    // Parse and validate request body
    const body = await request.json()
    
    // Check honeypot
    if (body.website_url && body.website_url.length > 0) {
      // Bot detected, return success but don't process
      return NextResponse.json(
        { success: true, message: 'Thank you for your submission!' },
        { status: 200 }
      )
    }
    
    const validatedData = LeadSubmissionSchema.parse(body)
    
    // Initialize Supabase client
    const supabase = createClient()
    
    // Calculate lead score
    const { score, grade } = await calculateLeadScore(validatedData, supabase)
    
    // Check if lead already exists
    const { data: existingLead } = await supabase
      .from('leads')
      .select('*')
      .eq('email', validatedData.email)
      .single()
    
    let leadId: string
    
    if (existingLead) {
      // Update existing lead
      const { data: updatedLead, error: updateError } = await supabase
        .from('leads')
        .update({
          first_name: validatedData.firstName || existingLead.first_name,
          last_name: validatedData.lastName || existingLead.last_name,
          company_name: validatedData.companyName || existingLead.company_name,
          job_title: validatedData.jobTitle || existingLead.job_title,
          phone: validatedData.phone || existingLead.phone,
          website: validatedData.website || existingLead.website,
          industry: validatedData.industry || existingLead.industry,
          company_size: validatedData.companySize || existingLead.company_size,
          country: validatedData.country || existingLead.country,
          source: validatedData.source, // Always update source to latest
          utm_source: validatedData.utmSource,
          utm_medium: validatedData.utmMedium,
          utm_campaign: validatedData.utmCampaign,
          utm_content: validatedData.utmContent,
          utm_term: validatedData.utmTerm,
          score: Math.max(score, existingLead.score), // Take higher score
          grade: score > existingLead.score ? grade : existingLead.grade,
          demo_requested: validatedData.demoRequested || existingLead.demo_requested,
          pilot_requested: validatedData.pilotRequested || existingLead.pilot_requested,
          roi_calculation: validatedData.roiCalculation || existingLead.roi_calculation,
          notes: validatedData.message ? 
            `${existingLead.notes || ''}\n\n[${new Date().toISOString()}] ${validatedData.message}` : 
            existingLead.notes,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingLead.id)
        .select('*')
        .single()
      
      if (updateError) {
        console.error('Error updating lead:', updateError)
        throw updateError
      }
      
      leadId = updatedLead.id
    } else {
      // Create new lead
      const { data: newLead, error: insertError } = await supabase
        .from('leads')
        .insert({
          email: validatedData.email,
          first_name: validatedData.firstName,
          last_name: validatedData.lastName,
          company_name: validatedData.companyName,
          job_title: validatedData.jobTitle,
          phone: validatedData.phone,
          website: validatedData.website,
          industry: validatedData.industry,
          company_size: validatedData.companySize,
          country: validatedData.country,
          source: validatedData.source,
          utm_source: validatedData.utmSource,
          utm_medium: validatedData.utmMedium,
          utm_campaign: validatedData.utmCampaign,
          utm_content: validatedData.utmContent,
          utm_term: validatedData.utmTerm,
          score,
          grade,
          demo_requested: validatedData.demoRequested,
          pilot_requested: validatedData.pilotRequested,
          roi_calculation: validatedData.roiCalculation,
          notes: validatedData.message,
          status: 'new',
          stage: 'lead'
        })
        .select('*')
        .single()
      
      if (insertError) {
        console.error('Error creating lead:', insertError)
        throw insertError
      }
      
      leadId = newLead.id
    }
    
    // Sync to CRM
    let crmContactId: string | undefined
    let crmCompanyId: string | undefined
    let crmDealId: string | undefined
    let dealUrl: string | undefined
    
    try {
      const crmProvider = getDefaultCRMProvider()
      
      // Create/update contact
      const crmContact: CRMContact = {
        email: validatedData.email,
        firstName: validatedData.firstName,
        lastName: validatedData.lastName,
        phone: validatedData.phone,
        jobTitle: validatedData.jobTitle,
        company: validatedData.companyName,
        website: validatedData.website,
        industry: validatedData.industry,
        country: validatedData.country,
        source: validatedData.source,
        utmSource: validatedData.utmSource,
        utmMedium: validatedData.utmMedium,
        utmCampaign: validatedData.utmCampaign,
        utmContent: validatedData.utmContent,
        utmTerm: validatedData.utmTerm,
        leadScore: score,
        leadGrade: grade
      }
      
      crmContactId = await crmProvider.upsertContact(crmContact)
      
      // Create/update company if company name provided
      if (validatedData.companyName) {
        const domain = validatedData.website ? 
          extractDomainFromEmail(validatedData.website) : 
          extractDomainFromEmail(validatedData.email)
        
        const crmCompany: CRMCompany = {
          name: validatedData.companyName,
          domain: domain,
          website: validatedData.website,
          industry: validatedData.industry,
          size: validatedData.companySize,
          country: validatedData.country
        }
        
        crmCompanyId = await crmProvider.upsertCompany(crmCompany)
      }
      
      // Create deal for qualified leads
      if (score >= 40 || validatedData.demoRequested || validatedData.pilotRequested) {
        const dealStage = getDealStageFromLead(validatedData.source, validatedData.demoRequested, validatedData.pilotRequested)
        const dealAmount = estimateDealAmount(validatedData.companySize, validatedData.source)
        
        const crmDeal: CRMDeal = {
          name: generateDealName(validatedData.companyName, validatedData.source),
          contactId: crmContactId,
          companyId: crmCompanyId,
          amount: dealAmount,
          currency: 'USD',
          stage: dealStage,
          pipeline: 'default',
          probability: getDealProbability(dealStage),
          source: validatedData.source,
          description: validatedData.message
        }
        
        crmDealId = await crmProvider.createDeal(crmDeal)
        dealUrl = `https://app.hubspot.com/deals/portal/deal/${crmDealId}` // Adjust URL based on CRM
      }
      
      // Update lead with CRM IDs
      await supabase
        .from('leads')
        .update({
          hubspot_contact_id: crmContactId,
          hubspot_company_id: crmCompanyId,
          crm_last_sync_at: new Date().toISOString()
        })
        .eq('id', leadId)
      
      // Log CRM event
      await supabase
        .from('crm_events')
        .insert({
          lead_id: leadId,
          event_type: existingLead ? 'contact_updated' : 'contact_created',
          event_source: 'hubspot',
          crm_contact_id: crmContactId,
          crm_company_id: crmCompanyId,
          crm_deal_id: crmDealId,
          properties: {
            source: validatedData.source,
            score: score,
            grade: grade,
            demo_requested: validatedData.demoRequested,
            pilot_requested: validatedData.pilotRequested
          },
          processed: true
        })
      
    } catch (crmError) {
      console.error('CRM sync error:', crmError)
      // Don't fail the API call if CRM sync fails, but log it
      
      await supabase
        .from('crm_events')
        .insert({
          lead_id: leadId,
          event_type: 'sync_failed',
          event_source: 'hubspot',
          properties: { error: String(crmError) },
          processed: false,
          error_message: String(crmError)
        })
    }
    
    const response: LeadSubmissionResponse = {
      success: true,
      leadId,
      crmContactId,
      crmCompanyId,
      crmDealId,
      dealUrl,
      message: existingLead ? 
        'Thank you! We\'ve updated your information.' : 
        'Thank you! We\'ll be in touch soon.'
    }
    
    return NextResponse.json(response, { status: 200 })
    
  } catch (error) {
    console.error('Lead submission error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Validation error', 
          details: error.errors 
        },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error',
        message: 'Please try again later.'
      },
      { status: 500 }
    )
  }
}