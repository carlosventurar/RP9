/**
 * Template Collections API
 * Handles CRUD operations for template collections and bundles
 * Sprint 3.3: Collections & Bundles System
 */

import { NextRequest, NextResponse } from 'next/server'

// Mock collections data (replace with real database)
const mockCollections = [
  {
    id: 'collection-1',
    name: 'E-commerce Starter Pack',
    description: 'Complete collection of templates to launch your online store quickly. Includes product pages, checkout flows, and inventory management.',
    creator_id: 'system-user-1',
    creator_name: 'RP9 Team',
    is_public: true,
    is_featured: true,
    bundle_price: 79.99,
    original_price: 106.65, // Sum of individual prices
    discount_percentage: 25.0,
    savings: 26.66,
    image_url: '/images/collections/ecommerce-starter.jpg',
    tags: ['e-commerce', 'starter', 'bundle', 'sales'],
    template_count: 4,
    templates: [
      {
        id: 'template-1',
        name: 'Multi-Channel Inventory Sync Pro',
        price: 35.00,
        category: 'E-commerce',
        rating: 4.8
      },
      {
        id: 'template-2', 
        name: 'Advanced Product Catalog Manager',
        price: 29.99,
        category: 'E-commerce',
        rating: 4.6
      },
      {
        id: 'template-ecom-3',
        name: 'Checkout Flow Optimizer',
        price: 24.99,
        category: 'E-commerce',
        rating: 4.9
      },
      {
        id: 'template-ecom-4',
        name: 'Customer Analytics Dashboard',
        price: 16.67,
        category: 'E-commerce',
        rating: 4.7
      }
    ],
    total_installs: 234,
    average_rating: 4.7,
    review_count: 89,
    created_at: '2024-10-15T10:00:00Z',
    updated_at: '2024-11-01T14:30:00Z'
  },
  {
    id: 'collection-2',
    name: 'Marketing Automation Suite',
    description: 'Comprehensive marketing tools including email campaigns, lead scoring, and customer segmentation templates.',
    creator_id: 'system-user-1',
    creator_name: 'RP9 Team',
    is_public: true,
    is_featured: true,
    bundle_price: 129.99,
    original_price: 185.70,
    discount_percentage: 30.0,
    savings: 55.71,
    image_url: '/images/collections/marketing-suite.jpg',
    tags: ['marketing', 'automation', 'campaigns', 'leads'],
    template_count: 5,
    templates: [
      {
        id: 'template-3',
        name: 'Advanced Lead Scoring AI Pro',
        price: 50.00,
        category: 'CRM & Sales',
        rating: 4.9
      },
      {
        id: 'template-mkt-1',
        name: 'Email Campaign Manager',
        price: 39.99,
        category: 'Marketing',
        rating: 4.8
      },
      {
        id: 'template-mkt-2',
        name: 'Customer Segmentation Engine',
        price: 34.99,
        category: 'Marketing',
        rating: 4.6
      },
      {
        id: 'template-mkt-3',
        name: 'Social Media Scheduler',
        price: 29.99,
        category: 'Marketing',
        rating: 4.5
      },
      {
        id: 'template-mkt-4',
        name: 'Marketing Attribution Tracker',
        price: 30.73,
        category: 'Marketing',
        rating: 4.7
      }
    ],
    total_installs: 167,
    average_rating: 4.6,
    review_count: 52,
    created_at: '2024-10-20T09:15:00Z',
    updated_at: '2024-11-02T11:20:00Z'
  },
  {
    id: 'collection-3',
    name: 'CRM Power Bundle',
    description: 'Everything you need for customer relationship management. Contact management, sales pipeline, and reporting.',
    creator_id: 'system-user-1',
    creator_name: 'RP9 Team',
    is_public: true,
    is_featured: false,
    bundle_price: 99.99,
    original_price: 124.99,
    discount_percentage: 20.0,
    savings: 25.00,
    image_url: '/images/collections/crm-bundle.jpg',
    tags: ['crm', 'sales', 'customers', 'pipeline'],
    template_count: 3,
    templates: [
      {
        id: 'template-crm-1',
        name: 'Sales Pipeline Manager',
        price: 44.99,
        category: 'CRM & Sales',
        rating: 4.8
      },
      {
        id: 'template-crm-2',
        name: 'Contact Management System',
        price: 39.99,
        category: 'CRM & Sales',
        rating: 4.6
      },
      {
        id: 'template-crm-3',
        name: 'Sales Reporting Dashboard',
        price: 40.01,
        category: 'CRM & Sales',
        rating: 4.7
      }
    ],
    total_installs: 143,
    average_rating: 4.5,
    review_count: 31,
    created_at: '2024-10-25T13:45:00Z',
    updated_at: '2024-10-30T16:10:00Z'
  },
  {
    id: 'collection-4',
    name: 'Free Getting Started Collection',
    description: 'Essential templates to get started with the platform. Perfect for beginners and small projects.',
    creator_id: 'system-user-1',
    creator_name: 'RP9 Team',
    is_public: true,
    is_featured: true,
    bundle_price: null, // Free collection
    original_price: 0,
    discount_percentage: 0,
    savings: 0,
    image_url: '/images/collections/getting-started.jpg',
    tags: ['free', 'beginner', 'essential', 'starter'],
    template_count: 3,
    templates: [
      {
        id: 'template-5',
        name: 'Email Notification System',
        price: 0, // Free template
        category: 'Communication',
        rating: 4.4
      },
      {
        id: 'template-free-1',
        name: 'Basic Contact Form',
        price: 0,
        category: 'Forms',
        rating: 4.2
      },
      {
        id: 'template-free-2',
        name: 'Simple Task Tracker',
        price: 0,
        category: 'Productivity',
        rating: 4.3
      }
    ],
    total_installs: 892,
    average_rating: 4.3,
    review_count: 156,
    created_at: '2024-09-01T08:00:00Z',
    updated_at: '2024-11-01T12:00:00Z'
  },
  {
    id: 'collection-5',
    name: 'Advanced Developer Tools',
    description: 'Professional-grade templates for experienced developers. Includes advanced workflows and integrations.',
    creator_id: 'system-user-1',
    creator_name: 'RP9 Team',
    is_public: true,
    is_featured: false,
    bundle_price: 199.99,
    original_price: 307.65,
    discount_percentage: 35.0,
    savings: 107.66,
    image_url: '/images/collections/developer-tools.jpg',
    tags: ['advanced', 'developer', 'professional', 'integrations'],
    template_count: 6,
    templates: [
      {
        id: 'template-dev-1',
        name: 'API Gateway Manager',
        price: 69.99,
        category: 'DevOps & IT',
        rating: 4.9
      },
      {
        id: 'template-dev-2',
        name: 'Microservices Orchestrator',
        price: 79.99,
        category: 'DevOps & IT',
        rating: 4.8
      },
      {
        id: 'template-dev-3',
        name: 'Database Migration Tool',
        price: 49.99,
        category: 'DevOps & IT',
        rating: 4.7
      },
      {
        id: 'template-dev-4',
        name: 'CI/CD Pipeline Builder',
        price: 54.99,
        category: 'DevOps & IT',
        rating: 4.6
      },
      {
        id: 'template-dev-5',
        name: 'Monitoring & Alerting System',
        price: 44.99,
        category: 'DevOps & IT',
        rating: 4.8
      },
      {
        id: 'template-dev-6',
        name: 'Advanced Logging Framework',
        price: 7.70,
        category: 'DevOps & IT',
        rating: 4.5
      }
    ],
    total_installs: 76,
    average_rating: 4.7,
    review_count: 23,
    created_at: '2024-11-01T10:30:00Z',
    updated_at: '2024-11-05T09:15:00Z'
  }
]

