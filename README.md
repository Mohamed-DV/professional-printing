# Professional Printing — 1000 cartes de visite à 290 MAD

Landing page (Arabic, RTL) + order form + order database + admin dashboard, built for Meta Ads traffic and deployed on Netlify. No framework, no external database: static pages, four Netlify Functions, and Netlify Blobs for storage.

## The offer (fixed server-side)

Every order is saved with these values, whatever the browser sends:

| field | value |
|---|---|
| product_name | `Cartes de Visite` |
| quantity | `1000` |
| printing_sides | `2` (Recto Verso) |
| design_included | `true` |
| design_price | `0` |
| unit_price | `0.29` |
| total_price | `290` |
| currency | `MAD` |

They live in `netlify/lib/offer.mjs`. Change the offer there (and the copy in `public/index.html`).

## Deploy on Netlify

1. Push this folder to a GitHub/GitLab repo, then in Netlify: **Add new site → Import an existing project**. Build settings are read from `netlify.toml` (`npm run build`, publish `dist`, functions in `netlify/functions`).
   - Or with the CLI: `npm install`, `npx netlify-cli deploy --build --prod`.
2. In **Site configuration → Environment variables**, add:

   | variable | required | what it does |
   |---|---|---|
   | `ADMIN_PASSWORD` | yes | password for `/admin/` |
   | `META_PIXEL_ID` | no | your Meta Pixel ID; the pixel is only added to the pages when this is set |
   | `SITE_URL` | no | e.g. `https://votre-domaine.ma`; defaults to Netlify's site URL (custom domain once connected). Used for canonical, Open Graph, sitemap, robots |
   | `ADMIN_SECRET` | no | separate key for signing admin sessions (defaults to the password) |

3. **Trigger a new deploy** after adding or changing variables — the site URL and pixel are written into the pages at build time.
4. Open `https://<your-site>/admin/` and sign in.

Netlify Blobs is enabled automatically on every Netlify site; there is nothing to set up.

## Pages

| path | what |
|---|---|
| `/` | landing page + order form |
| `/merci/?o=PP-…` | confirmation page (noindex) — fires the Meta `Purchase` event once per order |
| `/admin/` | order dashboard (noindex, password protected) |

## Order form

Fields: الاسم الكامل · اسم الشركة أو المشروع · نوع النشاط · رقم الهاتف · العنوان الكامل · واش عندك تصميم واجد؟

- **نعم، عندي تصميم** → optional file upload (PDF, JPG, PNG, WEBP, SVG, AI, EPS, PSD, CDR, ZIP — max 4 MB).
- **لا، بغيت تصميم مجاني** → optional description textarea.

Phone numbers are validated as Moroccan (05/06/07, +212, 00212, Arabic-Indic digits accepted) and stored as `+2126…`. Spam protection: hidden honeypot field + minimum fill time. Double taps / retries return the same order (idempotency key).

## Admin dashboard

- Customer info, quantity 1000, Recto Verso, design required (yes/no), 290 MAD, design file (preview / download) or description, status.
- Statuses: جديد → مؤكد → قيد التصميم → قيد الطباعة → تم الإرسال → تم التسليم, or ملغى.
- Filter by status, search by name / phone / company / order number, one-tap call & WhatsApp, CSV export (Excel-friendly, `;` separated, UTF-8 BOM), auto-refresh every minute.
- Sessions last 12 hours. Changing `ADMIN_PASSWORD` signs everyone out.

## Meta Ads tracking

With `META_PIXEL_ID` set:

| event | when |
|---|---|
| `PageView` | every page |
| `InitiateCheckout` | first interaction with the form |
| `Purchase` (value 290, MAD, `eventID` = order number) | on `/merci/`, once per order |

UTM parameters and `fbclid` from the ad URL are saved on the order (shown as "المصدر" in the admin and in the CSV). Switch `Purchase` to `Lead` in `public/assets/js/merci.js` if you prefer to optimise on leads for unconfirmed COD orders.

## Data

Stored in Netlify Blobs (site-wide stores):

- `pp-orders` — one JSON document per order, key `<timestamp>-<order_number>`
- `pp-design-files` — uploaded design files, same key as the order
- `pp-order-idempotency` — duplicate-submit protection

Example order:

```json
{
  "order_number": "PP-261016-9H55",
  "created_at": "2026-10-16T02:59:22.338Z",
  "status": "new",
  "full_name": "يوسف بناني",
  "company_name": "مطعم الأطلس",
  "activity_type": "مطعم",
  "phone": "+212612345678",
  "address": "حي الرياض، شارع 5، رقم 12، الرباط",
  "has_design": false,
  "design_required": true,
  "design_file": null,
  "design_description": "أسود وذهبي، اللوغو، الاسم والهاتف",
  "product_name": "Cartes de Visite",
  "quantity": 1000,
  "printing_sides": 2,
  "design_included": true,
  "design_price": 0,
  "unit_price": 0.29,
  "total_price": 290,
  "currency": "MAD",
  "tracking": { "utm_source": "facebook", "utm_campaign": "cv-290" }
}
```

The admin loads the newest 150 orders at a time ("تحميل طلبات أقدم" loads more). If volume grows into the thousands per month, move the orders to a SQL database (e.g. Netlify DB / Supabase) — only `netlify/functions/*` would change.

## Local development

```bash
npm install
npm i -g netlify-cli
cp .env.example .env   # then set ADMIN_PASSWORD in .env (local only)
npm run dev          # http://localhost:8888  (admin: /admin/)
```

## Project layout

```
public/                 static site (copied to dist/ by scripts/build.mjs)
  index.html            landing + form (critical CSS inlined)
  merci/index.html      confirmation
  admin/index.html      dashboard
  assets/js/            order.js, merci.js, admin.js, pixel.js
  assets/img/           logo, mark, badge, icons, og-cover.jpg
  assets/fonts/         Alexandria (self-hosted, Arabic + Latin subset)
netlify/functions/      orders-create, admin-login, admin-orders, admin-file
netlify/lib/            offer constants, validation, auth, helpers
scripts/build.mjs       fills __SITE_URL__, __META_PIXEL_ID__, __V__ (cache-busting)
netlify.toml            build, headers (CSP, caching), functions
```
