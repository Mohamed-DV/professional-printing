import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

const TOKEN_TTL_SECONDS = 12 * 60 * 60; // admin sessions last 12 hours

const env = (name) => (process.env[name] || '').trim();

export const adminConfigured = () => env('ADMIN_PASSWORD').length > 0;

// Tokens are signed with ADMIN_SECRET if set, otherwise with ADMIN_PASSWORD,
// so changing the password signs everyone out.
const signingKey = () => env('ADMIN_SECRET') || env('ADMIN_PASSWORD');

const sha256 = (value) => createHash('sha256').update(String(value)).digest();

export function passwordMatches(input) {
  const expected = env('ADMIN_PASSWORD');
  if (!expected || typeof input !== 'string') return false;
  return timingSafeEqual(sha256(input), sha256(expected));
}

const sign = (payload) => createHmac('sha256', signingKey()).update(payload).digest('base64url');

export function issueToken() {
  const exp = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;
  const payload = `v1.${exp}`;
  return { token: `${payload}.${sign(payload)}`, expires_at: new Date(exp * 1000).toISOString() };
}

export function isAuthorized(req) {
  if (!adminConfigured()) return false;
  const header = req.headers.get('authorization') || '';
  const token = header.replace(/^Bearer\s+/i, '').trim();
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== 'v1') return false;
  const [v, exp, sig] = parts;
  if (!/^\d+$/.test(exp) || Number(exp) < Math.floor(Date.now() / 1000)) return false;
  const expected = Buffer.from(sign(`${v}.${exp}`));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
