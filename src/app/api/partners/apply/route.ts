// Partner Application API
// POST /api/partners/apply - Handles partner program applications

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getDefaultCRMProvider } from '@/lib/crm/factory'

// Validation schema
const PartnerApplicationSchema = z.object({
  // Personal information
  email: z.string().email('Invalid email address'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  phone: z.string().optional(),
  
  // Company information
  companyName: z.string().optional(),
  website: z.string().url().optional().or(z.literal('')),
  
  // Partner details
  partnerType: z.enum(['consultant', 'agency', 'freelancer', 'reseller'], {
    errorMap: () => ({ message: 'Please select a valid partner type' })
  }),
  experienceLevel: z.enum(['beginner', 'intermediate', 'expert']).optional(),
  specialties: z.array(z.string()).default([]),
  targetIndustries: z.array(z.string()).default([]),
  monthlyCapacity: z.number().int().min(0).max(1000).optional(),
  
  // Business information
  currentClients: z.number().int().min(0).max(10000).optional(),
  annualRevenue: z.number().min(0).max(100000000).optional(),
  teamSize: z.number().int().min(1).max(10000).optional(),
  
  // Application questions
  motivation: z.string().min(10, 'Please tell us why you want to become a partner (minimum 10 characters)'),
  relevantExperience: z.string().min(10, 'Please describe your relevant experience (minimum 10 characters)'),
  referralSource: z.string().optional(),
  
  // UTM tracking
  utmSource: z.string().optional(),
  utmMedium: z.string().optional(),
  utmCampaign: z.string().optional(),
  
  // Honeypot
  website_url: z.string().max(0).optional()
})

// Rate limiting
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const windowMs = 60 * 60 * 1000 // 1 hour
  const maxRequests = 2 // Max 2 applications per hour per IP
  
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

// Calculate application score
function calculateApplicationScore(applicationData: z.infer<typeof PartnerApplicationSchema>): { score: number; autoApprove: boolean; tier: string } {
  let score = 0
  
  // Base score
  score += 20
  
  // Partner type scoring
  const typeScores = {
    'consultant': 30,
    'agency': 25,
    'freelancer': 20,
    'reseller': 15
  }
  score += typeScores[applicationData.partnerType]
  
  // Experience level scoring
  const experienceScores = {
    'expert': 30,
    'intermediate': 20,
    'beginner': 10
  }
  if (applicationData.experienceLevel) {
    score += experienceScores[applicationData.experienceLevel]
  }
  
  // Business maturity scoring
  if (applicationData.currentClients) {
    if (applicationData.currentClients >= 50) score += 25
    else if (applicationData.currentClients >= 20) score += 20
    else if (applicationData.currentClients >= 10) score += 15
    else if (applicationData.currentClients >= 5) score += 10
    else score += 5
  }
  
  // Team size scoring
  if (applicationData.teamSize) {
    if (applicationData.teamSize >= 20) score += 20
    else if (applicationData.teamSize >= 10) score += 15
    else if (applicationData.teamSize >= 5) score += 10
    else score += 5
  }
  
  // Revenue scoring
  if (applicationData.annualRevenue) {
    if (applicationData.annualRevenue >= 1000000) score += 25
    else if (applicationData.annualRevenue >= 500000) score += 20
    else if (applicationData.annualRevenue >= 100000) score += 15
    else if (applicationData.annualRevenue >= 50000) score += 10
    else score += 5
  }
  
  // Capacity scoring
  if (applicationData.monthlyCapacity) {
    if (applicationData.monthlyCapacity >= 100) score += 15
    else if (applicationData.monthlyCapacity >= 50) score += 10
    else if (applicationData.monthlyCapacity >= 20) score += 5
  }
  
  // Quality of application
  const motivationLength = applicationData.motivation.length
  const experienceLength = applicationData.relevantExperience.length
  
  if (motivationLength > 200 && experienceLength > 200) score += 15
  else if (motivationLength > 100 && experienceLength > 100) score += 10
  else if (motivationLength > 50 && experienceLength > 50) score += 5
  
  // Specialties and target industries
  score += Math.min(10, applicationData.specialties.length * 2)
  score += Math.min(10, applicationData.targetIndustries.length * 2)
  
  // Ensure score is within bounds
  score = Math.min(100, Math.max(0, score))
  
  // Determine auto-approval and tier
  const autoApprove = score >= 80
  const tier = score >= 80 ? 'gold' : 'silver'
  
  return { score, autoApprove, tier }
}

// Sync to CRM
async function syncToCRM(applicationData: z.infer<typeof PartnerApplicationSchema>): Promise<string | undefined> {
  try {
    const crmProvider = getDefaultCRMProvider()
    
    const contactId = await crmProvider.upsertContact({
      email: applicationData.email,
      firstName: applicationData.firstName,
      lastName: applicationData.lastName,
      phone: applicationData.phone,
      company: applicationData.companyName,
      website: applicationData.website,
      source: 'partner-application',
      utmSource: applicationData.utmSource,
      utmMedium: applicationData.utmMedium,
      utmCampaign: applicationData.utmCampaign,
      customProperties: {
        partner_type: applicationData.partnerType,
        experience_level: applicationData.experienceLevel,
        monthly_capacity: applicationData.monthlyCapacity?.toString(),
        current_clients: applicationData.currentClients?.toString(),
        annual_revenue: applicationData.annualRevenue?.toString(),
        team_size: applicationData.teamSize?.toString(),
        referral_source: applicationData.referralSource,
        application_submitted: new Date().toISOString()
      }
    })
    
    return contactId
    
  } catch (error) {
    console.error('Error syncing partner application to CRM:', error)
    return undefined
  }
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { success: false, error: 'Too many applications. Please try again later.' },
        { status: 429 }
      )
    }
    
    // Parse and validate request body
    const body = await request.json()
    
    // Check honeypot
    if (body.website_url && body.website_url.length > 0) {
      return NextResponse.json(
        { success: true, message: 'Application submitted successfully!' },
        { status: 200 }
      )
    }
    
    const validatedData = PartnerApplicationSchema.parse(body)
    
    // Initialize Supabase client
    const supabase = createClient()
    
    // Check if application already exists
    const { data: existingApplication } = await supabase
      .from('partner_applications')
      .select('*')
      .eq('email', validatedData.email)
      .single()
    
    if (existingApplication && existingApplication.status !== 'rejected') {
      return NextResponse.json({
        success: false,
        error: 'An application with this email already exists.',
        existingStatus: existingApplication.status
      }, { status: 400 })
    }
    
    // Calculate application score
    const { score, autoApprove, tier } = calculateApplicationScore(validatedData)
    
    // Create partner application
    const applicationData = {
      email: validatedData.email,
      first_name: validatedData.firstName,
      last_name: validatedData.lastName,
      company_name: validatedData.companyName,
      phone: validatedData.phone,
      website: validatedData.website,
      partner_type: validatedData.partnerType,
      experience_level: validatedData.experienceLevel,
      specialties: validatedData.specialties,
      target_industries: validatedData.targetIndustries,
      monthly_capacity: validatedData.monthlyCapacity,
      current_clients: validatedData.currentClients,
      annual_revenue: validatedData.annualRevenue,
      team_size: validatedData.teamSize,
      motivation: validatedData.motivation,
      relevant_experience: validatedData.relevantExperience,
      referral_source: validatedData.referralSource,
      status: autoApprove ? 'approved' : 'pending',
      tier: autoApprove ? tier : null
    }
    
    const { data: application, error } = await supabase
      .from('partner_applications')
      .insert(applicationData)
      .select('*')
      .single()
    
    if (error) {
      console.error('Error creating partner application:', error)
      throw error
    }
    
    // Sync to CRM
    const crmContactId = await syncToCRM(validatedData)
    
    if (crmContactId) {
      await supabase
        .from('partner_applications')
        .update({ 
          hubspot_contact_id: crmContactId,
          crm_last_sync_at: new Date().toISOString()
        })
        .eq('id', application.id)
    }
    
    // Send notification email to team (would be implemented with email service)
    // await sendPartnerApplicationNotification(application, score, autoApprove)
    
    // Send confirmation email to applicant
    // await sendPartnerApplicationConfirmation(validatedData, autoApprove, tier)
    
    // Prepare response
    let responseMessage = 'Thank you for your partner application!'
    let nextSteps = []
    
    if (autoApprove) {
      responseMessage = `Congratulations! Your ${tier} partner application has been approved!`
      nextSteps = [
        'Check your email for partner onboarding instructions',
        'Access your partner portal to get started',
        'Schedule an onboarding call with our team'
      ]
    } else {
      responseMessage = 'Thank you for your partner application!'
      nextSteps = [
        'We\'ll review your application within 2-3 business days',
        'Check your email for updates on your application status',
        'Feel free to reach out if you have any questions'
      ]
    }
    
    return NextResponse.json({
      success: true,
      applicationId: application.id,
      status: autoApprove ? 'approved' : 'pending',
      tier: autoApprove ? tier : null,
      score: score, // Remove in production
      message: responseMessage,
      nextSteps,
      estimatedReviewTime: autoApprove ? 'immediate' : '2-3 business days'
    })
    
  } catch (error) {
    console.error('Partner application error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid application data', 
          details: error.errors 
        },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Application submission failed. Please try again.' 
      },
      { status: 500 }
    )
  }
}