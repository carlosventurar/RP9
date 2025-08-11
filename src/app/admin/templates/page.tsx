'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  FunnelChart,
  Funnel,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Download,
  Star,
  Users,
  Eye,
  ShoppingCart,
  BarChart3,
  Calendar,
  Filter,
  RefreshCw,
  Award,
  Target,
  Loader2
} from 'lucide-react'
import { useAuth } from '@/lib/hooks/useAuth'

interface AnalyticsData {
  overview: {
    totalTemplates: number
    totalInstalls: number
    totalRevenue: number
    averageRating: number
    conversionRate: number
    premiumConversionRate: number
  }
  revenueByMonth: Array<{
    month: string
    revenue: number
    installs: number
    premiumSales: number
  }>
  installsByDay: Array<{
    date: string
    installs: number
    views: number
  }>
  topTemplates: Array<{
    id: string
    name: string
    installs: number
    revenue: number
    rating: number
    conversionRate: number
    category: string
    price: number
    views: number
  }>
  categoryPerformance: Array<{
    category: string
    templates: number
    totalInstalls: number
    totalRevenue: number
    averageRating: number
    conversionRate: number
  }>
  userEngagement: {
    totalViews: number
    uniqueVisitors: number
    returningVisitors: number
    averageSessionDuration: number
    bounceRate: number
    reviewsSubmitted: number
    helpfulVotes: number
  }
  conversionFunnel: Array<{
    stage: string
    count: number
    percentage: number
  }>
  ratingDistribution: Array<{
    rating: number
    count: number
    percentage: number
  }>
}

