// The confirmed commercial offer. These values are written into every order
// by the server — nothing the browser sends can change them.
export const OFFER = Object.freeze({
  product_name: 'Cartes de Visite',
  quantity: 1000,
  printing_sides: 2,
  design_included: true,
  design_price: 0,
  unit_price: 0.29,
  total_price: 290,
  currency: 'MAD',
});

// Order workflow, in the order an order normally moves through it.
export const STATUSES = Object.freeze([
  'new',        // جديد
  'confirmed',  // مؤكد
  'designing',  // قيد التصميم
  'printing',   // قيد الطباعة
  'shipped',    // تم الإرسال
  'delivered',  // تم التسليم
  'cancelled',  // ملغى
]);

export const STORES = Object.freeze({
  orders: 'pp-orders',
  files: 'pp-design-files',
  idempotency: 'pp-order-idempotency',
});

// Design files customers can attach (checked by extension, server side).
export const MAX_FILE_BYTES = 4 * 1024 * 1024; // Netlify Functions accept ~6 MB per request
export const FILE_TYPES = Object.freeze({
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  ai: 'application/postscript',
  eps: 'application/postscript',
  psd: 'image/vnd.adobe.photoshop',
  cdr: 'application/vnd.corel-draw',
  zip: 'application/zip',
});
// Types that are safe to preview inline in the admin (never SVG/HTML-like).
export const INLINE_PREVIEW = new Set(['pdf', 'jpg', 'jpeg', 'png', 'webp']);
