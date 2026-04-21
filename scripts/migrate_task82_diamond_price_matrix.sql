-- Task 82 — Centralized Diamond Price Matrix (LGD only).
--
-- Today's pricing flow guesses the cost of a (shape, size, type) combo from
-- the most recent product's diamond_specs row and falls back to vendor
-- inventory. There is no team-managed source of truth, and no way to bump
-- every diamond price by a percentage when the LGD market moves. This task
-- introduces a per-(shape × size × quality bucket × color bucket) price
-- matrix that the master can edit from one screen plus a bulk %-adjuster.
--
-- Idempotent: safe to re-run.
-- Run in: Supabase Dashboard → SQL Editor → New query.

-- ─────────────────────────────────────────────────────────────────────
-- 1. diamond_quality_buckets — master-managed list (e.g. VVS, VS, SI).
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS diamond_quality_buckets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  sort_order int NOT NULL DEFAULT 100,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS diamond_quality_buckets_label_lower_idx
  ON diamond_quality_buckets (lower(label));

-- ─────────────────────────────────────────────────────────────────────
-- 2. diamond_color_buckets — master-managed list (e.g. DEF, GH, IJ).
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS diamond_color_buckets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  sort_order int NOT NULL DEFAULT 100,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS diamond_color_buckets_label_lower_idx
  ON diamond_color_buckets (lower(label));

-- ─────────────────────────────────────────────────────────────────────
-- 3. diamond_price_matrix — one row per (shape, size, quality, color, type).
--    `type` is kept for future natural-stone use; today the UI seeds 'lgd'
--    only because the user explicitly said this module is LGD-only for now.
--    `price_per_piece` matches every other diamond cost field in the app
--    (catalog `cost`, inventory `avg_purchase_price`).
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS diamond_price_matrix (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shape_id uuid NOT NULL REFERENCES diamond_shapes(id) ON DELETE CASCADE,
  size_id uuid NOT NULL REFERENCES diamond_sizes(id) ON DELETE CASCADE,
  quality_bucket_id uuid NOT NULL REFERENCES diamond_quality_buckets(id) ON DELETE CASCADE,
  color_bucket_id uuid NOT NULL REFERENCES diamond_color_buckets(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'lgd' CHECK (type IN ('lgd','natural')),
  price_per_piece numeric NOT NULL CHECK (price_per_piece >= 0),
  updated_by text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shape_id, size_id, quality_bucket_id, color_bucket_id, type)
);
CREATE INDEX IF NOT EXISTS diamond_price_matrix_lookup_idx
  ON diamond_price_matrix (shape_id, size_id, type);

-- ─────────────────────────────────────────────────────────────────────
-- 4. RLS — service-role writes through the master-gated /api/diamonds/*
--    routes; everyone signed in can read so the catalog forms and the
--    retailer comparison-quote section can show suggested prices.
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE diamond_quality_buckets ENABLE ROW LEVEL SECURITY;
ALTER TABLE diamond_color_buckets   ENABLE ROW LEVEL SECURITY;
ALTER TABLE diamond_price_matrix    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_dqb" ON diamond_quality_buckets;
CREATE POLICY "service_role_all_dqb" ON diamond_quality_buckets
  FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_read_dqb" ON diamond_quality_buckets;
CREATE POLICY "auth_read_dqb" ON diamond_quality_buckets
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "service_role_all_dcb" ON diamond_color_buckets;
CREATE POLICY "service_role_all_dcb" ON diamond_color_buckets
  FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_read_dcb" ON diamond_color_buckets;
CREATE POLICY "auth_read_dcb" ON diamond_color_buckets
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "service_role_all_dpm" ON diamond_price_matrix;
CREATE POLICY "service_role_all_dpm" ON diamond_price_matrix
  FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_read_dpm" ON diamond_price_matrix;
CREATE POLICY "auth_read_dpm" ON diamond_price_matrix
  FOR SELECT TO authenticated USING (true);

-- ─────────────────────────────────────────────────────────────────────
-- 5. Seed default buckets so the master sees a usable grid on first open.
-- ─────────────────────────────────────────────────────────────────────
INSERT INTO diamond_quality_buckets (label, sort_order)
SELECT v.label, v.sort_order FROM (VALUES
  ('VVS', 10), ('VS', 20), ('SI', 30)
) v(label, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM diamond_quality_buckets q WHERE lower(q.label) = lower(v.label)
);

INSERT INTO diamond_color_buckets (label, sort_order)
SELECT v.label, v.sort_order FROM (VALUES
  ('DEF', 10), ('GH', 20), ('IJ', 30)
) v(label, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM diamond_color_buckets c WHERE lower(c.label) = lower(v.label)
);

-- ─────────────────────────────────────────────────────────────────────
-- 6. orders.comparison_payload — JSON snapshot of an external piece the
--    retailer asked Shewah to quote on (gold weight + karat + diamond
--    rows + computed quote). Kept on the order so the admin sees the
--    exact spec the partner is comparing against.
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS comparison_payload jsonb;
