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

    if (!tenantId) {
      return NextResponse.json(
        { error: 'tenantId parameter required' },
        { status: 400 }
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

    // Forward request to AI service if available, otherwise use local data
    const aiServiceUrl = process.env.AI_BACKEND_URL
    
    if (aiServiceUrl) {
      try {
        const aiResponse = await fetch(`${aiServiceUrl}/usage/${tenantId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          }
        })

        if (aiResponse.ok) {
          const data = await aiResponse.json()
          return NextResponse.json(data)
        }
      } catch (error) {
        console.warn('AI service unavailable, using local data:', error)
      }
    }

    // Fallback to local database queries
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    // Get AI usage from this month
    const { data: aiUsage } = await supabase
      .from('ai_usage')
      .select('cost_usd, action, provider, created_at')
      .eq('tenant_id', tenantId)
      .gte('created_at', startOfMonth.toISOString())

    // Get budget information
    const { data: budget } = await supabase
      .from('ai_budgets')
      .select('monthly_usd, spent_usd, hard_limit_behavior')
      .eq('tenant_id', tenantId)
      .single()

    // Calculate usage statistics
    const totalCost = aiUsage?.reduce((sum, record) => sum + (record.cost_usd || 0), 0) || 0
    const requestCount = aiUsage?.length || 0

    const monthlyLimit = budget?.monthly_usd || 20 // Default $20
    const remainingBudget = monthlyLimit - totalCost
    const percentUsed = Math.round((totalCost / monthlyLimit) * 100)

    // Break down by action type
    const actionBreakdown = {
      generate: aiUsage?.filter(u => u.action === 'generate').length || 0,
      explain: aiUsage?.filter(u => u.action === 'explain').length || 0,
      optimize: aiUsage?.filter(u => u.action === 'optimize').length || 0,
      chat: aiUsage?.filter(u => u.action === 'chat').length || 0
    }

    // Break down by provider
    const providerBreakdown = {
      openai: aiUsage?.filter(u => u.provider?.includes('openai')).length || 0,
      anthropic: aiUsage?.filter(u => u.provider?.includes('anthropic')).length || 0,
      byok: aiUsage?.filter(u => u.provider?.includes('byok')).length || 0
    }

    return NextResponse.json({
      budget: {
        monthlyLimit,
        spent: totalCost,
        remaining: remainingBudget,
        percentUsed,
        limitBehavior: budget?.hard_limit_behavior || 'warn'
      },
      usage: {
        requestCount,
        totalCost,
        averageCostPerRequest: requestCount > 0 
          ? Number((totalCost / requestCount).toFixed(4))
          : 0,
        breakdown: {
          byAction: actionBreakdown,
          byProvider: providerBreakdown
        }
      },
      status: {
        canMakeRequests: remainingBudget > 0 || budget?.hard_limit_behavior === 'warn',
        warningLevel: percentUsed > 90 ? 'critical' : percentUsed > 75 ? 'high' : 'normal'
      },
      period: {
        start: startOfMonth.toISOString(),
        end: new Date().toISOString()
      }
    })

  } catch (error: any) {
    console.error('Get Usage API Error:', error)
    
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