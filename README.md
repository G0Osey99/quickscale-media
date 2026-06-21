# QuickScale Media — Website (GitHub Pages build)

A static, framework-free rebuild of the **QuickScale Prototype** (Claude Design) as a
production-ready, GitHub Pages–compatible site. It reproduces the prototype's design 1:1
(Archivo + Hanken Grotesk type, `#FFC400` yellow on near-black, all sections and
interactions) while adding the structure, SEO, and accessibility called for in
`../Context/DESIGN.md`, `../Context/SEO.md`, and `../Context/TEARDOWN.md`.

The original prototype is a single-file Claude Design SPA (`<x-dc>` + `support.js` runtime)
wrapped in a Desktop/Mobile preview "chrome." That wrapper is the *viewer*, not the website —
this build is the actual site it represents: real multi-page structure, no runtime dependency.

## Structure

```
Prototype/
├── index.html              # Home (hero, proof, differentiator, value cards,
│                           #       stats, testimonials, team teaser, lead form #book)
├── services/ process/ about/ contact/   # the four sub-pages (folder + index.html)
├── privacy/ terms/         # legal pages (the SMS-consent form needs these)
├── 404.html                # Branded not-found page
├── assets/
│   ├── css/styles.css      # Design tokens + all components (one stylesheet)
│   ├── js/config.js        # PUBLIC runtime config (demo flag, endpoint, public keys)
│   ├── js/main.js          # Nav, carousel, count-up, FAQ, steps, lead form (live or demo)
│   └── img/                # favicon.svg, favicon-32.png, apple-touch-icon.png, icon-512.png, og-image.png
├── admin/                  # Admin panel — FRONT-END PROTOTYPE (login+2FA, inbox,
│   │                       #   media manager, content editor, users, settings)
│   ├── index.html
│   └── assets/             # admin.css, admin.js, mock-data.js
├── media/slots.json        # Registry of every replaceable media slot (uploader writes this)
├── supabase/               # BACKEND ACTIVATION KIT (run when going live)
│   ├── schema.sql          #   tables + Row-Level Security + roles
│   └── functions/submit-lead/index.ts   # hardened lead-capture Edge Function
├── robots.txt  sitemap.xml  llms.txt  .nojekyll
├── PROVISION.md            # step-by-step: flip the demo to a live Supabase backend
└── README.md
```

Pages use **folder + `index.html`** so URLs are clean slugs (`/services/`, `/process/`, …),
and links/assets are **relative**, so it works at a domain root *or* a project subpath
(`user.github.io/repo/`). Canonical/OG/sitemap now point at the production domain
`https://quickscalem.com` and the `404.html` base path is `/`. (See `../PRODUCTION_READINESS.md`
for current launch status and the remaining placeholders to replace.)

## Admin panel & backend

`admin/` is a polished, on-brand **front-end prototype** of the systems panel — login → TOTP
2FA → backup-code, a lead **inbox** (statuses, notes, search, mark-spam), a **media manager**
(every slot mapped, drag-drop, alt text), a **content editor**, **users/invites**, and
**settings**. It runs on demo data and a theatrical login (gates the UI only); it is `noindex`
and `Disallow`ed in robots.txt.

To make it real (login/2FA, an inbox that receives submissions, secure uploads, email invites),
follow **`PROVISION.md`** — it wires the public forms + admin to **Supabase** (Auth + TOTP MFA,
Postgres + RLS, Storage, invites) using the `supabase/` kit. The public forms are already
backend-ready: set `live:true` + the endpoint in `assets/js/config.js` and they POST to the
Edge Function (which validates, rate-limits, and persists before notifying).

## Preview locally

Any static server works (relative paths need http://, not file://):

```bash
cd Prototype
python -m http.server 8080      # then open http://localhost:8080
```

## Deploy to GitHub Pages

1. Commit this `Prototype/` content to a repo.
2. **Settings → Pages →** deploy from branch. Set the source to the folder that contains
   `index.html` (move these files to the repo root, or point Pages at `/Prototype`, or use
   an Actions workflow).
3. For a custom domain (`quickscalem.com`), add a `CNAME` file containing the domain,
   configure DNS, then find/replace the github.io demo URL → `https://quickscalem.com`
   across the HTML + `sitemap.xml`/`robots.txt`/`llms.txt` and fix the `404.html` base path.

## Replace before launch (placeholders)

The prototype shipped with placeholders; carry the real assets/data over:

- **Production domain** — if not `quickscalem.com`, find-and-replace it across the HTML
  (`<link rel="canonical">`, OG/Twitter URLs, JSON-LD `@id`/`url`, `sitemap.xml`, `robots.txt`, `llms.txt`).
- **NAP** — phone `(717) 555-0142` is a placeholder. Set the real phone/email/address and keep
  it **identical** to your Google Business Profile (footer, Contact page, and JSON-LD).
- **Social links** — footer Facebook/Instagram icons point to `href="#"`. Set real profile URLs
  (and add them to `sameAs` in the JSON-LD). *Don't ship a broken/fake link — the old site's
  fake Facebook link was flagged in TEARDOWN.md.*
- **Lead form** — currently a static demo that validates and shows the success state. Wire the
  submit to a real handler (Formspree, your CRM webhook, or a serverless function) and fire the
  **Meta Pixel `Lead`** event. See the marked `TODO` in `assets/js/main.js`.
- **Analytics/tracking** — add GA4 + Meta Pixel; set the form submission as a conversion event.
- **Real media** — striped boxes labeled "media goes here" are placeholders for your job-site
  photos/video. Swap in optimized WebP/AVIF with descriptive `alt` text and lazy-loading.
- **OG image** — `assets/img/og-image.png` is auto-generated branding; replace with a real photo
  card if you prefer.

## What's implemented from the Context docs

- **DESIGN.md** — mobile-first responsive (375/768/1024), 8-pt spacing, 60/30/10 color with
  yellow reserved for primary actions, modular type scale, dark text on yellow (AA), soft
  elevation, consistent radius, CSS-variable design tokens, `prefers-reduced-motion` support.
- **SEO.md** — one `<h1>` per page, logical headings, clean slugs, unique title + meta
  description per page, JSON-LD (Organization, WebSite, LocalBusiness/ProfessionalService,
  Service ×3, FAQPage, HowTo, Person, BreadcrumbList), Open Graph/Twitter, canonical,
  `sitemap.xml`, `robots.txt`, `llms.txt`, Lititz/Lancaster/PA signals, descriptive links.
- **TEARDOWN.md** — leads with the in-house-content differentiator and real proof
  (testimonials/results), one consistent CTA ("Book My Free Strategy Call"), the "on the call
  we will…" bullets beside every form, a rebuilt story-driven About page, a dedicated Process
  page, risk-reversal microcopy, and a sticky mobile booking bar.

## Accessibility & performance

- Semantic landmarks, labeled form fields, visible focus rings, skip link, ARIA on
  interactive widgets, keyboard-operable nav/forms.
- Works without JavaScript (content is server-rendered HTML; JS only enhances).
- Two self-hosted-via-Google web fonts with `display=swap`; no framework, no build step.
