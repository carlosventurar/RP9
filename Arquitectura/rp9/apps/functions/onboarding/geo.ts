import type { Handler } from '@netlify/functions'
export const handler: Handler = async (event) => {
  // Stub geo: usar headers/Netlify geolocation real en prod
  const country = 'MX'
  return { statusCode: 200, body: JSON.stringify({ country }) }
}
