'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip
} from 'recharts'
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Download,
  Star,
  Users,
  Package,
  BarChart3,
  ArrowRight,
  Activity,
  Clock,
  AlertCircle,
  CheckCircle
} from 'lucide-react'
import { useAuth } from '@/lib/hooks/useAuth'

interface DashboardStats {
  revenue: { current: number; change: number; trend: 'up' | 'down' }
  installs: { current: number; change: number; trend: 'up' | 'down' }
  users: { current: number; change: number; trend: 'up' | 'down' }
  rating: { current: number; change: number; trend: 'up' | 'down' }
}

const mockStats: DashboardStats = {
  revenue: { current: 2850, change: 12.5, trend: 'up' },
  installs: { current: 4847, change: 8.2, trend: 'up' },
  users: { current: 1247, change: 15.8, trend: 'up' },
  rating: { current: 4.6, change: 0.1, trend: 'up' }
}

const recentActivity = [
  {
    id: 1,
    type: 'purchase',
    message: 'New purchase: Advanced Lead Scoring AI Pro',
    amount: 50,
    time: '2 minutes ago',
    user: 'john.doe@company.com'
  },
  {
    id: 2,
    type: 'install',
    message: 'Template installed: Multi-Channel Inventory Sync',
    time: '5 minutes ago',
    user: 'sarah.chen@startup.co'
  },
  {
    id: 3,
    type: 'review',
    message: 'New 5-star review on Email Notification System',
    time: '12 minutes ago',
    user: 'mike.r@agency.com'
  },
  {
    id: 4,
    type: 'purchase',
    message: 'New purchase: Cross-Platform Campaign Manager',
    amount: 35,
    time: '18 minutes ago',
    user: 'lisa.wang@marketing.io'
  }
]

const quickStats = [
  { name: 'Active Templates', value: 10, icon: Package },
  { name: 'Premium Templates', value: 5, icon: Star },
  { name: 'Total Reviews', value: 127, icon: Star },
  { name: 'Avg Rating', value: '4.6', icon: TrendingUp }
]

const trendingTemplates = [
  { name: 'Multi-Channel Inventory Sync Pro', installs: 89, revenue: 2225, trend: 'up' },
  { name: 'Advanced Lead Scoring AI Pro', installs: 43, revenue: 2150, trend: 'up' },
  { name: 'Email Notification System', installs: 1247, revenue: 0, trend: 'stable' }
]

