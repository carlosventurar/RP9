import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Request schema
const generateWorkflowSchema = z.object({
  prompt: z.string().min(10).max(2000),
  tenantId: z.string().uuid(),
  context: z.object({
    existingWorkflows: z.array(z.string()).optional(),
    integrations: z.array(z.string()).optional(),
    complexity: z.enum(['simple', 'medium', 'complex']).optional()
  }).optional()
})

export async function POST(request: NextRequest) {
  try {
    // Parse and validate request
    const body = await request.json()
    const { prompt, tenantId, context } = generateWorkflowSchema.parse(body)

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

    // Check plan limits for workflow generation
    const planLimits = {
      starter: { aiGenerationsPerMonth: 10 },
      pro: { aiGenerationsPerMonth: 100 },
      enterprise: { aiGenerationsPerMonth: -1 } // unlimited
    }

    const currentLimit = planLimits[tenant.plan as keyof typeof planLimits] || planLimits.starter

    if (currentLimit.aiGenerationsPerMonth > 0) {
      const startOfMonth = new Date()
      startOfMonth.setDate(1)
      startOfMonth.setHours(0, 0, 0, 0)

      const { count } = await supabase
        .from('ai_generated_workflows')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .gte('created_at', startOfMonth.toISOString())

      if (count && count >= currentLimit.aiGenerationsPerMonth) {
        return NextResponse.json({
          error: 'Monthly limit exceeded',
          message: `You have reached your monthly limit of ${currentLimit.aiGenerationsPerMonth} AI generations`,
          currentUsage: count,
          limit: currentLimit.aiGenerationsPerMonth,
          upgradeRequired: true
        }, { status: 429 })
      }
    }

    // Forward request to AI service
    const aiServiceUrl = process.env.AI_BACKEND_URL || 'http://localhost:8090'
    
    const aiResponse = await fetch(`${aiServiceUrl}/ai/generate-workflow`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'X-Forwarded-For': request.headers.get('x-forwarded-for') || '',
        'User-Agent': request.headers.get('user-agent') || ''
      },
      body: JSON.stringify({
        prompt,
        tenantId,
        userId: user.id,
        context: {
          ...context,
          plan: tenant.plan,
          source: 'portal'
        }
      })
    })

    if (!aiResponse.ok) {
      const error = await aiResponse.json().catch(() => ({}))
      return NextResponse.json(
        { 
          error: 'AI service error',
          message: error.message || 'Failed to generate workflow'
        },
        { status: aiResponse.status }
      )
    }

    const data = await aiResponse.json()
    
    // Add additional metadata for frontend
    return NextResponse.json({
      ...data,
      metadata: {
        ...data.metadata,
        remainingGenerations: currentLimit.aiGenerationsPerMonth === -1 
          ? 'unlimited' 
          : currentLimit.aiGenerationsPerMonth - ((count || 0) + 1),
        planLimits: currentLimit
      }
    })

  } catch (error: any) {
    console.error('Generate Workflow API Error:', error)
    
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