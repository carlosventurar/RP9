import crypto from 'crypto';

export type ApiKeyRecord = {
  tenant_id: string;
  prefix: string;
  hash: Buffer;     // sha256 hash of secret
  scopes: string[];
  status: 'active'|'revoked';
};

export function generateApiKey(prefix='rp9'): { display: string; prefix: string; secret: string; hash: Buffer } {
  const raw = crypto.randomBytes(24).toString('base64url');
  const secret = `${prefix}_sk_${raw}`;
  const hash = crypto.createHash('sha256').update(secret).digest();
  return { display: secret, prefix: raw.slice(0,8), secret, hash };
}

export function verifyApiKey(secret: string, record: ApiKeyRecord): boolean {
  const hash = crypto.createHash('sha256').update(secret).digest();
  return record.status === 'active' && crypto.timingSafeEqual(hash, record.hash);
}