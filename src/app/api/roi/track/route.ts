// ROI Calculation Tracking API
// POST /api/roi/track - Tracks ROI calculator usage and conversions

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

// Validation schema
const ROITrackingSchema = z.object({
  // User identification (optional)
  email: z.string().email().optional(),
  sessionId: z.string().optional(),
  
  // Calculation inputs
  teamSize: z.number().int().min(1).max(10000),
  avgHourlyRate: z.number().min(0).max(1000),
  manualTasksPerMonth: z.number().int().min(0).max(10000),
  timePerTask: z.number().min(0).max(100),
  automationPercentage: z.number().int().min(0).max(100),
  currentToolsCost: z.number().min(0).max(100000),
  industry: z.string().optional(),
  
  // Calculation results
  monthlySavings: z.number(),
  annualSavings: z.number(),
  roiPercentage: z.number(),
  paybackMonths: z.number().int(),
  hoursFreed: z.number().int(),
  
  // UTM tracking
  utmSource: z.string().optional(),
  utmMedium: z.string().optional(),
  utmCampaign: z.string().optional(),
  
  // CTA tracking
  ctaClicked: z.boolean().default(false),
  ctaType: z.enum(['demo-request', 'pilot-request', 'contact-sales', 'get-started']).optional()
})

// Get client IP address
function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const realIP = request.headers.get('x-real-ip')
  const clientIP = request.ip
  
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  
  return realIP || clientIP || 'unknown'
}

// Simple rate limiting
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()

