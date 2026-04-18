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
  reference_images text[]
);

alter table cad_revisions
  add column if not exists reference_images text[];

create index if not exists cad_revisions_request_id_idx
  on cad_revisions(cad_request_id, created_at);

alter table cad_revisions enable row level security;

create policy "Authenticated users can do everything" on cad_revisions
  for all using (auth.role() = 'authenticated');
