import { getStore } from '@netlify/blobs';
import { OFFER, STORES, MAX_FILE_BYTES } from '../lib/offer.mjs';
import { validateOrderForm } from '../lib/validate.mjs';
import { json, fail, methodNotAllowed } from '../lib/http.mjs';

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O/1/I/L — easy to read over the phone

function orderNumber(now) {
  const d = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Casablanca', year: '2-digit', month: '2-digit', day: '2-digit',
  }).formatToParts(now).reduce((a, p) => ({ ...a, [p.type]: p.value }), {});
  const rand = Array.from(crypto.getRandomValues(new Uint8Array(4)), (b) => ALPHABET[b % ALPHABET.length]).join('');
  return `PP-${d.year}${d.month}${d.day}-${rand}`;
}

export default async (req) => {
  if (req.method !== 'POST') return methodNotAllowed(['POST']);

  const length = Number(req.headers.get('content-length') || 0);
  if (length > MAX_FILE_BYTES + 512 * 1024) {
    return fail(413, 'الملف كبير بزاف. الحد الأقصى 4 ميغا.', { errors: { design_file: 'الملف كبير بزاف. الحد الأقصى 4 ميغا — تقدر تكمل الطلب بلا ملف ونتواصلو معاك.' } });
  }

  let form;
  try {
    form = await req.formData();
  } catch {
    return fail(400, 'الطلب ماوصلش مزيان. عاود جرب.');
  }

  // Bot traps: hidden field must stay empty, and nobody fills six fields in under 1.5 s.
  const honeypot = form.get('website');
  const elapsed = Number(form.get('t') || 0);
  if ((typeof honeypot === 'string' && honeypot.trim() !== '') || (elapsed > 0 && elapsed < 1500)) {
    return json({ ok: true, order_number: 'PP-000000-0000', total_price: OFFER.total_price, currency: OFFER.currency });
  }

  const { errors, data, file } = validateOrderForm(form);
  if (Object.keys(errors).length) {
    return fail(422, 'شي معلومات ناقصة ولا ماشي صحيحة.', { errors });
  }

  const idemStore = getStore({ name: STORES.idempotency, consistency: 'strong' });
  const ordersStore = getStore({ name: STORES.orders, consistency: 'strong' });
  const filesStore = getStore({ name: STORES.files, consistency: 'strong' });

  // Same browser session submitting twice (double tap, flaky network) gets the same order back.
  const idem = typeof form.get('idem') === 'string' && /^[A-Za-z0-9-]{8,64}$/.test(form.get('idem')) ? form.get('idem') : null;
  if (idem) {
    const previous = await idemStore.get(idem, { type: 'json' });
    if (previous?.order_number) {
      return json({ ok: true, order_number: previous.order_number, total_price: OFFER.total_price, currency: OFFER.currency, duplicate: true });
    }
  }

  const now = new Date();
  const order_number = orderNumber(now);
  const id = `${now.getTime()}-${order_number}`;

  let design_file = null;
  if (file) {
    await filesStore.set(id, await file.blob.arrayBuffer(), {
      metadata: { name: file.name, type: file.type, ext: file.ext, size: file.size },
    });
    design_file = { name: file.name, type: file.type, ext: file.ext, size: file.size };
  }

  const order = {
    id,
    order_number,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
    status: 'new',
    status_history: [{ status: 'new', at: now.toISOString() }],

    // customer
    full_name: data.full_name,
    company_name: data.company_name,
    activity_type: data.activity_type,
    phone: data.phone,
    address: data.address,

    // design
    has_design: data.has_design,          // true = customer already has a design
    design_required: !data.has_design,    // true = we design it for free
    design_file,
    design_description: data.design_description,

    // fixed offer (server-side constants)
    ...OFFER,

    tracking: data.tracking,
  };

  await ordersStore.setJSON(id, order);
  if (idem) await idemStore.setJSON(idem, { order_number, id }, { onlyIfNew: true });

  return json({ ok: true, order_number, total_price: OFFER.total_price, currency: OFFER.currency }, 201);
};

export const config = { path: '/api/orders' };
