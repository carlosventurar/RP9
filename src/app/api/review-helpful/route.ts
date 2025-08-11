import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient(await cookies())
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 })
    }

    const body = await request.json()
    const { reviewId, review_id, isHelpful, is_helpful } = body
    const finalReviewId = reviewId || review_id
    const finalIsHelpful = isHelpful !== undefined ? isHelpful : is_helpful

    // Validation
    if (!finalReviewId) {
      return NextResponse.json({
        success: false,
        error: 'Review ID is required'
      }, { status: 400 })
    }

    if (typeof finalIsHelpful !== 'boolean') {
      return NextResponse.json({
        success: false,
        error: 'isHelpful must be a boolean'
      }, { status: 400 })
    }

    // Check if user already voted on this review
    const { data: existingVote } = await supabase
      .from('review_helpful_votes')
      .select('*')
      .eq('review_id', finalReviewId)
      .eq('user_id', user.id)
      .single()

    if (existingVote) {
      // Update existing vote
      const { error: updateError } = await supabase
        .from('review_helpful_votes')
        .update({ is_helpful: finalIsHelpful })
        .eq('id', existingVote.id)

      if (updateError) {
        console.error('Error updating helpful vote:', updateError)
        return NextResponse.json({
          success: false,
          error: 'Failed to update vote'
        }, { status: 500 })
      }
    } else {
      // Insert new vote
      const { error: insertError } = await supabase
        .from('review_helpful_votes')
        .insert({
          review_id: finalReviewId,
          user_id: user.id,
          is_helpful: finalIsHelpful
        })

      if (insertError) {
        console.error('Error creating helpful vote:', insertError)
        return NextResponse.json({
          success: false,
          error: 'Failed to create vote'
        }, { status: 500 })
      }
    }

    // Get updated helpful count
    const { count: helpfulCount } = await supabase
      .from('review_helpful_votes')
      .select('*', { count: 'exact', head: true })
      .eq('review_id', finalReviewId)
      .eq('is_helpful', true)

    return NextResponse.json({
      success: true,
      data: {
        review_id: finalReviewId,
        helpful_count: helpfulCount || 0,
        user_voted: true,
        message: finalIsHelpful ? 'Marked as helpful' : 'Removed helpful vote'
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
    const supabase = await createClient(await cookies())
    const { searchParams } = new URL(request.url)
    const reviewId = searchParams.get('reviewId') || searchParams.get('review_id')

    if (!reviewId) {
      return NextResponse.json({
        success: false,
        error: 'Review ID is required'
      }, { status: 400 })
    }

    // Get helpful count
    const { count: helpfulCount } = await supabase
      .from('review_helpful_votes')
      .select('*', { count: 'exact', head: true })
      .eq('review_id', reviewId)
      .eq('is_helpful', true)

    // Check if current user has voted (if authenticated)
    let userVoted = false
    const { data: { user } } = await supabase.auth.getUser()
    
    if (user) {
      const { data: userVote } = await supabase
        .from('review_helpful_votes')
        .select('is_helpful')
        .eq('review_id', reviewId)
        .eq('user_id', user.id)
        .single()

      userVoted = !!userVote?.is_helpful
    }

    return NextResponse.json({
      success: true,
      data: {
        review_id: reviewId,
        helpful_count: helpfulCount || 0,
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