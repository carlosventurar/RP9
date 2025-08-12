import type { Handler } from '@netlify/functions'
import crypto from 'crypto'
export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' }
  try {
    const body = event.isBase64Encoded && event.body ? Buffer.from(event.body, 'base64') : Buffer.from(event.body||'')
    const sha256 = crypto.createHash('sha256').update(body).digest('hex')
    // TODO: subir a Supabase Storage y persistir registro con hash
    return { statusCode: 200, body: JSON.stringify({ ok: true, sha256 }) }
  } catch (e:any) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) }
  }
}
