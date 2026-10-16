(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const track = (...args) => { try { if (typeof window.fbq === 'function') window.fbq(...args); } catch (_) {} };
  const store = {
    get(k) { try { return JSON.parse(sessionStorage.getItem(k)); } catch (_) { return null; } },
    set(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch (_) {} },
  };

  /* ---------- Card deck: tap to flip, and one flip on arrival ---------- */
  const deck = $('#deck');
  if (deck) {
    const flip = (on) => {
      deck.setAttribute('aria-pressed', String(on));
      deck.setAttribute('aria-label', on ? 'قلب البطاقة باش تشوف الوجه الأمامي' : 'قلب البطاقة باش تشوف الوجه الخلفي');
    };
    let userTouched = false;
    deck.addEventListener('click', () => { userTouched = true; flip(deck.getAttribute('aria-pressed') !== 'true'); });
    if (!reduceMotion) {
      setTimeout(() => { if (!userTouched) flip(true); }, 1100);
      setTimeout(() => { if (!userTouched) flip(false); }, 3600);
    }
  }

  /* ---------- Ad attribution (kept for the session) ---------- */
  const TRACK_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid'];
  const params = new URLSearchParams(location.search);
  const tracking = store.get('pp_tracking') || {};
  let changed = false;
  for (const k of TRACK_KEYS) if (params.get(k)) { tracking[k] = params.get(k).slice(0, 200); changed = true; }
  if (changed) store.set('pp_tracking', tracking);

  /* ---------- Order form ---------- */
  const form = $('#order-form');
  if (!form) return;

  const startedAt = performance.now();
  const idem = (crypto.randomUUID && crypto.randomUUID()) || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  const branchYes = $('#branch-yes');
  const branchNo = $('#branch-no');
  const fileInput = $('#f-file');
  const filePill = $('#file-pill');
  const drop = $('#drop');
  const submitBtn = $('#submit');
  const formError = $('#form-error');
  const designSet = $('#f-design');

  const MAX_BYTES = 4 * 1024 * 1024;
  const FILE_EXT = ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'svg', 'ai', 'eps', 'psd', 'cdr', 'zip'];
  const MSG = {
    full_name: 'كتب الاسم الكامل ديالك.',
    company_name: 'كتب اسم الشركة أو المشروع.',
    activity_type: 'كتب نوع النشاط (مثلاً: مطعم، صالون، محامي…).',
    phone_missing: 'كتب رقم الهاتف.',
    phone_invalid: 'رقم الهاتف ماشي صحيح. مثال: 06 12 34 56 78',
    address: 'كتب العنوان الكامل (الحي، الشارع، الرقم، المدينة).',
    has_design: 'اختار واش عندك تصميم واجد ولا لا.',
    file_size: 'الملف كبير بزاف. الحد الأقصى 4 ميغا — تقدر تكمل الطلب بلا ملف ونتواصلو معاك.',
    file_type: 'نوع الملف ماشي مقبول. استعمل PDF، JPG، PNG، AI، EPS، PSD، CDR أو ZIP.',
    network: 'ما قدرناش نصيفطو الطلب. تأكد من الأنترنت وعاود اضغط على الزر.',
    server: 'وقع مشكل تقني. عاود جرب من بعد شوية.',
  };

  const toLatinDigits = (s) => s
    .replace(/[٠-٩]/g, (d) => d.charCodeAt(0) - 0x0660)
    .replace(/[۰-۹]/g, (d) => d.charCodeAt(0) - 0x06F0);
  const validPhone = (v) => /^(?:\+212|00212|212|0)[5-7]\d{8}$/.test(toLatinDigits(v).replace(/[\s\-.()‎‏]/g, ''));
  const val = (name) => (form.elements[name] && typeof form.elements[name].value === 'string' ? form.elements[name].value.trim() : '');
  const choice = () => { const c = form.querySelector('input[name="has_design"]:checked'); return c ? c.value : ''; };

  function setError(name, message) {
    const box = $(`#e-${name}`);
    if (box) box.textContent = message || '';
    const target = name === 'has_design' ? designSet : name === 'design_file' ? fileInput : form.elements[name];
    if (target && target.setAttribute) {
      if (message) target.setAttribute('aria-invalid', 'true');
      else target.removeAttribute('aria-invalid');
    }
  }

  function checkField(name) {
    const v = val(name);
    let msg = '';
    switch (name) {
      case 'full_name': if (v.length < 2) msg = MSG.full_name; break;
      case 'company_name': if (v.length < 1) msg = MSG.company_name; break;
      case 'activity_type': if (v.length < 2) msg = MSG.activity_type; break;
      case 'phone': msg = !v ? MSG.phone_missing : (validPhone(v) ? '' : MSG.phone_invalid); break;
      case 'address': if (v.length < 6) msg = MSG.address; break;
      case 'has_design': if (!choice()) msg = MSG.has_design; break;
      default: break;
    }
    setError(name, msg);
    return !msg;
  }

  const FIELDS = ['full_name', 'company_name', 'activity_type', 'phone', 'address', 'has_design'];

  // Re-check a field as soon as the customer fixes it.
  form.addEventListener('input', (e) => {
    const n = e.target.name;
    if (FIELDS.includes(n) && $(`#e-${n}`) && $(`#e-${n}`).textContent) checkField(n);
  });
  form.elements.phone.addEventListener('blur', () => { if (val('phone')) checkField('phone'); });

  // First interaction with the form = checkout started.
  let checkoutTracked = false;
  form.addEventListener('focusin', () => {
    if (checkoutTracked) return;
    checkoutTracked = true;
    track('track', 'InitiateCheckout', { value: 290, currency: 'MAD', content_name: 'Cartes de Visite', num_items: 1 });
  });

  /* Design: show upload or description depending on the answer */
  function syncBranch() {
    const c = choice();
    branchYes.hidden = c !== 'yes';
    branchNo.hidden = c !== 'no';
    if (c) setError('has_design', '');
  }
  form.querySelectorAll('input[name="has_design"]').forEach((r) => r.addEventListener('change', syncBranch));
  syncBranch();

  /* File picking */
  const fmtSize = (b) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`);
  function fileProblem(f) {
    const ext = (f.name.split('.').pop() || '').toLowerCase();
    if (!FILE_EXT.includes(ext)) return MSG.file_type;
    if (f.size > MAX_BYTES) return MSG.file_size;
    return '';
  }
  function showFile() {
    const f = fileInput.files && fileInput.files[0];
    if (!f) { filePill.hidden = true; drop.hidden = false; setError('design_file', ''); return; }
    const problem = fileProblem(f);
    if (problem) { fileInput.value = ''; filePill.hidden = true; drop.hidden = false; setError('design_file', problem); return; }
    setError('design_file', '');
    $('#file-name').textContent = f.name;
    $('#file-size').textContent = fmtSize(f.size);
    filePill.hidden = false;
    drop.hidden = true;
  }
  fileInput.addEventListener('change', showFile);
  $('#file-clear').addEventListener('click', () => { fileInput.value = ''; showFile(); fileInput.focus(); });
  ['dragenter', 'dragover'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add('is-over'); }));
  ['dragleave', 'drop'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.remove('is-over'); }));
  drop.addEventListener('drop', (e) => {
    const files = e.dataTransfer && e.dataTransfer.files;
    if (files && files.length) {
      try { const dt = new DataTransfer(); dt.items.add(files[0]); fileInput.files = dt.files; } catch (_) { return; }
      showFile();
    }
  });

  /* Submit */
  let sending = false;
  const SUBMIT_LABEL = submitBtn.textContent;
  function busy(on) {
    sending = on;
    submitBtn.setAttribute('aria-busy', String(on));
    submitBtn.disabled = on;
    submitBtn.innerHTML = on ? '<span class="spin" aria-hidden="true"></span><span>كنصيفطو الطلب…</span>' : '';
    if (!on) submitBtn.textContent = SUBMIT_LABEL;
  }

  function focusFirstError() {
    const first = FIELDS.concat('design_file').find((n) => $(`#e-${n}`) && $(`#e-${n}`).textContent);
    if (!first) return;
    const el = first === 'has_design' ? designSet.querySelector('input') : first === 'design_file' ? drop : form.elements[first];
    const field = (first === 'has_design' ? designSet : el.closest('.field')) || el;
    field.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
    setTimeout(() => el.focus({ preventScroll: true }), reduceMotion ? 0 : 350);
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (sending) return;
    formError.textContent = '';

    const ok = FIELDS.map(checkField).every(Boolean);
    if (!ok) { focusFirstError(); return; }

    const data = new FormData(form);
    if (choice() === 'yes') data.delete('design_description');
    else data.delete('design_file');
    if (data.get('design_file') instanceof File && data.get('design_file').size === 0) data.delete('design_file');
    data.set('idem', idem);
    data.set('t', String(Math.round(performance.now() - startedAt)));
    for (const [k, v] of Object.entries(store.get('pp_tracking') || {})) data.set(k, v);

    busy(true);
    let res, body = {};
    try {
      res = await fetch(form.action, { method: 'POST', body: data, headers: { accept: 'application/json' } });
      body = await res.json().catch(() => ({}));
    } catch (_) {
      busy(false);
      formError.textContent = MSG.network;
      return;
    }

    if (res.ok && body.ok) {
      store.set('pp_last_order', { order_number: body.order_number, has_design: choice() === 'yes' });
      location.assign(`/merci/?o=${encodeURIComponent(body.order_number)}`);
      return;
    }

    busy(false);
    if (body.errors && typeof body.errors === 'object') {
      for (const [name, message] of Object.entries(body.errors)) setError(name, message);
      focusFirstError();
    } else {
      formError.textContent = body.message || MSG.server;
    }
  });
})();
