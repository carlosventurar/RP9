import type { Handler } from '@netlify/functions'

export const handler: Handler = async () => {
  const checks: any = {}
  let ok = true

  // Check n8n instance
  try {
    const n8nUrl = process.env.N8N_BASE_URL?.replace(/\/$/, '') + '/api/v1/workflows'
    const n8nResponse = await fetch(n8nUrl, {
      headers: { 
        'X-N8N-API-KEY': process.env.N8N_API_KEY || '',
        'accept': 'application/json'
      },
      signal: AbortSignal.timeout(10000) // 10s timeout
    })
    checks.n8n = {
      status: n8nResponse.ok,
      responseTime: Date.now() - Date.now() // This would need proper timing
    }
    ok = ok && n8nResponse.ok
  } catch (error) {
    checks.n8n = { 
      status: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
    ok = false
  }

  // Check Supabase connection
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (supabaseUrl) {
      const healthResponse = await fetch(`${supabaseUrl}/rest/v1/`, {
        headers: {
          'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
          'authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`
        },
        signal: AbortSignal.timeout(5000) // 5s timeout
      })
      checks.supabase = {
        status: healthResponse.ok,
        responseTime: Date.now() - Date.now()
      }
      ok = ok && healthResponse.ok
    } else {
      checks.supabase = { status: false, error: 'SUPABASE_URL not configured' }
      ok = false
    }
  } catch (error) {
    checks.supabase = { 
      status: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
    ok = false
  }

  // System info
  const systemInfo = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'unknown',
    version: process.env.npm_package_version || '1.0.0'
  }

  return {
    statusCode: ok ? 200 : 503,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    },
    body: JSON.stringify({ 
      ok, 
      checks, 
      system: systemInfo,
      uptime: process.uptime()
    })
  }
}