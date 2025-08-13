import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { verifySignature } from '../lib/security/hmac';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export const handler: Handler = async (event) => {
  const secret = process.env.HMAC_SECRET || '';
  const timestamp = event.headers['x-rp9-timestamp'] || event.headers['X-RP9-Timestamp'] as string;
  const signature = event.headers['x-rp9-signature'] || event.headers['X-RP9-Signature'] as string;
  const rawBody = event.body || '';

  const ok = verifySignature(rawBody, String(timestamp||''), String(signature||''), secret, 300);
  if (!ok) return { statusCode: 401, body: JSON.stringify({ error: 'invalid_signature' }) };

  // Idempotency: reject repeats
  const sigKey = String(signature);
  const exists = await supabase.from('webhook_idempotency').select('signature').eq('signature', sigKey).maybeSingle();
  if (exists.data) return { statusCode: 200, body: JSON.stringify({ ok: true, duplicate: true }) };
  await supabase.from('webhook_idempotency').insert({ signature: sigKey, ts: new Date().toISOString() });

  // TODO: route event to downstream handler
  return { statusCode: 200, body: JSON.stringify({ ok: true }) };
};