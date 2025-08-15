import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

// const supabase = createClient() // Moved inside handlers

// Request schema
const chatRequestSchema = z.object({
  message: z.string().min(1).max(2000),
  tenantId: z.string().uuid(),
  conversationId: z.string().uuid().optional(),
  context: z.record(z.any()).optional()
})

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    // Parse and validate request
    const body = await request.json()
    const { message, tenantId, conversationId, context } = chatRequestSchema.parse(body)

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

    // Check tenant access
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id, plan')
      .eq('id', tenantId)
      .or(`owner_user_id.eq.${user.id},id.in.(select tenant_id from tenant_members where user_id = '${user.id}')`)
      .single()

    if (tenantError || !tenant) {
      return NextResponse.json(
        { error: 'Access denied to tenant' },
        { status: 403 }
      )
    }

    // Forward request to AI service
    const aiServiceUrl = process.env.AI_BACKEND_URL || 'http://localhost:8090'
    
    const aiResponse = await fetch(`${aiServiceUrl}/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'X-Forwarded-For': request.headers.get('x-forwarded-for') || '',
        'User-Agent': request.headers.get('user-agent') || ''
      },
      body: JSON.stringify({
        tenantId,
        userId: user.id,
        messages: [
          {
            role: 'user',
            content: message,
            timestamp: new Date().toISOString()
          }
        ],
        context: {
          ...context,
          conversationId,
          source: 'portal'
        }
      })
    })

    if (!aiResponse.ok) {
      const error = await aiResponse.json().catch(() => ({}))
      return NextResponse.json(
        { 
          error: 'AI service error',
          message: error.message || 'Failed to process request'
        },
        { status: aiResponse.status }
      )
    }

    const data = await aiResponse.json()
    return NextResponse.json(data)

  } catch (error: any) {
    console.error('AI Chat API Error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Validation error',
          details: error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
        },
        { status: 400 }
      )
    }

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
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}