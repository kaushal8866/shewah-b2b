-- =====================================================================
-- DIP v5 — L2 attribute layer.
--
-- migration: migrate_dip_attributes
-- version:   1
-- requires:  migrate_dip_corpus.sql (dip_brands, dip_designs, dip_snapshots)
-- applies:   dip_model_versions, dip_extraction_runs, dip_attributes,
--            dip_gold_sets, dip_gold_labels, dip_actions
-- rollback:  scripts/rollback/README.md — NOT in this file, deliberately.
--            A `drop table` anywhere in the deploy path is a loaded gun
--            aimed at history that cannot be regenerated.
-- idempotent: yes. Safe to re-run.
--
-- Design notes that matter, stated once here:
--
--   * Parsing karat out of Shopify `options` is NOT a model call. It gets
--     its own extractor kind, because recording it as a Gemini output
--     would imply an uncertainty it does not have.
--   * A failed extraction must never read as "no attribute found". Hence
--     an explicit status column rather than absence.
--   * Every derived value points at the exact extractor version AND the
--     exact image that produced it. A CDN URL is not an identifier — the
--     same URL can serve a re-shot photo months later.
-- =====================================================================

create extension if not exists "uuid-ossp";

-- ---------------------------------------------------------------------
-- Extractor and model identity.
--
-- Must describe the ENTIRE extraction behaviour, not just the prompt:
-- two runs with the same prompt and different temperature are different
-- extractors and their outputs are not comparable.
-- ---------------------------------------------------------------------
create table if not exists dip_model_versions (
  id                 uuid primary key default uuid_generate_v4(),
  kind               text not null check (kind in ('structured_parser', 'vision_model', 'scorer')),
  version            text not null,          -- 'shopify-options-v1', 'gemini-vision-v1'
  provider           text,                   -- null for structured_parser
  model_name         text,
  temperature        numeric(4,3),
  max_output_tokens  int,
  prompt_hash        text,
  schema_version     text not null,          -- shape of the attribute output
  normalizer_version text not null,          -- code that maps raw -> typed
  git_commit         text,
  config             jsonb not null default '{}'::jsonb,
  notes              text,
  created_at         timestamptz not null default now(),
  unique (kind, version)
);

-- ---------------------------------------------------------------------
-- Extraction runs — reproducible selection.
--
-- Without this, "200 designs extracted" is a number with no referent and
-- a later run cannot be compared to it.
-- ---------------------------------------------------------------------
create table if not exists dip_extraction_runs (
  id                uuid primary key default uuid_generate_v4(),
  model_version_id  uuid not null references dip_model_versions(id) on delete restrict,
  started_at        timestamptz not null default now(),
  finished_at       timestamptz,
  status            text not null default 'running'
                    check (status in ('running', 'success', 'partial', 'failed')),

  -- what was selected
  brand_id          uuid references dip_brands(id) on delete restrict,
  market            text,
  category          text,
  selection_query   text,
  design_ids        uuid[],
  image_variant     text,                    -- e.g. 'primary@width=800'

  -- how it was run (denormalised from model_versions on purpose: the run
  -- record must stay readable even if a version row is later corrected)
  model_name        text,
  prompt_hash       text,
  git_commit        text,
  model_config      jsonb not null default '{}'::jsonb,

  designs_attempted int not null default 0,
  designs_extracted int not null default 0,
  designs_failed    int not null default 0,
  input_tokens      bigint not null default 0,
  output_tokens     bigint not null default 0,
  est_cost_usd      numeric(10,4) not null default 0,
  error             text
);

create index if not exists idx_dip_extraction_runs_started
  on dip_extraction_runs (started_at desc);
create index if not exists idx_dip_extraction_runs_version
  on dip_extraction_runs (model_version_id, started_at desc);

