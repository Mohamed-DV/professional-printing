import { getStore } from '@netlify/blobs';
import { STORES, INLINE_PREVIEW } from '../lib/offer.mjs';
import { isAuthorized } from '../lib/auth.mjs';
import { fail, methodNotAllowed } from '../lib/http.mjs';

const asciiName = (name, ext) => (name.replace(/[^\w.\-]+/g, '_').replace(/^_+|_+$/g, '') || `design.${ext}`);

export default async (req, context) => {
  if (req.method !== 'GET') return methodNotAllowed(['GET']);
  if (!isAuthorized(req)) return fail(401, 'خاصك تدخل من جديد.');

  const id = context.params?.id;
  const store = getStore({ name: STORES.files, consistency: 'strong' });
  const entry = await store.getWithMetadata(id, { type: 'arrayBuffer' });
  if (!entry) return fail(404, 'الملف ماكاينش.');

  const meta = entry.metadata || {};
  const ext = String(meta.ext || '').toLowerCase();
  const name = String(meta.name || `design.${ext || 'bin'}`);
  const inline = INLINE_PREVIEW.has(ext) && new URL(req.url).searchParams.get('download') !== '1';

  return new Response(entry.data, {
    status: 200,
    headers: {
      // Anything that is not a plain image/PDF is served as a download only.
      'content-type': inline ? meta.type : 'application/octet-stream',
      'content-disposition': `${inline ? 'inline' : 'attachment'}; filename="${asciiName(name, ext)}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      'cache-control': 'private, no-store',
      'x-content-type-options': 'nosniff',
      'content-security-policy': "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox",
    },
  });
};

export const config = { path: '/api/admin/orders/:id/file' };
