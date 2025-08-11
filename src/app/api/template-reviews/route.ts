import { NextRequest, NextResponse } from 'next/server'

// Mock reviews data for local development
const mockReviews = [
  {
    id: 'review-1',
    user_id: 'user-1',
    rating: 5,
    comment: 'Excellent template! Saved me hours of work setting up email notifications. The workflow is clean and easy to customize.',
    helpful_count: 8,
    created_at: '2025-08-10T10:30:00Z',
    updated_at: '2025-08-10T10:30:00Z',
    user_name: 'Sarah Chen',
    user_email: 'sarah.chen@example.com',
    user_has_helped: false
  },
  {
    id: 'review-2', 
    user_id: 'user-2',
    rating: 4,
    comment: 'Great starting point for inventory sync. Had to make a few adjustments for our specific use case, but the core logic is solid.',
    helpful_count: 5,
    created_at: '2025-08-09T15:45:00Z',
    updated_at: '2025-08-09T15:45:00Z',
    user_name: 'Mike Rodriguez',
    user_email: 'mike.r@company.com',
    user_has_helped: true
  },
  {
    id: 'review-3',
    user_id: 'user-3', 
    rating: 5,
    comment: 'Perfect for our lead scoring needs. The AI integration works flawlessly and the documentation is comprehensive.',
    helpful_count: 12,
    created_at: '2025-08-08T09:15:00Z',
    updated_at: '2025-08-08T09:15:00Z',
    user_name: 'Jennifer Park',
    user_email: 'j.park@startup.io',
    user_has_helped: false
  },
  {
    id: 'review-4',
    user_id: 'user-4',
    rating: 3,
    comment: 'Good template but requires some technical knowledge to set up properly. Would benefit from more detailed setup instructions.',
    helpful_count: 3,
    created_at: '2025-08-07T14:20:00Z',
    updated_at: '2025-08-07T14:20:00Z',
    user_name: 'Alex Thompson',
    user_email: 'alex.t@email.com',
    user_has_helped: false
  }
]

// Map reviews to templates
const templateReviews: Record<string, string[]> = {
  '1': ['review-1'], // Email Notification
  '101': ['review-2'], // Multi-Channel Inventory
  '102': [], // Customer Segmentation (no reviews yet)
  '103': ['review-3'], // Lead Scoring AI
  '104': [], // Campaign Manager (no reviews yet) 
  '105': ['review-4'] // Multi-Cloud Deployment
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const templateId = searchParams.get('templateId')
    const limit = searchParams.get('limit')

    if (!templateId) {
      return NextResponse.json({
        success: false,
        error: 'Template ID is required'
      }, { status: 400 })
    }

    // Get reviews for this template
    const reviewIds = templateReviews[templateId] || []
    let reviews = mockReviews.filter(review => reviewIds.includes(review.id))

    // Sort by most recent first
    reviews = reviews.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    // Apply limit if specified
    if (limit) {
      const limitNum = parseInt(limit)
      if (!isNaN(limitNum) && limitNum > 0) {
        reviews = reviews.slice(0, limitNum)
      }
    }

    return NextResponse.json({
      success: true,
      data: reviews,
      meta: {
        total: reviews.length,
        average_rating: reviews.length > 0 
          ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
          : 0
      }
    })

  } catch (error) {
    console.error('Template reviews API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch reviews'
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication (mock for now)
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 })
    }

    const body = await request.json()
    const { templateId, rating, comment } = body

    // Validation
    if (!templateId) {
      return NextResponse.json({
        success: false,
        error: 'Template ID is required'
      }, { status: 400 })
    }

    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json({
        success: false,
        error: 'Rating must be between 1 and 5'
      }, { status: 400 })
    }

    // Create new review (mock)
    const newReview = {
      id: `review-${Date.now()}`,
      user_id: 'current-user',
      rating,
      comment: comment || null,
      helpful_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      user_name: 'Current User',
      user_email: 'current.user@example.com',
      user_has_helped: false
    }

    // Add to mock data (in production, this would save to database)
    mockReviews.unshift(newReview)
    
    // Add to template mapping
    if (!templateReviews[templateId]) {
      templateReviews[templateId] = []
    }
    templateReviews[templateId].unshift(newReview.id)

    return NextResponse.json({
      success: true,
      data: {
        review: newReview,
        message: 'Review submitted successfully'
      }
    })

  } catch (error) {
    console.error('Create review API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to create review'
    }, { status: 500 })
  }
}