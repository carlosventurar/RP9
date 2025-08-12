
import type { Handler } from '@netlify/functions'

function encrypt(data: Buffer, secret: string) {
  return data.toString('base64') // placeholder
}

export const handler: Handler = async () => {
  const bucket = process.env.BACKUPS_BUCKET
  if (!bucket) return { statusCode: 500, body: 'Missing BACKUPS_BUCKET' }

  const base = process.env.N8N_BASE_URL!.replace(/\/$/, '')
  const res = await fetch(base + '/api/v1/workflows', { headers: { 'X-N8N-API-KEY': process.env.N8N_API_KEY || '' } })
  const data = await res.json()
  const payload = Buffer.from(JSON.stringify({ exported_at: new Date().toISOString(), workflows: data?.data || [] }))
  const encrypted = encrypt(payload, process.env.BACKUPS_ENCRYPTION_KEY || '')
  // TODO: subir a Supabase Storage/S3 según BACKUPS_BUCKET

  return { statusCode: 200, body: JSON.stringify({ ok: true, size: payload.length }) }
}
