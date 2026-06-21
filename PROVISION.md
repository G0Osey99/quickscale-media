# Going live — provisioning the QuickScale backend

The public site and the admin ship as a **front-end prototype**: forms validate
and show success but don't send, and the admin's login is theatrical (gates the UI
only). This guide turns it into a real, hardened system on **Supabase** free tier.

You'll need ~45–60 minutes and these accounts (all have free tiers):
**Supabase**, a **transactional email** provider (Resend/Postmark), **Cloudflare**
(Turnstile anti-bot), and — for tracking — **Meta** (Pixel/CAPI) and **Google** (GA4).

---

## 1. Supabase project
1. Create a project at supabase.com. Copy the **Project URL** and **anon public key** (Settings → API).
2. SQL Editor → paste and run **`supabase/schema.sql`** (creates tables, RLS, roles, triggers).
3. Storage → create a bucket named **`media`**, set **public read**. Then add policies:
   - SELECT: `true` (public read of published media)
   - INSERT/UPDATE/DELETE: `public.is_staff()` (only signed-in staff upload)

## 2. First admin user (the "temporary user")
1. Authentication → Users → **Add user** (email + a strong password). Use a real inbox you control.
2. Promote to owner (SQL Editor):
   ```sql
   update public.profiles set role='owner', full_name='Daniel Demidovich'
   where id = (select id from auth.users where email='daniel@quickscalem.com');
   ```
3. Authentication → Providers/Policies → **require MFA**; sign in once to enroll TOTP and save the backup codes.

> Later, onboard teammates with **Authentication → invite** (or `inviteUserByEmail`). The invite link is single-use; the new user sets a password and enrolls 2FA. Roles: `owner` / `editor` / `viewer` (set in `profiles.role`).

## 3. Anti-bot — Cloudflare Turnstile
1. Cloudflare dashboard → Turnstile → add a widget for your domain. Copy the **site key** (public) and **secret key**.

## 4. Email notifications — Resend (or Postmark)
1. Create an API key. Verify your sending domain and set **SPF, DKIM, DMARC** DNS records (so invites/alerts don't spoof or land in spam).

## 5. Deploy the lead endpoint (Edge Function)
Install the Supabase CLI, then from this folder:
```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase functions deploy submit-lead --no-verify-jwt
supabase secrets set ALLOWED_ORIGIN="https://g0osey99.github.io" \
  TURNSTILE_SECRET="..." RESEND_API_KEY="..." \
  NOTIFY_EMAIL="daniel@quickscalem.com" FROM_EMAIL="leads@quickscalem.com"
```
The function URL looks like `https://YOUR_PROJECT.functions.supabase.co/submit-lead`.
(Set `ALLOWED_ORIGIN` to `https://quickscalem.com` once the domain is live.)

## 6. Turn the public forms on
Edit **`assets/js/config.js`**:
```js
window.QS_CONFIG = {
  live: true,
  leadEndpoint: "https://YOUR_PROJECT.functions.supabase.co/submit-lead",
  turnstileSiteKey: "0x4AAAA...",   // public
  metaPixelId: "1234567890",        // public
  ga4MeasurementId: "G-XXXXXXX",    // public
  minFormSeconds: 3
};
```
(To show the visible Turnstile widget, add the Turnstile script + a `<div class="cf-turnstile">` to both forms and include the token as `turnstileToken` in the payload — the function already verifies it.)

## 7. Connect the admin to Supabase (remaining dev step)
The admin UI is built backend-ready. To make it real, in `admin/assets/admin.js` swap the
`QS_MOCK` reads/writes for `supabase-js`:
- **Auth:** `supabase.auth.signInWithPassword()` → `supabase.auth.mfa.challengeAndVerify()` for the TOTP step (replaces the mock login). Backup codes via the MFA recovery flow.
- **Inbox:** `supabase.from('leads').select()/update()`, notes via `lead_notes`.
- **Media:** `supabase.storage.from('media').upload()` then update `media_slots`.
- RLS already enforces who can read/write — the UI just calls the queries.

## 8. Harden the admin host (important)
GitHub Pages can't set security headers and the repo is public, so for production move
`admin/` to a host that can (Netlify, Cloudflare Pages, or Vercel) on a **noindex subdomain**
like `admin.quickscalem.com`, and set these response headers:
```
X-Robots-Tag: noindex
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: no-referrer
Content-Security-Policy: default-src 'self'; img-src 'self' data: https://YOUR_PROJECT.supabase.co; connect-src 'self' https://YOUR_PROJECT.supabase.co; frame-ancestors 'none'; object-src 'none'; base-uri 'none'
```
Optionally put **Cloudflare Access** (free) in front of the admin as a second front door.

## 9. Replace the placeholders (content)
- **NAP:** find/replace `(717) 555-0142` and confirm `hello@quickscalem.com` / address match your Google Business Profile (footer + Contact + JSON-LD).
- **Social links:** set the real Facebook/Instagram URLs (footer `href="#"`) and add them to JSON-LD `sameAs`.
- **Testimonials & stats:** only publish real, verifiable ones; don't add Review/AggregateRating schema until then.
- **Media:** upload real job-site photos/video via the admin (fills the slots in `media/slots.json`). Replace `assets/img/og-image.png` with a real share card.
- **Domain:** when `quickscalem.com` goes live, find/replace `https://g0osey99.github.io/quickscale-media` → `https://quickscalem.com` across the HTML + `sitemap.xml`/`robots.txt`/`llms.txt`, add a `CNAME` file, and fix the `404.html` base path (`/quickscale-media/` → `/`).

## 10. Tracking
- Meta Pixel + GA4 load automatically once their IDs are in `config.js`; the forms fire `Lead` / `generate_lead` on success (with an `event_id`).
- For accuracy, add **Meta Conversions API** server-side (reuse the same `event_id` to dedupe) — a Phase-2 add to the Edge Function.

## Security checklist (verify before real traffic)
- [ ] RLS on every table; public has **no** direct table access (inserts only via the Edge Function).
- [ ] MFA required for all admin users; backup codes saved.
- [ ] Secrets only in Supabase/host env — never in the repo or `config.js`. (`.gitignore` covers `.env`.)
- [ ] Turnstile + rate limit live on the form endpoint; honeypot/timing on the client.
- [ ] Admin on a noindex origin with the headers above; CSP enforced.
- [ ] SPF/DKIM/DMARC set on the sending domain.
- [ ] Free-tier pause mitigated: keep-alive cron + email on every insert (or upgrade to Pro).
- [ ] Have a lawyer review `privacy/` and `terms/` for your jurisdiction.
