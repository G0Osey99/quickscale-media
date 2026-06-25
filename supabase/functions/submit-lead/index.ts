// ============================================================
// QuickScale Media — submit-lead Edge Function (Deno).
//
// The public lead form POSTs here. This is a thin, hardened RELAY that
// forwards leads into GoHighLevel (the CRM / SMS / automation system) via a
// GHL Inbound Webhook. It verifies anti-spam (Turnstile + honeypot), validates
// and normalizes the fields, then forwards. It does NOT run a CRM of its own.
//
// Deploy:  supabase functions deploy submit-lead --no-verify-jwt
// Secrets (supabase secrets set ...):
//   GHL_WEBHOOK_URL     GoHighLevel Inbound Webhook URL — the primary lead sink.
//   ALLOWED_ORIGINS     comma-separated site origins (CORS).
//   TURNSTILE_SECRET    Cloudflare Turnstile secret (optional; if set, token required).
//   RESEND_API_KEY / NOTIFY_EMAIL / FROM_EMAIL   backup email notification (optional).
//   META_PIXEL_ID / META_CAPI_TOKEN              Meta CAPI "Lead" (optional).
// If GHL_WEBHOOK_URL is NOT set yet, the function falls back to storing the lead
// in Supabase (`leads`) so nothing is lost while GHL is being wired up.
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected automatically.
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ||
  "https://quickscalem.com,https://www.quickscalem.com,https://scalequick.cc,https://www.scalequick.cc,https://quickscale-media.minedude.workers.dev,http://localhost:8080")
  .split(",").map((s) => s.trim()).filter(Boolean);
const GHL_WEBHOOK_URL = Deno.env.get("GHL_WEBHOOK_URL") ?? "";
const TURNSTILE_SECRET = Deno.env.get("TURNSTILE_SECRET") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const NOTIFY_EMAIL = Deno.env.get("NOTIFY_EMAIL") ?? "";
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "leads@quickscalem.com";
const META_PIXEL_ID = Deno.env.get("META_PIXEL_ID") ?? "";
const META_CAPI_TOKEN = Deno.env.get("META_CAPI_TOKEN") ?? "";
const META_TEST_EVENT_CODE = Deno.env.get("META_TEST_EVENT_CODE") ?? "";
const META_API_VERSION = "v19.0";

