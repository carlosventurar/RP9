'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  DollarSign,
  TrendingUp,
  Package,
  Users,
  Eye,
  Download,
  Star,
  AlertCircle,
  CheckCircle,
  Clock,
  ExternalLink,
  Plus,
  BarChart3,
  Calendar,
  CreditCard,
  Loader2
} from 'lucide-react'

interface CreatorStats {
  total_earnings_cents: number
  pending_payout_cents: number
  paid_out_cents: number
  total_items: number
  approved_items: number
  pending_items: number
  total_installs: number
  total_views: number
  average_rating: number
  this_month_earnings_cents: number
  last_payout_date: string | null
  next_payout_date: string
}

interface CreatorItem {
  id: string
  slug: string
  title: string
  status: string
  tier: string
  one_off_price_cents: number | null
  subscription_price_cents: number | null
  install_count: number
  view_count: number
  rating_avg: number
  rating_count: number
  earnings_30d_cents: number
  created_at: string
}

interface ConnectStatus {
  status: string
  charges_enabled: boolean
  payouts_enabled: boolean
  requirements: {
    currently_due: string[]
    eventually_due: string[]
  }
}

export default function CreatorDashboard() {
  const { user, token, isAuthenticated } = useAuth()
  const [connectStatus, setConnectStatus] = useState<ConnectStatus | null>(null)
  const [stats, setStats] = useState<CreatorStats | null>(null)
  const [items, setItems] = useState<CreatorItem[]>([])
  const [loading, setLoading] = useState(true)
  const [onboardingUrl, setOnboardingUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!isAuthenticated || !user) return

    const fetchCreatorData = async () => {
      setLoading(true)
      try {
        // Get Stripe Connect status
        const connectResponse = await fetch('/.netlify/functions/creators-onboard', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: user.id,
            action: 'get_account_status'
          })
        })
        const connectData = await connectResponse.json()
        
        if (connectData.success) {
          setConnectStatus(connectData.data)
          
          // Mock stats data (in production, fetch from API)
          setStats({
            total_earnings_cents: 12580,
            pending_payout_cents: 3240,
            paid_out_cents: 9340,
            total_items: 4,
            approved_items: 3,
            pending_items: 1,
            total_installs: 156,
            total_views: 1240,
            average_rating: 4.7,
            this_month_earnings_cents: 3240,
            last_payout_date: '2024-07-15',
            next_payout_date: '2024-08-15'
          })

          // Mock items data (in production, fetch from marketplace API)
          setItems([
            {
              id: '1',
              slug: 'advanced-crm-sync',
              title: 'Advanced CRM Sync Pro',
              status: 'approved',
              tier: 'pro',
              one_off_price_cents: 4999,
              subscription_price_cents: null,
              install_count: 89,
              view_count: 567,
              rating_avg: 4.8,
              rating_count: 23,
              earnings_30d_cents: 2450,
              created_at: '2024-06-15T10:00:00Z'
            },
            {
              id: '2', 
              slug: 'whatsapp-automation-suite',
              title: 'WhatsApp Automation Suite',
              status: 'approved',
              tier: 'mid',
              one_off_price_cents: 2999,
              subscription_price_cents: 999,
              install_count: 45,
              view_count: 234,
              rating_avg: 4.6,
              rating_count: 12,
              earnings_30d_cents: 1890,
              created_at: '2024-07-01T14:00:00Z'
            },
            {
              id: '3',
              slug: 'email-marketing-flows',
              title: 'Email Marketing Flows Basic',
              status: 'pending',
              tier: 'low',
              one_off_price_cents: 1999,
              subscription_price_cents: null,
              install_count: 0,
              view_count: 89,
              rating_avg: 0,
              rating_count: 0,
              earnings_30d_cents: 0,
              created_at: '2024-08-10T09:00:00Z'
            }
          ])
        } else if (connectData.error && connectData.error.includes('not_created')) {
          // Need to create Stripe Connect account
          setConnectStatus({ status: 'not_created', charges_enabled: false, payouts_enabled: false, requirements: { currently_due: [], eventually_due: [] } })
        }
      } catch (error) {
        console.error('Failed to fetch creator data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchCreatorData()
  }, [user, isAuthenticated])

  const handleStripeOnboard = async () => {
    try {
      const response = await fetch('/.netlify/functions/creators-onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user!.id,
          action: 'create_account_link',
          return_url: `${window.location.origin}/creator/dashboard?onboard=complete`,
          refresh_url: `${window.location.origin}/creator/dashboard?onboard=refresh`
        })
      })
      
      const data = await response.json()
      
      if (data.success) {
        window.location.href = data.data.onboarding_url
      } else {
        alert('Failed to start onboarding: ' + data.error)
      }
    } catch (error) {
      console.error('Onboarding error:', error)
      alert('Failed to start onboarding. Please try again.')
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
        <p className="text-muted-foreground">Please log in to access the creator dashboard.</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  // Show onboarding if not set up
  if (!connectStatus || connectStatus.status === 'not_created') {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center space-y-4">
          <h1 className="text-3xl font-bold">Welcome to RP9 Creators</h1>
          <p className="text-muted-foreground text-lg">
            Start earning by sharing your automation expertise with the community
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Complete Your Creator Profile</CardTitle>
            <CardDescription>
              Set up payments and start publishing templates to earn revenue
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
              <div className="space-y-2">
                <CheckCircle className="h-8 w-8 text-green-500 mx-auto" />
                <h3 className="font-medium">Create Account</h3>
                <p className="text-sm text-muted-foreground">Account created ✓</p>
              </div>
              <div className="space-y-2">
                <Clock className="h-8 w-8 text-yellow-500 mx-auto" />
                <h3 className="font-medium">Setup Payments</h3>
                <p className="text-sm text-muted-foreground">Complete Stripe Connect</p>
              </div>
              <div className="space-y-2">
                <Package className="h-8 w-8 text-gray-400 mx-auto" />
                <h3 className="font-medium">Publish Templates</h3>
                <p className="text-sm text-muted-foreground">Upload your first template</p>
              </div>
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                You'll need to complete Stripe Connect verification to receive payments. 
                This includes providing tax information and bank details.
              </AlertDescription>
            </Alert>

            <Button 
              className="w-full" 
              onClick={handleStripeOnboard}
            >
              <CreditCard className="h-4 w-4 mr-2" />
              Complete Payment Setup
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Show verification in progress
  if (connectStatus.status === 'incomplete' || connectStatus.status === 'under_review') {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center space-y-4">
          <h1 className="text-3xl font-bold">Account Verification In Progress</h1>
          <p className="text-muted-foreground">
            {connectStatus.status === 'incomplete' 
              ? 'Please complete your Stripe Connect setup'
              : 'Your account is under review by Stripe'
            }
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Verification Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                {connectStatus.charges_enabled ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <Clock className="h-5 w-5 text-yellow-500" />
                )}
                <span>Charges {connectStatus.charges_enabled ? 'Enabled' : 'Pending'}</span>
              </div>
              <div className="flex items-center gap-2">
                {connectStatus.payouts_enabled ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <Clock className="h-5 w-5 text-yellow-500" />
                )}
                <span>Payouts {connectStatus.payouts_enabled ? 'Enabled' : 'Pending'}</span>
              </div>
            </div>

            {connectStatus.requirements.currently_due.length > 0 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Action Required:</strong> Complete these requirements:
                  <ul className="list-disc list-inside mt-2">
                    {connectStatus.requirements.currently_due.map((req, index) => (
                      <li key={index} className="text-sm">{req}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            <Button 
              onClick={handleStripeOnboard}
              variant={connectStatus.status === 'incomplete' ? 'default' : 'outline'}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              {connectStatus.status === 'incomplete' ? 'Complete Setup' : 'Update Information'}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Main dashboard for active creators
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Creator Dashboard</h1>
          <p className="text-muted-foreground">
            Manage your templates and track your earnings
          </p>
        </div>
        <Button asChild>
          <a href="/creator/upload">
            <Plus className="h-4 w-4 mr-2" />
            Upload Template
          </a>
        </Button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Earnings</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${(stats.total_earnings_cents / 100).toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground">
                +${(stats.this_month_earnings_cents / 100).toFixed(2)} this month
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Templates</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.approved_items}</div>
              <p className="text-xs text-muted-foreground">
                {stats.pending_items} pending approval
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Installs</CardTitle>
              <Download className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_installs}</div>
              <p className="text-xs text-muted-foreground">
                Across all templates
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Rating</CardTitle>
              <Star className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.average_rating.toFixed(1)}</div>
              <p className="text-xs text-muted-foreground">
                {stats.total_views} total views
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Payout Info */}
      {stats && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Payout Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Pending Payout</p>
                <p className="text-2xl font-bold text-green-600">
                  ${(stats.pending_payout_cents / 100).toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Last Payout</p>
                <p className="text-lg">
                  {stats.last_payout_date 
                    ? new Date(stats.last_payout_date).toLocaleDateString()
                    : 'No payouts yet'
                  }
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Next Payout</p>
                <p className="text-lg">{new Date(stats.next_payout_date).toLocaleDateString()}</p>
                <p className="text-xs text-muted-foreground">Monthly on 15th</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Templates Table */}
      <Card>
        <CardHeader>
          <CardTitle>Your Templates</CardTitle>
          <CardDescription>
            Manage and track the performance of your published templates
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {items.map((item) => (
              <div key={item.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-medium">{item.title}</h3>
                    <Badge variant={
                      item.status === 'approved' ? 'default' : 
                      item.status === 'pending' ? 'secondary' : 'destructive'
                    }>
                      {item.status}
                    </Badge>
                    <Badge variant="outline">{item.tier}</Badge>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Price</p>
                      <p className="font-medium">
                        {item.one_off_price_cents 
                          ? `$${(item.one_off_price_cents / 100).toFixed(2)}`
                          : 'Free'
                        }
                        {item.subscription_price_cents && 
                          ` / $${(item.subscription_price_cents / 100).toFixed(2)}/mo`
                        }
                      </p>
                    </div>
                    
                    <div>
                      <p className="text-muted-foreground">Installs</p>
                      <p className="font-medium">{item.install_count}</p>
                    </div>
                    
                    <div>
                      <p className="text-muted-foreground">Rating</p>
                      <p className="font-medium">
                        {item.rating_avg > 0 
                          ? `${item.rating_avg.toFixed(1)} (${item.rating_count})`
                          : 'No ratings'
                        }
                      </p>
                    </div>
                    
                    <div>
                      <p className="text-muted-foreground">Views</p>
                      <p className="font-medium">{item.view_count}</p>
                    </div>
                    
                    <div>
                      <p className="text-muted-foreground">Earnings (30d)</p>
                      <p className="font-medium text-green-600">
                        ${(item.earnings_30d_cents / 100).toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <a href={`/templates/${item.slug}`} target="_blank">
                      <Eye className="h-3 w-3 mr-1" />
                      View
                    </a>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <a href={`/creator/templates/${item.id}/edit`}>
                      Edit
                    </a>
                  </Button>
                </div>
              </div>
            ))}

            {items.length === 0 && (
              <div className="text-center py-8">
                <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No templates yet</h3>
                <p className="text-muted-foreground mb-4">Upload your first template to start earning</p>
                <Button asChild>
                  <a href="/creator/upload">
                    <Plus className="h-4 w-4 mr-2" />
                    Upload Template
                  </a>
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}