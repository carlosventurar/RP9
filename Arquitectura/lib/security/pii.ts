export function maskEmail(email: string) {
  const [user, domain] = email.split('@');
  if (!domain) return email;
  const maskedUser = user.length <= 1 ? '*' : user[0] + '*'.repeat(Math.max(1, user.length - 2)) + user.slice(-1);
  return `${maskedUser}@${domain}`;
}

export function maskPhone(phone: string) {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return phone;
  const masked = '+1*** *** ' + digits.slice(-4);
  return masked;
}