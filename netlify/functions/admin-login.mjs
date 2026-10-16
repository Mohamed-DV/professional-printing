import { adminConfigured, passwordMatches, issueToken } from '../lib/auth.mjs';
import { json, fail, methodNotAllowed, sleep } from '../lib/http.mjs';

export default async (req) => {
  if (req.method !== 'POST') return methodNotAllowed(['POST']);
  if (!adminConfigured()) {
    return fail(503, 'ADMIN_PASSWORD ماشي مضبوط فـ Netlify (Site configuration → Environment variables).');
  }
  let body = {};
  try { body = await req.json(); } catch { /* empty body */ }

  if (!passwordMatches(body.password)) {
    await sleep(700); // slows down password guessing
    return fail(401, 'كلمة السر غالطة.');
  }
  return json({ ok: true, ...issueToken() });
};

export const config = { path: '/api/admin/login' };
