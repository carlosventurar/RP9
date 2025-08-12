
import type { Handler } from '@netlify/functions'

async function postSlack(webhook: string, payload: any) {
  await fetch(webhook, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' }

  const { sev = 'info', title = 'Alert', desc = '', meta = {} } = JSON.parse(event.body || '{}')
  const webhook = process.env.ALERTS_SLACK_WEBHOOK
  if (!webhook) return { statusCode: 500, body: 'Missing ALERTS_SLACK_WEBHOOK' }

  const color = sev === 'sev1' ? '#ff0000' : sev === 'sev2' ? '#ff9900' : '#36a64f'
  const payload = {
    attachments: [{
      color,
      title,
      text: desc,
      fields: Object.entries(meta).map(([k,v]) => ({ title: k, value: String(v), short: true })),
      ts: Math.floor(Date.now()/1000)
    }]
  }
  await postSlack(webhook, payload)
  return { statusCode: 200, body: JSON.stringify({ ok: true }) }
}
