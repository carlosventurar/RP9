
import type { Handler } from '@netlify/functions'

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' }
  // TODO: descargar último backup del bucket, restaurar en schema sandbox y validar integridad
  return { statusCode: 200, body: JSON.stringify({ ok: true, message: 'Restore sandbox stub' }) }
}
