import { NextRequest, NextResponse } from 'next/server'

// Mock analytics data for comprehensive dashboard
const analyticsData = {
  overview: {
    totalTemplates: 10,
    totalInstalls: 4847,
    totalRevenue: 2850,
    averageRating: 4.6,
    conversionRate: 12.4, // percentage of views to installs
    premiumConversionRate: 8.7, // percentage of premium template views to purchases
  },

  revenueByMonth: [
    { month: 'Jan', revenue: 450, installs: 850, premiumSales: 18 },
    { month: 'Feb', revenue: 520, installs: 920, premiumSales: 21 },
    { month: 'Mar', revenue: 680, installs: 1150, premiumSales: 27 },
    { month: 'Apr', revenue: 750, installs: 1200, premiumSales: 30 },
    { month: 'May', revenue: 450, installs: 727, premiumSales: 18 }
  ],

  installsByDay: [
    { date: '2025-08-04', installs: 45, views: 320 },
    { date: '2025-08-05', installs: 67, views: 450 },
    { date: '2025-08-06', installs: 89, views: 520 },
    { date: '2025-08-07', installs: 123, views: 680 },
    { date: '2025-08-08', installs: 156, views: 890 },
    { date: '2025-08-09', installs: 134, views: 750 },
    { date: '2025-08-10', installs: 178, views: 920 }
  ],

  topTemplates: [
    {
      id: '1',
      name: 'Email Notification System',
      installs: 1247,
      revenue: 0,
      rating: 4.8,
      conversionRate: 15.2,
      category: 'notifications',
      price: 0,
      views: 8200
    },
    {
      id: '101',
      name: 'Multi-Channel Inventory Sync Pro',
      installs: 89,
      revenue: 2225, // 89 * $25
      rating: 4.9,
      conversionRate: 8.3,
      category: 'E-commerce',
      price: 25,
      views: 1070
    },
    {
      id: '103',
      name: 'Advanced Lead Scoring AI Pro',
      installs: 43,
      revenue: 2150, // 43 * $50
      rating: 4.9,
      conversionRate: 6.8,
      category: 'CRM & Sales',
      price: 50,
      views: 630
    },
    {
      id: '2',
      name: 'HTTP API to Slack',
      installs: 856,
      revenue: 0,
      rating: 4.6,
      conversionRate: 12.1,
      category: 'integrations',
      price: 0,
      views: 7070
    },
    {
      id: '104',
      name: 'Cross-Platform Campaign Manager Pro',
      installs: 78,
      revenue: 2730, // 78 * $35
      rating: 4.7,
      conversionRate: 9.2,
      category: 'Marketing',
      price: 35,
      views: 850
    }
  ],

  categoryPerformance: [
    {
      category: 'E-commerce',
      templates: 2,
      totalInstalls: 156,
      totalRevenue: 3375,
      averageRating: 4.85,
      conversionRate: 7.8
    },
    {
      category: 'CRM & Sales',
      templates: 2,
      totalInstalls: 735,
      totalRevenue: 2150,
      averageRating: 4.7,
      conversionRate: 8.5
    },
    {
      category: 'Marketing',
      templates: 1,
      totalInstalls: 78,
      totalRevenue: 2730,
      averageRating: 4.7,
      conversionRate: 9.2
    },
    {
      category: 'DevOps & IT',
      templates: 1,
      totalInstalls: 34,
      totalRevenue: 1700,
      averageRating: 4.9,
      conversionRate: 5.4
    },
    {
      category: 'notifications',
      templates: 2,
      totalInstalls: 1670,
      totalRevenue: 0,
      averageRating: 4.7,
      conversionRate: 13.8
    },
    {
      category: 'integrations',
      templates: 2,
      totalInstalls: 1174,
      totalRevenue: 0,
      averageRating: 4.55,
      conversionRate: 11.2
    }
  ],

  userEngagement: {
    totalViews: 24580,
    uniqueVisitors: 8940,
    returningVisitors: 3420,
    averageSessionDuration: 4.2, // minutes
    bounceRate: 32.1, // percentage
    reviewsSubmitted: 127,
    helpfulVotes: 892
  },

  conversionFunnel: [
    { stage: 'Template View', count: 24580, percentage: 100 },
    { stage: 'Template Detail', count: 8940, percentage: 36.4 },
    { stage: 'Install Intent', count: 3420, percentage: 13.9 },
    { stage: 'Completed Install', count: 2890, percentage: 11.8 },
    { stage: 'Premium Purchase', count: 187, percentage: 0.76 }
  ],

  ratingDistribution: [
    { rating: 5, count: 89, percentage: 70.1 },
    { rating: 4, count: 24, percentage: 18.9 },
    { rating: 3, count: 9, percentage: 7.1 },
    { rating: 2, count: 3, percentage: 2.4 },
    { rating: 1, count: 2, percentage: 1.6 }
  ]
}

export async function GET(request: NextRequest) {
  try {
    // Check authentication for admin access
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({
        success: false,
        error: 'Admin authentication required'
      }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const metric = searchParams.get('metric')
    const timeRange = searchParams.get('timeRange') || '30d'
    const category = searchParams.get('category')

    let responseData = analyticsData

    // Filter by specific metric if requested
    if (metric) {
      switch (metric) {
        case 'overview':
          responseData = { overview: analyticsData.overview }
          break
        case 'revenue':
          responseData = { 
            revenueByMonth: analyticsData.revenueByMonth,
            overview: { totalRevenue: analyticsData.overview.totalRevenue }
          }
          break
        case 'installs':
          responseData = { 
            installsByDay: analyticsData.installsByDay,
            overview: { totalInstalls: analyticsData.overview.totalInstalls }
          }
          break
        case 'templates':
          responseData = { topTemplates: analyticsData.topTemplates }
          break
        case 'categories':
          responseData = { categoryPerformance: analyticsData.categoryPerformance }
          break
        case 'engagement':
          responseData = { userEngagement: analyticsData.userEngagement }
          break
        case 'conversion':
          responseData = { conversionFunnel: analyticsData.conversionFunnel }
          break
        case 'ratings':
          responseData = { ratingDistribution: analyticsData.ratingDistribution }
          break
        default:
          responseData = analyticsData
      }
    }

    // Filter by category if requested
    if (category && responseData.topTemplates) {
      responseData.topTemplates = responseData.topTemplates.filter(
        template => template.category.toLowerCase() === category.toLowerCase()
      )
    }

    return NextResponse.json({
      success: true,
      data: responseData,
      meta: {
        timeRange,
        generatedAt: new Date().toISOString(),
        dataPoints: Object.keys(responseData).length
      }
    })

  } catch (error) {
    console.error('Template analytics API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch analytics data'
    }, { status: 500 })
  }
}