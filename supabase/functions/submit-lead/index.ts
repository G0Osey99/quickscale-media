// ============================================================
// QuickScale Media — submit-lead Edge Function (Deno).
// Public lead forms POST here. This is the ONLY public write path
// to the database; it uses the service_role key (server-side only)
// to insert into the RLS-protected `leads` table.
//
// Deploy:  supabase functions deploy submit-lead --no-verify-jwt
// Secrets (supabase secrets set ...):
//   ALLOWED_ORIGIN      e.g. https://quickscalem.com  (or the github.io URL)
//   TURNSTILE_SECRET    Cloudflare Turnstile secret  (optional; if set, token required)
//   RESEND_API_KEY      transactional email key      (optional)
//   NOTIFY_EMAIL        where new-lead alerts go      (optional)
//   FROM_EMAIL          verified sender, e.g. leads@quickscalem.com (optional)
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically.
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Fail-closed default (not '*'); PROVISION sets the ALLOWED_ORIGIN secret per environment.
const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") || "https://g0osey99.github.io";
const TURNSTILE_SECRET = Deno.env.get("TURNSTILE_SECRET") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const NOTIFY_EMAIL = Deno.env.get("NOTIFY_EMAIL") ?? "";
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "leads@quickscalem.com";

const cors = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
  "Vary": "Origin",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "content-type": "application/json" } });

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Trim, cap length, and drop ASCII control characters (codepoints < 32 and 127)
// while keeping normal punctuation like spaces, hyphens and parentheses.
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "bad_json" }, 400); }

  // Honeypot (if the client forwards it) — pretend success.
  if (clean(body.company_website)) return json({ ok: true });

  // Cloudflare Turnstile (only enforced if a secret is configured).
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

  // Validate + normalize (server is the source of truth).
  const fullName = clean(body.fullName, 120);
  const business = clean(body.business, 160);
  const phoneRaw = clean(body.phone, 40);
  const email = clean(body.email, 200).toLowerCase();
  const phoneDigits = (phoneRaw.match(/\d/g) || []).length;
  if (!fullName || !business || phoneDigits < 10 || !EMAIL_RE.test(email)) {
    return json({ error: "validation_failed" }, 422);
  }

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const db = createClient(url, serviceKey, { auth: { persistSession: false } });

  // Per-IP rate limit (sha-256 of IP, last 60s, max 5). Best-effort (non-atomic);
  // Turnstile is the primary bot defense — a race could let 1-2 extra requests through.
  const rawIp = clientIp(req);
  const ipHash = await sha256(rawIp);
  const since = new Date(Date.now() - 60_000).toISOString();
  const { count } = await db.from("leads").select("id", { count: "exact", head: true })
    .eq("ip_hash", ipHash).gte("created_at", since);
  if ((count ?? 0) >= 5) return json({ error: "rate_limited" }, 429);

  const smsConsent = body.smsConsent === true;
  const record = {
    full_name: fullName,
    business,
    phone: phoneRaw,
    email,
    sms_consent: smsConsent,
    consent_text: smsConsent ? clean(body.consentText, 600) : null,
    consent_ip: smsConsent ? rawIp : null, // TCPA proof only when consented
    source_page: clean(body.sourcePage, 40),
    page_url: clean(body.pageUrl, 500),
    attribution: (body.attribution && typeof body.attribution === "object" && JSON.stringify(body.attribution).length <= 2000) ? body.attribution : {},
    event_id: clean(body.eventId, 80),
    ip_hash: ipHash,
    user_agent: clean(req.headers.get("user-agent"), 400),
  };

  // PERSIST FIRST — a lead is never lost to a downstream (email) failure.
  const { data, error } = await db.from("leads").insert(record).select("id").single();
  if (error) { console.error("insert_failed", error); return json({ error: "server_error" }, 500); }

  // THEN notify (best-effort; failure does not fail the request).
  if (RESEND_API_KEY && NOTIFY_EMAIL) {
    try {
      const attr = record.attribution as Record<string, unknown>;
      const campaign = (attr && attr.utm_campaign) ? String(attr.utm_campaign) : "-";
      const lines = [
        "New strategy-call request",
        "",
        "Name: " + fullName,
        "Business: " + business,
        "Phone: " + phoneRaw,
        "Email: " + email,
        "SMS consent: " + (smsConsent ? "yes" : "no"),
        "Source: " + record.source_page,
        "Campaign: " + campaign,
      ];
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 5000);
      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          signal: ctl.signal,
          headers: { "Authorization": "Bearer " + RESEND_API_KEY, "content-type": "application/json" },
          body: JSON.stringify({
            from: FROM_EMAIL,
            to: NOTIFY_EMAIL,
            subject: "New lead: " + fullName + " - " + business,
            text: lines.join("\n"),
          }),
        });
      } finally { clearTimeout(timer); }
    } catch (e) { console.error("notify_failed", e); }
  }

  return json({ ok: true, id: data?.id });
});
