import crypto from 'crypto';

function getKey(version: string) {
  const envKey = process.env[`DATA_KEK_${version}`];
  if (!envKey) throw new Error(`Missing KEK for version ${version}`);
  const b64 = envKey.replace(/^base64:/, '');
  return Buffer.from(b64, 'base64');
}

export function encryptColumn(plaintext: string, version = process.env.DATA_KEK_VERSION || 'v1') {
  const key = getKey(version);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v=${version};iv=${iv.toString('base64url')};ct=${enc.toString('base64url')};tag=${tag.toString('base64url')}`;
}

export function decryptColumn(serialized: string) {
  const parts = Object.fromEntries(serialized.split(';').map(p => p.split('=')));
  const version = parts['v'];
  const key = getKey(version);
  const iv = Buffer.from(parts['iv'], 'base64url');
  const ct = Buffer.from(parts['ct'], 'base64url');
  const tag = Buffer.from(parts['tag'], 'base64url');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(ct), decipher.final()]);
  return dec.toString('utf8');
}