import crypto from 'crypto';

export function signBody(bodyRaw: string, timestamp: string, secret: string): string {
  const payload = `${timestamp}\n${bodyRaw}`;
  const mac = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return `sha256=${mac}`;
}

export function verifySignature(bodyRaw: string, timestamp: string, signatureHeader: string|undefined, secret: string, skewSec=300): boolean {
  if (!signatureHeader) return false;
  const now = Math.floor(Date.now()/1000);
  const ts = parseInt(timestamp || '0', 10);
  if (!ts || Math.abs(now - ts) > skewSec) return false;
  const expected = signBody(bodyRaw, timestamp, secret);
  try {
    const a = Buffer.from(signatureHeader.replace(/^sha256=/,'').trim(), 'hex');
    const b = Buffer.from(expected.replace(/^sha256=/,'').trim(), 'hex');
    return a.length===b.length && crypto.timingSafeEqual(a,b);
  } catch { return false; }
}