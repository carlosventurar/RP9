import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export const handler: Handler = async (event) => {
  const tenant_id = (event.headers['x-tenant'] || 'default') as string;
  const ip = (event.headers['x-forwarded-for'] || '').toString().split(',')[0] || '';
  const ua = (event.headers['user-agent'] || '').toString();
  const body = event.body ? JSON.parse(event.body) : {};
  const { action, resource, resource_id, old: oldV, new: newV, result='ok', user_id=null } = body;

  await supabase.from('audit_logs').insert({
    tenant_id, user_id, action, resource, resource_id, ip, user_agent: ua, old: oldV || null, new: newV || null, result
  });

  return { statusCode: 200, body: JSON.stringify({ ok: true }) };
};