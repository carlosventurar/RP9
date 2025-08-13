/**
 * Token-bucket simple usando Supabase como storage.
 * Clave: tenant:apikey (o tenant:ip)
 */
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function checkRateLimit(key: string, maxPerMin=300) {
  const now = new Date();
  const windowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes());
  const windowIso = windowStart.toISOString();
  const { data, error } = await supabase
    .from('rate_limits')
    .upsert({ key, window_start: windowIso, count: 1 }, { onConflict: 'key,window_start' })
    .select()
    .single();
  if (error) { /* optional: log */ }
  const count = (data?.count ?? 1);
  if (count > maxPerMin) return false;
  // increment
  await supabase.rpc('increment_rate_limit', { k: key, w: windowIso });
  return true;
}