(() => {
  'use strict';
  const number = new URLSearchParams(location.search).get('o') || '';
  if (!/^PP-\d{6}-[A-Z0-9]{4}$/.test(number)) return;

  document.getElementById('order-number').textContent = number;
  document.getElementById('num').hidden = false;

  let last = null;
  try { last = JSON.parse(sessionStorage.getItem('pp_last_order')); } catch (_) {}
  if (last && last.order_number === number && last.has_design === true) {
    document.getElementById('next').textContent = 'غادي نتاصلو بيك فالهاتف فأقرب وقت باش نأكدو معاك الطلب ونراجعو ملف التصميم.';
  }

  // Report the order to Meta once per order number (refreshing the page doesn't count again).
  const key = `pp_tracked_${number}`;
  let already = false;
  try { already = localStorage.getItem(key) === '1'; } catch (_) {}
  if (already) return;

  const send = () => {
    if (typeof window.fbq !== 'function') return false;
    window.fbq('track', 'Purchase',
      { value: 290, currency: 'MAD', content_name: 'Cartes de Visite', content_type: 'product', contents: [{ id: 'cartes-visite-1000-rv', quantity: 1 }] },
      { eventID: number });
    try { localStorage.setItem(key, '1'); } catch (_) {}
    return true;
  };
  if (!send()) {
    let tries = 0;
    const t = setInterval(() => { if (send() || ++tries > 20) clearInterval(t); }, 250);
  }
})();
