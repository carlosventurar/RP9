import { Handler, HandlerEvent } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import { rateLimitByTenant, RATE_LIMIT_CONFIGS, getRateLimitHeaders } from '../../src/lib/security/rate-limit'

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = supabaseUrl && supabaseServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null

interface ContactCenterKPIs {
  period: string
  totalCalls: number
  answeredCalls: number
  abandonedCalls: number
  transferredCalls: number
  avgHandleTime: number // seconds
  p95HandleTime: number // seconds
  avgCSAT: number | null
  csatResponseRate: number
  errorRate: number
  topAgents: Array<{
    agentId: string
    agentName: string
    callCount: number
    avgHandleTime: number
    avgCSAT: number | null
  }>
  hourlyDistribution: Array<{
    hour: number
    callCount: number
    avgHandleTime: number
  }>
  statusBreakdown: {
    completed: number
    abandoned: number
    transferred: number
    error: number
  }
}

export const handler: Handler = async (event: HandlerEvent) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
  }

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' }
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    }
  }

  try {
    if (!supabase) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Service configuration error' })
      }
    }

    // Get user from JWT token
    const authHeader = event.headers.authorization || event.headers.Authorization
    if (!authHeader) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Authorization required' })
      }
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Invalid token' })
      }
    }

    // Get tenant for user
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id, name')
      .eq('owner_user_id', user.id)
      .single()

    if (tenantError || !tenant) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Tenant not found' })
      }
    }

    // Rate limiting by tenant
    const rateLimitResult = rateLimitByTenant(tenant.id, RATE_LIMIT_CONFIGS.NORMAL)
    
    if (!rateLimitResult.allowed) {
      return {
        statusCode: 429,
        headers: { ...headers, ...getRateLimitHeaders(rateLimitResult) },
        body: JSON.stringify({ 
          error: 'Rate limit exceeded',
          remaining: rateLimitResult.remaining 
        })
      }
    }

    // Parse query parameters
    const queryParams = event.queryStringParameters || {}
    const period = queryParams.period || '7d' // 7d, 30d, 90d
    const includeHourly = queryParams.hourly === 'true'

    console.log(`Fetching CC KPIs for tenant ${tenant.id}, period: ${period}`)

    // Calculate date range
    const endDate = new Date()
    const startDate = new Date()
    
    switch (period) {
      case '24h':
        startDate.setHours(startDate.getHours() - 24)
        break
      case '7d':
        startDate.setDate(startDate.getDate() - 7)
        break
      case '30d':
        startDate.setDate(startDate.getDate() - 30)
        break
      case '90d':
        startDate.setDate(startDate.getDate() - 90)
        break
      default:
        startDate.setDate(startDate.getDate() - 7)
    }

    // Fetch basic metrics
    const kpis = await calculateContactCenterKPIs(tenant.id, startDate, endDate, includeHourly)

    return {
      statusCode: 200,
      headers: { ...headers, ...getRateLimitHeaders(rateLimitResult) },
      body: JSON.stringify({
        success: true,
        data: kpis,
        tenant: tenant.id,
        period,
        dateRange: {
          start: startDate.toISOString(),
          end: endDate.toISOString()
        }
      })
    }

  } catch (error) {
    console.error('CC KPI error:', error)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
}