-- ---------------------------------------------------------------------
-- Attributes — one row per (design, extractor version).
--
-- Two versions coexist by design: that is what makes re-extraction
-- against history possible, and what lets v1 and v2 be compared.
-- ---------------------------------------------------------------------
create table if not exists dip_attributes (
  id                uuid primary key default uuid_generate_v4(),
  design_id         uuid not null references dip_designs(id) on delete restrict,
  model_version_id  uuid not null references dip_model_versions(id) on delete restrict,
  run_id            uuid references dip_extraction_runs(id) on delete set null,
  extracted_at      timestamptz not null default now(),

  -- A failure is a state, not an absence. 'extracted' with null fields and
  -- 'failed' mean completely different things downstream.
  status            text not null default 'pending'
                    check (status in ('pending', 'extracted', 'failed', 'skipped', 'needs_review')),
  failure_reason    text,                    -- 'image_download'|'model_timeout'|'rate_limit'|'parse'|...
  attempts          int not null default 0,

  -- inferred from the image
  category          text,
  silhouette        text,
  stone_shape       text,
  setting           text,
  stone_count       text,
  motif             text,
  occasion          text,

  -- OBSERVED from Shopify options. Offered SETS, never collapsed to a
  -- scalar: a design exists across a karat x colour matrix, and flattening
  -- it would invent a fact the merchant never stated.
  karat_options     int[],
  colour_options    text[],

  -- Validation only. The model reads the photograph; the photograph shows
  -- one colourway while the listing offers several. This may NEVER
  -- overwrite colour_options.
  image_colour_observed text,
  colour_check_status   text check (colour_check_status in ('pass', 'mismatch', 'uncertain', 'n/a')),

  -- Per field: origin, confidence, and the exact image + snapshot it came
  -- from. This is what lets AURORA explain why it believes something.
  evidence          jsonb not null default '{}'::jsonb,
  raw_model_output  jsonb,                   -- before normalisation

  unique (design_id, model_version_id)
);

create index if not exists idx_dip_attributes_design   on dip_attributes (design_id);
create index if not exists idx_dip_attributes_version  on dip_attributes (model_version_id, status);
create index if not exists idx_dip_attributes_status   on dip_attributes (status) where status <> 'extracted';
-- Signal queries filter on these constantly.
create index if not exists idx_dip_attributes_silhouette on dip_attributes (silhouette) where silhouette is not null;
create index if not exists idx_dip_attributes_shape      on dip_attributes (stone_shape) where stone_shape is not null;

-- ---------------------------------------------------------------------
-- Frozen evaluation sets.
--
-- Comparing extractor v1 to v2 across a set whose membership shifted
-- measures the SET, not the extractors. Hence `frozen`.
-- ---------------------------------------------------------------------
create table if not exists dip_gold_sets (
  id                   uuid primary key default uuid_generate_v4(),
  set_version          text not null unique,   -- 'gold_set_v1'
  purpose              text not null,
  field_list           text[] not null,        -- exactly which fields are labelled
  label_schema_version text not null,
  frozen               boolean not null default false,
  notes                text,
  created_at           timestamptz not null default now()
);

-- Human ground truth. Written by a person, never by an extraction run.
create table if not exists dip_gold_labels (
  id                   uuid primary key default uuid_generate_v4(),
  gold_set_id          uuid not null references dip_gold_sets(id) on delete restrict,
  design_id            uuid not null references dip_designs(id) on delete restrict,

  -- Pinned to the exact image that was looked at. The hash is what keeps a
  -- label from March meaningful in September after a merchant re-shoots.
  snapshot_id          uuid references dip_snapshots(id) on delete set null,
  image_url            text not null,
  image_sha256         text not null,
  image_index          int not null default 0,

  category             text,
  silhouette           text,
  stone_shape          text,
  setting              text,

  label_confidence     text check (label_confidence in ('certain', 'probable', 'unsure')),
  annotator            text not null,
  labelled_at          timestamptz,
  label_schema_version text not null,

  unique (gold_set_id, design_id)
);

create index if not exists idx_dip_gold_labels_set on dip_gold_labels (gold_set_id);

-- Multi-image evidence.
--
-- Added after building the first sheet, which showed that image[0] is often a
-- LIFESTYLE shot: a model wearing the ring at a distance where the setting and
-- stone shape are not visible at all. Filenames give no usable signal
-- ('Ear_3.png', 'Square_10_1x', 'InfinityRing_1.png'), so picking "the product
-- shot" heuristically is fragile.
--
-- Both the human labeller and the extractor therefore see the same first few
-- images, and the label is pinned to all of them. The singular image_url /
-- image_sha256 columns above stay as the primary, since a merchant re-shooting
-- image[0] is still the strongest change signal.
alter table dip_gold_labels add column if not exists image_urls text[];
alter table dip_gold_labels add column if not exists image_shas text[];

