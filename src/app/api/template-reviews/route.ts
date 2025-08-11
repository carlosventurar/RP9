import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient(await cookies())
    const { searchParams } = new URL(request.url)
    const templateId = searchParams.get('templateId') || searchParams.get('template_id')
    const limit = parseInt(searchParams.get('limit') || '10')
    const offset = parseInt(searchParams.get('offset') || '0')

    let query = supabase
      .from('template_reviews')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (templateId) {
      query = query.eq('template_id', templateId)
    }

    const { data: reviews, error } = await query

    if (error) {
      console.error('Error fetching reviews:', error)
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch reviews'
      }, { status: 500 })
    }

    // Calculate average rating
    const averageRating = reviews && reviews.length > 0 
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : 0

    return NextResponse.json({
      success: true,
      data: reviews || [],
      meta: {
        total: reviews?.length || 0,
        average_rating: Number(averageRating.toFixed(2))
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
    const { templateId, template_id, rating, comment } = body
    const finalTemplateId = templateId || template_id

    // Validation
    if (!finalTemplateId) {
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

    // Check if user already reviewed this template
    const { data: existingReview } = await supabase
      .from('template_reviews')
      .select('id')
      .eq('template_id', finalTemplateId)
      .eq('user_id', user.id)
      .single()

    if (existingReview) {
      return NextResponse.json({
        success: false,
        error: 'You have already reviewed this template'
      }, { status: 409 })
    }

    // Insert the review
    const { data: newReview, error } = await supabase
      .from('template_reviews')
      .insert({
        template_id: finalTemplateId,
        user_id: user.id,
        rating,
        comment: comment || null
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating review:', error)
      return NextResponse.json({
        success: false,
        error: 'Failed to create review'
      }, { status: 500 })
    }

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

export async function PUT(request: NextRequest) {
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
    const { id, rating, comment } = body

    // Validation
    if (!id || !rating || rating < 1 || rating > 5) {
      return NextResponse.json({
        success: false,
        error: 'Invalid input data'
      }, { status: 400 })
    }

    // Update the review (RLS will ensure user can only update their own)
    const { data, error } = await supabase
      .from('template_reviews')
      .update({
        rating,
        comment: comment || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      console.error('Error updating review:', error)
      return NextResponse.json({
        success: false,
        error: 'Failed to update review'
      }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({
        success: false,
        error: 'Review not found or not authorized'
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: { review: data }
    })
  } catch (error) {
    console.error('Template reviews PUT API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
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

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'Review ID is required'
      }, { status: 400 })
    }

    // Delete the review (RLS will ensure user can only delete their own)
    const { error } = await supabase
      .from('template_reviews')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      console.error('Error deleting review:', error)
      return NextResponse.json({
        success: false,
        error: 'Failed to delete review'
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: { message: 'Review deleted successfully' }
    })
  } catch (error) {
    console.error('Template reviews DELETE API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}