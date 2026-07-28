-- =====================================================================
-- DIP v5 — L0/L1 corpus. Competitor design intelligence.
--
-- Separate from the operational app in both prefix and purpose: nothing in
-- here describes anything Shewah sells. The unit is a competitor DESIGN
-- observed over time, and the value is entirely in the time dimension —
-- a snapshot missed this week cannot be taken next year.
--
-- Two rules the schema enforces rather than documents:
--   1. dip_snapshots is APPEND ONLY. No UPDATE, no DELETE, ever. Deleting a
--      snapshot destroys history that cannot be regenerated.
--   2. Identity is (brand_id, external_id). For Shopify that is the numeric
--      product id, stable across retitles and relistings — which is what
--      stops a relisted SKU registering as a new launch.
--
-- No PII enters any of these tables at any point.
-- =====================================================================

create extension if not exists "uuid-ossp";

-- ---------------------------------------------------------------------
-- Brands — the watchlist, in the database rather than in code so the
-- coverage gap is visible as data.
-- ---------------------------------------------------------------------
create table if not exists dip_brands (
  id            uuid primary key default uuid_generate_v4(),
  name          text not null,
  market        text not null check (market in ('IN', 'AU', 'US')),
  -- 'shopify' = public /products.json. 'crawlee' = needs a headless browser
  -- (slice 2). 'manual' = no automated path found yet.
  platform      text not null check (platform in ('shopify', 'crawlee', 'manual')),
  base_url      text not null,
  is_active     boolean not null default false,
  -- The spec excludes silver and moissanite as PRODUCT while permitting them
  -- as design reference. Recording this stops a large silver catalogue
  -- dominating a demand count it should not be counted in.
  product_focus text not null default 'mixed' check (product_focus in ('lgd_gold', 'silver', 'mixed')),
  notes         text,
  created_at    timestamptz not null default now(),
  unique (name, market)
);

-- ---------------------------------------------------------------------
-- Designs — identity. One row per competitor design, ever.
-- ---------------------------------------------------------------------
create table if not exists dip_designs (
  id            uuid primary key default uuid_generate_v4(),
  brand_id      uuid not null references dip_brands(id) on delete restrict,
  external_id   text not null,
  handle        text,
  title         text not null,
  product_type  text,
  source_url    text not null,

  first_seen    timestamptz not null default now(),
  last_seen     timestamptz not null default now(),
  -- Flipped false when a run completes without seeing it. The first_seen ->
  -- last_seen span while live IS the listing_survival signal, so this must
  -- only ever be set by a SUCCESSFUL run — a failed or partial read would
  -- otherwise mark a whole catalogue dead.
  is_live       boolean not null default true,

  -- Hash of the last stored raw payload. Lets ingest skip rewriting an
  -- unchanged payload; see the note on dip_snapshots.raw.
  last_raw_hash text,

  created_at    timestamptz not null default now(),
  unique (brand_id, external_id)
);

create index if not exists idx_dip_designs_brand_live on dip_designs (brand_id, is_live);
create index if not exists idx_dip_designs_last_seen  on dip_designs (last_seen);

-- ---------------------------------------------------------------------
-- Ingest runs — provenance and health. A failed run must leave a ROW,
-- not an absence: "no data for week 12" and "week 12 failed" are
-- different facts and only one of them is a competitor signal.
-- ---------------------------------------------------------------------
create table if not exists dip_ingest_runs (
  id                uuid primary key default uuid_generate_v4(),
  brand_id          uuid not null references dip_brands(id) on delete restrict,
  started_at        timestamptz not null default now(),
  finished_at       timestamptz,
  status            text not null default 'running'
                    check (status in ('running', 'success', 'partial', 'failed')),
  http_status       int,
  designs_seen      int not null default 0,
  designs_new       int not null default 0,
  snapshots_written int not null default 0,
  -- Set when the catalogue was read only in part. A partial read must never
  -- be recorded as success: an unread page is indistinguishable from a
  -- competitor delisting 250 designs.
  truncated_reason  text,
  error             text
);

