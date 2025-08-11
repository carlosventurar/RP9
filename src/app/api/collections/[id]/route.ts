/**
 * Individual Collection API
 * Handles single collection operations (GET, PUT, DELETE)
 * Sprint 3.3: Collections & Bundles System
 */

import { NextRequest, NextResponse } from 'next/server'

// Mock collection data (same as main route for consistency)
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
    original_price: 106.65,
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
        rating: 4.8,
        installs: 2456,
        description: 'Synchronize inventory across multiple sales channels in real-time.'
      },
      {
        id: 'template-2', 
        name: 'Advanced Product Catalog Manager',
        price: 29.99,
        category: 'E-commerce',
        rating: 4.6,
        installs: 1834,
        description: 'Comprehensive product catalog management with advanced filtering.'
      },
      {
        id: 'template-ecom-3',
        name: 'Checkout Flow Optimizer',
        price: 24.99,
        category: 'E-commerce',
        rating: 4.9,
        installs: 3201,
        description: 'Optimized checkout process to reduce cart abandonment.'
      },
      {
        id: 'template-ecom-4',
        name: 'Customer Analytics Dashboard',
        price: 16.67,
        category: 'E-commerce',
        rating: 4.7,
        installs: 1987,
        description: 'Comprehensive analytics for customer behavior and sales trends.'
      }
    ],
    total_installs: 234,
    average_rating: 4.7,
    review_count: 89,
    created_at: '2024-10-15T10:00:00Z',
    updated_at: '2024-11-01T14:30:00Z',
    long_description: 'This comprehensive e-commerce starter pack includes everything you need to launch a successful online store. Our carefully curated templates work seamlessly together to provide inventory management, product catalog organization, optimized checkout flows, and detailed analytics. Save 25% compared to purchasing these templates individually and get your store up and running in days, not weeks.',
    features: [
      'Real-time inventory synchronization across multiple channels',
      'Advanced product catalog with filtering and search',
      'Optimized checkout process with A/B tested flows',
      'Comprehensive customer analytics and reporting',
      'Mobile-responsive design for all templates',
      'Easy customization and white-label options',
      '24/7 premium support included',
      'Regular updates and feature additions'
    ],
    requirements: [
      'Basic understanding of template configuration',
      'Access to your e-commerce platform API',
      'Admin access to your online store'
    ],
    included_support: 'Premium support with priority response time',
    update_policy: 'Free updates for 12 months included'
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
        rating: 4.9,
        installs: 1523,
        description: 'AI-powered lead scoring system with machine learning algorithms.'
      },
      {
        id: 'template-mkt-1',
        name: 'Email Campaign Manager',
        price: 39.99,
        category: 'Marketing',
        rating: 4.8,
        installs: 2834,
        description: 'Comprehensive email marketing with automation workflows.'
      },
      {
        id: 'template-mkt-2',
        name: 'Customer Segmentation Engine',
        price: 34.99,
        category: 'Marketing',
        rating: 4.6,
        installs: 1456,
        description: 'Advanced customer segmentation based on behavior and demographics.'
      },
      {
        id: 'template-mkt-3',
        name: 'Social Media Scheduler',
        price: 29.99,
        category: 'Marketing',
        rating: 4.5,
        installs: 2101,
        description: 'Schedule and manage social media posts across multiple platforms.'
      },
      {
        id: 'template-mkt-4',
        name: 'Marketing Attribution Tracker',
        price: 30.73,
        category: 'Marketing',
        rating: 4.7,
        installs: 987,
        description: 'Track marketing attribution across all channels and touchpoints.'
      }
    ],
    total_installs: 167,
    average_rating: 4.6,
    review_count: 52,
    created_at: '2024-10-20T09:15:00Z',
    updated_at: '2024-11-02T11:20:00Z',
    long_description: 'Transform your marketing efforts with our comprehensive automation suite. These professionally designed templates work together to create a complete marketing ecosystem, from lead generation to customer retention. Save 30% compared to individual purchases and implement enterprise-grade marketing automation in your business.',
    features: [
      'AI-powered lead scoring with 95% accuracy',
      'Multi-channel email campaigns with automation',
      'Advanced customer segmentation and targeting',
      'Social media scheduling across 15+ platforms',
      'Complete marketing attribution tracking',
      'Real-time campaign performance analytics',
      'A/B testing capabilities built-in',
      'CRM integration and sync capabilities'
    ],
    requirements: [
      'Marketing platform API access',
      'Basic understanding of marketing automation',
      'CRM system for lead management'
    ],
    included_support: 'Premium support with marketing consultation',
    update_policy: 'Lifetime updates and new template additions'
  }
]

