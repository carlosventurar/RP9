// GTM Analytics API  
// GET /api/gtm/analytics - Returns comprehensive GTM KPIs and metrics

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

// Query parameters schema
const AnalyticsQuerySchema = z.object({
  period: z.enum(['7d', '30d', '90d', '1y']).default('30d'),
  metrics: z.string().optional(), // comma-separated list of specific metrics
  breakdown: z.enum(['day', 'week', 'month']).optional(),
  country: z.string().length(2).optional(),
  source: z.string().optional()
})

// Helper function to get date range
function getDateRange(period: string): { startDate: Date; endDate: Date } {
  const endDate = new Date()
  const startDate = new Date()
  
  switch (period) {
    case '7d':
      startDate.setDate(endDate.getDate() - 7)
      break
    case '30d':
      startDate.setDate(endDate.getDate() - 30)
      break
    case '90d':
      startDate.setDate(endDate.getDate() - 90)
      break
    case '1y':
      startDate.setFullYear(endDate.getFullYear() - 1)
      break
    default:
      startDate.setDate(endDate.getDate() - 30)
  }
  
  return { startDate, endDate }
}

// Lead analytics
async function getLeadAnalytics(supabase: any, startDate: Date, endDate: Date, filters: any) {
  const { data: leads } = await supabase
    .from('leads')
    .select('*')
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString())
    .then((result: any) => {
      if (filters.country) {
        return supabase
          .from('leads')
          .select('*')
          .gte('created_at', startDate.toISOString())
          .lte('created_at', endDate.toISOString())
          .eq('country', filters.country)
      }
      if (filters.source) {
        return supabase
          .from('leads')
          .select('*')
          .gte('created_at', startDate.toISOString())
          .lte('created_at', endDate.toISOString())
          .eq('source', filters.source)
      }
      return result
    })

  const total = leads?.length || 0
  const new_leads = leads?.filter((l: any) => l.status === 'new').length || 0
  const qualified = leads?.filter((l: any) => ['qualified', 'demo', 'pilot'].includes(l.status)).length || 0
  const converted = leads?.filter((l: any) => l.status === 'customer').length || 0
  const conversionRate = total > 0 ? (converted / total) * 100 : 0

  // Lead sources breakdown
  const sourceBreakdown = leads?.reduce((acc: any, lead: any) => {
    const source = lead.source || 'unknown'
    acc[source] = (acc[source] || 0) + 1
    return acc
  }, {}) || {}

  const sources = Object.entries(sourceBreakdown).map(([source, count]) => ({
    source,
    count: count as number,
    percentage: total > 0 ? ((count as number / total) * 100).toFixed(1) : '0'
  })).sort((a, b) => b.count - a.count)

  return {
    total,
    new: new_leads,
    qualified,
    converted,
    conversionRate: parseFloat(conversionRate.toFixed(2)),
    sources
  }
}

// Pipeline analytics  
async function getPipelineAnalytics(supabase: any, startDate: Date, endDate: Date) {
  // Note: This would need to be enhanced based on actual CRM integration
  // For now, using lead data as proxy
  const { data: leads } = await supabase
    .from('leads')
    .select('*')
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString())

  // Mock pipeline data - in real implementation, this would come from CRM
  const mockPipelineData = {
    totalDeals: leads?.filter((l: any) => ['demo', 'pilot', 'customer'].includes(l.status)).length || 0,
    totalValue: 0, // Would be calculated from actual deal amounts
    averageDealSize: 0,
    winRate: 0
  }

  // Calculate based on company size and lead score
  const qualifiedLeads = leads?.filter((l: any) => l.score >= 40) || []
  
  const estimatedValue = qualifiedLeads.reduce((sum: number, lead: any) => {
    let dealSize = 3000 // Base deal size
    
    if (lead.company_size === '1000+') dealSize = 25000
    else if (lead.company_size === '201-1000') dealSize = 15000
    else if (lead.company_size === '51-200') dealSize = 8000
    else if (lead.company_size === '11-50') dealSize = 3000
    
    // High-intent sources get premium pricing
    if (['roi-calculator', 'demo-request', 'pilot-request'].includes(lead.source)) {
      dealSize *= 1.2
    }
    
    return sum + dealSize
  }, 0)

  return {
    totalDeals: qualifiedLeads.length,
    totalValue: Math.round(estimatedValue),
    averageDealSize: qualifiedLeads.length > 0 ? Math.round(estimatedValue / qualifiedLeads.length) : 0,
    winRate: qualifiedLeads.length > 0 ? 
      ((leads?.filter((l: any) => l.status === 'customer').length || 0) / qualifiedLeads.length * 100).toFixed(1) : 
      '0.0'
  }
}

// ROI calculator analytics
async function getROIAnalytics(supabase: any, startDate: Date, endDate: Date) {
  const { data: roiEvents } = await supabase
    .from('roi_events')
    .select('*')
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString())

  const total = roiEvents?.length || 0
  const withCTA = roiEvents?.filter((e: any) => e.cta_clicked).length || 0
  const leadGenerated = roiEvents?.filter((e: any) => e.lead_generated).length || 0

  const avgSavings = roiEvents && roiEvents.length > 0 ? 
    roiEvents.reduce((sum: number, e: any) => sum + (e.annual_savings || 0), 0) / roiEvents.length : 
    0

  return {
    calculationsTotal: total,
    averageSavings: Math.round(avgSavings),
    ctaClickRate: total > 0 ? ((withCTA / total) * 100).toFixed(1) : '0.0',
    leadConversionRate: total > 0 ? ((leadGenerated / total) * 100).toFixed(1) : '0.0'
  }
}

