'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { 
  CheckCircle,
  XCircle,
  Clock,
  Star,
  Eye,
  DollarSign,
  AlertCircle,
  Shield,
  Users,
  Package,
  TrendingUp,
  Download,
  Filter,
  Search,
  ExternalLink
} from 'lucide-react'

interface PendingItem {
  id: string
  slug: string
  title: string
  short_desc: string
  category_key: string
  tier: string
  one_off_price_cents: number | null
  subscription_price_cents: number | null
  status: string
  creator: {
    display_name: string
    country: string
  }
  created_at: string
  lint_passed: boolean
  security_passed: boolean
}

export default function MarketplaceAdminPage() {
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([])
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('pending')

  // Mock data for demonstration
  useEffect(() => {
    const mockPendingItems: PendingItem[] = [
      {
        id: '1',
        slug: 'advanced-inventory-sync',
        title: 'Advanced Inventory Sync',
        short_desc: 'Synchronize inventory across multiple e-commerce platforms with real-time updates and conflict resolution',
        category_key: 'ecommerce',
        tier: 'pro',
        one_off_price_cents: 7999,
        subscription_price_cents: null,
        status: 'pending',
        creator: {
          display_name: 'Miguel Rodriguez',
          country: 'MX'
        },
        created_at: '2024-08-12T10:30:00Z',
        lint_passed: true,
        security_passed: true
      },
      {
        id: '2',
        slug: 'customer-journey-tracker',
        title: 'Customer Journey Tracker',
        short_desc: 'Track customer interactions across touchpoints with advanced analytics and behavioral insights',
        category_key: 'crm',
        tier: 'mid',
        one_off_price_cents: 3999,
        subscription_price_cents: 1299,
        status: 'pending',
        creator: {
          display_name: 'Ana Sofia García',
          country: 'CO'
        },
        created_at: '2024-08-11T15:45:00Z',
        lint_passed: true,
        security_passed: false
      },
      {
        id: '3',
        slug: 'whatsapp-business-bot',
        title: 'WhatsApp Business Bot Suite',
        short_desc: 'Complete WhatsApp automation with AI responses, order processing, and customer service workflows',
        category_key: 'wa',
        tier: 'pro',
        one_off_price_cents: 5999,
        subscription_price_cents: 1999,
        status: 'pending',
        creator: {
          display_name: 'Carlos Mendoza',
          country: 'CL'
        },
        created_at: '2024-08-10T09:20:00Z',
        lint_passed: false,
        security_passed: true
      }
    ]
    setPendingItems(mockPendingItems)
  }, [])

  const handleApproveItem = async (itemId: string) => {
    try {
      // In production, call API to approve item
      console.log('Approving item:', itemId)
      
      // Update local state
      setPendingItems(prev => prev.map(item => 
        item.id === itemId ? { ...item, status: 'approved' } : item
      ))
      
      alert('Template approved successfully!')
    } catch (error) {
      console.error('Failed to approve item:', error)
      alert('Failed to approve template. Please try again.')
    }
  }

  const handleRejectItem = async (itemId: string, reason: string) => {
    try {
      // In production, call API to reject item
      console.log('Rejecting item:', itemId, 'Reason:', reason)
      
      // Update local state
      setPendingItems(prev => prev.map(item => 
        item.id === itemId ? { ...item, status: 'rejected' } : item
      ))
      
      alert('Template rejected successfully!')
    } catch (error) {
      console.error('Failed to reject item:', error)
      alert('Failed to reject template. Please try again.')
    }
  }

  const handleToggleFeatured = async (itemId: string, featured: boolean) => {
    try {
      // In production, call API to toggle featured status
      console.log('Toggle featured:', itemId, featured)
      alert(`Template ${featured ? 'featured' : 'unfeatured'} successfully!`)
    } catch (error) {
      console.error('Failed to update featured status:', error)
      alert('Failed to update featured status. Please try again.')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Marketplace Administration</h1>
          <p className="text-muted-foreground">
            Manage template submissions, curation, and marketplace settings
          </p>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">3</div>
            <p className="text-xs text-muted-foreground">2 need attention</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Templates</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">127</div>
            <p className="text-xs text-muted-foreground">+8 this month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Creators</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">42</div>
            <p className="text-xs text-muted-foreground">12 new this month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revenue Share</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$2,340</div>
            <p className="text-xs text-muted-foreground">30% platform fee</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="pending">Pending Review</TabsTrigger>
          <TabsTrigger value="featured">Featured</TabsTrigger>
          <TabsTrigger value="refunds">Refunds</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Templates Awaiting Review</CardTitle>
              <CardDescription>
                Review template submissions for quality, security, and compliance
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {pendingItems.map((item) => (
                  <ReviewCard 
                    key={item.id} 
                    item={item} 
                    onApprove={handleApproveItem}
                    onReject={handleRejectItem}
                  />
                ))}
                
                {pendingItems.length === 0 && (
                  <div className="text-center py-8">
                    <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">All caught up!</h3>
                    <p className="text-muted-foreground">No templates pending review</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="featured" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Featured Templates Management</CardTitle>
              <CardDescription>
                Manage which templates are featured in the marketplace
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Alert>
                <Star className="h-4 w-4" />
                <AlertDescription>
                  Featured templates get priority placement and increased visibility. 
                  Consider performance metrics and user ratings when featuring templates.
                </AlertDescription>
              </Alert>
              
              <div className="mt-6">
                <p className="text-center text-muted-foreground py-8">
                  Featured templates management interface would be here
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="refunds" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Refund Requests</CardTitle>
              <CardDescription>
                Review and process customer refund requests
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Refund policy: 7 days for digital products, automatic for unused templates, 
                  manual review for cases with high usage.
                </AlertDescription>
              </Alert>
              
              <div className="mt-6">
                <p className="text-center text-muted-foreground py-8">
                  No pending refund requests
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Top Performing Templates</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { name: 'Advanced CRM Sync', installs: 234, rating: 4.8 },
                    { name: 'WhatsApp Automation Suite', installs: 189, rating: 4.7 },
                    { name: 'Email Marketing Flows', installs: 156, rating: 4.6 }
                  ].map((template, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{template.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {template.installs} installs • {template.rating} ★
                        </p>
                      </div>
                      <TrendingUp className="h-4 w-4 text-green-500" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Category Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { category: 'E-commerce', templates: 23, revenue: '$1,240' },
                    { category: 'CRM & Sales', templates: 18, revenue: '$890' },
                    { category: 'WhatsApp', templates: 15, revenue: '$760' }
                  ].map((cat, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{cat.category}</p>
                        <p className="text-sm text-muted-foreground">
                          {cat.templates} templates
                        </p>
                      </div>
                      <p className="font-medium text-green-600">{cat.revenue}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function ReviewCard({ 
  item, 
  onApprove, 
  onReject 
}: { 
  item: PendingItem
  onApprove: (id: string) => void
  onReject: (id: string, reason: string) => void
}) {
  const [rejectionReason, setRejectionReason] = useState('')
  const [showRejectForm, setShowRejectForm] = useState(false)

  const handleReject = () => {
    if (!rejectionReason.trim()) {
      alert('Please provide a rejection reason')
      return
    }
    onReject(item.id, rejectionReason)
    setShowRejectForm(false)
    setRejectionReason('')
  }

  return (
    <div className="border rounded-lg p-4 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-lg">{item.title}</h3>
            <Badge variant="outline">{item.tier}</Badge>
            <Badge variant="secondary">{item.category_key}</Badge>
          </div>
          <p className="text-muted-foreground">{item.short_desc}</p>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>By {item.creator.display_name}</span>
            <span>•</span>
            <span>{item.creator.country}</span>
            <span>•</span>
            <span>{new Date(item.created_at).toLocaleDateString()}</span>
          </div>
        </div>
        
        <div className="text-right">
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
      </div>

      {/* Quality Checks */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1">
          {item.lint_passed ? (
            <CheckCircle className="h-4 w-4 text-green-500" />
          ) : (
            <XCircle className="h-4 w-4 text-red-500" />
          )}
          <span className="text-sm">Code Quality</span>
        </div>
        
        <div className="flex items-center gap-1">
          {item.security_passed ? (
            <CheckCircle className="h-4 w-4 text-green-500" />
          ) : (
            <XCircle className="h-4 w-4 text-red-500" />
          )}
          <span className="text-sm">Security Scan</span>
        </div>
      </div>

      {/* Quality Issues */}
      {(!item.lint_passed || !item.security_passed) && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Quality Issues Detected:</strong>
            <ul className="list-disc list-inside mt-1">
              {!item.lint_passed && <li>Code linting failed - check for syntax errors and style issues</li>}
              {!item.security_passed && <li>Security scan failed - potential secrets or vulnerabilities found</li>}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button 
          size="sm" 
          variant="outline" 
          asChild
        >
          <a href={`/templates/${item.slug}`} target="_blank">
            <Eye className="h-3 w-3 mr-1" />
            Preview
          </a>
        </Button>
        
        <Button 
          size="sm" 
          onClick={() => onApprove(item.id)}
          disabled={!item.lint_passed || !item.security_passed}
        >
          <CheckCircle className="h-3 w-3 mr-1" />
          Approve
        </Button>
        
        <Button 
          size="sm" 
          variant="destructive" 
          onClick={() => setShowRejectForm(!showRejectForm)}
        >
          <XCircle className="h-3 w-3 mr-1" />
          Reject
        </Button>
      </div>

      {/* Rejection Form */}
      {showRejectForm && (
        <div className="border-t pt-4 space-y-3">
          <Textarea
            placeholder="Provide detailed feedback on why this template is being rejected..."
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            rows={3}
          />
          <div className="flex items-center gap-2">
            <Button size="sm" variant="destructive" onClick={handleReject}>
              Confirm Rejection
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowRejectForm(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}