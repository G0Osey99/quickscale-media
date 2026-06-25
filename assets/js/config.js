/* ============================================================
   QuickScale Media — runtime config (PUBLIC values only).
   The lead form POSTs to leadEndpoint (the submit-lead Edge Function),
   which relays the lead into GoHighLevel. Set live:false for demo mode
   (validate + show success WITHOUT sending).
   ghlCalendarUrl: paste your GoHighLevel calendar embed URL to make the
   "Book a Call" buttons open instant booking (the form stays as a callback).
   Add metaPixelId / ga4MeasurementId to turn analytics on — they load only
   AFTER the visitor accepts the cookie banner.
   NEVER put secret keys here — this file is publicly served.
   ============================================================ */
window.QS_CONFIG = {
  live: true,               // true = POST to leadEndpoint (relays to GoHighLevel)
  leadEndpoint: "https://mymhjqwhhkwiqozynkul.supabase.co/functions/v1/submit-lead",
  ghlCalendarUrl: "",       // GoHighLevel calendar embed URL — when set, "Book a Call" opens instant booking
  supabaseUrl: "https://mymhjqwhhkwiqozynkul.supabase.co",  // public — the admin panel connects here
  supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15bWhqcXdoaGt3aXFvenlua3VsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIwMDc2MDIsImV4cCI6MjA5NzU4MzYwMn0.gtCKE6Au2TeWD8nvP4GN2M7ZhMRRfc95afz5954oQTU",  // PUBLIC anon key (RLS enforces access)
  turnstileSiteKey: "0x4AAAAAADouxnno8ldmEfEb",     // Cloudflare Turnstile PUBLIC site key — add in the anti-bot phase
  metaPixelId: "",          // Meta Pixel ID (public) — add with tracking
  ga4MeasurementId: "",     // GA4 Measurement ID, e.g. "G-XXXXXXXXXX" — add with tracking
  minFormSeconds: 3         // anti-bot timing trap: min seconds a human takes to submit
};