export default function TemplateAnalyticsPage() {
  const { token, isAuthenticated } = useAuth()
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [timeRange, setTimeRange] = useState('30d')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  const fetchAnalytics = async () => {
    if (!isAuthenticated || !token) {
      setError('Admin authentication required')
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const response = await fetch(`/api/template-analytics?timeRange=${timeRange}${selectedCategory !== 'all' ? `&category=${selectedCategory}` : ''}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      const data = await response.json()

      if (data.success) {
        setAnalytics(data.data)
        setError(null)
      } else {
        throw new Error(data.error || 'Failed to fetch analytics')
      }
    } catch (error) {
      console.error('Analytics fetch error:', error)
      setError(error instanceof Error ? error.message : 'Failed to load analytics')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAnalytics()
  }, [timeRange, selectedCategory, isAuthenticated])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num)
  }

  const chartColors = {
    primary: '#3b82f6',
    secondary: '#8b5cf6',
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
    info: '#06b6d4'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[600px]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading analytics...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[600px]">
        <div className="text-center">
          <div className="text-red-400 mb-4">
            <BarChart3 className="w-12 h-12 mx-auto mb-2" />
            <p>Failed to load analytics</p>
          </div>
          <Button onClick={fetchAnalytics} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
        </div>
      </div>
    )
  }

  if (!analytics) {
    return (
      <div className="flex items-center justify-center min-h-[600px]">
        <p className="text-muted-foreground">No analytics data available</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Template Analytics</h1>
          <p className="text-muted-foreground mt-1">
            Comprehensive insights into template performance and marketplace metrics
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[120px]">
              <Calendar className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="1y">Last year</SelectItem>
            </SelectContent>
          </Select>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-[150px]">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="E-commerce">E-commerce</SelectItem>
              <SelectItem value="CRM & Sales">CRM & Sales</SelectItem>
              <SelectItem value="Marketing">Marketing</SelectItem>
              <SelectItem value="DevOps & IT">DevOps & IT</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={fetchAnalytics} size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(analytics.overview.totalRevenue)}</div>
            <div className="flex items-center text-xs text-green-600">
              <TrendingUp className="w-3 h-3 mr-1" />
              +12.5% from last month
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Installs</CardTitle>
            <Download className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(analytics.overview.totalInstalls)}</div>
            <div className="flex items-center text-xs text-green-600">
              <TrendingUp className="w-3 h-3 mr-1" />
              +8.2% from last month
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Rating</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.overview.averageRating.toFixed(1)}</div>
            <div className="flex items-center text-xs text-green-600">
              <TrendingUp className="w-3 h-3 mr-1" />
              +0.1 from last month
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.overview.conversionRate.toFixed(1)}%</div>
            <div className="flex items-center text-xs text-red-600">
              <TrendingDown className="w-3 h-3 mr-1" />
              -0.3% from last month
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Revenue & Installs Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Revenue Trends</CardTitle>
            <CardDescription>Monthly revenue and premium sales</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={analytics.revenueByMonth}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value, name) => {
                  if (name === 'revenue') return [formatCurrency(value as number), 'Revenue']
                  return [value, name]
                }} />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stackId="1"
                  stroke={chartColors.primary}
                  fill={chartColors.primary}
                  fillOpacity={0.6}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Daily Installs</CardTitle>
            <CardDescription>Template installations over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={analytics.installsByDay}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                />
                <YAxis />
                <Tooltip 
                  labelFormatter={(value) => new Date(value).toLocaleDateString()}
                  formatter={(value, name) => [formatNumber(value as number), name === 'installs' ? 'Installs' : 'Views']}
                />
                <Line 
                  type="monotone" 
                  dataKey="installs" 
                  stroke={chartColors.success}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="views" 
                  stroke={chartColors.info}
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top Templates Table */}
      <Card>
        <CardHeader>
          <CardTitle>Top Performing Templates</CardTitle>
          <CardDescription>Best templates by installs and revenue</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {analytics.topTemplates.map((template, index) => (
              <div key={template.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-4">
                  <div className="flex items-center justify-center w-8 h-8 bg-primary/10 rounded-full">
                    <span className="text-sm font-bold">#{index + 1}</span>
                  </div>
                  <div>
                    <h4 className="font-semibold">{template.name}</h4>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span>{template.category}</span>
                      <span>•</span>
                      <div className="flex items-center gap-1">
                        <Star className="w-3 h-3 text-yellow-400 fill-current" />
                        {template.rating}
                      </div>
                      {template.price > 0 && (
                        <>
                          <span>•</span>
                          <Badge variant="outline">${template.price}</Badge>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-6 text-right">
                  <div>
                    <div className="font-semibold">{formatNumber(template.installs)}</div>
                    <div className="text-xs text-muted-foreground">installs</div>
                  </div>
                  {template.revenue > 0 && (
                    <div>
                      <div className="font-semibold">{formatCurrency(template.revenue)}</div>
                      <div className="text-xs text-muted-foreground">revenue</div>
                    </div>
                  )}
                  <div>
                    <div className="font-semibold">{template.conversionRate.toFixed(1)}%</div>
                    <div className="text-xs text-muted-foreground">conversion</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Category Performance & Conversion Funnel */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Category Performance</CardTitle>
            <CardDescription>Revenue and installs by category</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analytics.categoryPerformance}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="category" 
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis />
                <Tooltip formatter={(value, name) => {
                  if (name === 'totalRevenue') return [formatCurrency(value as number), 'Revenue']
                  return [formatNumber(value as number), name === 'totalInstalls' ? 'Installs' : 'Value']
                }} />
                <Bar dataKey="totalRevenue" fill={chartColors.primary} />
                <Bar dataKey="totalInstalls" fill={chartColors.secondary} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Conversion Funnel</CardTitle>
            <CardDescription>User journey through the marketplace</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {analytics.conversionFunnel.map((stage, index) => (
                <div key={stage.stage} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{stage.stage}</span>
                    <span className="text-sm text-muted-foreground">
                      {formatNumber(stage.count)} ({stage.percentage.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full transition-all duration-500"
                      style={{ width: `${stage.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Engagement Metrics */}
      <Card>
        <CardHeader>
          <CardTitle>User Engagement</CardTitle>
          <CardDescription>Community interaction and activity metrics</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-7">
            <div className="text-center">
              <div className="text-2xl font-bold">{formatNumber(analytics.userEngagement.totalViews)}</div>
              <div className="text-xs text-muted-foreground">Total Views</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{formatNumber(analytics.userEngagement.uniqueVisitors)}</div>
              <div className="text-xs text-muted-foreground">Unique Visitors</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{formatNumber(analytics.userEngagement.returningVisitors)}</div>
              <div className="text-xs text-muted-foreground">Returning</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{analytics.userEngagement.averageSessionDuration.toFixed(1)}m</div>
              <div className="text-xs text-muted-foreground">Avg Session</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{analytics.userEngagement.bounceRate.toFixed(1)}%</div>
              <div className="text-xs text-muted-foreground">Bounce Rate</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{formatNumber(analytics.userEngagement.reviewsSubmitted)}</div>
              <div className="text-xs text-muted-foreground">Reviews</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{formatNumber(analytics.userEngagement.helpfulVotes)}</div>
              <div className="text-xs text-muted-foreground">Helpful Votes</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}