async function calculateContactCenterKPIs(
  tenantId: string, 
  startDate: Date, 
  endDate: Date,
  includeHourly: boolean = false
): Promise<ContactCenterKPIs> {
  
  if (!supabase) {
    throw new Error('Supabase not initialized')
  }

  // Base query for call events in period
  const { data: events, error: eventsError } = await supabase
    .from('events_cc')
    .select(`
      id,
      payload,
      occurred_at,
      tickets (
        id,
        csat_score,
        csat_responded_at
      )
    `)
    .eq('tenant_id', tenantId)
    .eq('type', 'call.ended')
    .gte('occurred_at', startDate.toISOString())
    .lte('occurred_at', endDate.toISOString())

  if (eventsError) {
    console.error('Error fetching CC events:', eventsError)
    throw new Error('Failed to fetch contact center events')
  }

  const callEvents = events || []
  
  // Calculate basic metrics
  const totalCalls = callEvents.length
  let answeredCalls = 0
  let abandonedCalls = 0
  let transferredCalls = 0
  let errorCalls = 0
  let totalHandleTime = 0
  let handleTimes: number[] = []
  let csatScores: number[] = []
  let csatResponses = 0

  const agentStats = new Map<string, {
    agentId: string
    agentName: string
    calls: number
    totalHandleTime: number
    csatScores: number[]
  }>()

  const hourlyStats = new Map<number, {
    calls: number
    totalHandleTime: number
  }>()

  // Process each call event
  for (const event of callEvents) {
    const payload = event.payload as any
    const status = payload.status || 'completed'
    const startTime = payload.started_at ? new Date(payload.started_at) : null
    const endTime = payload.ended_at ? new Date(payload.ended_at) : null
    const agent = payload.agent
    const tickets = event.tickets || []

    // Count by status
    switch (status) {
      case 'completed':
        answeredCalls++
        break
      case 'abandoned':
        abandonedCalls++
        break
      case 'transferred':
        transferredCalls++
        break
      case 'error':
        errorCalls++
        break
      default:
        answeredCalls++
    }

    // Calculate handle time
    if (startTime && endTime) {
      const handleTimeSeconds = (endTime.getTime() - startTime.getTime()) / 1000
      if (handleTimeSeconds > 0 && handleTimeSeconds < 7200) { // Max 2 hours
        totalHandleTime += handleTimeSeconds
        handleTimes.push(handleTimeSeconds)

        // Agent statistics
        if (agent?.id) {
          const agentId = agent.id
          const agentName = agent.name || agentId
          
          if (!agentStats.has(agentId)) {
            agentStats.set(agentId, {
              agentId,
              agentName,
              calls: 0,
              totalHandleTime: 0,
              csatScores: []
            })
          }
          
          const agentStat = agentStats.get(agentId)!
          agentStat.calls++
          agentStat.totalHandleTime += handleTimeSeconds
        }

        // Hourly distribution
        if (includeHourly) {
          const hour = endTime.getHours()
          if (!hourlyStats.has(hour)) {
            hourlyStats.set(hour, { calls: 0, totalHandleTime: 0 })
          }
          const hourlyStat = hourlyStats.get(hour)!
          hourlyStat.calls++
          hourlyStat.totalHandleTime += handleTimeSeconds
        }
      }
    }

    // CSAT data
    for (const ticket of tickets) {
      if (ticket.csat_responded_at) {
        csatResponses++
        if (ticket.csat_score) {
          csatScores.push(ticket.csat_score)
          
          // Add to agent stats
          if (agent?.id) {
            const agentStat = agentStats.get(agent.id)
            if (agentStat) {
              agentStat.csatScores.push(ticket.csat_score)
            }
          }
        }
      }
    }
  }

  // Calculate derived metrics
  const avgHandleTime = handleTimes.length > 0 ? totalHandleTime / handleTimes.length : 0
  const p95HandleTime = handleTimes.length > 0 
    ? calculatePercentile(handleTimes, 0.95) 
    : 0
  const avgCSAT = csatScores.length > 0 
    ? csatScores.reduce((sum, score) => sum + score, 0) / csatScores.length
    : null
  const csatResponseRate = totalCalls > 0 ? (csatResponses / totalCalls) * 100 : 0
  const errorRate = totalCalls > 0 ? (errorCalls / totalCalls) * 100 : 0

  // Top agents
  const topAgents = Array.from(agentStats.entries())
    .map(([_, stats]) => ({
      agentId: stats.agentId,
      agentName: stats.agentName,
      callCount: stats.calls,
      avgHandleTime: stats.calls > 0 ? stats.totalHandleTime / stats.calls : 0,
      avgCSAT: stats.csatScores.length > 0 
        ? stats.csatScores.reduce((sum, score) => sum + score, 0) / stats.csatScores.length
        : null
    }))
    .sort((a, b) => b.callCount - a.callCount)
    .slice(0, 10)

  // Hourly distribution
  const hourlyDistribution = includeHourly
    ? Array.from({ length: 24 }, (_, hour) => {
        const stats = hourlyStats.get(hour)
        return {
          hour,
          callCount: stats?.calls || 0,
          avgHandleTime: stats ? (stats.calls > 0 ? stats.totalHandleTime / stats.calls : 0) : 0
        }
      })
    : []

  return {
    period: `${startDate.toISOString()}_${endDate.toISOString()}`,
    totalCalls,
    answeredCalls,
    abandonedCalls,
    transferredCalls,
    avgHandleTime: Math.round(avgHandleTime),
    p95HandleTime: Math.round(p95HandleTime),
    avgCSAT: avgCSAT ? Math.round(avgCSAT * 100) / 100 : null,
    csatResponseRate: Math.round(csatResponseRate * 100) / 100,
    errorRate: Math.round(errorRate * 100) / 100,
    topAgents,
    hourlyDistribution,
    statusBreakdown: {
      completed: answeredCalls,
      abandoned: abandonedCalls,
      transferred: transferredCalls,
      error: errorCalls
    }
  }
}

function calculatePercentile(values: number[], percentile: number): number {
  const sorted = values.slice().sort((a, b) => a - b)
  const index = (percentile * (sorted.length - 1))
  
  if (Math.floor(index) === index) {
    return sorted[index]
  } else {
    const lower = sorted[Math.floor(index)]
    const upper = sorted[Math.ceil(index)]
    return lower + (upper - lower) * (index - Math.floor(index))
  }
}