// Webinar analytics
async function getWebinarAnalytics(supabase: any, startDate: Date, endDate: Date) {
  const { data: registrations } = await supabase
    .from('webinar_registrations')
    .select('*')
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString())

  const total = registrations?.length || 0
  const attended = registrations?.filter((r: any) => r.attended).length || 0
  const converted = registrations?.filter((r: any) => r.lead_id).length || 0

  return {
    registrations: total,
    attendance: attended,
    attendanceRate: total > 0 ? ((attended / total) * 100).toFixed(1) : '0.0',
    leadConversionRate: total > 0 ? ((converted / total) * 100).toFixed(1) : '0.0'
  }
}

// Partner analytics
async function getPartnerAnalytics(supabase: any, startDate: Date, endDate: Date) {
  const { data: applications } = await supabase
    .from('partner_applications')
    .select('*')
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString())

  const total = applications?.length || 0
  const approved = applications?.filter((a: any) => a.status === 'approved').length || 0

  // Note: referrals would need to be tracked separately
  const referrals = 0 // Placeholder

  return {
    applications: total,
    approved: approved,
    approvalRate: total > 0 ? ((approved / total) * 100).toFixed(1) : '0.0',
    referrals: referrals
  }
}

// Time series data for charts
async function getTimeSeriesData(supabase: any, startDate: Date, endDate: Date, breakdown: string = 'day') {
  const { data: leads } = await supabase
    .from('leads')
    .select('created_at')
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString())
    .order('created_at')

  // Group by time period
  const timeGroups: { [key: string]: number } = {}
  
  leads?.forEach((lead: any) => {
    const date = new Date(lead.created_at)
    let key: string
    
    switch (breakdown) {
      case 'week':
        const weekStart = new Date(date)
        weekStart.setDate(date.getDate() - date.getDay())
        key = weekStart.toISOString().split('T')[0]
        break
      case 'month':
        key = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`
        break
      default: // day
        key = date.toISOString().split('T')[0]
    }
    
    timeGroups[key] = (timeGroups[key] || 0) + 1
  })

  return Object.entries(timeGroups).map(([date, count]) => ({
    date,
    leads: count,
    // Add other metrics as needed
  })).sort((a, b) => a.date.localeCompare(b.date))
}

export async function GET(request: NextRequest) {
  try {
    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const queryParams = Object.fromEntries(searchParams.entries())
    const validatedParams = AnalyticsQuerySchema.parse(queryParams)
    
    // Initialize Supabase client
    const supabase = createClient()
    
    // Get date range
    const { startDate, endDate } = getDateRange(validatedParams.period)
    
    // Prepare filters
    const filters = {
      country: validatedParams.country,
      source: validatedParams.source
    }
    
    // Get all analytics data
    const [
      leadAnalytics,
      pipelineAnalytics,
      roiAnalytics,
      webinarAnalytics,
      partnerAnalytics,
      timeSeriesData
    ] = await Promise.all([
      getLeadAnalytics(supabase, startDate, endDate, filters),
      getPipelineAnalytics(supabase, startDate, endDate),
      getROIAnalytics(supabase, startDate, endDate),
      getWebinarAnalytics(supabase, startDate, endDate),
      getPartnerAnalytics(supabase, startDate, endDate),
      validatedParams.breakdown ? getTimeSeriesData(supabase, startDate, endDate, validatedParams.breakdown) : null
    ])
    
    // Calculate additional metrics
    const totalTouchpoints = leadAnalytics.total + roiAnalytics.calculationsTotal + webinarAnalytics.registrations
    const qualifiedLeadRate = leadAnalytics.total > 0 ? 
      ((leadAnalytics.qualified / leadAnalytics.total) * 100).toFixed(1) : '0.0'
    
    // Prepare response
    const analytics = {
      period: validatedParams.period,
      dateRange: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      },
      leads: leadAnalytics,
      pipeline: pipelineAnalytics,
      roi: roiAnalytics,
      webinars: webinarAnalytics,
      partners: partnerAnalytics,
      summary: {
        totalTouchpoints,
        qualifiedLeadRate: parseFloat(qualifiedLeadRate),
        avgDealSize: pipelineAnalytics.averageDealSize,
        totalPipelineValue: pipelineAnalytics.totalValue
      },
      timeSeries: timeSeriesData,
      filters: filters,
      generatedAt: new Date().toISOString()
    }
    
    // Filter specific metrics if requested
    if (validatedParams.metrics) {
      const requestedMetrics = validatedParams.metrics.split(',')
      const filteredAnalytics: any = {
        period: analytics.period,
        dateRange: analytics.dateRange,
        generatedAt: analytics.generatedAt
      }
      
      requestedMetrics.forEach(metric => {
        if (analytics[metric as keyof typeof analytics]) {
          filteredAnalytics[metric] = analytics[metric as keyof typeof analytics]
        }
      })
      
      return NextResponse.json({
        success: true,
        data: filteredAnalytics
      })
    }
    
    return NextResponse.json({
      success: true,
      data: analytics
    })
    
  } catch (error) {
    console.error('GTM Analytics error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid query parameters', 
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