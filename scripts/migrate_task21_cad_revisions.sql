-- Task 21: CAD revisions history
-- Captures each render upload by the team and each retailer revision request /
-- approval as its own row, so the conversation isn't lost when partner_feedback
-- gets overwritten on cad_requests.

create table if not exists cad_revisions (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  cad_request_id  uuid not null references cad_requests(id) on delete cascade,
  -- 'render'           -> internal team uploaded a new render set
  -- 'revision_request' -> retailer asked for changes
  -- 'approval'         -> retailer approved this revision
  kind            text not null check (kind in ('render','revision_request','approval')),
  -- 'admin' for internal team, 'retailer' for the partner
  author          text not null check (author in ('admin','retailer')),
  note            text,
  render_images   text[],
  -- Optional extra images attached alongside a render (annotated sketches,
  -- before/after comparisons, mood references). Shown in the timeline next to
  -- the renders. Task 36.
  reference_images text[],
  -- Optional per-image caption, parallel array to reference_images
  -- (e.g. "Before halo change", "Inspiration"). Same length / index as
  -- reference_images; entries may be null/empty when no caption was given.
  -- Task 42.
  reference_captions text[]
);

alter table cad_revisions
  add column if not exists reference_images text[];

alter table cad_revisions
  add column if not exists reference_captions text[];

create index if not exists cad_revisions_request_id_idx
  on cad_revisions(cad_request_id, created_at);

alter table cad_revisions enable row level security;

create policy "Authenticated users can do everything" on cad_revisions
  for all using (auth.role() = 'authenticated');

-- Task 40: design team can ACK a revision request via inbound WhatsApp reply.
-- Stamped on the matching `revision_request` row when the design team replies
-- "ACK <order#>" to the outbound ping. Null = not yet acknowledged.
alter table cad_revisions
  add column if not exists acknowledged_at timestamptz;

-- Shared bearer token used by the inbound WhatsApp webhook to verify that
-- requests are coming from the configured gateway. Empty = no auth required
-- (development only — set this in production).
insert into settings (key, value) values
  ('whatsapp_inbound_token', '')
on conflict (key) do nothing;
