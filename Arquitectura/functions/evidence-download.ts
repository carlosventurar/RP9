import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function sha256Hex(buffer: Uint8Array) {
  return crypto.createHash('sha256').update(Buffer.from(buffer)).digest('hex');
}

export const handler: Handler = async (event) => {
  const id = event.queryStringParameters?.id;
  if (!id) return { statusCode: 400, body: 'missing id' };

  const { data: file } = await supabase.from('evidence_files').select('*').eq('id', id).single();
  if (!file) return { statusCode: 404, body: 'not found' };

  // download object (private) to verify hash, then re-issue signed URL
  const { data: dl } = await supabase.storage.from('evidence').download(file.path);
  if (!dl) return { statusCode: 404, body: 'not found' };

  const hex = await sha256Hex(await dl.arrayBuffer());
  if (hex !== file.sha256) return { statusCode: 409, body: JSON.stringify({ error: 'hash_mismatch' }) };

  const { data: signed } = await supabase.storage.from('evidence').createSignedUrl(file.path, 60 * 10); // 10 min
  return { statusCode: 200, body: JSON.stringify({ url: signed?.signedUrl }) };
};