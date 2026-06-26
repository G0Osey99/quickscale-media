/* ============================================================
   QuickScale Admin — DEMO fixtures.
   This file stands in for the Supabase database while the panel
   is a front-end prototype. When the backend is live, admin.js
   reads from supabase-js instead of window.QS_MOCK.
   Nothing here is real PII.
   ============================================================ */
window.QS_MOCK = {
  currentUser: { name: "Daniel Demidovich", email: "daniel@quickscalem.com", role: "Owner" },

  users: [
    { name: "Daniel Demidovich", email: "daniel@quickscalem.com", role: "Owner", status: "Active", twoFA: true, lastActive: "2026-06-20" },
    { name: "Ty Eckert", email: "ty@quickscalem.com", role: "Editor", status: "Invited", twoFA: false, lastActive: "—" }
  ],

  // Lead pipeline statuses, in order.
  statuses: ["new", "contacted", "booked", "won", "lost"],

  leads: [
    { id: "L-1042", name: "Mike Reilly", business: "Reilly Roofing", phone: "(717) 555-2087", email: "mike@reillyroofing.com", sourcePage: "home", campaign: "FB · Roofers · Lancaster", smsConsent: true, status: "new", spam: false, createdAt: "2026-06-20T13:42:00", notes: [] },
    { id: "L-1041", name: "Sandra Boyer", business: "Boyer Gutter Co.", phone: "(717) 555-3391", email: "sandra@boyergutter.com", sourcePage: "contact", campaign: "IG · Gutters · Lititz", smsConsent: false, status: "new", spam: false, createdAt: "2026-06-20T11:08:00", notes: [] },
    { id: "L-1040", name: "Carlos Mendez", business: "Mendez Painting LLC", phone: "(484) 555-7720", email: "carlos@mendezpaint.com", sourcePage: "home", campaign: "FB · Painters · Reading", smsConsent: true, status: "contacted", spam: false, createdAt: "2026-06-19T16:20:00", notes: [{ at: "2026-06-19T17:02:00", by: "Daniel", text: "Left voicemail, sent intro text." }] },
    { id: "L-1039", name: "Beth Hartman", business: "Hartman HVAC", phone: "(717) 555-8814", email: "beth@hartmanhvac.com", sourcePage: "home", campaign: "FB · HVAC · York", smsConsent: true, status: "booked", spam: false, createdAt: "2026-06-19T09:15:00", notes: [{ at: "2026-06-19T10:40:00", by: "Ty", text: "Booked strategy call for Mon 10am." }] },
    { id: "L-1038", name: "Greg Snyder", business: "Snyder Floor Coatings", phone: "(610) 555-1276", email: "greg@snyderfloors.com", sourcePage: "contact", campaign: "IG · Floor coating · Chester", smsConsent: false, status: "contacted", spam: false, createdAt: "2026-06-18T14:51:00", notes: [] },
    { id: "L-1037", name: "Tina Alvarez", business: "Alvarez Landscaping", phone: "(717) 555-4409", email: "tina@alvarezscapes.com", sourcePage: "home", campaign: "FB · Landscaping · Lancaster", smsConsent: true, status: "won", spam: false, createdAt: "2026-06-17T12:03:00", notes: [{ at: "2026-06-18T09:00:00", by: "Daniel", text: "Signed — content day scheduled." }] },
    { id: "L-1036", name: "Doug Keller", business: "Keller Exteriors", phone: "(717) 555-9930", email: "doug@kellerext.com", sourcePage: "home", campaign: "FB · Roofers · Harrisburg", smsConsent: true, status: "new", spam: false, createdAt: "2026-06-17T08:47:00", notes: [] },
    { id: "L-1035", name: "Priya Nair", business: "Nair Remodeling", phone: "(484) 555-2218", email: "priya@nairremodel.com", sourcePage: "contact", campaign: "IG · Remodel · Allentown", smsConsent: false, status: "lost", spam: false, createdAt: "2026-06-16T15:33:00", notes: [{ at: "2026-06-17T11:00:00", by: "Ty", text: "Budget too low right now, follow up Q4." }] },
    { id: "L-1034", name: "asdf qwerty", business: "—", phone: "(000) 000-0000", email: "spam@example.com", sourcePage: "home", campaign: "—", smsConsent: false, status: "new", spam: true, createdAt: "2026-06-16T03:12:00", notes: [] },
    { id: "L-1033", name: "Frank DiMauro", business: "DiMauro Concrete", phone: "(717) 555-6655", email: "frank@dimauroconcrete.com", sourcePage: "home", campaign: "FB · Concrete · Lancaster", smsConsent: true, status: "booked", spam: false, createdAt: "2026-06-15T10:22:00", notes: [] },
    { id: "L-1032", name: "Renee Walsh", business: "Walsh Window Cleaning", phone: "(610) 555-7041", email: "renee@walshwindows.com", sourcePage: "contact", campaign: "IG · Windows · West Chester", smsConsent: true, status: "won", spam: false, createdAt: "2026-06-13T13:18:00", notes: [] },
    { id: "L-1031", name: "Omar Haddad", business: "Haddad Fencing", phone: "(717) 555-5520", email: "omar@haddadfence.com", sourcePage: "home", campaign: "FB · Fencing · Lebanon", smsConsent: false, status: "contacted", spam: false, createdAt: "2026-06-12T09:40:00", notes: [] }
  ],

  kpis: {
    leadsToday: 2,
    leads7d: 9,
    leads30d: 38,
    booked30d: 11,
    won30d: 6,
    spend30d: "$9,400",
    costPerLead: "$247",
    bySource: [
      { label: "Facebook", value: 22 },
      { label: "Instagram", value: 13 },
      { label: "Direct / other", value: 3 }
    ],
    funnel: [
      { label: "Submitted", value: 38 },
      { label: "Contacted", value: 27 },
      { label: "Booked", value: 11 },
      { label: "Won", value: 6 }
    ]
  },

  // Mirrors media/slots.json for the demo media manager (avoids a fetch on file://).
  mediaSlots: [
    { id: "home-hero-reel", page: "Home", label: "Hero reel — job-site footage", type: "video", aspect: "4:3", current: null, alt: "" },
    { id: "home-proof-before", page: "Home", label: "Proof band — BEFORE", type: "image", aspect: "3:4", current: null, alt: "" },
    { id: "home-proof-after", page: "Home", label: "Proof band — AD RESULT", type: "image", aspect: "3:4", current: null, alt: "" },
    { id: "home-logo-1", page: "Home", label: "Client logo 1", type: "image", aspect: "free", current: null, alt: "" },
    { id: "home-logo-2", page: "Home", label: "Client logo 2", type: "image", aspect: "free", current: null, alt: "" },
    { id: "home-logo-3", page: "Home", label: "Client logo 3", type: "image", aspect: "free", current: null, alt: "" },
    { id: "home-logo-4", page: "Home", label: "Client logo 4", type: "image", aspect: "free", current: null, alt: "" },
    { id: "home-differentiator-reel", page: "Home", label: "Content day — on-site filming", type: "video", aspect: "16:10", current: null, alt: "" },
    { id: "home-team-daniel", page: "Home", label: "Team teaser — Daniel", type: "image", aspect: "1:1", current: null, alt: "" },
    { id: "home-team-ty", page: "Home", label: "Team teaser — Ty", type: "image", aspect: "1:1", current: null, alt: "" },
    { id: "services-content-reel", page: "Services", label: "In-house content reel", type: "video", aspect: "4:3", current: null, alt: "" },
    { id: "process-step-1", page: "Process", label: "Step 1 — Strategy Call", type: "image", aspect: "16:7", current: null, alt: "" },
    { id: "process-step-2", page: "Process", label: "Step 2 — Content Day", type: "image", aspect: "16:7", current: null, alt: "" },
    { id: "process-step-3", page: "Process", label: "Step 3 — Campaign Launch", type: "image", aspect: "16:7", current: null, alt: "" },
    { id: "process-step-4", page: "Process", label: "Step 4 — Follow-Up", type: "image", aspect: "16:7", current: null, alt: "" },
    { id: "about-founders", page: "About", label: "Founders on a job site", type: "image", aspect: "4:3", current: null, alt: "" },
    { id: "about-daniel", page: "About", label: "Daniel headshot", type: "image", aspect: "1:1", current: null, alt: "" },
    { id: "about-ty", page: "About", label: "Ty headshot", type: "image", aspect: "1:1", current: null, alt: "" },
    { id: "global-og-image", page: "Global", label: "Social share image (OG)", type: "image", aspect: "1200x630", current: "og-image.png", alt: "QuickScale Media" },
    { id: "global-favicon", page: "Global", label: "Favicon", type: "image", aspect: "32x32", current: "favicon-32.png", alt: "QuickScale Media icon" },
    { id: "global-apple-touch", page: "Global", label: "Apple touch icon", type: "image", aspect: "180x180", current: "apple-touch-icon.png", alt: "QuickScale Media icon" }
  ],

  // Editable content surfaces (the future light CMS). Values mirror the live site.
  content: {
    business: { name: "QuickScale Media", phone: "(717) 555-0142", email: "hello@quickscalem.com", city: "Lititz", region: "PA" },
    social: { facebook: "", instagram: "" },
    hero: { headline: "We've booked 1,400+ jobs for home service businesses.", sub: "We run your Meta ads and film the content ourselves — real footage from your job site that turns scrollers into booked estimates." },
    stats: [
      { value: "$800k+", label: "tracked revenue for clients" },
      { value: "20+", label: "home service clients" },
      { value: "1,400+", label: "jobs booked" }
    ],
    testimonials: [
      { quote: "42 estimate requests in our first month — booked solid for the summer.", name: "Dave R.", role: "Lancaster Roofing Co." },
      { quote: "They showed up, filmed the crew, and three weeks later my phone wouldn't stop ringing.", name: "Mia T.", role: "ProPaint PA" },
      { quote: "Finally an agency that gets home services. Real leads, not just 'brand awareness'.", name: "Sam K.", role: "GutterPros Lancaster" }
    ]
  },

  settings: {
    notifyEmail: "daniel@quickscalem.com",
    notifySlackWebhook: "",
    integrations: { supabaseUrl: "", metaPixelId: "", ga4MeasurementId: "", turnstileSiteKey: "", resendApiKey: "" }
  },

  auditLog: [
    { at: "2026-06-20T13:45:00", actor: "Daniel", action: "Uploaded media for home-hero-reel", ip: "—" },
    { at: "2026-06-20T09:02:00", actor: "Daniel", action: "Signed in (2FA passed)", ip: "—" },
    { at: "2026-06-19T17:02:00", actor: "Daniel", action: "Updated site content", ip: "—" },
    { at: "2026-06-19T10:40:00", actor: "Ty", action: "Invited ty@quickscalem.com (Editor)", ip: "—" },
    { at: "2026-06-18T09:00:00", actor: "Daniel", action: "Changed a teammate role → editor", ip: "—" }
  ]
};