function checkRateLimit(identifier: string): boolean {
  const now = Date.now()
  const windowMs = 60 * 1000 // 1 minute
  const maxRequests = 10
  
  const record = rateLimitMap.get(identifier)
  
  if (!record || now > record.resetTime) {
    rateLimitMap.set(identifier, { count: 1, resetTime: now + windowMs })
    return true
  }
  
  if (record.count >= maxRequests) {
    return false
  }
  
  record.count++
  return true
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const clientIP = getClientIP(request)
    if (!checkRateLimit(clientIP)) {
      return NextResponse.json(
        { success: false, error: 'Rate limit exceeded' },
        { status: 429 }
      )
    }
    
    // Parse and validate request body
    const body = await request.json()
    const validatedData = ROITrackingSchema.parse(body)
    
    // Initialize Supabase client
    const supabase = createClient()
    
    // Check if this is a potential lead
    let leadId: string | undefined
    
    if (validatedData.email) {
      const { data: existingLead } = await supabase
        .from('leads')
        .select('id')
        .eq('email', validatedData.email)
        .single()
      
      leadId = existingLead?.id
    }
    
    // Create ROI event record
    const roiEventData = {
      lead_id: leadId,
      email: validatedData.email,
      ip_address: clientIP,
      user_agent: request.headers.get('user-agent'),
      team_size: validatedData.teamSize,
      avg_hourly_rate: validatedData.avgHourlyRate,
      manual_tasks_per_month: validatedData.manualTasksPerMonth,
      time_per_task: validatedData.timePerTask,
      automation_percentage: validatedData.automationPercentage,
      current_tools_cost: validatedData.currentToolsCost,
      industry: validatedData.industry,
      monthly_savings: validatedData.monthlySavings,
      annual_savings: validatedData.annualSavings,
      roi_percentage: validatedData.roiPercentage,
      payback_months: validatedData.paybackMonths,
      hours_freed: validatedData.hoursFreed,
      session_id: validatedData.sessionId,
      utm_source: validatedData.utmSource,
      utm_medium: validatedData.utmMedium,
      utm_campaign: validatedData.utmCampaign,
      cta_clicked: validatedData.ctaClicked,
      cta_type: validatedData.ctaType,
      lead_generated: false // Will be updated when lead is actually created
    }
    
    const { data: roiEvent, error } = await supabase
      .from('roi_events')
      .insert(roiEventData)
      .select('*')
      .single()
    
    if (error) {
      console.error('Error creating ROI event:', error)
      throw error
    }
    
    // Update lead with ROI calculation if lead exists
    if (leadId) {
      await supabase
        .from('leads')
        .update({
          roi_calculation: {
            teamSize: validatedData.teamSize,
            avgHourlyRate: validatedData.avgHourlyRate,
            manualTasksPerMonth: validatedData.manualTasksPerMonth,
            timePerTask: validatedData.timePerTask,
            automationPercentage: validatedData.automationPercentage,
            currentToolsCost: validatedData.currentToolsCost,
            industry: validatedData.industry,
            monthlySavings: validatedData.monthlySavings,
            annualSavings: validatedData.annualSavings,
            roiPercentage: validatedData.roiPercentage,
            paybackMonths: validatedData.paybackMonths,
            hoursFreed: validatedData.hoursFreed,
            calculatedAt: new Date().toISOString()
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', leadId)
    }
    
    // Generate insights and recommendations
    const insights = generateROIInsights(validatedData)
    
    return NextResponse.json({
      success: true,
      eventId: roiEvent.id,
      insights,
      recommendations: generateRecommendations(validatedData)
    })
    
  } catch (error) {
    console.error('ROI tracking error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid data', 
          details: error.errors 
        },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Generate insights based on ROI calculation
function generateROIInsights(data: z.infer<typeof ROITrackingSchema>) {
  const insights = []
  
  // ROI insights
  if (data.roiPercentage > 500) {
    insights.push({
      type: 'high-roi',
      message: 'Exceptional ROI potential! Your automation could pay for itself in just a few months.',
      priority: 'high'
    })
  } else if (data.roiPercentage > 200) {
    insights.push({
      type: 'good-roi',
      message: 'Strong ROI potential. Automation will significantly reduce your operational costs.',
      priority: 'medium'
    })
  }
  
  // Time savings insights
  if (data.hoursFreed > 1000) {
    insights.push({
      type: 'time-savings',
      message: `You could free up ${data.hoursFreed} hours per month - that's like adding ${Math.round(data.hoursFreed / 160)} full-time employees!`,
      priority: 'high'
    })
  }
  
  // Cost efficiency insights
  if (data.monthlySavings > 10000) {
    insights.push({
      type: 'cost-efficiency',
      message: `With ${data.monthlySavings.toLocaleString()} in monthly savings, you could reinvest in growth initiatives.`,
      priority: 'high'
    })
  }
  
  // Industry-specific insights
  if (data.industry) {
    const industryInsights = getIndustrySpecificInsights(data.industry, data)
    insights.push(...industryInsights)
  }
  
  return insights
}

// Generate recommendations based on ROI calculation
function generateRecommendations(data: z.infer<typeof ROITrackingSchema>) {
  const recommendations = []
  
  // Based on team size
  if (data.teamSize <= 10) {
    recommendations.push({
      category: 'getting-started',
      title: 'Start with Core Workflows',
      description: 'Focus on automating your most repetitive daily tasks first.',
      priority: 1
    })
  } else if (data.teamSize <= 50) {
    recommendations.push({
      category: 'scaling',
      title: 'Department-Level Automation',
      description: 'Consider automating workflows that span multiple team members.',
      priority: 1
    })
  } else {
    recommendations.push({
      category: 'enterprise',
      title: 'Enterprise Integration',
      description: 'Focus on cross-departmental workflows and system integrations.',
      priority: 1
    })
  }
  
  // Based on automation percentage
  if (data.automationPercentage > 70) {
    recommendations.push({
      category: 'optimization',
      title: 'Advanced Automation',
      description: 'You\'re ready for AI-powered workflows and complex integrations.',
      priority: 2
    })
  } else if (data.automationPercentage > 40) {
    recommendations.push({
      category: 'expansion',
      title: 'Expand Automation',
      description: 'Identify additional processes that could benefit from automation.',
      priority: 2
    })
  }
  
  // Based on ROI
  if (data.roiPercentage > 300) {
    recommendations.push({
      category: 'urgency',
      title: 'Start Immediately',
      description: 'With this ROI, every day without automation is money left on the table.',
      priority: 1
    })
  }
  
  return recommendations.sort((a, b) => a.priority - b.priority)
}

// Industry-specific insights
function getIndustrySpecificInsights(industry: string, data: z.infer<typeof ROITrackingSchema>) {
  const industryMap: Record<string, any[]> = {
    'ecommerce': [
      {
        type: 'industry-specific',
        message: 'E-commerce businesses typically see 40% faster order processing with automation.',
        priority: 'medium'
      }
    ],
    'finance': [
      {
        type: 'industry-specific',
        message: 'Financial services can reduce compliance reporting time by up to 70% with automation.',
        priority: 'high'
      }
    ],
    'healthcare': [
      {
        type: 'industry-specific',
        message: 'Healthcare automation can improve patient satisfaction while reducing administrative burden.',
        priority: 'medium'
      }
    ],
    'manufacturing': [
      {
        type: 'industry-specific',
        message: 'Manufacturing workflows often benefit from real-time monitoring and quality control automation.',
        priority: 'medium'
      }
    ]
  }
  
  return industryMap[industry] || []
}