import { NextRequest, NextResponse } from 'next/server'

// Mock data for helpful votes
const mockHelpfulVotes: Record<string, { userId: string; isHelpful: boolean }[]> = {
  'review-1': [
    { userId: 'user-a', isHelpful: true },
    { userId: 'user-b', isHelpful: true },
    { userId: 'user-c', isHelpful: true },
    { userId: 'user-d', isHelpful: true },
    { userId: 'user-e', isHelpful: true },
    { userId: 'user-f', isHelpful: true },
    { userId: 'user-g', isHelpful: true },
    { userId: 'user-h', isHelpful: true }
  ],
  'review-2': [
    { userId: 'user-x', isHelpful: true },
    { userId: 'user-y', isHelpful: true },
    { userId: 'user-z', isHelpful: true },
    { userId: 'current-user', isHelpful: true },
    { userId: 'user-w', isHelpful: true }
  ],
  'review-3': [
    { userId: 'user-1', isHelpful: true },
    { userId: 'user-2', isHelpful: true },
    { userId: 'user-3', isHelpful: true },
    { userId: 'user-4', isHelpful: true },
    { userId: 'user-5', isHelpful: true },
    { userId: 'user-6', isHelpful: true },
    { userId: 'user-7', isHelpful: true },
    { userId: 'user-8', isHelpful: true },
    { userId: 'user-9', isHelpful: true },
    { userId: 'user-10', isHelpful: true },
    { userId: 'user-11', isHelpful: true },
    { userId: 'user-12', isHelpful: true }
  ],
  'review-4': [
    { userId: 'user-m', isHelpful: true },
    { userId: 'user-n', isHelpful: true },
    { userId: 'user-o', isHelpful: true }
  ]
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
    const { reviewId, isHelpful } = body

    // Validation
    if (!reviewId) {
      return NextResponse.json({
        success: false,
        error: 'Review ID is required'
      }, { status: 400 })
    }

    if (typeof isHelpful !== 'boolean') {
      return NextResponse.json({
        success: false,
        error: 'isHelpful must be a boolean'
      }, { status: 400 })
    }

    const currentUserId = 'current-user' // In production, extract from JWT token

    // Initialize votes array if doesn't exist
    if (!mockHelpfulVotes[reviewId]) {
      mockHelpfulVotes[reviewId] = []
    }

    const votes = mockHelpfulVotes[reviewId]
    const existingVoteIndex = votes.findIndex(vote => vote.userId === currentUserId)

    if (existingVoteIndex >= 0) {
      // Update existing vote
      votes[existingVoteIndex].isHelpful = isHelpful
    } else {
      // Add new vote
      votes.push({ userId: currentUserId, isHelpful })
    }

    // Calculate helpful count (only count true votes)
    const helpfulCount = votes.filter(vote => vote.isHelpful).length
    const userVoted = votes.some(vote => vote.userId === currentUserId)

    return NextResponse.json({
      success: true,
      data: {
        review_id: reviewId,
        helpful_count: helpfulCount,
        user_voted: userVoted,
        message: isHelpful ? 'Marked as helpful' : 'Removed helpful vote'
      }
    })

  } catch (error) {
    console.error('Review helpful API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to update helpfulness'
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const reviewId = searchParams.get('reviewId')

    if (!reviewId) {
      return NextResponse.json({
        success: false,
        error: 'Review ID is required'
      }, { status: 400 })
    }

    const votes = mockHelpfulVotes[reviewId] || []
    const helpfulCount = votes.filter(vote => vote.isHelpful).length
    
    // Check if current user has voted (requires auth)
    const authHeader = request.headers.get('authorization')
    let userVoted = false
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const currentUserId = 'current-user' // Extract from JWT in production
      userVoted = votes.some(vote => vote.userId === currentUserId)
    }

    return NextResponse.json({
      success: true,
      data: {
        review_id: reviewId,
        helpful_count: helpfulCount,
        user_voted: userVoted
      }
    })

  } catch (error) {
    console.error('Get review helpful API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to get helpfulness data'
    }, { status: 500 })
  }
}