// Mock reviews for collections
const mockCollectionReviews = [
  {
    id: 'review-coll-1',
    collection_id: 'collection-1',
    user_id: 'user-1',
    user_name: 'Sarah Chen',
    rating: 5,
    comment: 'Amazing collection! Saved me weeks of development time. The templates are well-designed and easy to customize. The bundle price is incredibly fair.',
    helpful_count: 12,
    created_at: '2024-11-01T14:22:00Z'
  },
  {
    id: 'review-coll-2', 
    collection_id: 'collection-1',
    user_id: 'user-2',
    user_name: 'Mike Rodriguez',
    rating: 4,
    comment: 'Great value for money. The bundle discount makes it very affordable compared to buying individually. Documentation could be better.',
    helpful_count: 8,
    created_at: '2024-10-28T16:45:00Z'
  },
  {
    id: 'review-coll-3',
    collection_id: 'collection-2',
    user_id: 'user-3',
    user_name: 'Lisa Wang',
    rating: 5,
    comment: 'Professional quality templates. The email campaign template alone is worth the price. Excellent integration capabilities.',
    helpful_count: 15,
    created_at: '2024-10-30T11:30:00Z'
  },
  {
    id: 'review-coll-4',
    collection_id: 'collection-4',
    user_id: 'user-4',
    user_name: 'David Kim',
    rating: 5,
    comment: 'Perfect for beginners! Clear documentation and easy to follow examples. Great way to get started with the platform.',
    helpful_count: 23,
    created_at: '2024-10-15T09:12:00Z'
  }
]

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const featured = searchParams.get('featured')
    const category = searchParams.get('category')
    const free = searchParams.get('free')
    const sort = searchParams.get('sort') || 'featured' // featured, newest, popular, price_asc, price_desc
    const limit = parseInt(searchParams.get('limit') || '20')
    const page = parseInt(searchParams.get('page') || '1')

    let collections = [...mockCollections]

    // Apply filters
    if (featured === 'true') {
      collections = collections.filter(c => c.is_featured)
    }

    if (free === 'true') {
      collections = collections.filter(c => c.bundle_price === null || c.bundle_price === 0)
    }

    if (category && category !== 'all') {
      collections = collections.filter(c =>
        c.templates.some(t => t.category === category) ||
        c.tags.some(tag => tag.toLowerCase().includes(category.toLowerCase()))
      )
    }

    // Apply sorting
    switch (sort) {
      case 'newest':
        collections.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        break
      case 'popular':
        collections.sort((a, b) => b.total_installs - a.total_installs)
        break
      case 'price_asc':
        collections.sort((a, b) => (a.bundle_price || 0) - (b.bundle_price || 0))
        break
      case 'price_desc':
        collections.sort((a, b) => (b.bundle_price || 0) - (a.bundle_price || 0))
        break
      case 'rating':
        collections.sort((a, b) => b.average_rating - a.average_rating)
        break
      case 'featured':
      default:
        // Featured first, then by newest
        collections.sort((a, b) => {
          if (a.is_featured && !b.is_featured) return -1
          if (!a.is_featured && b.is_featured) return 1
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        })
        break
    }

    // Pagination
    const startIndex = (page - 1) * limit
    const endIndex = startIndex + limit
    const paginatedCollections = collections.slice(startIndex, endIndex)

    return NextResponse.json({
      success: true,
      data: {
        collections: paginatedCollections,
        pagination: {
          page,
          limit,
          total: collections.length,
          pages: Math.ceil(collections.length / limit),
          hasNext: endIndex < collections.length,
          hasPrev: page > 1
        },
        filters: {
          featured: featured === 'true',
          category,
          free: free === 'true',
          sort
        }
      }
    })
  } catch (error) {
    console.error('Collections API error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch collections' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication (mock)
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { name, description, template_ids, bundle_price, discount_percentage, tags, is_public = true } = body

    // Validation
    if (!name || !description) {
      return NextResponse.json(
        { success: false, error: 'Name and description are required' },
        { status: 400 }
      )
    }

    if (!template_ids || !Array.isArray(template_ids) || template_ids.length === 0) {
      return NextResponse.json(
        { success: false, error: 'At least one template is required' },
        { status: 400 }
      )
    }

    if (bundle_price && (isNaN(bundle_price) || bundle_price < 0)) {
      return NextResponse.json(
        { success: false, error: 'Invalid bundle price' },
        { status: 400 }
      )
    }

    if (discount_percentage && (isNaN(discount_percentage) || discount_percentage < 0 || discount_percentage > 100)) {
      return NextResponse.json(
        { success: false, error: 'Discount percentage must be between 0 and 100' },
        { status: 400 }
      )
    }

    // Create new collection (mock)
    const newCollection = {
      id: `collection-${Date.now()}`,
      name,
      description,
      creator_id: 'user-123', // From auth token
      creator_name: 'Current User',
      is_public,
      is_featured: false,
      bundle_price: bundle_price || null,
      original_price: 0, // Calculate from template prices
      discount_percentage: discount_percentage || 0,
      savings: 0, // Calculate savings
      image_url: null,
      tags: tags || [],
      template_count: template_ids.length,
      templates: [], // Would fetch from database
      total_installs: 0,
      average_rating: 0,
      review_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    return NextResponse.json({
      success: true,
      data: { collection: newCollection },
      message: 'Collection created successfully'
    }, { status: 201 })

  } catch (error) {
    console.error('Collection creation error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create collection' },
      { status: 500 }
    )
  }
}