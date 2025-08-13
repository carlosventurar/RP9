import { generateApiKey, verifyApiKey } from '../lib/security/apiKeys';

test('api key generate/verify', () => {
  const g = generateApiKey('rp9');
  const rec = { tenant_id:'t', prefix:g.prefix, hash:g.hash, scopes:['read'], status:'active' as const };
  expect(verifyApiKey(g.display, rec)).toBe(true);
});