export default function AdminDashboard() {
  const { isAuthenticated } = useAuth()
  const [stats] = useState<DashboardStats>(mockStats)

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num)
  }

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'purchase':
        return <DollarSign className="w-4 h-4 text-green-600" />
      case 'install':
        return <Download className="w-4 h-4 text-blue-600" />
      case 'review':
        return <Star className="w-4 h-4 text-yellow-600" />
      default:
        return <Activity className="w-4 h-4 text-gray-600" />
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-[600px]">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-yellow-500" />
          <h2 className="text-xl font-semibold mb-2">Authentication Required</h2>
          <p className="text-muted-foreground">Please log in to access the admin dashboard</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Dashboard Overview</h1>
        <p className="text-muted-foreground mt-1">
          Welcome back! Here's what's happening with your template marketplace.
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.revenue.current)}</div>
            <div className={`flex items-center text-xs ${stats.revenue.trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
              {stats.revenue.trend === 'up' ? (
                <TrendingUp className="w-3 h-3 mr-1" />
              ) : (
                <TrendingDown className="w-3 h-3 mr-1" />
              )}
              {stats.revenue.change > 0 ? '+' : ''}{stats.revenue.change}% from last month
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Installs</CardTitle>
            <Download className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(stats.installs.current)}</div>
            <div className={`flex items-center text-xs ${stats.installs.trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
              {stats.installs.trend === 'up' ? (
                <TrendingUp className="w-3 h-3 mr-1" />
              ) : (
                <TrendingDown className="w-3 h-3 mr-1" />
              )}
              {stats.installs.change > 0 ? '+' : ''}{stats.installs.change}% from last month
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(stats.users.current)}</div>
            <div className={`flex items-center text-xs ${stats.users.trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
              {stats.users.trend === 'up' ? (
                <TrendingUp className="w-3 h-3 mr-1" />
              ) : (
                <TrendingDown className="w-3 h-3 mr-1" />
              )}
              {stats.users.change > 0 ? '+' : ''}{stats.users.change}% from last month
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Rating</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.rating.current.toFixed(1)}</div>
            <div className={`flex items-center text-xs ${stats.rating.trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
              {stats.rating.trend === 'up' ? (
                <TrendingUp className="w-3 h-3 mr-1" />
              ) : (
                <TrendingDown className="w-3 h-3 mr-1" />
              )}
              {stats.rating.change > 0 ? '+' : ''}{stats.rating.change} from last month
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[
          { name: 'Template Analytics', href: '/admin/templates', color: 'blue' },
          { name: 'Revenue Reports', href: '/admin/revenue', color: 'green' },
          { name: 'User Management', href: '/admin/users', color: 'purple' },
          { name: 'Template Management', href: '/admin/templates/manage', color: 'orange' }
        ].map((action) => (
          <Link key={action.name} href={action.href}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="flex items-center justify-between p-4">
                <span className="font-medium">{action.name}</span>
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Content Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Recent Activity */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest purchases, installs, and reviews</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                  <div className="mt-0.5">{getActivityIcon(activity.type)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{activity.message}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-xs text-muted-foreground">{activity.user}</p>
                      <span className="text-xs text-muted-foreground">•</span>
                      <p className="text-xs text-muted-foreground">{activity.time}</p>
                    </div>
                  </div>
                  {activity.amount && (
                    <div className="text-sm font-semibold text-green-600">
                      +{formatCurrency(activity.amount)}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t">
              <Link href="/admin/activity">
                <Button variant="outline" className="w-full">
                  View All Activity
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Stats</CardTitle>
            <CardDescription>Key marketplace metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {quickStats.map((stat) => (
                <div key={stat.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <stat.icon className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">{stat.name}</span>
                  </div>
                  <span className="font-semibold">{stat.value}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t">
              <Link href="/admin/templates">
                <Button variant="outline" size="sm" className="w-full">
                  <BarChart3 className="w-4 h-4 mr-2" />
                  View Analytics
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Trending Templates */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Trending Templates</CardTitle>
            <CardDescription>Top performing templates this week</CardDescription>
          </div>
          <Link href="/admin/templates">
            <Button variant="outline" size="sm">
              View All
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {trendingTemplates.map((template, index) => (
              <div key={template.name} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-6 h-6 bg-primary/10 rounded-full text-xs font-bold">
                    #{index + 1}
                  </div>
                  <div>
                    <h4 className="font-medium text-sm">{template.name}</h4>
                    <p className="text-xs text-muted-foreground">
                      {formatNumber(template.installs)} installs
                      {template.revenue > 0 && ` • ${formatCurrency(template.revenue)} revenue`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {template.trend === 'up' ? (
                    <Badge variant="secondary" className="bg-green-500/10 text-green-600">
                      <TrendingUp className="w-3 h-3 mr-1" />
                      Up
                    </Badge>
                  ) : (
                    <Badge variant="secondary">
                      Stable
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* System Status */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <CheckCircle className="w-5 h-5 text-green-500" />
            <div>
              <p className="font-medium text-sm">All Systems Operational</p>
              <p className="text-xs text-muted-foreground">Last check: {new Date().toLocaleTimeString()}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Activity className="w-5 h-5 text-blue-500" />
            <div>
              <p className="font-medium text-sm">API Response Time</p>
              <p className="text-xs text-muted-foreground">Avg: 145ms</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Clock className="w-5 h-5 text-purple-500" />
            <div>
              <p className="font-medium text-sm">Uptime</p>
              <p className="text-xs text-muted-foreground">99.9% (30 days)</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}