-- ---------------------------------------------------------------------
-- Actions — the label store. Empty for now, and that is the point:
-- a label not recorded this month cannot be recorded later.
-- ---------------------------------------------------------------------
create table if not exists dip_actions (
  id                 uuid primary key default uuid_generate_v4(),
  action_type        text not null,     -- render_tested|quote_issued|quote_won|sample_made|...
  occurred_at        timestamptz not null default now(),

  -- An action is rarely about a single design. It may concern an attribute,
  -- a bundle, a recommendation or a campaign.
  design_id          uuid references dip_designs(id) on delete set null,
  attribute_key      text,
  attribute_snapshot jsonb,
  market             text,

  -- Plain nullable uuids with NO foreign key: dip_scores, recommendations
  -- and experiments do not exist yet, and a constraint against a missing
  -- table is a broken migration. FKs arrive with those tables.
  score_id           uuid,
  recommendation_id  uuid,
  experiment_id      uuid,

  outcome            text,
  outcome_reason     text,
  margin_outcome     numeric(14,2),
  notes              text,
  created_at         timestamptz not null default now()
);

create index if not exists idx_dip_actions_occurred  on dip_actions (occurred_at desc);
create index if not exists idx_dip_actions_attribute on dip_actions (attribute_key) where attribute_key is not null;

-- ---------------------------------------------------------------------
-- RLS — owner only, matching the L0/L1 corpus. This is competitive
-- intelligence; the ingest and extraction jobs use the service role,
-- which bypasses RLS.
-- ---------------------------------------------------------------------
alter table dip_model_versions   enable row level security;
alter table dip_extraction_runs  enable row level security;
alter table dip_attributes       enable row level security;
alter table dip_gold_sets        enable row level security;
alter table dip_gold_labels      enable row level security;
alter table dip_actions          enable row level security;

drop policy if exists "Owner only full access" on dip_model_versions;
drop policy if exists "Owner only full access" on dip_extraction_runs;
drop policy if exists "Owner only full access" on dip_attributes;
drop policy if exists "Owner only full access" on dip_gold_sets;
drop policy if exists "Owner only full access" on dip_gold_labels;
drop policy if exists "Owner only full access" on dip_actions;

create policy "Owner only full access" on dip_model_versions  for all using (get_my_role() = 'owner');
create policy "Owner only full access" on dip_extraction_runs for all using (get_my_role() = 'owner');
create policy "Owner only full access" on dip_attributes      for all using (get_my_role() = 'owner');
create policy "Owner only full access" on dip_gold_sets       for all using (get_my_role() = 'owner');
create policy "Owner only full access" on dip_gold_labels     for all using (get_my_role() = 'owner');
create policy "Owner only full access" on dip_actions         for all using (get_my_role() = 'owner');

-- ---------------------------------------------------------------------
-- Seed the structured parser. It is not a model, and its version exists
-- so that a re-parse after a normalisation fix is distinguishable from
-- the original pass.
-- ---------------------------------------------------------------------
insert into dip_model_versions
  (kind, version, schema_version, normalizer_version, notes)
values
  ('structured_parser', 'shopify-options-v1', 'attr-v1', 'norm-v1',
   'Parses karat and colour from the Shopify options array. Observed fact, confidence 1, no model involved.')
on conflict (kind, version) do nothing;

-- =====================================================================
-- DEPLOYMENT VERIFICATION
-- Run this after applying. Every row should report present/ok.
-- =====================================================================
-- select 'tables' as check,
--        count(*) filter (where table_name = 'dip_model_versions')  as model_versions,
--        count(*) filter (where table_name = 'dip_extraction_runs') as extraction_runs,
--        count(*) filter (where table_name = 'dip_attributes')      as attributes,
--        count(*) filter (where table_name = 'dip_gold_sets')       as gold_sets,
--        count(*) filter (where table_name = 'dip_gold_labels')     as gold_labels,
--        count(*) filter (where table_name = 'dip_actions')         as actions
--   from information_schema.tables
--  where table_schema = 'public' and table_name like 'dip_%';
--
-- select 'rls' as check, tablename, rowsecurity
--   from pg_tables where schemaname = 'public' and tablename like 'dip_%'
--  order by tablename;
--
-- select 'seed' as check, kind, version, schema_version, normalizer_version
--   from dip_model_versions;
