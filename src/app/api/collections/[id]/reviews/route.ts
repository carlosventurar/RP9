/**
 * Collection Reviews API
 * Handles collection review operations (GET, POST)
 * Sprint 3.3: Collections & Bundles System
 */

import { NextRequest, NextResponse } from 'next/server'

// Mock collection reviews data
const mockCollectionReviews = [
  {
    id: 'review-coll-1',
    collection_id: 'collection-1',
    user_id: 'user-1',
    user_name: 'Sarah Chen',
    user_avatar: '/avatars/sarah.jpg',
    rating: 5,
    comment: 'Amazing collection! Saved me weeks of development time. The templates are well-designed and easy to customize. The bundle price is incredibly fair compared to hiring a developer. Each template works perfectly with the others.',
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
    comment: 'Great value for money. The bundle discount makes it very affordable compared to buying individually. Documentation could be better but support team is responsive. The inventory sync template is particularly impressive.',
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
    comment: 'Perfect for my startup! We went from idea to live store in just 3 days. The analytics template gives us insights we never had before. Customer support was excellent during setup.',
    helpful_count: 15,
    created_at: '2024-10-25T09:30:00Z',
    verified_purchase: true
  },
  {
    id: 'review-coll-4',
    collection_id: 'collection-1',
    user_id: 'user-7',
    user_name: 'Alex Thompson',
    user_avatar: '/avatars/alex.jpg',
    rating: 4,
    comment: 'Solid e-commerce collection. The checkout optimization template increased our conversion rate by 15%. Only minor issue was some initial configuration complexity.',
    helpful_count: 6,
    created_at: '2024-10-22T11:15:00Z',
    verified_purchase: true
  },
  {
    id: 'review-coll-5',
    collection_id: 'collection-2',
    user_id: 'user-3',
    user_name: 'Lisa Wang',
    user_avatar: '/avatars/lisa.jpg',
    rating: 5,
    comment: 'Professional quality templates. The email campaign template alone is worth the price. Excellent integration capabilities with our existing CRM. The lead scoring AI is remarkably accurate.',
    helpful_count: 18,
    created_at: '2024-10-30T11:30:00Z',
    verified_purchase: true
  },
  {
    id: 'review-coll-6',
    collection_id: 'collection-2',
    user_id: 'user-6',
    user_name: 'Robert Chen',
    user_avatar: '/avatars/robert.jpg',
    rating: 4,
    comment: 'Solid marketing suite. The lead scoring AI is impressive and has improved our conversion rates by 23%. Setup took some time but worth it. Great documentation and video tutorials.',
    helpful_count: 11,
    created_at: '2024-10-27T15:45:00Z',
    verified_purchase: true
  },
  {
    id: 'review-coll-7',
    collection_id: 'collection-2',
    user_id: 'user-8',
    user_name: 'Maria Garcia',
    user_avatar: '/avatars/maria.jpg',
    rating: 5,
    comment: 'Best marketing automation investment we\'ve made! The customer segmentation is incredibly detailed and the social media scheduler saves hours every week. ROI was positive within the first month.',
    helpful_count: 22,
    created_at: '2024-10-24T14:20:00Z',
    verified_purchase: true
  },
  {
    id: 'review-coll-8',
    collection_id: 'collection-4',
    user_id: 'user-4',
    user_name: 'David Kim',
    user_avatar: '/avatars/david.jpg',
    rating: 5,
    comment: 'Perfect for beginners! Clear documentation and easy to follow examples. Great way to get started with the platform. All templates work out of the box with minimal configuration.',
    helpful_count: 23,
    created_at: '2024-10-15T09:12:00Z',
    verified_purchase: true
  },
  {
    id: 'review-coll-9',
    collection_id: 'collection-4',
    user_id: 'user-9',
    user_name: 'Emma Johnson',
    user_avatar: '/avatars/emma.jpg',
    rating: 4,
    comment: 'Excellent starter collection. The email notification system is very reliable and the task tracker is perfect for small teams. Would love to see more templates added to this free collection.',
    helpful_count: 14,
    created_at: '2024-10-12T16:30:00Z',
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
    const limit = parseInt(searchParams.get('limit') || '10')
    const page = parseInt(searchParams.get('page') || '1')
    const sort = searchParams.get('sort') || 'newest' // newest, oldest, helpful, rating_high, rating_low

    // Filter reviews for this collection
    let reviews = mockCollectionReviews.filter(r => r.collection_id === collectionId)

    // Apply sorting
    switch (sort) {
      case 'oldest':
        reviews.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        break
      case 'helpful':
        reviews.sort((a, b) => b.helpful_count - a.helpful_count)
        break
      case 'rating_high':
        reviews.sort((a, b) => b.rating - a.rating)
        break
      case 'rating_low':
        reviews.sort((a, b) => a.rating - b.rating)
        break
      case 'newest':
      default:
        reviews.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        break
    }

    // Calculate pagination
    const startIndex = (page - 1) * limit
    const endIndex = startIndex + limit
    const paginatedReviews = reviews.slice(startIndex, endIndex)

    // Calculate summary statistics
    const totalReviews = reviews.length
    const averageRating = totalReviews > 0 
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews 
      : 0

    const ratingDistribution = {
      5: reviews.filter(r => r.rating === 5).length,
      4: reviews.filter(r => r.rating === 4).length,
      3: reviews.filter(r => r.rating === 3).length,
      2: reviews.filter(r => r.rating === 2).length,
      1: reviews.filter(r => r.rating === 1).length
    }

    return NextResponse.json({
      success: true,
      data: {
        reviews: paginatedReviews,
        summary: {
          total_reviews: totalReviews,
          average_rating: Math.round(averageRating * 10) / 10,
          rating_distribution: ratingDistribution
        },
        pagination: {
          page,
          limit,
          total: totalReviews,
          pages: Math.ceil(totalReviews / limit),
          hasNext: endIndex < totalReviews,
          hasPrev: page > 1
        }
      }
    })
  } catch (error) {
    console.error('Collection reviews fetch error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch collection reviews' },
      { status: 500 }
    )
  }
}

