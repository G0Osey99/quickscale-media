// ============================================================
// QuickScale Admin — invite-teammate Edge Function (Deno).
// Called by the admin Users view. Requires the caller to be a
// signed-in OWNER (verified via their JWT); then uses the
// service_role key to invite the email and set their role.
//
// Deploy: supabase functions deploy admin-invite
// SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY are injected.
// Optional secret: ADMIN_ORIGINS (comma-separated CORS allowlist).
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = (Deno.env.get("ADMIN_ORIGINS") ||
  "https://quickscalem.com,https://www.quickscalem.com,https://admin.quickscalem.com,https://quickscale-media.minedude.workers.dev,http://localhost:8080,http://localhost:8137,http://localhost:8166")
  .split(",").map((s) => s.trim()).filter(Boolean);

function corsHeaders(origin: string | null) {
  const allow = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, content-type",
    "Vary": "Origin",
  };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLES = ["owner", "editor", "viewer"];

Deno.serve(async (req) => {
  const cors = corsHeaders(req.headers.get("Origin"));
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "content-type": "application/json" } });
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader) return json({ error: "unauthorized" }, 401);

  // 1. Verify the caller is a real signed-in user (validates their JWT).
  const caller = createClient(url, anon, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: { user }, error: uerr } = await caller.auth.getUser();
  if (uerr || !user) return json({ error: "unauthorized" }, 401);

  // 2. Confirm the caller is an OWNER (service_role read, bypasses RLS).
  const admin = createClient(url, service, { auth: { persistSession: false } });
  const { data: prof } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (!prof || prof.role !== "owner") return json({ error: "forbidden" }, 403);

  // 3. Validate input.
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "bad_json" }, 400); }
  const email = String(body.email ?? "").trim().toLowerCase();
  const role = ROLES.includes(String(body.role)) ? String(body.role) : "viewer";
  if (!EMAIL_RE.test(email)) return json({ error: "invalid_email" }, 422);

  // 4. Invite + assign role (the new profile row is created by the on_auth_user_created trigger).
  const redirectTo = (req.headers.get("Origin") || ALLOWED_ORIGINS[0]) + "/admin/";
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo });
  if (error) return json({ error: "invite_failed", detail: error.message }, 400);
  if (data?.user?.id) {
    await admin.from("profiles").update({ role, email }).eq("id", data.user.id);
  }
  return json({ ok: true });
});
