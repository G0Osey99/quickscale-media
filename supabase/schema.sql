-- ============================================================
-- QuickScale Media — Supabase schema + Row-Level Security
-- Run this in the Supabase SQL editor (or `supabase db push`).
-- Model: the PUBLIC can never touch these tables directly. The
-- public lead form posts to the submit-lead Edge Function, which
-- uses the service_role key (bypasses RLS) to insert. Admin users
-- read/write through RLS policies scoped to their role.
-- ============================================================

-- ---------- enums ----------
do $$ begin
  create type lead_status as enum ('new','contacted','booked','won','lost');
exception when duplicate_object then null; end $$;

do $$ begin
  create type app_role as enum ('owner','editor','viewer');
exception when duplicate_object then null; end $$;

-- ---------- profiles (1:1 with auth.users) ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,                 -- mirrored from auth.users for the admin Users view
  role app_role not null default 'viewer',
  created_at timestamptz not null default now()
);
alter table public.profiles add column if not exists email text;
alter table public.profiles enable row level security;

-- New auth users get a profile automatically (default role viewer; promote in SQL).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email), new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();

-- role helpers (security definer so policies can read profiles without recursion)
create or replace function public.current_role()
returns app_role language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;
create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select public.current_role() in ('owner','editor');
$$;
create or replace function public.is_owner()
returns boolean language sql stable security definer set search_path = public as $$
  select public.current_role() = 'owner';
$$;

-- profiles policies
create policy "profiles: self or staff can read" on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_staff());
create policy "profiles: owner manages roles" on public.profiles
  for update to authenticated using (public.is_owner()) with check (public.is_owner());

-- ---------- leads ----------
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  full_name text not null,
  business text not null,
  phone text not null,
  email text not null,
  sms_consent boolean not null default false,
  consent_text text,
  consent_ip text,            -- retained only when sms_consent = true (TCPA proof)
  source_page text,
  page_url text,
  attribution jsonb not null default '{}'::jsonb,
  status lead_status not null default 'new',
  spam boolean not null default false,
  event_id text,              -- dedupe with Meta Pixel/CAPI
  ip_hash text,               -- sha-256(ip) for rate limiting (not raw IP)
  user_agent text
);
create index if not exists leads_created_idx on public.leads (created_at desc);
create index if not exists leads_status_idx on public.leads (status);
create index if not exists leads_iphash_idx on public.leads (ip_hash, created_at desc);
alter table public.leads enable row level security;

-- NO public/insert policy on purpose: inserts happen via the Edge Function
-- (service_role, which bypasses RLS). Admins read; staff update; owner deletes.
create policy "leads: staff & viewers read" on public.leads
  for select to authenticated using (public.current_role() in ('owner','editor','viewer'));
create policy "leads: staff update" on public.leads
  for update to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "leads: owner delete" on public.leads
  for delete to authenticated using (public.is_owner());

-- ---------- lead notes ----------
create table if not exists public.lead_notes (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  author uuid references auth.users(id),
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists lead_notes_lead_idx on public.lead_notes (lead_id, created_at);
alter table public.lead_notes enable row level security;
create policy "notes: staff read" on public.lead_notes
  for select to authenticated using (public.current_role() in ('owner','editor','viewer'));
create policy "notes: staff insert" on public.lead_notes
  for insert to authenticated with check (public.is_staff() and author = auth.uid());

-- ---------- media slots (the manifest, server-side) ----------
create table if not exists public.media_slots (
  id text primary key,
  page text not null,
  label text not null,
  type text not null,           -- image | video
  aspect text,
  current text,                 -- published asset path/URL (null = placeholder)
  alt text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
alter table public.media_slots enable row level security;
create policy "media: authenticated read" on public.media_slots
  for select to authenticated using (true);
create policy "media: staff write" on public.media_slots
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
-- Public site reads PUBLISHED media (rows with an asset) so uploads render on the pages.
create policy "media_slots public read" on public.media_slots
  for select to anon using (current is not null);

-- ---------- audit log ----------
create table if not exists public.audit_log (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  actor uuid references auth.users(id),
  action text not null,
  meta jsonb not null default '{}'::jsonb,
  ip text
);
alter table public.audit_log enable row level security;
create policy "audit: owner reads" on public.audit_log
  for select to authenticated using (public.is_owner());
create policy "audit: staff append" on public.audit_log
  for insert to authenticated with check (public.is_staff() and actor = auth.uid());

-- ---------- storage bucket for uploads ----------
insert into storage.buckets (id, name, public) values ('media','media', true)
  on conflict (id) do nothing;
-- Public object URLs are served by the storage CDN (no SELECT policy needed). Staff manage
-- uploads; listing via the Storage API is restricted to staff.
drop policy if exists "media staff read" on storage.objects;
drop policy if exists "media staff insert" on storage.objects;
drop policy if exists "media staff update" on storage.objects;
drop policy if exists "media staff delete" on storage.objects;
create policy "media staff read" on storage.objects
  for select to authenticated using (bucket_id = 'media' and public.is_staff());
create policy "media staff insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'media' and public.is_staff());
create policy "media staff update" on storage.objects
  for update to authenticated using (bucket_id = 'media' and public.is_staff())
  with check (bucket_id = 'media' and public.is_staff());
create policy "media staff delete" on storage.objects
  for delete to authenticated using (bucket_id = 'media' and public.is_staff());

-- ---------- site_content (editable site copy + settings for the admin) ----------
create table if not exists public.site_content (
  id text primary key,
  doc jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
alter table public.site_content enable row level security;
create policy "content public read" on public.site_content
  for select to anon, authenticated using (true);
create policy "content staff write" on public.site_content
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
insert into public.site_content (id, doc) values ('site', '{}'::jsonb) on conflict (id) do nothing;

-- The admin Users view invites teammates via the `admin-invite` Edge Function
-- (supabase/functions/admin-invite) — caller must be a signed-in owner.

-- ============================================================
-- AFTER you create the first admin user in the Supabase dashboard,
-- promote them to owner (replace the email):
--   update public.profiles set role = 'owner', full_name = 'Daniel Demidovich'
--   where id = (select id from auth.users where email = 'daniel@quickscalem.com');
-- Require MFA for that user via the dashboard (Authentication → MFA).
-- ============================================================
