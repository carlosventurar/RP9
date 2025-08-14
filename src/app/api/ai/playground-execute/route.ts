import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const executeSchema = z.object({
  tenantId: z.string().uuid(),
  prompt: z.string().min(1),
  variables: z.record(z.string()).optional(),
  model: z.string().optional().default('gpt-4'),
  templateId: z.string().optional()
})

export async function POST(request: NextRequest) {
  try {
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

    // Parse and validate request body
    const body = await request.json()
    const validatedData = executeSchema.parse(body)

    // Check tenant access
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id, plan')
      .eq('id', validatedData.tenantId)
      .or(`owner_user_id.eq.${user.id},id.in.(select tenant_id from tenant_members where user_id = '${user.id}')`)
      .single()

    if (tenantError || !tenant) {
      return NextResponse.json(
        { error: 'Access denied to tenant' },
        { status: 403 }
      )
    }

    // Check budget before execution
    const { data: budget } = await supabase
      .from('ai_budgets')
      .select('monthly_usd, spent_usd, hard_limit_behavior')
      .eq('tenant_id', validatedData.tenantId)
      .single()

    const monthlyLimit = budget?.monthly_usd || 20
    const spentThisMonth = budget?.spent_usd || 0
    const remainingBudget = monthlyLimit - spentThisMonth

    if (remainingBudget <= 0 && budget?.hard_limit_behavior === 'block') {
      return NextResponse.json(
        { error: 'Budget limit exceeded' },
        { status: 402 }
      )
    }

    // Forward request to AI service if available
    const aiServiceUrl = process.env.AI_BACKEND_URL
    
    if (aiServiceUrl) {
      try {
        const aiResponse = await fetch(`${aiServiceUrl}/playground/execute`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            tenantId: validatedData.tenantId,
            prompt: validatedData.prompt,
            variables: validatedData.variables,
            model: validatedData.model,
            templateId: validatedData.templateId,
            userId: user.id
          })
        })

        if (aiResponse.ok) {
          const data = await aiResponse.json()
          
          // Update template usage count if templateId provided
          if (validatedData.templateId) {
            await supabase
              .from('ai_prompt_templates')
              .update({ 
                usage_count: supabase.raw('usage_count + 1'),
                updated_at: new Date().toISOString()
              })
              .eq('id', validatedData.templateId)
          }

          return NextResponse.json(data)
        }
      } catch (error) {
        console.warn('AI service unavailable, using fallback:', error)
      }
    }

    // Fallback implementation using OpenAI directly
    const openaiApiKey = process.env.OPENAI_API_KEY
    if (!openaiApiKey) {
      return NextResponse.json(
        { error: 'AI service not configured' },
        { status: 503 }
      )
    }

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`
      },
      body: JSON.stringify({
        model: validatedData.model,
        messages: [
          {
            role: 'user',
            content: validatedData.prompt
          }
        ],
        max_tokens: 1500,
        temperature: 0.7
      })
    })

    if (!openaiResponse.ok) {
      const error = await openaiResponse.json()
      throw new Error(error.error?.message || 'OpenAI API error')
    }

    const openaiData = await openaiResponse.json()
    const response = openaiData.choices[0]?.message?.content || 'No response'
    const tokensUsed = openaiData.usage?.total_tokens || 0
    
    // Estimate cost (rough approximation)
    const costPerToken = validatedData.model.includes('gpt-4') ? 0.00003 : 0.000002
    const costUsd = tokensUsed * costPerToken

    // Log usage to database
    await supabase
      .from('ai_usage')
      .insert({
        tenant_id: validatedData.tenantId,
        user_id: user.id,
        action: 'playground',
        provider: 'openai',
        model: validatedData.model,
        prompt_tokens: openaiData.usage?.prompt_tokens || 0,
        completion_tokens: openaiData.usage?.completion_tokens || 0,
        total_tokens: tokensUsed,
        cost_usd: costUsd,
        metadata: {
          templateId: validatedData.templateId,
          variables: validatedData.variables
        }
      })

    // Update budget
    if (budget) {
      await supabase
        .from('ai_budgets')
        .update({ 
          spent_usd: spentThisMonth + costUsd 
        })
        .eq('tenant_id', validatedData.tenantId)
    }

    // Update template usage count if templateId provided
    if (validatedData.templateId) {
      await supabase
        .from('ai_prompt_templates')
        .update({ 
          usage_count: supabase.raw('usage_count + 1'),
          updated_at: new Date().toISOString()
        })
        .eq('id', validatedData.templateId)
    }

    return NextResponse.json({
      success: true,
      response,
      tokensUsed,
      costUsd,
      provider: 'openai',
      model: validatedData.model,
      executionTime: Date.now()
    })

  } catch (error: any) {
    console.error('Playground Execute API Error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Validation error',
          details: error.errors
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