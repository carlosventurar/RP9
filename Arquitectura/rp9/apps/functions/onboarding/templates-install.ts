import type { Handler } from '@netlify/functions'
const BFF = process.env.BFF_BASE_URL
const TENANT = process.env.BFF_TENANT || 'default'
const TOKEN = process.env.BFF_TOKEN || ''
async function install(workflow:any) {
  const r = await fetch(BFF + '/api/workflows', {
    method: 'POST',
    headers: { 'content-type':'application/json', 'x-tenant': TENANT, 'authorization': `Bearer ${TOKEN}` },
    body: JSON.stringify({ workflow })
  })
  if (!r.ok) throw new Error('BFF error ' + r.status)
  return r.json()
}
export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' }
  try {
    const { mockWorkflow, realWorkflow } = JSON.parse(event.body || '{}')
    if (!mockWorkflow || !realWorkflow) return { statusCode: 400, body: 'Missing workflows' }
    const mock = await install(mockWorkflow)
    const real = await install(realWorkflow)
    return { statusCode: 200, body: JSON.stringify({ ok: true, mock, real }) }
  } catch (e:any) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) }
  }
}
