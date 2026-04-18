-- Task 47: CAD partner handoff with expiring link, ZIP + PDF brief, WhatsApp
-- approve / request-revision response loop.
--
-- Adds two tables:
--   * cad_partner_share_links  — token-based handoff URL with TTL + revoke
--   * cad_partner_responses    — partner Approve / Request revision + comment
--
-- Both are accessed only via the service-role key from the public token route,
-- so RLS is locked down to service_role.

create extension if not exists "uuid-ossp";

create table if not exists cad_partner_share_links (
  token              uuid        primary key default gen_random_uuid(),
  cad_request_id     uuid        not null references cad_requests(id) on delete cascade,
  partner_name       text,
  partner_phone      text,
  created_at         timestamptz not null default now(),
  created_by         uuid,
  expires_at         timestamptz not null,
  revoked_at         timestamptz,
  last_opened_at     timestamptz
);

create index if not exists cad_partner_share_links_request_idx
  on cad_partner_share_links(cad_request_id, created_at desc);

alter table cad_partner_share_links enable row level security;
drop policy if exists "service_role_all" on cad_partner_share_links;
create policy "service_role_all" on cad_partner_share_links
  for all using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create table if not exists cad_partner_responses (
  id              uuid        primary key default gen_random_uuid(),
  link_id         uuid        not null references cad_partner_share_links(token) on delete cascade,
  cad_request_id  uuid        not null references cad_requests(id) on delete cascade,
  decision        text        not null check (decision in ('approved','revision')),
  comment         text,
  partner_name    text,
  ip              text,
  user_agent      text,
  responded_at    timestamptz not null default now()
);

create index if not exists cad_partner_responses_request_idx
  on cad_partner_responses(cad_request_id, responded_at desc);

alter table cad_partner_responses enable row level security;
drop policy if exists "service_role_all" on cad_partner_responses;
create policy "service_role_all" on cad_partner_responses
  for all using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- Atomic stamp helper for last_opened_at (called from the public page render).
create or replace function cad_partner_share_record_visit(p_token uuid) returns void as $func$
  update cad_partner_share_links set last_opened_at = now() where token = p_token;
$func$ language sql;
