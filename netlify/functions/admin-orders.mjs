import { getStore } from '@netlify/blobs';
import { STORES, STATUSES } from '../lib/offer.mjs';
import { isAuthorized } from '../lib/auth.mjs';
import { json, fail, methodNotAllowed, mapPool } from '../lib/http.mjs';

const PAGE_SIZE = 150;

// Keys start with the creation timestamp, so sorting keys newest-first
// gives orders newest-first without reading them.
const byNewest = (a, b) => (a < b ? 1 : a > b ? -1 : 0);

async function listOrders(store, url) {
  const cursor = url.searchParams.get('cursor');
  const limit = Math.min(Number(url.searchParams.get('limit')) || PAGE_SIZE, 300);

  const { blobs } = await store.list();
  const keys = blobs.map((b) => b.key).sort(byNewest);
  const start = cursor ? keys.findIndex((k) => byNewest(k, cursor) > 0) : 0;
  const pageKeys = start < 0 ? [] : keys.slice(start, start + limit);

  const orders = (await mapPool(pageKeys, 16, (k) => store.get(k, { type: 'json' }))).filter(Boolean);
  const last = pageKeys[pageKeys.length - 1];
  const hasMore = start >= 0 && start + limit < keys.length;

  return json({ ok: true, orders, total: keys.length, next_cursor: hasMore ? last : null });
}

async function updateOrder(store, id, req) {
  let body = {};
  try { body = await req.json(); } catch { /* empty body */ }
  const status = body.status;
  if (!STATUSES.includes(status)) return fail(400, 'حالة غير معروفة.');

  // Optimistic concurrency: retry if someone else saved the same order meanwhile.
  for (let attempt = 0; attempt < 3; attempt++) {
    const current = await store.getWithMetadata(id, { type: 'json' });
    if (!current) return fail(404, 'الطلب ماكاينش.');
    const order = current.data;
    if (order.status === status) return json({ ok: true, order });

    const now = new Date().toISOString();
    const next = {
      ...order,
      status,
      updated_at: now,
      status_history: [...(order.status_history || []), { status, at: now }].slice(-30),
    };
    const res = await store.setJSON(id, next, current.etag ? { onlyIfMatch: current.etag } : {});
    if (res.modified !== false) return json({ ok: true, order: next });
  }
  return fail(409, 'الطلب تبدّل من بلاصة أخرى. حدّث الصفحة وعاود.');
}

export default async (req, context) => {
  if (!isAuthorized(req)) return fail(401, 'خاصك تدخل من جديد.');
  const store = getStore({ name: STORES.orders, consistency: 'strong' });
  const id = context.params?.id;

  if (!id) {
    if (req.method !== 'GET') return methodNotAllowed(['GET']);
    return listOrders(store, new URL(req.url));
  }

  if (req.method === 'GET') {
    const order = await store.get(id, { type: 'json' });
    return order ? json({ ok: true, order }) : fail(404, 'الطلب ماكاينش.');
  }
  if (req.method === 'PATCH') return updateOrder(store, id, req);
  return methodNotAllowed(['GET', 'PATCH']);
};

export const config = { path: ['/api/admin/orders', '/api/admin/orders/:id'] };
