// Webinar Registration API
// POST /api/webinars/register - Handles webinar registrations

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getDefaultCRMProvider } from '@/lib/crm/factory'

// Validation schema
const WebinarRegistrationSchema = z.object({
  // Required fields
  email: z.string().email('Invalid email address'),
  webinarId: z.string().min(1, 'Webinar ID is required'),
  webinarTitle: z.string().min(1, 'Webinar title is required'),
  
  // Optional personal info
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  companyName: z.string().optional(),
  jobTitle: z.string().optional(),
  phone: z.string().optional(),
  
  // Webinar details
  webinarDate: z.string().datetime().optional(),
  webinarType: z.enum(['live', 'on-demand', 'office-hours']).default('live'),
  
  // UTM tracking
  utmSource: z.string().optional(),
  utmMedium: z.string().optional(),
  utmCampaign: z.string().optional(),
  
  // Honeypot for bot detection
  website_url: z.string().max(0).optional()
})

// Rate limiting
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const windowMs = 5 * 60 * 1000 // 5 minutes
  const maxRequests = 3 // Max 3 registrations per 5 minutes per IP
  
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

// Check if user is already registered for this webinar
async function checkExistingRegistration(email: string, webinarId: string, supabase: any): Promise<boolean> {
  const { data, error } = await supabase
    .from('webinar_registrations')
    .select('id')
    .eq('email', email)
    .eq('webinar_id', webinarId)
    .eq('status', 'registered')
    .single()
  
  return !!data && !error
}

// Find or create lead
async function findOrCreateLead(registrationData: z.infer<typeof WebinarRegistrationSchema>, supabase: any): Promise<string | null> {
  // Check if lead exists
  const { data: existingLead } = await supabase
    .from('leads')
    .select('*')
    .eq('email', registrationData.email)
    .single()
  
  if (existingLead) {
    // Update existing lead with any new information
    const updates: any = {
      updated_at: new Date().toISOString()
    }
    
    if (registrationData.firstName && !existingLead.first_name) {
      updates.first_name = registrationData.firstName
    }
    if (registrationData.lastName && !existingLead.last_name) {
      updates.last_name = registrationData.lastName
    }
    if (registrationData.companyName && !existingLead.company_name) {
      updates.company_name = registrationData.companyName
    }
    if (registrationData.jobTitle && !existingLead.job_title) {
      updates.job_title = registrationData.jobTitle
    }
    if (registrationData.phone && !existingLead.phone) {
      updates.phone = registrationData.phone
    }
    
    // Update source if it's more valuable
    if (registrationData.utmSource && (!existingLead.utm_source || registrationData.utmSource === 'webinar')) {
      updates.utm_source = registrationData.utmSource
      updates.utm_medium = registrationData.utmMedium
      updates.utm_campaign = registrationData.utmCampaign
      updates.source = 'webinar'
    }
    
    // Increase score for webinar registration
    updates.score = Math.min(100, (existingLead.score || 0) + 15)
    
    if (Object.keys(updates).length > 1) { // More than just updated_at
      await supabase
        .from('leads')
        .update(updates)
        .eq('id', existingLead.id)
    }
    
    return existingLead.id
  } else {
    // Create new lead
    const leadData = {
      email: registrationData.email,
      first_name: registrationData.firstName,
      last_name: registrationData.lastName,
      company_name: registrationData.companyName,
      job_title: registrationData.jobTitle,
      phone: registrationData.phone,
      source: 'webinar',
      utm_source: registrationData.utmSource,
      utm_medium: registrationData.utmMedium,
      utm_campaign: registrationData.utmCampaign,
      score: 25, // Base score for webinar registration
      grade: 'C',
      status: 'new',
      stage: 'mql',
      country: 'MX' // Default, could be improved with IP geolocation
    }
    
    const { data: newLead, error } = await supabase
      .from('leads')
      .insert(leadData)
      .select('*')
      .single()
    
    if (error) {
      console.error('Error creating lead for webinar registration:', error)
      return null
    }
    
    return newLead.id
  }
}