create index if not exists idx_dip_runs_brand_started on dip_ingest_runs (brand_id, started_at desc);

-- ---------------------------------------------------------------------
-- Snapshots — the corpus itself. APPEND ONLY.
-- ---------------------------------------------------------------------
create table if not exists dip_snapshots (
  id                uuid primary key default uuid_generate_v4(),
  design_id         uuid not null references dip_designs(id) on delete restrict,
  run_id            uuid not null references dip_ingest_runs(id) on delete restrict,
  captured_at       timestamptz not null default now(),

  price_local       numeric(14,2),
  currency          text not null,
  -- Shopify's strike-through price. NOTE (measured 28 Jul 2026): all three
  -- seeded Indian brands set this on ~100% of listings — 2915/2915, 4711/4712,
  -- 601/645 — because Indian retail displays MRP against selling price
  -- permanently. The spec's `price_hold` signal (% never discounted) will
  -- therefore be ~0 for IN brands and carries no information there. Use the
  -- discount DEPTH (compare_at - price) instead when that signal is built.
  compare_at_price  numeric(14,2),
  is_discounted     boolean not null default false,
  available         boolean not null default false,
  variant_count     int not null default 0,
  grams             numeric(10,3),

  tags              text[] not null default '{}',
  image_urls        text[] not null default '{}',

  -- The source payload, with the variants array replaced by a summary
  -- (measured: variants are 96% of a Limelight product — 99 per design).
  --
  -- NULLABLE ON PURPOSE. Written only when raw_hash differs from the design's
  -- previous snapshot. Most designs are unchanged most weeks, and storing an
  -- identical 4 KB blob 52 times a year buys nothing. To reconstruct the
  -- payload at any date, take the most recent non-null raw at or before it.
  raw               jsonb,
  raw_hash          text not null
);

create index if not exists idx_dip_snapshots_design_time on dip_snapshots (design_id, captured_at desc);
create index if not exists idx_dip_snapshots_run         on dip_snapshots (run_id);
create index if not exists idx_dip_snapshots_captured    on dip_snapshots (captured_at);

-- Append-only, enforced rather than trusted. The corpus is worth more than
-- any single correction, and there is no legitimate reason to rewrite an
-- observation that was true when it was taken.
create or replace function dip_snapshots_append_only() returns trigger
language plpgsql as $$
begin
  raise exception 'dip_snapshots is append-only: % is not permitted', tg_op;
end;
$$;

drop trigger if exists trg_dip_snapshots_no_update on dip_snapshots;
create trigger trg_dip_snapshots_no_update
  before update or delete on dip_snapshots
  for each row execute function dip_snapshots_append_only();

-- ---------------------------------------------------------------------
-- RLS — owner only. This is competitive intelligence; no partner, reseller
-- or sub-admin has any reason to read it, and the ingest job writes with
-- the service role, which bypasses RLS.
-- ---------------------------------------------------------------------
alter table dip_brands      enable row level security;
alter table dip_designs     enable row level security;
alter table dip_snapshots   enable row level security;
alter table dip_ingest_runs enable row level security;

drop policy if exists "Owner only full access" on dip_brands;
drop policy if exists "Owner only full access" on dip_designs;
drop policy if exists "Owner only full access" on dip_snapshots;
drop policy if exists "Owner only full access" on dip_ingest_runs;

create policy "Owner only full access" on dip_brands      for all using (get_my_role() = 'owner');
create policy "Owner only full access" on dip_designs     for all using (get_my_role() = 'owner');
create policy "Owner only full access" on dip_snapshots   for all using (get_my_role() = 'owner');
create policy "Owner only full access" on dip_ingest_runs for all using (get_my_role() = 'owner');

