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
  supabaseUrl: "https://mymhjqwhhkwiqozynkul.supabase.co",  // public — the admin panel connects here
  supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15bWhqcXdoaGt3aXFvenlua3VsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIwMDc2MDIsImV4cCI6MjA5NzU4MzYwMn0.gtCKE6Au2TeWD8nvP4GN2M7ZhMRRfc95afz5954oQTU",  // PUBLIC anon key (RLS enforces access)
  turnstileSiteKey: "0x4AAAAAADouxnno8ldmEfEb",     // Cloudflare Turnstile PUBLIC site key — add in the anti-bot phase
  metaPixelId: "",          // Meta Pixel ID (public) — add with tracking
  ga4MeasurementId: "",     // GA4 Measurement ID, e.g. "G-XXXXXXXXXX" — add with tracking
  minFormSeconds: 3         // anti-bot timing trap: min seconds a human takes to submit
};
