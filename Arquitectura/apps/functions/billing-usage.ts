import { Handler } from '@netlify/functions'
export const handler: Handler = async () => {
  // Pseudocódigo: SELECT v_usage_daily por tenant
  return { statusCode:200, body: JSON.stringify({ data: [] }) }
}
