import type { Handler } from '@netlify/functions'
export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' }
  try {
    const { tenantId, userId, taskKey, status, meta } = JSON.parse(event.body || '{}')
    if (!tenantId || !taskKey || !status) return { statusCode: 400, body: 'Missing fields' }
    // TODO: insert/update Supabase onboarding_progress
    return { statusCode: 200, body: JSON.stringify({ ok: true }) }
  } catch (e:any) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) }
  }
}