function corsHeaders(origin: string | null) {
  const allow = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
    "Vary": "Origin",
  };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clean(s: unknown, max = 200): string {
  let out = "";
  for (const ch of String(s ?? "")) {
    const c = ch.codePointAt(0) ?? 0;
    if (c >= 32 && c !== 127) out += ch;
  }
  return out.trim().slice(0, max);
}
async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function clientIp(req: Request): string {
  const h = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for") ?? "0.0.0.0";
  return h.split(",")[0].trim();
}
function splitName(full: string): { first: string; last: string } {
  const parts = full.trim().split(/\s+/);
  return { first: parts[0] || full, last: parts.slice(1).join(" ") };
}
function e164(phoneRaw: string): string {
  const d = phoneRaw.replace(/\D/g, "");
  if (d.length === 10) return "+1" + d;
  if (d.length === 11 && d[0] === "1") return "+" + d;
  return d ? "+" + d : "";
}
async function postJson(target: string, payload: unknown, ms = 8000): Promise<boolean> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(target, { method: "POST", signal: ctl.signal, headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    return r.ok;
  } catch { return false; } finally { clearTimeout(timer); }
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req.headers.get("Origin"));
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "content-type": "application/json" } });
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const reqOrigin = req.headers.get("Origin");
  if (reqOrigin && !ALLOWED_ORIGINS.includes(reqOrigin)) return json({ error: "forbidden_origin" }, 403);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "bad_json" }, 400); }

  // Honeypot — pretend success.
  if (clean(body.company_website)) return json({ ok: true });

  // Cloudflare Turnstile (enforced only if a secret is configured).
  if (TURNSTILE_SECRET) {
    const token = clean(body.turnstileToken, 4000);
    if (!token) return json({ error: "captcha_required" }, 400);
    const form = new FormData();
    form.append("secret", TURNSTILE_SECRET);
    form.append("response", token);
    form.append("remoteip", clientIp(req));
    const v = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: form })
      .then((r) => r.json()).catch(() => ({ success: false }));
    if (!v.success) return json({ error: "captcha_failed" }, 400);
  }

  // Validate + normalize.
  const fullName = clean(body.fullName, 120);
  const business = clean(body.business, 160);
  const phoneRaw = clean(body.phone, 40);
  const email = clean(body.email, 200).toLowerCase();
  if (!fullName || !business || (phoneRaw.match(/\d/g) || []).length < 10 || !EMAIL_RE.test(email)) {
    return json({ error: "validation_failed" }, 422);
  }

  const rawIp = clientIp(req);
  const userAgent = clean(req.headers.get("user-agent"), 400);
  const smsConsent = body.smsConsent === true;
  const consentText = smsConsent ? clean(body.consentText, 600) : "";
  const eventId = clean(body.eventId, 80);
  const sourcePage = clean(body.sourcePage, 40);
  const pageUrl = clean(body.pageUrl, 500);
  const attribution = (body.attribution && typeof body.attribution === "object" && JSON.stringify(body.attribution).length <= 2000)
    ? body.attribution as Record<string, unknown> : {};
  const { first, last } = splitName(fullName);

  // Backup notifications (best-effort) — run regardless of which sink is used.
  const notify: Promise<unknown>[] = [];
  if (RESEND_API_KEY && NOTIFY_EMAIL) {
    notify.push((async () => {
      const campaign = attribution.utm_campaign ? String(attribution.utm_campaign) : "-";
      const lines = ["New strategy-call request", "", "Name: " + fullName, "Business: " + business,
        "Phone: " + phoneRaw, "Email: " + email, "SMS consent: " + (smsConsent ? "yes" : "no"),
        "Source: " + sourcePage, "Campaign: " + campaign];
      const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), 5000);
      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST", signal: ctl.signal,
          headers: { "Authorization": "Bearer " + RESEND_API_KEY, "content-type": "application/json" },
          body: JSON.stringify({ from: FROM_EMAIL, to: NOTIFY_EMAIL, subject: "New lead: " + fullName + " - " + business, text: lines.join("\n") }),
        });
      } finally { clearTimeout(timer); }
    })());
  }
  if (META_PIXEL_ID && META_CAPI_TOKEN && eventId) {
    notify.push((async () => {
      const digits = phoneRaw.replace(/\D/g, "");
      const phoneNorm = digits.length === 10 ? "1" + digits : digits;
      const fbclid = typeof attribution.fbclid === "string" ? attribution.fbclid : "";
      const landedMs = typeof attribution.landingAt === "string" ? Date.parse(attribution.landingAt) : NaN;
      const fbcTime = Number.isFinite(landedMs) ? landedMs : Date.now();
      const fbp = clean(body.fbp, 100);
      const userData: Record<string, unknown> = { em: [await sha256(email)], ph: [await sha256(phoneNorm)], client_ip_address: rawIp, client_user_agent: userAgent };
      if (fbclid) userData.fbc = "fb.1." + fbcTime + "." + fbclid;
      if (fbp) userData.fbp = fbp;
      const payload: Record<string, unknown> = { data: [{ event_name: "Lead", event_time: Math.floor(Date.now() / 1000), event_id: eventId, action_source: "website", event_source_url: pageUrl || undefined, user_data: userData }] };
      if (META_TEST_EVENT_CODE) payload.test_event_code = META_TEST_EVENT_CODE;
      await postJson("https://graph.facebook.com/" + META_API_VERSION + "/" + META_PIXEL_ID + "/events?access_token=" + encodeURIComponent(META_CAPI_TOKEN), payload, 5000);
    })());
  }

  // ---------- PRIMARY SINK: GoHighLevel inbound webhook ----------
  if (GHL_WEBHOOK_URL) {
    const ghlPayload = {
      firstName: first, lastName: last, name: fullName,
      email, phone: e164(phoneRaw) || phoneRaw, companyName: business,
      source: "Website" + (sourcePage ? " (" + sourcePage + ")" : ""),
      smsConsent, consentText, consentIp: smsConsent ? rawIp : "",
      pageUrl, eventId,
      utmSource: clean(attribution.utm_source, 120), utmMedium: clean(attribution.utm_medium, 120),
      utmCampaign: clean(attribution.utm_campaign, 200), utmContent: clean(attribution.utm_content, 200),
      utmTerm: clean(attribution.utm_term, 200), fbclid: clean(attribution.fbclid, 200),
      gclid: clean(attribution.gclid, 200), referrer: clean(attribution.referrer, 300),
      tags: ["website-lead"],
    };
    const ok = await postJson(GHL_WEBHOOK_URL, ghlPayload);
    if (!ok) {
      // Dead-letter: never lose a lead. Store in Supabase if available (email is already queued).
      try {
        const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
        await db.from("leads").insert({ full_name: fullName, business, phone: phoneRaw, email, sms_consent: smsConsent, consent_text: consentText || null, consent_ip: smsConsent ? rawIp : null, source_page: sourcePage, page_url: pageUrl, attribution, event_id: eventId, ip_hash: await sha256(rawIp), user_agent: userAgent });
      } catch (e) { console.error("ghl_failed_and_store_failed", e); }
    }
    if (notify.length) { try { await Promise.allSettled(notify); } catch (e) { console.error("notify_failed", e); } }
    return json({ ok: true });
  }

  // ---------- FALLBACK (GHL not configured yet): store in Supabase ----------
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const ipHash = await sha256(rawIp);
  const since = new Date(Date.now() - 60_000).toISOString();
  const { count } = await db.from("leads").select("id", { count: "exact", head: true }).eq("ip_hash", ipHash).gte("created_at", since);
  if ((count ?? 0) >= 5) return json({ error: "rate_limited" }, 429);

  const { error } = await db.from("leads").insert({
    full_name: fullName, business, phone: phoneRaw, email, sms_consent: smsConsent,
    consent_text: consentText || null, consent_ip: smsConsent ? rawIp : null,
    source_page: sourcePage, page_url: pageUrl, attribution, event_id: eventId, ip_hash: ipHash, user_agent: userAgent,
  }).select("id").single();
  if (error) { console.error("insert_failed", error); return json({ error: "server_error" }, 500); }
  if (notify.length) { try { await Promise.allSettled(notify); } catch (e) { console.error("notify_failed", e); } }
  return json({ ok: true });
});
