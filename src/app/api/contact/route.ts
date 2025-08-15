import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const contactFormSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email().max(255),
  company: z.string().min(1).max(100),
  phone: z.string().max(20).optional(),
  employees: z.enum(['1-10', '11-50', '51-200', '201+']).optional(),
  subject: z.enum(['demo', 'pricing', 'support', 'partnership', 'other']).optional(),
  message: z.string().min(1).max(2000),
  country: z.string().max(10),
  locale: z.string().max(10),
  timestamp: z.string()
})

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    
    // Parse and validate request body
    const body = await request.json()
    const validatedData = contactFormSchema.parse(body)

    // Log the contact request
    console.log('Contact form submission:', {
      email: validatedData.email,
      company: validatedData.company,
      subject: validatedData.subject,
      timestamp: validatedData.timestamp
    })

    // Store in database (if table exists)
    try {
      const { error: dbError } = await supabase
        .from('contact_submissions')
        .insert({
          name: validatedData.name,
          email: validatedData.email,
          company: validatedData.company,
          phone: validatedData.phone,
          employees: validatedData.employees,
          subject: validatedData.subject,
          message: validatedData.message,
          country: validatedData.country,
          locale: validatedData.locale,
          submitted_at: validatedData.timestamp,
          status: 'new'
        })

      if (dbError) {
        console.warn('Database storage failed (table may not exist):', dbError.message)
        // Continue without database storage - this is non-critical
      }
    } catch (dbError) {
      console.warn('Database operation failed:', dbError)
      // Continue without database storage
    }

    // Send notification email (in production, this would integrate with email service)
    try {
      // For demo purposes, we'll just log the notification
      console.log('📧 New contact form submission:', {
        from: validatedData.email,
        company: validatedData.company,
        subject: `Contact Form: ${validatedData.subject || 'General Inquiry'}`,
        message: validatedData.message.substring(0, 100) + '...'
      })

      // In production, you would integrate with:
      // - SendGrid, Mailgun, AWS SES, etc.
      // - Slack notifications
      // - CRM systems like HubSpot, Salesforce
      
    } catch (emailError) {
      console.error('Email notification failed:', emailError)
      // Don't fail the request if email fails
    }

    // Return success response
    return NextResponse.json({
      success: true,
      message: 'Contact form submitted successfully',
      id: `contact_${Date.now()}` // Simple ID for demo
    })

  } catch (error: any) {
    console.error('Contact Form API Error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Validation error',
          details: error.errors
        },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
      },
      { status: 500 }
    )
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}