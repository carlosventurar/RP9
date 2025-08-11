/**
 * User Favorites API
 * Handles user favorite templates
 * Sprint 3.1: Sistema de Template Favorites con Supabase
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient(await cookies())
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Get user's favorite templates with template details
    const { data: favorites, error } = await supabase
      .from('template_favorites')
      .select(`
        id,
        created_at,
        templates (
          id,
          name,
          description,
          category,
          price,
          is_premium,
          average_rating,
          reviews_count,
          favorites_count,
          created_at
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('Error fetching favorites:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch favorites' },
        { status: 500 }
      )
    }

    // Transform data for frontend
    const formattedFavorites = favorites?.map(fav => ({
      favorite_id: fav.id,
      favorited_at: fav.created_at,
      ...fav.templates
    })) || []

    // Get total count for pagination
    const { count: totalCount } = await supabase
      .from('template_favorites')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)

    return NextResponse.json({
      success: true,
      data: {
        favorites: formattedFavorites,
        total: totalCount || 0,
        pagination: {
          limit,
          offset,
          hasMore: (totalCount || 0) > offset + limit
        }
      }
    })
  } catch (error) {
    console.error('Favorites API error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch favorites' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient(await cookies())
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { template_id, templateId } = body
    const finalTemplateId = template_id || templateId

    // Validation
    if (!finalTemplateId) {
      return NextResponse.json(
        { success: false, error: 'Template ID is required' },
        { status: 400 }
      )
    }

    // Check if already favorited
    const { data: existingFavorite } = await supabase
      .from('template_favorites')
      .select('id')
      .eq('user_id', user.id)
      .eq('template_id', finalTemplateId)
      .single()

    if (existingFavorite) {
      return NextResponse.json(
        { success: false, error: 'Template already in favorites' },
        { status: 409 }
      )
    }

    // Verify template exists
    const { data: template } = await supabase
      .from('templates')
      .select('id, name')
      .eq('id', finalTemplateId)
      .single()

    if (!template) {
      return NextResponse.json(
        { success: false, error: 'Template not found' },
        { status: 404 }
      )
    }

    // Create new favorite
    const { data: newFavorite, error } = await supabase
      .from('template_favorites')
      .insert({
        user_id: user.id,
        template_id: finalTemplateId
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating favorite:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to add to favorites' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: { favorite: newFavorite },
      message: 'Template added to favorites'
    }, { status: 201 })

  } catch (error) {
    console.error('Add favorite error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to add favorite' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient(await cookies())
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { template_id, templateId } = body
    const finalTemplateId = template_id || templateId

    // Validation
    if (!finalTemplateId) {
      return NextResponse.json(
        { success: false, error: 'Template ID is required' },
        { status: 400 }
      )
    }

    // Delete the favorite
    const { error } = await supabase
      .from('template_favorites')
      .delete()
      .eq('user_id', user.id)
      .eq('template_id', finalTemplateId)

    if (error) {
      console.error('Error removing favorite:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to remove from favorites' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Template removed from favorites'
    })

  } catch (error) {
    console.error('Remove favorite error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to remove favorite' },
      { status: 500 }
    )
  }
}