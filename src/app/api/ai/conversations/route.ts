import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

// const supabase = createClient() // Moved inside handlers

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    // Get auth token from headers
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authorization token required' },
        { status: 401 }
      )
    }

    const token = authHeader.replace('Bearer ', '')

    // Verify token with Supabase
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      )
    }

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const tenantId = searchParams.get('tenantId')
    const type = searchParams.get('type')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Build query
    let query = supabase
      .from('ai_conversations')
      .select(`
        id,
        type,
        messages,
        metadata,
        created_at,
        updated_at
      `)
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // Filter by tenant if provided
    if (tenantId) {
      // Verify tenant access first
      const { data: tenant, error: tenantError } = await supabase
        .from('tenants')
        .select('id')
        .eq('id', tenantId)
        .or(`owner_user_id.eq.${user.id},id.in.(select tenant_id from tenant_members where user_id = '${user.id}')`)
        .single()

      if (tenantError || !tenant) {
        return NextResponse.json(
          { error: 'Access denied to tenant' },
          { status: 403 }
        )
      }

      query = query.eq('tenant_id', tenantId)
    } else {
      // Get all tenants user has access to
      const { data: userTenants } = await supabase
        .from('tenants')
        .select('id')
        .or(`owner_user_id.eq.${user.id},id.in.(select tenant_id from tenant_members where user_id = '${user.id}')`)

      if (userTenants && userTenants.length > 0) {
        const tenantIds = userTenants.map(t => t.id)
        query = query.in('tenant_id', tenantIds)
      }
    }

    // Filter by type if provided
    if (type && ['generate', 'debug', 'optimize', 'chat'].includes(type)) {
      query = query.eq('type', type)
    }

    const { data: conversations, error } = await query

    if (error) {
      throw error
    }

    // Transform conversations for frontend
    const transformedConversations = conversations?.map(conv => {
      const messages = conv.messages || []
      const firstUserMessage = messages.find((m: any) => m.role === 'user')
      const lastMessage = messages[messages.length - 1]

      // Generate title from first user message
      const title = firstUserMessage?.content 
        ? (firstUserMessage.content.length > 50 
          ? firstUserMessage.content.substring(0, 47) + '...'
          : firstUserMessage.content)
        : `${conv.type} conversation`

      // Generate preview from last assistant message
      const preview = messages
        .filter((m: any) => m.role === 'assistant')
        .pop()?.content?.substring(0, 100) + '...' || 'No response yet'

      return {
        id: conv.id,
        type: conv.type,
        title,
        preview,
        messagesCount: messages.length,
        createdAt: conv.created_at,
        updatedAt: conv.updated_at,
        metadata: {
          ...conv.metadata,
          rating: conv.metadata?.rating,
          workflowsGenerated: conv.type === 'generate' ? 1 : 0,
          errorsAnalyzed: conv.type === 'debug' ? 1 : 0,
          optimizationsSuggested: conv.type === 'optimize' ? 1 : 0
        }
      }
    }) || []

    return NextResponse.json({
      success: true,
      conversations: transformedConversations,
      pagination: {
        limit,
        offset,
        total: transformedConversations.length,
        hasMore: transformedConversations.length === limit
      }
    })

  } catch (error: any) {
    console.error('Get Conversations API Error:', error)
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
      },
      { status: 500 }
    )
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}