// Sync registration to CRM
async function syncToCRM(registrationData: z.infer<typeof WebinarRegistrationSchema>, leadId: string | null): Promise<void> {
  try {
    const crmProvider = getDefaultCRMProvider()
    
    // Create or update contact in CRM
    const contactId = await crmProvider.upsertContact({
      email: registrationData.email,
      firstName: registrationData.firstName,
      lastName: registrationData.lastName,
      company: registrationData.companyName,
      jobTitle: registrationData.jobTitle,
      phone: registrationData.phone,
      source: 'webinar',
      utmSource: registrationData.utmSource,
      utmMedium: registrationData.utmMedium,
      utmCampaign: registrationData.utmCampaign,
      customProperties: {
        webinar_id: registrationData.webinarId,
        webinar_title: registrationData.webinarTitle,
        webinar_type: registrationData.webinarType,
        registered_at: new Date().toISOString()
      }
    })
    
    console.log('Webinar registration synced to CRM:', contactId)
    
  } catch (error) {
    console.error('Error syncing webinar registration to CRM:', error)
    // Don't fail the registration if CRM sync fails
  }
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { success: false, error: 'Too many registrations. Please try again later.' },
        { status: 429 }
      )
    }
    
    // Parse and validate request body
    const body = await request.json()
    
    // Check honeypot
    if (body.website_url && body.website_url.length > 0) {
      return NextResponse.json(
        { success: true, message: 'Registration successful!' },
        { status: 200 }
      )
    }
    
    const validatedData = WebinarRegistrationSchema.parse(body)
    
    // Initialize Supabase client
    const supabase = createClient()
    
    // Check if already registered
    const alreadyRegistered = await checkExistingRegistration(
      validatedData.email, 
      validatedData.webinarId, 
      supabase
    )
    
    if (alreadyRegistered) {
      return NextResponse.json({
        success: true,
        message: 'You are already registered for this webinar!',
        alreadyRegistered: true
      })
    }
    
    // Find or create lead
    const leadId = await findOrCreateLead(validatedData, supabase)
    
    // Create webinar registration
    const registrationData = {
      lead_id: leadId,
      email: validatedData.email,
      first_name: validatedData.firstName,
      last_name: validatedData.lastName,
      company_name: validatedData.companyName,
      job_title: validatedData.jobTitle,
      phone: validatedData.phone,
      webinar_id: validatedData.webinarId,
      webinar_title: validatedData.webinarTitle,
      webinar_date: validatedData.webinarDate ? new Date(validatedData.webinarDate).toISOString() : null,
      webinar_type: validatedData.webinarType,
      status: 'registered',
      utm_source: validatedData.utmSource,
      utm_medium: validatedData.utmMedium,
      utm_campaign: validatedData.utmCampaign
    }
    
    const { data: registration, error } = await supabase
      .from('webinar_registrations')
      .insert(registrationData)
      .select('*')
      .single()
    
    if (error) {
      console.error('Error creating webinar registration:', error)
      throw error
    }
    
    // Sync to CRM in background
    syncToCRM(validatedData, leadId).catch(console.error)
    
    // Send confirmation email (would be implemented with email service)
    // await sendWebinarConfirmationEmail(validatedData)
    
    // Prepare response based on webinar type
    let responseMessage = 'Registration successful!'
    let nextSteps = []
    
    switch (validatedData.webinarType) {
      case 'live':
        responseMessage = `You're registered for "${validatedData.webinarTitle}"!`
        nextSteps = [
          'Check your email for confirmation and calendar invite',
          'We\'ll send a reminder 1 hour before the webinar',
          'Join link will be included in your confirmation email'
        ]
        break
        
      case 'on-demand':
        responseMessage = 'Access granted! You can watch this content anytime.'
        nextSteps = [
          'Check your email for the viewing link',
          'Content is available 24/7',
          'Download resources from the webinar page'
        ]
        break
        
      case 'office-hours':
        responseMessage = 'You\'re signed up for Office Hours!'
        nextSteps = [
          'Prepare your questions in advance',
          'Join the live session for personalized help',
          'Recording will be available afterward'
        ]
        break
    }
    
    return NextResponse.json({
      success: true,
      registrationId: registration.id,
      message: responseMessage,
      nextSteps,
      webinarDetails: {
        id: validatedData.webinarId,
        title: validatedData.webinarTitle,
        type: validatedData.webinarType,
        date: validatedData.webinarDate
      }
    })
    
  } catch (error) {
    console.error('Webinar registration error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid registration data', 
          details: error.errors 
        },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Registration failed. Please try again.' 
      },
      { status: 500 }
    )
  }
}