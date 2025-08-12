import { Handler } from '@netlify/functions'
import fetch from 'node-fetch'

export const handler: Handler = async () => {
  const base = (process.env.N8N_BASE_URL || '').replace(/\/$/, '')
  const key  = process.env.N8N_API_KEY!
  if (!base || !key) return { statusCode: 500, body: 'Missing N8N envs' }

  const r = await fetch(`${base}/api/v1/executions?limit=50&includeData=false`, {
    headers: { 'X-N8N-API-KEY': key, 'accept':'application/json' }
  })
  const data = await r.json()

  // TODO: upsert en Supabase 'usage_executions' y subir usage a Stripe (si metered item existe)
  return { statusCode: 200, body: JSON.stringify({ pulled: data?.data?.length || 0 }) }
}
