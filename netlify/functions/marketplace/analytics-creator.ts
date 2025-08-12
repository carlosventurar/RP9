import { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface AnalyticsQuery {
  period: 'day' | 'week' | 'month' | 'quarter' | 'year' | 'custom'
  startDate?: string
  endDate?: string
  templateId?: string
  metrics?: string[] // Métricas específicas a incluir
}

interface CreatorAnalytics {
  overview: {
    totalEarnings: number
    totalSales: number
    totalTemplates: number
    averageRating: number
    totalViews: number
    totalDownloads: number
    conversionRate: number
    topTemplate: {
      id: string
      name: string
      sales: number
      revenue: number
    } | null
  }
  salesTrend: Array<{
    date: string
    sales: number
    revenue: number
    views: number
    conversions: number
  }>
  templatePerformance: Array<{
    id: string
    name: string
    category: string
    sales: number
    revenue: number
    views: number
    downloads: number
    rating: number
    conversionRate: number
    lastSaleDate?: string
  }>
  revenueBreakdown: {
    byCategory: Array<{
      category: string
      revenue: number
      sales: number
      percentage: number
    }>
    byTemplate: Array<{
      templateId: string
      templateName: string
      revenue: number
      sales: number
      percentage: number
    }>
  }
  geographical: Array<{
    country: string
    countryName: string
    sales: number
    revenue: number
    percentage: number
  }>
  payoutHistory: Array<{
    id: string
    periodStart: string
    periodEnd: string
    earnings: number
    status: string
    paidDate?: string
    method: string
  }>
}

const getDateRange = (period: string, startDate?: string, endDate?: string): { start: Date; end: Date } => {
  const now = new Date()
  const end = endDate ? new Date(endDate) : now
  let start: Date

  switch (period) {
    case 'day':
      start = new Date(end)
      start.setHours(0, 0, 0, 0)
      break
    case 'week':
      start = new Date(end)
      start.setDate(end.getDate() - 7)
      break
    case 'month':
      start = new Date(end)
      start.setMonth(end.getMonth() - 1)
      break
    case 'quarter':
      start = new Date(end)
      start.setMonth(end.getMonth() - 3)
      break
    case 'year':
      start = new Date(end)
      start.setFullYear(end.getFullYear() - 1)
      break
    case 'custom':
      if (!startDate) throw new Error('startDate requerido para período personalizado')
      start = new Date(startDate)
      break
    default:
      throw new Error('Período inválido')
  }

  return { start, end }
}

const getOverviewAnalytics = async (creatorId: string, dateRange: { start: Date; end: Date }): Promise<CreatorAnalytics['overview']> => {
  // Obtener métricas generales
  const { data: creatorData } = await supabase
    .from('creator_profiles')
    .select('total_earnings_cents, total_sales')
    .eq('id', creatorId)
    .single()

  // Contar templates del creator
  const { count: templatesCount } = await supabase
    .from('templates')
    .select('*', { count: 'exact', head: true })
    .eq('metadata->>creator_id', creatorId)

  // Obtener ventas del período
  const { data: periodSales } = await supabase
    .from('template_sales')
    .select('price_cents, template_id')
    .eq('creator_id', creatorId)
    .eq('status', 'completed')
    .gte('completed_at', dateRange.start.toISOString())
    .lte('completed_at', dateRange.end.toISOString())

  // Analytics por template
  const { data: templateAnalytics } = await supabase
    .from('template_analytics')
    .select('template_id, views, downloads, average_rating')
    .eq('creator_id', creatorId)
    .gte('date', dateRange.start.toISOString().split('T')[0])
    .lte('date', dateRange.end.toISOString().split('T')[0])

  const totalViews = templateAnalytics?.reduce((sum, ta) => sum + (ta.views || 0), 0) || 0
  const totalDownloads = templateAnalytics?.reduce((sum, ta) => sum + (ta.downloads || 0), 0) || 0
  const avgRating = templateAnalytics?.reduce((sum, ta) => sum + (ta.average_rating || 0), 0) / (templateAnalytics?.length || 1) || 0

  // Template con más ventas
  const templateSalesMap = new Map<string, { sales: number; revenue: number }>()
  periodSales?.forEach(sale => {
    const existing = templateSalesMap.get(sale.template_id) || { sales: 0, revenue: 0 }
    templateSalesMap.set(sale.template_id, {
      sales: existing.sales + 1,
      revenue: existing.revenue + sale.price_cents
    })
  })

  let topTemplate = null
  if (templateSalesMap.size > 0) {
    const [topTemplateId, topStats] = Array.from(templateSalesMap.entries())
      .sort((a, b) => b[1].revenue - a[1].revenue)[0]

    const { data: templateInfo } = await supabase
      .from('templates')
      .select('name')
      .eq('id', topTemplateId)
      .single()

    topTemplate = {
      id: topTemplateId,
      name: templateInfo?.name || 'Template sin nombre',
      sales: topStats.sales,
      revenue: topStats.revenue
    }
  }

  const conversionRate = totalViews > 0 ? ((periodSales?.length || 0) / totalViews) * 100 : 0

  return {
    totalEarnings: creatorData?.total_earnings_cents || 0,
    totalSales: creatorData?.total_sales || 0,
    totalTemplates: templatesCount || 0,
    averageRating: avgRating,
    totalViews,
    totalDownloads,
    conversionRate,
    topTemplate
  }
}

const getSalesTrend = async (creatorId: string, dateRange: { start: Date; end: Date }): Promise<CreatorAnalytics['salesTrend']> => {
  const { data: dailyAnalytics } = await supabase
    .from('template_analytics')
    .select('date, sales, revenue_cents, views')
    .eq('creator_id', creatorId)
    .gte('date', dateRange.start.toISOString().split('T')[0])
    .lte('date', dateRange.end.toISOString().split('T')[0])
    .order('date')

  if (!dailyAnalytics) return []

  // Agrupar por fecha
  const trendMap = new Map<string, { sales: number; revenue: number; views: number }>()

  dailyAnalytics.forEach(analytics => {
    const existing = trendMap.get(analytics.date) || { sales: 0, revenue: 0, views: 0 }
    trendMap.set(analytics.date, {
      sales: existing.sales + (analytics.sales || 0),
      revenue: existing.revenue + (analytics.revenue_cents || 0),
      views: existing.views + (analytics.views || 0)
    })
  })

  return Array.from(trendMap.entries()).map(([date, data]) => ({
    date,
    sales: data.sales,
    revenue: data.revenue,
    views: data.views,
    conversions: data.views > 0 ? (data.sales / data.views) * 100 : 0
  }))
}

const getTemplatePerformance = async (creatorId: string, dateRange: { start: Date; end: Date }): Promise<CreatorAnalytics['templatePerformance']> => {
  // Obtener templates del creator
  const { data: templates } = await supabase
    .from('templates')
    .select('id, name, category')
    .eq('metadata->>creator_id', creatorId)

  if (!templates) return []

  const templateIds = templates.map(t => t.id)

  // Analytics por template
  const { data: analytics } = await supabase
    .from('template_analytics')
    .select('template_id, sales, revenue_cents, views, downloads, average_rating')
    .eq('creator_id', creatorId)
    .in('template_id', templateIds)
    .gte('date', dateRange.start.toISOString().split('T')[0])
    .lte('date', dateRange.end.toISOString().split('T')[0])

  // Última fecha de venta por template
  const { data: lastSales } = await supabase
    .from('template_sales')
    .select('template_id, completed_at')
    .eq('creator_id', creatorId)
    .in('template_id', templateIds)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })

  // Agrupar analytics por template
  const performanceMap = new Map()

  templates.forEach(template => {
    performanceMap.set(template.id, {
      id: template.id,
      name: template.name,
      category: template.category,
      sales: 0,
      revenue: 0,
      views: 0,
      downloads: 0,
      rating: 0,
      conversionRate: 0,
      lastSaleDate: undefined
    })
  })

  analytics?.forEach(analytic => {
    const existing = performanceMap.get(analytic.template_id)
    if (existing) {
      existing.sales += analytic.sales || 0
      existing.revenue += analytic.revenue_cents || 0
      existing.views += analytic.views || 0
      existing.downloads += analytic.downloads || 0
      existing.rating = Math.max(existing.rating, analytic.average_rating || 0)
    }
  })

  lastSales?.forEach(sale => {
    const existing = performanceMap.get(sale.template_id)
    if (existing && !existing.lastSaleDate) {
      existing.lastSaleDate = sale.completed_at
    }
  })

  // Calcular conversion rates
  performanceMap.forEach((template, id) => {
    template.conversionRate = template.views > 0 ? (template.sales / template.views) * 100 : 0
  })

  return Array.from(performanceMap.values())
    .sort((a, b) => b.revenue - a.revenue)
}

