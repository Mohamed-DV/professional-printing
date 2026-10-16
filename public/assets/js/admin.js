(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const TOKEN_KEY = 'pp_admin_token';


  
  const STATUS = {
    new: { label: 'جديد', color: 'var(--s-new)' },
    confirmed: { label: 'مؤكد', color: 'var(--s-confirmed)' },
    designing: { label: 'قيد التصميم', color: 'var(--s-designing)' },
    printing: { label: 'قيد الطباعة', color: 'var(--s-printing)' },
    shipped: { label: 'تم الإرسال', color: 'var(--s-shipped)' },
    delivered: { label: 'تم التسليم', color: 'var(--s-delivered)' },
    cancelled: { label: 'ملغى', color: 'var(--s-cancelled)' },
  };

  const state = { orders: [], cursor: null, total: 0, filter: 'all', query: '' };

  /* ---------- helpers ---------- */
  const el = (tag, attrs = {}, ...kids) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat()) if (kid != null) n.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    return n;
  };
  const fmtDate = (iso) => {
    try {
      return new Intl.DateTimeFormat('ar-MA-u-nu-latn', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Casablanca' }).format(new Date(iso));
    } catch (_) { return iso; }
  };
  const localPhone = (p) => {
    const m = /^\+212(\d)(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(p || '');
    return m ? `0${m[1]}${m[2]} ${m[3]} ${m[4]} ${m[5]}` : (p || '');
  };
  const fmtSize = (b) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`);
  const money = (n) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

  let toastTimer;
  function toast(text, isError = false) {
    const t = $('#toast');
    t.textContent = text;
    t.classList.toggle('is-error', isError);
    t.setAttribute('aria-hidden', 'false');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.setAttribute('aria-hidden', 'true'), 2600);
  }

  /* ---------- auth ---------- */
  const getToken = () => {
    try {
      const t = JSON.parse(localStorage.getItem(TOKEN_KEY));
      return t && new Date(t.expires_at) > new Date() ? t.token : null;
    } catch (_) { return null; }
  };
  const setToken = (t) => { try { t ? localStorage.setItem(TOKEN_KEY, JSON.stringify(t)) : localStorage.removeItem(TOKEN_KEY); } catch (_) {} };

  async function api(path, opts = {}) {
    const res = await fetch(path, { ...opts, headers: { accept: 'application/json', ...(opts.headers || {}), authorization: `Bearer ${getToken()}` } });
    if (res.status === 401) { logout('الجلسة سالات، دخل من جديد.'); throw new Error('unauthorized'); }
    return res;
  }

  function showApp(on) {
    $('#login').hidden = on;
    $('#app').hidden = !on;
  }

  function logout(message) {
    setToken(null);
    state.orders = [];
    showApp(false);
    $('#login-msg').textContent = message || '';
    $('#password').value = '';
    $('#password').focus();
  }

  $('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('#login-btn');
    const msg = $('#login-msg');
    msg.textContent = '';
    const password = $('#password').value;
    if (!password) { msg.textContent = 'كتب كلمة السر.'; return; }
    btn.disabled = true;
    try {
      const res = await fetch('/api/admin/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.token) { msg.textContent = body.message || 'ما قدرناش ندخلو.'; return; }
      setToken({ token: body.token, expires_at: body.expires_at });
      showApp(true);
      await load(true);
    } catch (_) {
      msg.textContent = 'مشكل فالاتصال. عاود جرب.';
    } finally {
      btn.disabled = false;
    }
  });
  $('#logout').addEventListener('click', () => logout());

  /* ---------- data ---------- */
  let loading = false;
  async function load(reset = false, { silent = false } = {}) {
    if (loading) return;
    loading = true;
    const refreshBtn = $('#refresh');
    refreshBtn.disabled = true;
    try {
      const params = new URLSearchParams({ limit: '150' });
      if (!reset && state.cursor) params.set('cursor', state.cursor);
      const res = await api(`/api/admin/orders?${params}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.message || 'error');
      if (reset) {
        const before = new Set(state.orders.map((o) => o.id));
        state.orders = body.orders;
        const fresh = state.orders.filter((o) => before.size && !before.has(o.id)).length;
        if (silent && fresh) toast(`${fresh} طلب جديد`);
      } else {
        const seen = new Set(state.orders.map((o) => o.id));
        state.orders.push(...body.orders.filter((o) => !seen.has(o.id)));
      }
      state.cursor = body.next_cursor;
      state.total = body.total;
      render();
    } catch (err) {
      if (err.message !== 'unauthorized' && !silent) toast('ما قدرناش نجيبو الطلبات. عاود جرب.', true);
    } finally {
      loading = false;
      refreshBtn.disabled = false;
    }
  }

  async function changeStatus(order, status, select) {
    const previous = order.status;
    order.status = status;
    render();
    try {
      const res = await api(`/api/admin/orders/${encodeURIComponent(order.id)}`, {
        method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.message);
      Object.assign(order, body.order);
      render();
      toast(`${order.order_number}: ${STATUS[status].label}`);
    } catch (err) {
      if (err.message === 'unauthorized') return;
      order.status = previous;
      render();
      toast(err.message || 'ما تبدلاتش الحالة. عاود جرب.', true);
    }
  }

  async function fetchFile(order) {
    const res = await api(`/api/admin/orders/${encodeURIComponent(order.id)}/file`);
    if (!res.ok) throw new Error('missing');
    return URL.createObjectURL(await res.blob());
  }

  async function previewFile(order) {
    const ext = (order.design_file && order.design_file.ext) || '';
    try {
      if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
        const url = await fetchFile(order);
        $('#viewer-img').src = url;
        $('#viewer-dl').href = url;
        $('#viewer-dl').setAttribute('download', order.design_file.name);
        $('#viewer').hidden = false;
        $('#viewer-close').focus();
      } else {
        const win = window.open('', '_blank');
        const url = await fetchFile(order);
        if (win) win.location.href = url; else location.href = url;
      }
    } catch (err) {
      if (err.message !== 'unauthorized') toast('الملف ماكاينش.', true);
    }
  }

  async function downloadFile(order) {
    try {
      const url = await fetchFile(order);
      const a = el('a', { href: url, download: order.design_file.name });
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch (err) {
      if (err.message !== 'unauthorized') toast('الملف ماكاينش.', true);
    }
  }

  function closeViewer() {
    const img = $('#viewer-img');
    if (img.src.startsWith('blob:')) URL.revokeObjectURL(img.src);
    img.removeAttribute('src');
    $('#viewer').hidden = true;
  }
  $('#viewer-close').addEventListener('click', closeViewer);
  $('#viewer').addEventListener('click', (e) => { if (e.target.id === 'viewer') closeViewer(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#viewer').hidden) closeViewer(); });

  /* ---------- rendering ---------- */
  const matches = (o, q) => {
    if (!q) return true;
    const hay = [o.order_number, o.full_name, o.company_name, o.activity_type, o.phone, localPhone(o.phone).replace(/\s/g, ''), o.address]
      .join(' ').toLowerCase();
    return hay.includes(q.toLowerCase().replace(/\s+/g, ' ').trim()) || hay.includes(q.replace(/\s/g, ''));
  };

  function visibleOrders() {
    return state.orders.filter((o) => (state.filter === 'all' || o.status === state.filter) && matches(o, state.query));
  }

  function renderSummary() {
    const live = state.orders.filter((o) => o.status !== 'cancelled');
    $('#sum-all').textContent = state.total > state.orders.length ? `${state.orders.length} / ${state.total}` : String(state.orders.length);
    $('#sum-new').textContent = String(state.orders.filter((o) => o.status === 'new').length);
    $('#sum-design').textContent = String(live.filter((o) => o.design_required).length);
    $('#sum-money').textContent = money(live.reduce((s, o) => s + (Number(o.total_price) || 0), 0));
  }

  function renderChips() {
    const counts = state.orders.reduce((m, o) => ((m[o.status] = (m[o.status] || 0) + 1), m), {});
    const chips = [['all', 'الكل', null, state.orders.length], ...Object.entries(STATUS).map(([k, v]) => [k, v.label, v.color, counts[k] || 0])];
    $('#chips').replaceChildren(...chips.map(([key, label, color, n]) =>
      el('button', { type: 'button', class: 'chip', 'aria-pressed': String(state.filter === key), onclick: () => { state.filter = key; render(); } },
        color ? el('span', { class: 'dot', style: `--c:${color}` }) : null, label, el('span', { class: 'n', text: String(n) }))));
  }

  function orderCard(o) {
    const st = STATUS[o.status] || STATUS.new;
    const select = el('select', { 'aria-label': `حالة الطلب ${o.order_number}` },
      ...Object.entries(STATUS).map(([k, v]) => el('option', { value: k, selected: k === o.status, text: v.label })));
    select.addEventListener('change', () => changeStatus(o, select.value, select));

    const phoneLocal = localPhone(o.phone);
    const wa = (o.phone || '').replace(/^\+/, '');

    const customer = el('section', { class: 'block' },
      el('h3', { text: 'معلومات الزبون' }),
      el('dl', { class: 'kv' },
        el('div', {}, el('dt', { text: 'الاسم الكامل' }), el('dd', { text: o.full_name })),
        el('div', {}, el('dt', { text: 'المشروع' }), el('dd', { text: o.company_name })),
        el('div', {}, el('dt', { text: 'النشاط' }), el('dd', { text: o.activity_type })),
        el('div', {}, el('dt', { text: 'الهاتف' }), el('dd', {}, el('span', { class: 'ltr', text: phoneLocal }))),
        el('div', {}, el('dt', { text: 'العنوان' }), el('dd', { text: o.address }))),
      el('div', { class: 'contact' },
        el('a', { class: 'btn', href: `tel:${o.phone}` }, 'اتصل'),
        el('a', { class: 'btn', href: `https://wa.me/${wa}`, target: '_blank', rel: 'noopener' }, 'واتساب')));

    const details = el('section', { class: 'block' },
      el('h3', { text: 'الطلب' }),
      el('dl', { class: 'kv' },
        el('div', {}, el('dt', { text: 'المنتوج' }), el('dd', { text: o.product_name })),
        el('div', {}, el('dt', { text: 'الكمية' }), el('dd', { text: String(o.quantity) })),
        el('div', {}, el('dt', { text: 'الطباعة' }), el('dd', { text: o.printing_sides === 2 ? 'Recto Verso' : `${o.printing_sides} وجه` })),
        el('div', {}, el('dt', { text: 'تصميم مطلوب' }), el('dd', {},
          el('span', { class: `tag ${o.design_required ? 'tag--yes' : 'tag--no'}`, text: o.design_required ? 'نعم — مجاني' : 'لا — عندو تصميم' }))),
        el('div', {}, el('dt', { text: 'المجموع' }), el('dd', { class: 'total' }, el('span', { class: 'ltr', text: `${o.total_price} ${o.currency}` })))));

    let designBody;
    if (o.design_file) {
      designBody = el('div', { class: 'design-file' },
        el('span', { class: 'name', title: o.design_file.name, text: o.design_file.name }),
        el('span', { class: 'size ltr', text: fmtSize(o.design_file.size) }),
        el('button', { type: 'button', class: 'btn', onclick: () => previewFile(o) }, 'معاينة'),
        el('button', { type: 'button', class: 'btn', onclick: () => downloadFile(o) }, 'تحميل'));
    } else if (o.design_description) {
      designBody = el('p', { class: 'desc', text: o.design_description });
    } else {
      designBody = el('p', { class: 'none', text: o.has_design ? 'عندو تصميم ولكن ما رفعش الملف — طلبو منو.' : 'ما كتبش وصف — سولو فالمكالمة.' });
    }
    const t = o.tracking || {};
    const source = [t.utm_source, t.utm_campaign, t.utm_content].filter(Boolean).join(' / ');
    const design = el('section', { class: 'block' },
      el('h3', { text: o.design_file ? 'ملف التصميم' : 'وصف التصميم' }),
      designBody,
      source ? el('p', { class: 'src' }, 'المصدر: ', el('span', { class: 'ltr', text: source })) : null);

    return el('article', { class: 'order', 'data-status': o.status },
      el('header', { class: 'order__head' },
        el('span', { class: 'order__num ltr', text: o.order_number }),
        el('span', { class: 'order__date', text: fmtDate(o.created_at) }),
        el('span', { class: 'grow' }),
        el('label', { class: 'status' }, el('span', { class: 'dot', style: `--c:${st.color}` }), select)),
      el('div', { class: 'order__body' }, customer, details, design));
  }

  function render() {
    renderSummary();
    renderChips();
    const rows = visibleOrders();
    const list = $('#list');
    if (!rows.length) {
      list.replaceChildren(el('p', { class: 'empty', text: state.orders.length ? 'حتى طلب ما كيطابق هاد الفلترة.' : 'مازال ما كاين حتى طلب. الطلبات الجديدة غادي تبان هنا.' }));
    } else {
      list.replaceChildren(...rows.map(orderCard));
    }
    $('#more-wrap').hidden = !state.cursor;
  }

  $('#search').addEventListener('input', (e) => { state.query = e.target.value; render(); });
  $('#refresh').addEventListener('click', () => load(true));
  $('#more').addEventListener('click', () => load(false));

  /* ---------- CSV export (current filter) ---------- */
  $('#export').addEventListener('click', () => {
    const rows = visibleOrders();
    if (!rows.length) { toast('ما كاين حتى طلب للتصدير.', true); return; }
    const cols = [
      ['order_number', 'Commande'], ['created_at', 'Date'], ['status', 'Statut'], ['full_name', 'Nom complet'], ['company_name', 'Entreprise'],
      ['activity_type', 'Activité'], ['phone', 'Téléphone'], ['address', 'Adresse'], ['design_required', 'Design requis'],
      ['design_file', 'Fichier design'], ['design_description', 'Description design'], ['product_name', 'Produit'], ['quantity', 'Quantité'],
      ['printing_sides', 'Faces'], ['unit_price', 'Prix unitaire'], ['design_price', 'Prix design'], ['total_price', 'Total'], ['currency', 'Devise'],
      ['utm_source', 'utm_source'], ['utm_campaign', 'utm_campaign'],
    ];
    const value = (o, k) => {
      if (k === 'status') return STATUS[o.status] ? STATUS[o.status].label : o.status;
      if (k === 'phone') return localPhone(o.phone);
      if (k === 'design_required') return o.design_required ? 'Oui' : 'Non';
      if (k === 'design_file') return o.design_file ? o.design_file.name : '';
      if (k.startsWith('utm_')) return (o.tracking || {})[k] || '';
      return o[k] == null ? '' : o[k];
    };
    const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;
    const csv = [cols.map((c) => esc(c[1])).join(';'), ...rows.map((o) => cols.map(([k]) => esc(value(o, k))).join(';'))].join('\r\n');
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    const a = el('a', { href: url, download: `commandes-cartes-visite-${new Date().toISOString().slice(0, 10)}.csv` });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  });

  /* ---------- start ---------- */
  if (getToken()) { showApp(true); load(true); }
  else { showApp(false); $('#password').focus(); }

  // Pick up new orders every minute while the tab is open.
  setInterval(() => {
    if (document.visibilityState === 'visible' && getToken() && !$('#app').hidden && !document.activeElement.matches('select')) load(true, { silent: true });
  }, 60000);
})();
