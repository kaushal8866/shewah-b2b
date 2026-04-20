-- Task 76 — Diamond catalog by shape × size + stock-shortage alerts.
-- Idempotent: safe to re-run.
-- Run in: Supabase Dashboard → SQL Editor → New query.

-- ─────────────────────────────────────────────────────────────────────
-- 1. diamond_shapes — master list of shapes you stock (Round, Oval, ...).
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS diamond_shapes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sort_order int NOT NULL DEFAULT 100,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS diamond_shapes_name_lower_idx
  ON diamond_shapes (lower(name));

-- ─────────────────────────────────────────────────────────────────────
-- 2. diamond_sizes — per-shape size buckets ("1.5mm", "0.10ct", etc).
--    `reorder_threshold_pieces` lets the Stock dashboard flag a group
--    as low / out before the karigar runs out mid-job.
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS diamond_sizes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shape_id uuid NOT NULL REFERENCES diamond_shapes(id) ON DELETE CASCADE,
  label text NOT NULL,
  approx_carats numeric,                       -- reference weight per piece
  reorder_threshold_pieces int,                -- highlight if pieces on hand < this
  sort_order int NOT NULL DEFAULT 100,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS diamond_sizes_shape_label_idx
  ON diamond_sizes (shape_id, lower(label));

-- ─────────────────────────────────────────────────────────────────────
-- 3. Extend stock_movements with optional shape/size and a pieces count.
--    Carats remain the canonical `quantity`; pieces are tracked in
--    parallel for diamond movements so the dashboard can show both
--    "1.85 ct on hand" AND "37 stones on hand" per shape × size.
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE stock_movements
  ADD COLUMN IF NOT EXISTS diamond_shape_id uuid
    REFERENCES diamond_shapes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS diamond_size_id uuid
    REFERENCES diamond_sizes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pieces numeric;

CREATE INDEX IF NOT EXISTS stock_movements_diamond_group_idx
  ON stock_movements(diamond_shape_id, diamond_size_id);

-- Safety: only diamond rows may carry shape/size/pieces.
ALTER TABLE stock_movements
  DROP CONSTRAINT IF EXISTS stock_movements_diamond_only_shape;
ALTER TABLE stock_movements
  ADD CONSTRAINT stock_movements_diamond_only_shape CHECK (
    diamond_shape_id IS NULL
    OR material_type IN ('diamond_lgd','diamond_natural')
  );

-- ─────────────────────────────────────────────────────────────────────
-- 4. diamond_stock_by_group — live view, one row per
--    (material_type, shape, size) with carats and pieces on hand.
--    Rows where shape_id is NULL are surfaced as "Unclassified" so
--    legacy movements don't disappear.
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW diamond_stock_by_group AS
SELECT
  s.material_type,
  s.diamond_shape_id,
  sh.name                      AS shape_name,
  s.diamond_size_id,
  sz.label                     AS size_label,
  sz.approx_carats             AS size_approx_carats,
  sz.reorder_threshold_pieces  AS reorder_threshold_pieces,
  COALESCE(SUM(CASE s.movement_type
    WHEN 'purchase'       THEN  s.quantity
    WHEN 'return_in'      THEN  s.quantity
    WHEN 'adjustment_in'  THEN  s.quantity
    WHEN 'issue'          THEN -s.quantity
    WHEN 'adjustment_out' THEN -s.quantity
    ELSE 0 END), 0) AS carats,
  COALESCE(SUM(CASE s.movement_type
    WHEN 'purchase'       THEN  COALESCE(s.pieces, 0)
    WHEN 'return_in'      THEN  COALESCE(s.pieces, 0)
    WHEN 'adjustment_in'  THEN  COALESCE(s.pieces, 0)
    WHEN 'issue'          THEN -COALESCE(s.pieces, 0)
    WHEN 'adjustment_out' THEN -COALESCE(s.pieces, 0)
    ELSE 0 END), 0) AS pieces,
  MAX(s.movement_date) AS last_movement_date
FROM stock_movements s
LEFT JOIN diamond_shapes sh ON sh.id = s.diamond_shape_id
LEFT JOIN diamond_sizes  sz ON sz.id = s.diamond_size_id
WHERE s.material_type IN ('diamond_lgd','diamond_natural')
GROUP BY
  s.material_type, s.diamond_shape_id, sh.name,
  s.diamond_size_id, sz.label, sz.approx_carats, sz.reorder_threshold_pieces;

-- ─────────────────────────────────────────────────────────────────────
-- 5. RLS — service-role writes through the master-gated /api/diamonds
--    routes; everyone signed in can read the catalog so dropdowns and
--    badges work everywhere.
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE diamond_shapes ENABLE ROW LEVEL SECURITY;
ALTER TABLE diamond_sizes  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_diamond_shapes" ON diamond_shapes;
CREATE POLICY "service_role_all_diamond_shapes" ON diamond_shapes
  FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_read_diamond_shapes" ON diamond_shapes;
CREATE POLICY "auth_read_diamond_shapes" ON diamond_shapes
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "service_role_all_diamond_sizes" ON diamond_sizes;
CREATE POLICY "service_role_all_diamond_sizes" ON diamond_sizes
  FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_read_diamond_sizes" ON diamond_sizes;
CREATE POLICY "auth_read_diamond_sizes" ON diamond_sizes
  FOR SELECT TO authenticated USING (true);

-- ─────────────────────────────────────────────────────────────────────
-- 6. Seed defaults — common shapes plus round-cut mm sizes with the
--    standard approx-weight reference table jewellers use.
-- ─────────────────────────────────────────────────────────────────────
INSERT INTO diamond_shapes (name, sort_order)
SELECT v.name, v.sort_order
FROM (VALUES
  ('Round', 10), ('Oval', 20), ('Pear', 30), ('Cushion', 40),
  ('Princess', 50), ('Marquise', 60), ('Emerald', 70),
  ('Radiant', 80), ('Heart', 90), ('Asscher', 100)
) AS v(name, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM diamond_shapes ds WHERE lower(ds.name) = lower(v.name)
);

INSERT INTO diamond_sizes (shape_id, label, approx_carats, sort_order)
SELECT (SELECT id FROM diamond_shapes WHERE lower(name) = 'round'),
       v.label, v.approx_carats, v.sort_order
FROM (VALUES
  ('1.0mm',  0.005, 10),
  ('1.25mm', 0.009, 20),
  ('1.5mm',  0.015, 30),
  ('1.75mm', 0.025, 40),
  ('2.0mm',  0.030, 50),
  ('2.25mm', 0.045, 60),
  ('2.5mm',  0.060, 70),
  ('2.75mm', 0.080, 80),
  ('3.0mm',  0.100, 90),
  ('3.25mm', 0.140, 100),
  ('3.5mm',  0.170, 110),
  ('4.0mm',  0.250, 120),
  ('4.5mm',  0.360, 130),
  ('5.0mm',  0.500, 140)
) AS v(label, approx_carats, sort_order)
WHERE EXISTS (SELECT 1 FROM diamond_shapes WHERE lower(name) = 'round')
  AND NOT EXISTS (
    SELECT 1 FROM diamond_sizes dz
    WHERE dz.shape_id = (SELECT id FROM diamond_shapes WHERE lower(name) = 'round')
      AND lower(dz.label) = lower(v.label)
  );