const getPayoutHistory = async (creatorId: string): Promise<CreatorAnalytics['payoutHistory']> => {
  const { data: payouts } = await supabase
    .from('creator_payouts')
    .select('id, period_start, period_end, net_payout_cents, status, paid_at, creator_profiles!inner(payout_method)')
    .eq('creator_id', creatorId)
    .order('period_start', { ascending: false })
    .limit(12) // Últimos 12 pagos

  if (!payouts) return []

  return payouts.map(payout => ({
    id: payout.id,
    periodStart: payout.period_start,
    periodEnd: payout.period_end,
    earnings: payout.net_payout_cents,
    status: payout.status,
    paidDate: payout.paid_at,
    method: (payout.creator_profiles as any).payout_method
  }))
}

export const handler: Handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  }

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers }
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Método no permitido' })
    }
  }

  try {
    // Validar autenticación
    const authHeader = event.headers.authorization
    if (!authHeader) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Token de autorización requerido' })
      }
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Token inválido' })
      }
    }

    // Verificar que el usuario es un creator
    const { data: creator, error: creatorError } = await supabase
      .from('creator_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (creatorError || !creator) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Creator no encontrado' })
      }
    }

    // Parsear parámetros de query
    const params = event.queryStringParameters || {}
    const query: AnalyticsQuery = {
      period: (params.period as any) || 'month',
      startDate: params.startDate,
      endDate: params.endDate,
      templateId: params.templateId,
      metrics: params.metrics ? params.metrics.split(',') : undefined
    }

    const dateRange = getDateRange(query.period, query.startDate, query.endDate)

    // Generar analytics
    const analytics: CreatorAnalytics = {
      overview: await getOverviewAnalytics(creator.id, dateRange),
      salesTrend: await getSalesTrend(creator.id, dateRange),
      templatePerformance: await getTemplatePerformance(creator.id, dateRange),
      revenueBreakdown: {
        byCategory: [], // Implementar si se necesita
        byTemplate: [] // Implementar si se necesita
      },
      geographical: [], // Implementar si se necesita
      payoutHistory: await getPayoutHistory(creator.id)
    }

    // Filtrar métricas específicas si se especificaron
    if (query.metrics && query.metrics.length > 0) {
      const filteredAnalytics: Partial<CreatorAnalytics> = {}
      query.metrics.forEach(metric => {
        if (metric in analytics) {
          (filteredAnalytics as any)[metric] = (analytics as any)[metric]
        }
      })
      
      return {
        statusCode: 200,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(filteredAnalytics)
      }
    }

    return {
      statusCode: 200,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(analytics)
    }

  } catch (error: any) {
    console.error('Creator Analytics Error:', error)
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Error interno del servidor',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined
      })
    }
  }
}