// Mock reviews for specific collections
const mockReviews = [
  {
    id: 'review-coll-1',
    collection_id: 'collection-1',
    user_id: 'user-1',
    user_name: 'Sarah Chen',
    user_avatar: '/avatars/sarah.jpg',
    rating: 5,
    comment: 'Amazing collection! Saved me weeks of development time. The templates are well-designed and easy to customize. The bundle price is incredibly fair compared to hiring a developer.',
    helpful_count: 12,
    created_at: '2024-11-01T14:22:00Z',
    verified_purchase: true
  },
  {
    id: 'review-coll-2', 
    collection_id: 'collection-1',
    user_id: 'user-2',
    user_name: 'Mike Rodriguez',
    user_avatar: '/avatars/mike.jpg',
    rating: 4,
    comment: 'Great value for money. The bundle discount makes it very affordable compared to buying individually. Documentation could be better but support team is responsive.',
    helpful_count: 8,
    created_at: '2024-10-28T16:45:00Z',
    verified_purchase: true
  },
  {
    id: 'review-coll-3',
    collection_id: 'collection-1',
    user_id: 'user-5',
    user_name: 'Jennifer Walsh',
    user_avatar: '/avatars/jennifer.jpg',
    rating: 5,
    comment: 'Perfect for my startup! We went from idea to live store in just 3 days. The analytics template gives us insights we never had before.',
    helpful_count: 15,
    created_at: '2024-10-25T09:30:00Z',
    verified_purchase: true
  },
  {
    id: 'review-coll-4',
    collection_id: 'collection-2',
    user_id: 'user-3',
    user_name: 'Lisa Wang',
    user_avatar: '/avatars/lisa.jpg',
    rating: 5,
    comment: 'Professional quality templates. The email campaign template alone is worth the price. Excellent integration capabilities with our existing CRM.',
    helpful_count: 18,
    created_at: '2024-10-30T11:30:00Z',
    verified_purchase: true
  },
  {
    id: 'review-coll-5',
    collection_id: 'collection-2',
    user_id: 'user-6',
    user_name: 'Robert Chen',
    user_avatar: '/avatars/robert.jpg',
    rating: 4,
    comment: 'Solid marketing suite. The lead scoring AI is impressive and has improved our conversion rates by 23%. Setup took some time but worth it.',
    helpful_count: 11,
    created_at: '2024-10-27T15:45:00Z',
    verified_purchase: true
  }
]

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = await params
    const collectionId = id
    const { searchParams } = new URL(request.url)
    const includeReviews = searchParams.get('include_reviews') === 'true'

    // Find collection
    const collection = mockCollections.find(c => c.id === collectionId)
    
    if (!collection) {
      return NextResponse.json(
        { success: false, error: 'Collection not found' },
        { status: 404 }
      )
    }

    const response: any = {
      success: true,
      data: { collection }
    }

    // Include reviews if requested
    if (includeReviews) {
      const collectionReviews = mockReviews.filter(r => r.collection_id === collectionId)
      response.data.reviews = collectionReviews
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Collection fetch error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch collection' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check authentication (mock)
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { id } = await params
    const collectionId = id
    const body = await request.json()

    // Find collection
    const collection = mockCollections.find(c => c.id === collectionId)
    
    if (!collection) {
      return NextResponse.json(
        { success: false, error: 'Collection not found' },
        { status: 404 }
      )
    }

    // Check ownership (mock - in real app check against creator_id)
    // if (collection.creator_id !== currentUserId) {
    //   return NextResponse.json(
    //     { success: false, error: 'Not authorized to update this collection' },
    //     { status: 403 }
    //   )
    // }

    // Update collection fields
    const updatedCollection = {
      ...collection,
      ...body,
      id: collectionId, // Prevent ID changes
      updated_at: new Date().toISOString()
    }

    return NextResponse.json({
      success: true,
      data: { collection: updatedCollection },
      message: 'Collection updated successfully'
    })

  } catch (error) {
    console.error('Collection update error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update collection' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check authentication (mock)
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { id } = await params
    const collectionId = id

    // Find collection
    const collection = mockCollections.find(c => c.id === collectionId)
    
    if (!collection) {
      return NextResponse.json(
        { success: false, error: 'Collection not found' },
        { status: 404 }
      )
    }

    // Check ownership (mock)
    // if (collection.creator_id !== currentUserId) {
    //   return NextResponse.json(
    //     { success: false, error: 'Not authorized to delete this collection' },
    //     { status: 403 }
    //   )
    // }

    // In real implementation, would delete from database
    return NextResponse.json({
      success: true,
      message: 'Collection deleted successfully'
    })

  } catch (error) {
    console.error('Collection deletion error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete collection' },
      { status: 500 }
    )
  }
}