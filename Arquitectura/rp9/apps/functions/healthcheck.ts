
import type { Handler } from '@netlify/functions'
import fetch from 'node-fetch'

export const handler: Handler = async () => {
  const checks: any = {}
  let ok = true

  try {
    const n8n = await fetch(process.env.N8N_BASE_URL!.replace(/\/$/, '') + '/api/v1/healthz', {
      headers: { 'X-N8N-API-KEY': process.env.N8N_API_KEY || '' }
    })
    checks.n8n = n8n.ok
    ok = ok && n8n.ok
  } catch { checks.n8n = false; ok = false }

  return { statusCode: ok ? 200 : 503, body: JSON.stringify({ ok, checks, ts: new Date().toISOString() }) }
}
