import { NextRequest, NextResponse } from 'next/server'

// Mock templates data for local development
const mockTemplates = [
  {
    id: '1',
    name: 'Email Notification System',
    description: 'Simple email notifications for workflow events with customizable templates',
    category: 'notifications',
    subcategory: null,
    workflow_json: { nodes: [], connections: {} },
    icon_url: null,
    preview_images: [],
    tags: ['email', 'notification', 'basic'],
    difficulty: 'beginner',
    estimated_time: 10,
    price: 0,
    install_count: 1247,
    rating: 4.8,
    is_featured: true,
    is_active: true
  },
  {
    id: '101',
    name: 'Multi-Channel Inventory Sync Pro',
    description: 'Advanced inventory synchronization across Shopify, Amazon, eBay, and WooCommerce with conflict resolution',
    category: 'E-commerce',
    subcategory: 'Inventory Management',
    workflow_json: { nodes: [], connections: {} },
    icon_url: null,
    preview_images: [],
    tags: ['multi-channel', 'inventory', 'sync', 'e-commerce', 'pro'],
    difficulty: 'advanced',
    estimated_time: 45,
    price: 25,
    install_count: 89,
    rating: 4.9,
    is_featured: true,
    is_active: true
  },
  {
    id: '102',
    name: 'Advanced Lead Scoring AI Pro',
    description: 'Machine learning-powered lead qualification using 50+ data points and behavioral analysis',
    category: 'CRM & Sales',
    subcategory: 'Lead Management',
    workflow_json: { nodes: [], connections: {} },
    icon_url: null,
    preview_images: [],
    tags: ['ai', 'lead-scoring', 'ml', 'crm', 'enterprise'],
    difficulty: 'advanced',
    estimated_time: 75,
    price: 50,
    install_count: 43,
    rating: 4.9,
    is_featured: true,
    is_active: true
  }
]

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const search = searchParams.get('search')
    
    let filteredTemplates = mockTemplates
    
    // Filter by category
    if (category && category !== 'all') {
      filteredTemplates = filteredTemplates.filter(t => 
        t.category.toLowerCase() === category.toLowerCase()
      )
    }
    
    // Filter by search term
    if (search) {
      const searchLower = search.toLowerCase()
      filteredTemplates = filteredTemplates.filter(t =>
        t.name.toLowerCase().includes(searchLower) ||
        t.description.toLowerCase().includes(searchLower) ||
        t.tags.some(tag => tag.toLowerCase().includes(searchLower))
      )
    }
    
    return NextResponse.json({
      success: true,
      data: filteredTemplates,
      meta: {
        total: filteredTemplates.length,
        free: filteredTemplates.filter(t => t.price === 0).length,
        premium: filteredTemplates.filter(t => t.price > 0).length
      }
    })
    
  } catch (error) {
    console.error('Templates API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch templates'
    }, { status: 500 })
  }
}