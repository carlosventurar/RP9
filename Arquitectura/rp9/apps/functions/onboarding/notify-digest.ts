import type { Handler } from '@netlify/functions'
export const handler: Handler = async () => {
  // Daily digest (7–14 días): resumen de progreso y CTA
  return { statusCode: 200, body: JSON.stringify({ ok: true }) }
}
