import { signBody, verifySignature } from '../lib/security/hmac';

test('hmac verify ok', () => {
  const secret='s3cr3t'; const ts='1700000000'; const body='{"a":1}';
  const sig = signBody(body, ts, secret);
  expect(verifySignature(body, ts, sig, secret, 999999)).toBe(true);
});