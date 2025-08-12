import { Handler } from '@netlify/functions'
export const handler: Handler = async () => {
  // TODO: reintentos de cobro (3), registro en billing_events y notificación al admin
  return { statusCode: 200, body: JSON.stringify({ ok: true }) }
}
