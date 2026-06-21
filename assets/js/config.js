/* ============================================================
   QuickScale Media — runtime config (PUBLIC values only).
   LIVE mode is enabled: the lead forms POST to the Supabase
   Edge Function (leadEndpoint) below. To return to demo mode
   (validate + show success WITHOUT sending), set live:false.
   Add metaPixelId / ga4MeasurementId to turn analytics on —
   they load only AFTER the visitor accepts the cookie banner.
   NEVER put secret keys here — this file is publicly served.
   ============================================================ */
window.QS_CONFIG = {
  live: true,               // true = POST to leadEndpoint (Supabase Edge Function)
  leadEndpoint: "https://mymhjqwhhkwiqozynkul.supabase.co/functions/v1/submit-lead",
  turnstileSiteKey: "0x4AAAAAADouxnno8ldmEfEb",     // Cloudflare Turnstile PUBLIC site key — add in the anti-bot phase
  metaPixelId: "",          // Meta Pixel ID (public) — add with tracking
  ga4MeasurementId: "",     // GA4 Measurement ID, e.g. "G-XXXXXXXXXX" — add with tracking
  minFormSeconds: 3         // anti-bot timing trap: min seconds a human takes to submit
};
