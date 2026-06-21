/* ============================================================
   QuickScale Media — runtime config (PUBLIC values only).
   Demo mode by default: the lead forms validate and show the
   success state WITHOUT sending anywhere. After wiring the
   Supabase backend (see PROVISION.md), set live:true and fill
   in the endpoint + public keys below.
   NEVER put secret keys here — this file is publicly served.
   ============================================================ */
window.QS_CONFIG = {
  live: true,               // true = POST to leadEndpoint (Supabase Edge Function)
  leadEndpoint: "https://mymhjqwhhkwiqozynkul.supabase.co/functions/v1/submit-lead",
  turnstileSiteKey: "",     // Cloudflare Turnstile PUBLIC site key — add in the anti-bot phase
  metaPixelId: "",          // Meta Pixel ID (public) — add with tracking
  ga4MeasurementId: "",     // GA4 Measurement ID, e.g. "G-XXXXXXXXXX" — add with tracking
  minFormSeconds: 3         // anti-bot timing trap: min seconds a human takes to submit
};
