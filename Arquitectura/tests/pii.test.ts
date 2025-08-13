import { maskEmail, maskPhone } from '../lib/security/pii';

test('mask email', () => {
  expect(maskEmail('user@example.com')).toMatch(/u\*+r@example\.com/);
});
test('mask phone', () => {
  expect(maskPhone('+1 809-555-1234')).toContain('1234');
});