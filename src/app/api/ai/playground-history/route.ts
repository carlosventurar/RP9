import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    if (!tenantId) {
      return NextResponse.json(
        { error: 'tenantId parameter required' },
        { status: 400 }
      )
    }

    // Check tenant access
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

    // Get playground execution history from AI usage logs
    const { data: usageHistory, error } = await supabase
      .from('ai_usage')
      .select(`
        id,
        action,
        provider,
        model,
        prompt_tokens,
        completion_tokens,
        total_tokens,
        cost_usd,
        metadata,
        created_at
      `)
      .eq('tenant_id', tenantId)
      .eq('user_id', user.id)
      .eq('action', 'playground')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      throw error
    }

    // Get conversation history for more detailed prompt/response data
    const { data: conversations, error: convError } = await supabase
      .from('ai_conversations')
      .select(`
        id,
        type,
        messages,
        metadata,
        created_at
      `)
      .eq('tenant_id', tenantId)
      .eq('user_id', user.id)
      .eq('type', 'playground')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // Transform and merge data
    const executions = []

    // Add usage history as executions
    if (usageHistory) {
      for (const usage of usageHistory) {
        // Try to find corresponding conversation
        const conversation = conversations?.find(conv => 
          Math.abs(new Date(conv.created_at).getTime() - new Date(usage.created_at).getTime()) < 60000 // Within 1 minute
        )

        const messages = conversation?.messages || []
        const userMessage = messages.find((m: any) => m.role === 'user')
        const assistantMessage = messages.find((m: any) => m.role === 'assistant')

        executions.push({
          id: usage.id,
          templateId: usage.metadata?.templateId,
          prompt: userMessage?.content || 'Unknown prompt',
          variables: usage.metadata?.variables || {},
          response: assistantMessage?.content || 'No response recorded',
          provider: usage.provider,
          model: usage.model,
          tokensUsed: usage.total_tokens || 0,
          costUsd: usage.cost_usd || 0,
          executionTime: usage.metadata?.executionTime || 0,
          timestamp: usage.created_at,
          status: assistantMessage ? 'success' : 'error',
          error: !assistantMessage ? 'No response recorded' : undefined
        })
      }
    }

    // Add conversations without corresponding usage (fallback)
    if (conversations) {
      for (const conv of conversations) {
        const hasUsageRecord = usageHistory?.some(usage => 
          Math.abs(new Date(conv.created_at).getTime() - new Date(usage.created_at).getTime()) < 60000
        )

        if (!hasUsageRecord) {
          const messages = conv.messages || []
          const userMessage = messages.find((m: any) => m.role === 'user')
          const assistantMessage = messages.find((m: any) => m.role === 'assistant')

          executions.push({
            id: conv.id,
            templateId: conv.metadata?.templateId,
            prompt: userMessage?.content || 'Unknown prompt',
            variables: conv.metadata?.variables || {},
            response: assistantMessage?.content || 'No response',
            provider: conv.metadata?.provider || 'unknown',
            model: conv.metadata?.model || 'unknown',
            tokensUsed: conv.metadata?.tokensUsed || 0,
            costUsd: conv.metadata?.costUsd || 0,
            executionTime: conv.metadata?.executionTime || 0,
            timestamp: conv.created_at,
            status: assistantMessage ? 'success' : 'error',
            error: !assistantMessage ? 'No response' : undefined
          })
        }
      }
    }

    // Sort by timestamp (most recent first)
    executions.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    return NextResponse.json({
      success: true,
      executions: executions.slice(0, limit),
      pagination: {
        limit,
        offset,
        total: executions.length,
        hasMore: executions.length === limit
      }
    })

  } catch (error: any) {
    console.error('Get Playground History API Error:', error)
    
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