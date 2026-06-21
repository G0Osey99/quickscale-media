/* ============================================================
   QuickScale Media — runtime config (PUBLIC values only).
   Demo mode by default: the lead forms validate and show the
   success state WITHOUT sending anywhere. After wiring the
   Supabase backend (see PROVISION.md), set live:true and fill
   in the endpoint + public keys below.
   NEVER put secret keys here — this file is publicly served.
   ============================================================ */
window.QS_CONFIG = {
  live: false,              // false = demo mode (no network); true = POST to leadEndpoint
  leadEndpoint: "",         // e.g. "https://YOUR-PROJECT.functions.supabase.co/submit-lead"
  turnstileSiteKey: "",     // Cloudflare Turnstile PUBLIC site key (optional anti-bot widget)
  metaPixelId: "",          // Meta Pixel ID (public) — enables Pixel PageView + Lead events
  ga4MeasurementId: "",     // GA4 Measurement ID, e.g. "G-XXXXXXXXXX" (public)
  minFormSeconds: 3         // anti-bot timing trap: min seconds a human takes to submit
};
