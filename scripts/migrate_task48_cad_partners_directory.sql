-- Task 48: CAD partner directory
--
-- Adds a small directory of recurring CAD partners so the design team can pick
-- one from a dropdown when generating a share link instead of retyping the
-- name/phone every time. Each partner can carry an optional default TTL and
-- free-form notes (e.g. file format preferences). Existing share links are
-- left untouched; they simply have no partner_id until a fresh link is
-- generated against a directory entry.
--
-- Idempotent: safe to re-run.

create extension if not exists "uuid-ossp";

create table if not exists cad_partners (
  id                uuid        primary key default gen_random_uuid(),
  name              text        not null,
  phone             text,
  notes             text,
  default_ttl_days  integer     not null default 7
                                check (default_ttl_days between 1 and 30),
  is_active         boolean     not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create unique index if not exists cad_partners_name_lower_idx
  on cad_partners (lower(name));

alter table cad_partners enable row level security;
drop policy if exists "service_role_all" on cad_partners;
create policy "service_role_all" on cad_partners
  for all using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- Bind share links to a directory partner (optional — ad-hoc entries with
-- only partner_name/partner_phone are still allowed for one-off shares).
alter table cad_partner_share_links
  add column if not exists cad_partner_id uuid
    references cad_partners(id) on delete set null;

create index if not exists cad_partner_share_links_partner_idx
  on cad_partner_share_links(cad_partner_id, created_at desc);
