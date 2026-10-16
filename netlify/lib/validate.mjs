import { FILE_TYPES, MAX_FILE_BYTES } from './offer.mjs';

// Arabic-Indic (٠-٩) and Persian (۰-۹) digits -> 0-9
const toLatinDigits = (s) =>
  s.replace(/[٠-٩]/g, (d) => d.charCodeAt(0) - 0x0660)
   .replace(/[۰-۹]/g, (d) => d.charCodeAt(0) - 0x06F0);

export function cleanText(value, max) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, max);
}

// Moroccan numbers: 06…, 07…, 05… or +212 / 00212 forms.
export function normalizeMoroccanPhone(value) {
  if (typeof value !== 'string') return null;
  const compact = toLatinDigits(value).replace(/[\s\-.()‎‏]/g, '');
  const m = compact.match(/^(?:\+212|00212|212|0)([5-7]\d{8})$/);
  return m ? `+212${m[1]}` : null;
}

export const fileExtension = (name) => {
  const m = /\.([a-z0-9]{1,5})$/i.exec(name || '');
  return m ? m[1].toLowerCase() : '';
};

const MESSAGES = {
  full_name: 'كتب الاسم الكامل ديالك.',
  company_name: 'كتب اسم الشركة أو المشروع.',
  activity_type: 'كتب نوع النشاط (مثلاً: مطعم، صالون، محامي…).',
  phone_missing: 'كتب رقم الهاتف.',
  phone_invalid: 'رقم الهاتف ماشي صحيح. مثال: 06 12 34 56 78',
  address: 'كتب العنوان الكامل (الحي، الشارع، الرقم، المدينة).',
  has_design: 'اختار واش عندك تصميم واجد ولا لا.',
  file_size: 'الملف كبير بزاف. الحد الأقصى 4 ميغا — تقدر تكمل الطلب بلا ملف ونتواصلو معاك.',
  file_type: 'نوع الملف ماشي مقبول. استعمل PDF، JPG، PNG، AI، EPS، PSD، CDR أو ZIP.',
};

/**
 * Validates the multipart form. Returns { errors, data, file }.
 * `errors` is keyed by form field name so the page can show each message
 * under its field.
 */
export function validateOrderForm(form) {
  const errors = {};
  const get = (k) => (typeof form.get(k) === 'string' ? form.get(k) : '');

  const full_name = cleanText(get('full_name'), 80);
  const company_name = cleanText(get('company_name'), 100);
  const activity_type = cleanText(get('activity_type'), 80);
  const phoneRaw = cleanText(get('phone'), 30);
  const address = cleanText(get('address'), 300);
  const hasDesignRaw = get('has_design');

  if (full_name.length < 2) errors.full_name = MESSAGES.full_name;
  if (company_name.length < 1) errors.company_name = MESSAGES.company_name;
  if (activity_type.length < 2) errors.activity_type = MESSAGES.activity_type;

  const phone = normalizeMoroccanPhone(phoneRaw);
  if (!phoneRaw) errors.phone = MESSAGES.phone_missing;
  else if (!phone) errors.phone = MESSAGES.phone_invalid;

  if (address.length < 6) errors.address = MESSAGES.address;

  let has_design = null;
  if (hasDesignRaw === 'yes') has_design = true;
  else if (hasDesignRaw === 'no') has_design = false;
  else errors.has_design = MESSAGES.has_design;

  // Only the branch the customer chose is kept.
  let file = null;
  let design_description = null;
  if (has_design === true) {
    const f = form.get('design_file');
    if (f && typeof f === 'object' && f.size > 0) {
      const ext = fileExtension(f.name);
      if (!FILE_TYPES[ext]) errors.design_file = MESSAGES.file_type;
      else if (f.size > MAX_FILE_BYTES) errors.design_file = MESSAGES.file_size;
      else file = { blob: f, ext, name: cleanText(f.name, 120) || `design.${ext}`, size: f.size, type: FILE_TYPES[ext] };
    }
  } else if (has_design === false) {
    design_description = cleanText(get('design_description'), 1000) || null;
  }

  const tracking = {};
  for (const k of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid']) {
    const v = cleanText(get(k), 200);
    if (v) tracking[k] = v;
  }

  return {
    errors,
    data: { full_name, company_name, activity_type, phone, address, has_design, design_description, tracking },
    file,
  };
}