-- ---------------------------------------------------------------------
-- Seed the watchlist.
--
-- Verified 28 Jul 2026: only three of ~20 brands expose Shopify
-- /products.json. The rest are seeded INACTIVE with the reason recorded, so
-- the coverage gap lives in the data and shows up in the health check rather
-- than being remembered.
-- ---------------------------------------------------------------------
insert into dip_brands (name, market, platform, base_url, is_active, product_focus, notes) values
  -- Readable today.
  ('Limelight Diamonds', 'IN', 'shopify', 'https://limelightdiamonds.com', true,  'lgd_gold',
   'Verified 2026-07-28: 2915 designs. NOTE: intermittent HTTP 500 on individual pagination pages; the adapter skips and continues.'),
  ('Starkle',            'IN', 'shopify', 'https://starkle.in',            true,  'lgd_gold',
   'Verified 2026-07-28: 645 designs. Product images are large (~900 KB); use Shopify CDN resize params when archiving.'),
  ('GIVA',               'IN', 'shopify', 'https://giva.co',               true,  'silver',
   'Verified 2026-07-28: 4712 designs. Predominantly 925 silver — DESIGN REFERENCE ONLY per spec, not product-comparable. Do not let its volume dominate demand counts.'),

  -- Not Shopify. Need the Crawlee adapter (slice 2).
  ('BlueStone',          'IN', 'crawlee', 'https://www.bluestone.com',        false, 'mixed',    'products.json 404 — not Shopify.'),
  ('CaratLane',          'IN', 'crawlee', 'https://www.caratlane.com',        false, 'mixed',    'products.json 404 — not Shopify.'),
  ('Melorra',            'IN', 'crawlee', 'https://melorra.com',              false, 'mixed',    'products.json 404 — not Shopify.'),
  ('Angara India',       'IN', 'crawlee', 'https://www.angara.in',            false, 'mixed',    'products.json 404 — not Shopify.'),
  ('Aukera',             'IN', 'crawlee', 'https://aukera.in',                false, 'lgd_gold', 'HTTP 520 on probe 2026-07-28; retry when building the Crawlee adapter.'),
  ('Fiona Diamonds',     'IN', 'crawlee', 'https://www.fionadiamonds.com',    false, 'lgd_gold', 'Not probed successfully 2026-07-28.'),
  ('Vrai',               'US', 'crawlee', 'https://www.vrai.com',             false, 'lgd_gold', 'products.json 404 after redirect.'),
  ('Brilliant Earth',    'US', 'crawlee', 'https://www.brilliantearth.com',   false, 'mixed',    'HTTP 403 — actively bot-blocked. Needs full browser + care.'),
  ('Clean Origin',       'US', 'crawlee', 'https://www.cleanorigin.com',      false, 'lgd_gold', 'HTTP 403 — actively bot-blocked.'),
  ('Grown Brilliance',   'US', 'crawlee', 'https://www.grownbrilliance.com',  false, 'lgd_gold', 'Not yet probed.'),
  ('With Clarity',       'US', 'crawlee', 'https://www.withclarity.com',      false, 'lgd_gold', 'Not yet probed.'),
  ('Moi Moi',            'AU', 'crawlee', 'https://www.moimoi.com.au',        false, 'mixed',    'products.json 404 — not Shopify.'),
  ('Novita Diamonds',    'AU', 'crawlee', 'https://www.novitadiamonds.com.au',false, 'lgd_gold', 'Connection refused on probe 2026-07-28.'),
  ('Cullen Jewellery',   'AU', 'crawlee', 'https://www.cullenjewellery.com',  false, 'lgd_gold', 'products.json 404 — not Shopify.'),
  ('Larsen Jewellery',   'AU', 'crawlee', 'https://www.larsenjewellery.com.au',false,'mixed',    'Not yet probed.'),
  ('Michael Hill LGD',   'AU', 'crawlee', 'https://www.michaelhill.com.au',   false, 'mixed',    'Not yet probed.')
on conflict (name, market) do nothing;
