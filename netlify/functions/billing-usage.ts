import { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method not allowed' }
  }

  const { tenantId, startDate, endDate } = event.queryStringParameters || {}
  
  if (!tenantId) {
    return { statusCode: 400, body: 'tenant_id is required' }
  }

  try {
    // Obtener uso diario por tenant
    const { data: usageData, error } = await supabase
      .from('v_usage_daily')
      .select('*')
      .eq('tenant_id', tenantId)
      .gte('usage_date', startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .lte('usage_date', endDate || new Date().toISOString().split('T')[0])
      .order('usage_date', { ascending: true })

    if (error) {
      console.error('Error fetching usage data:', error)
      return { statusCode: 500, body: JSON.stringify({ error: 'Failed to fetch usage data' }) }
    }

    // Obtener información del plan actual
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('*, plans(*)')
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .single()

    if (subError && subError.code !== 'PGRST116') {
      console.error('Error fetching subscription:', subError)
    }

    // Calcular totales
    const totalExecutions = usageData.reduce((sum, day) => sum + (day.executions || 0), 0)
    const planLimit = subscription?.plans?.execution_limit || 1000
    const usagePercentage = planLimit > 0 ? (totalExecutions / planLimit) * 100 : 0

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        data: usageData,
        summary: {
          totalExecutions,
          planLimit,
          usagePercentage: Math.round(usagePercentage * 100) / 100,
          plan: subscription?.plans?.name || 'Starter',
          status: subscription?.status || 'free'
        }
      })
    }
  } catch (error) {
    console.error('Unexpected error:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    }
  }
}