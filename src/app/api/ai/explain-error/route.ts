import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Request schema
const explainErrorSchema = z.object({
  executionId: z.string().min(1),
  workflowId: z.string().min(1),
  tenantId: z.string().uuid(),
  errorLogs: z.array(z.any()).min(1),
  workflowData: z.any().optional()
})

export async function POST(request: NextRequest) {
  try {
    // Parse and validate request
    const body = await request.json()
    const { executionId, workflowId, tenantId, errorLogs, workflowData } = explainErrorSchema.parse(body)

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

    // Check if error analysis is available for this plan
    const planFeatures = {
      starter: { errorAnalysis: true, autoFix: false },
      pro: { errorAnalysis: true, autoFix: true },
      enterprise: { errorAnalysis: true, autoFix: true }
    }

    const features = planFeatures[tenant.plan as keyof typeof planFeatures] || planFeatures.starter
    
    if (!features.errorAnalysis) {
      return NextResponse.json({
        error: 'Feature not available',
        message: 'Error analysis is not available in your plan',
        upgradeRequired: true
      }, { status: 403 })
    }

    // Check for existing analysis to avoid duplicates
    const { data: existingAnalysis } = await supabase
      .from('execution_errors')
      .select('id, analysis')
      .eq('tenant_id', tenantId)
      .eq('execution_id', executionId)
      .single()

    if (existingAnalysis) {
      return NextResponse.json({
        success: true,
        cached: true,
        analysis: existingAnalysis.analysis,
        executionId,
        workflowId,
        message: 'Analysis retrieved from cache'
      })
    }

    // Forward request to AI service
    const aiServiceUrl = process.env.AI_BACKEND_URL || 'http://localhost:8090'
    
    const aiResponse = await fetch(`${aiServiceUrl}/ai/explain-error`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'X-Forwarded-For': request.headers.get('x-forwarded-for') || '',
        'User-Agent': request.headers.get('user-agent') || ''
      },
      body: JSON.stringify({
        executionId,
        workflowId,
        tenantId,
        userId: user.id,
        errorLogs,
        workflowData,
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
          message: error.message || 'Failed to analyze error'
        },
        { status: aiResponse.status }
      )
    }

    const data = await aiResponse.json()
    
    // Add feature flags to response
    return NextResponse.json({
      ...data,
      features: {
        autoFixAvailable: features.autoFix,
        canApplyFixes: features.autoFix && data.analysis?.suggestedFixes?.some((fix: any) => fix.autoApplicable)
      }
    })

  } catch (error: any) {
    console.error('Explain Error API Error:', error)
    
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