import { Handler } from '@netlify/functions';
import { checkRateLimit } from '../lib/security/rateLimit';

export const handler: Handler = async (event) => {
  const tenant = event.headers['x-tenant'] || 'default';
  const apiKeyPrefix = (event.headers['authorization'] || '').slice(-12) || (event.headers['x-api-key'] || '').slice(-12);
  const key = `${tenant}:${apiKeyPrefix || 'anon'}`;
  const max = parseInt(process.env.RATE_LIMIT_MAX_PER_MIN || '300', 10);

  const allowed = await checkRateLimit(key, max);
  if (!allowed) {
    return { statusCode: 429, body: JSON.stringify({ error: 'rate_limited' }) };
  }
  return { statusCode: 200, body: JSON.stringify({ ok: true }) };
};