export async function POST(
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
    const { rating, comment } = body

    // Validation
    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json(
        { success: false, error: 'Rating must be between 1 and 5' },
        { status: 400 }
      )
    }

    if (comment && comment.trim().length < 10) {
      return NextResponse.json(
        { success: false, error: 'Comment must be at least 10 characters long' },
        { status: 400 }
      )
    }

    // Check if user already reviewed this collection (mock)
    const userId = 'user-current' // From auth token
    const existingReview = mockCollectionReviews.find(
      r => r.collection_id === collectionId && r.user_id === userId
    )

    if (existingReview) {
      return NextResponse.json(
        { success: false, error: 'You have already reviewed this collection' },
        { status: 400 }
      )
    }

    // Check if user has purchased/installed the collection (mock)
    // In real implementation, check collection_installs table
    const hasPurchased = true // Mock: assume user has purchased

    if (!hasPurchased) {
      return NextResponse.json(
        { success: false, error: 'You must purchase this collection before reviewing' },
        { status: 403 }
      )
    }

    // Create new review (mock)
    const newReview = {
      id: `review-coll-${Date.now()}`,
      collection_id: collectionId,
      user_id: userId,
      user_name: 'Current User', // From auth/user data
      user_avatar: '/avatars/default.jpg',
      rating,
      comment: comment?.trim() || null,
      helpful_count: 0,
      created_at: new Date().toISOString(),
      verified_purchase: true
    }

    // In real implementation:
    // 1. Insert into collection_reviews table
    // 2. Update collection average_rating via trigger
    // 3. Return the created review

    return NextResponse.json({
      success: true,
      data: { review: newReview },
      message: 'Review submitted successfully'
    }, { status: 201 })

  } catch (error) {
    console.error('Collection review creation error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to submit review' },
      { status: 500 }
    )
  }
}