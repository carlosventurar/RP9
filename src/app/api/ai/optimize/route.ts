import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Request schema
const optimizeSchema = z.object({
  workflowId: z.string().min(1),
  tenantId: z.string().uuid(),
  workflowData: z.any(),
  executionHistory: z.array(z.object({
    executionId: z.string(),
    duration: z.number().min(0),
    status: z.string(),
    timestamp: z.string(),
    nodeStats: z.record(z.any()).optional()
  })).optional()
})

export async function POST(request: NextRequest) {
  try {
    // Parse and validate request
    const body = await request.json()
    const { workflowId, tenantId, workflowData, executionHistory } = optimizeSchema.parse(body)

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

    // Check plan features
    const planFeatures = {
      starter: { profiler: false, autoOptimize: false },
      pro: { profiler: true, autoOptimize: false },
      enterprise: { profiler: true, autoOptimize: true }
    }

    const features = planFeatures[tenant.plan as keyof typeof planFeatures] || planFeatures.starter
    
    if (!features.profiler) {
      return NextResponse.json({
        error: 'Feature not available',
        message: 'Workflow optimization is not available in your plan',
        upgradeRequired: true
      }, { status: 403 })
    }

    // Check for recent optimization to avoid duplicates
    const { data: recentOptimization } = await supabase
      .from('workflow_optimizations')
      .select('id, optimization_analysis, created_at')
      .eq('tenant_id', tenantId)
      .eq('workflow_id', workflowId)
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Within 24 hours
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (recentOptimization) {
      return NextResponse.json({
        success: true,
        cached: true,
        workflowId,
        analysis: recentOptimization.optimization_analysis,
        message: 'Recent optimization analysis retrieved from cache',
        createdAt: recentOptimization.created_at
      })
    }

    // Check AI flags
    const { data: aiFlags } = await supabase
      .from('ai_flags')
      .select('profiler_enabled')
      .eq('tenant_id', tenantId)
      .single()

    if (aiFlags && !aiFlags.profiler_enabled) {
      return NextResponse.json({
        error: 'Feature disabled',
        message: 'Workflow profiler is disabled for your tenant'
      }, { status: 403 })
    }

    // Forward request to AI service
    const aiServiceUrl = process.env.AI_BACKEND_URL || 'http://localhost:8090'
    
    const aiResponse = await fetch(`${aiServiceUrl}/ai/optimize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'X-Forwarded-For': request.headers.get('x-forwarded-for') || '',
        'User-Agent': request.headers.get('user-agent') || ''
      },
      body: JSON.stringify({
        workflowId,
        tenantId,
        userId: user.id,
        workflowData,
        executionHistory,
        context: {
          plan: tenant.plan,
          features,
          source: 'portal'
        }
      })
    })

    if (!aiResponse.ok) {
      const error = await aiResponse.json().catch(() => ({}))
      return NextResponse.json(
        { 
          error: 'AI service error',
          message: error.message || 'Failed to optimize workflow'
        },
        { status: aiResponse.status }
      )
    }

    const data = await aiResponse.json()
    
    // Add feature flags and recommendations to response
    return NextResponse.json({
      ...data,
      features: {
        autoOptimizeAvailable: features.autoOptimize,
        canApplyOptimizations: features.autoOptimize && data.analysis?.suggestions?.some((s: any) => s.implementation?.difficulty === 'easy')
      },
      recommendations: {
        shouldUpgrade: !features.autoOptimize && data.analysis?.suggestions?.length > 2,
        nextSteps: features.autoOptimize 
          ? ['Review suggestions', 'Apply automatic optimizations', 'Test changes']
          : ['Review suggestions', 'Apply changes manually', 'Consider upgrading for auto-optimization']
      }
    })

  } catch (error: any) {
    console.error('Optimize Workflow API Error:', error)
    
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