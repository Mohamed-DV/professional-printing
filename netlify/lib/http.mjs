const BASE_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
};

export const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), { status, headers: { ...BASE_HEADERS, ...headers } });

export const fail = (status, message, extra = {}) => json({ ok: false, message, ...extra }, status);

export const methodNotAllowed = (allowed) =>
  json({ ok: false, message: 'Method not allowed' }, 405, { allow: allowed.join(', ') });

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Run async work over a list with a fixed number of parallel workers.
export async function mapPool(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
  return out;
}
