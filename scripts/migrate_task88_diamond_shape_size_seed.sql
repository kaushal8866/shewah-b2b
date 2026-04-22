-- Task 88 — Seed every diamond shape we trade + per-shape mm↔ct size grid.
--
-- Source for the size tables: https://diamondsizecharts.com/ (one chart
-- per shape). All inserts are idempotent thanks to:
--   • diamond_shapes_name_lower_idx          (unique on lower(name))
--   • diamond_sizes_shape_label_idx          (unique on shape_id, label)
-- both created in scripts/migrate_task76_diamond_catalog.sql.
--
-- Run in: Supabase Dashboard → SQL Editor → New query.
-- Safe to re-run any number of times.

-- ─────────────────────────────────────────────────────────────────────
-- 0. Defensive index — task 76 already creates this, but recreate
--    conditionally so this script is safely runnable on its own.
-- ─────────────────────────────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS diamond_sizes_shape_label_idx
  ON diamond_sizes (shape_id, label);

-- ─────────────────────────────────────────────────────────────────────
-- 1. New shapes — added on top of the 10 seeded by task 76.
--    (Round, Oval, Pear, Cushion, Princess, Marquise, Emerald, Radiant,
--    Heart, Asscher are already in place.)
-- ─────────────────────────────────────────────────────────────────────
INSERT INTO diamond_shapes (name, sort_order)
SELECT v.name, v.sort_order
FROM (VALUES
  ('Baguette',             110),
  ('Tapered Baguette',     120),
  ('Trillion',             130),
  ('Half Moon',            140),
  ('Calf',                 150),
  ('Bullet',               160),
  ('Tapered Bullet',       170),
  ('Shield',               180),
  ('Kite',                 190),
  ('Trapezoid',            200),
  ('Hexagon',              210),
  ('Epaulette',            220),
  ('Carre',                230),
  ('Rectangular Cushion',  240),
  ('Rectangular Radiant',  250),
  ('Rose Cut',             260)
) AS v(name, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM diamond_shapes ds WHERE lower(ds.name) = lower(v.name)
);

-- ─────────────────────────────────────────────────────────────────────
-- 2. Per-shape size grids. One INSERT block per shape; each block reads
--    the shape_id by name so re-ordering is irrelevant.
--    Carat values are the standard trade approximations from
--    diamondsizecharts.com — these are reference weights per piece, NOT
--    contractual weights, so the size picker can show "≈ 0.50 ct" while
--    the actual stone weight on the order is captured separately.
-- ─────────────────────────────────────────────────────────────────────

-- Round — fill in the sizes that task 76 didn't seed (5.5mm and up,
-- plus the 0.8mm melee size used in pavé).
INSERT INTO diamond_sizes (shape_id, label, approx_carats, sort_order)
SELECT s.id, v.label, v.approx_carats, v.sort_order
FROM diamond_shapes s
CROSS JOIN (VALUES
  ('0.8mm',  0.0025,   5),
  ('3.75mm', 0.21,    115),  -- bridges the 3.5mm / 4.0mm gap left by task 76
  ('5.5mm',  0.66,    150),
  ('6.0mm',  0.84,    160),
  ('6.5mm',  1.00,    170),
  ('6.5+',   NULL,    175),  -- catch-all bucket for anything 6.5mm and larger
  ('7.0mm',  1.30,    180),
  ('7.5mm',  1.67,    190),
  ('8.0mm',  2.00,    200),
  ('8.5mm',  2.40,    210),
  ('9.0mm',  2.75,    220),
  ('9.5mm',  3.35,    230),
  ('10.0mm', 3.87,    240)
) AS v(label, approx_carats, sort_order)
WHERE lower(s.name) = 'round'
ON CONFLICT (shape_id, label) DO NOTHING;

-- Princess — square brilliant, mm = side length.
INSERT INTO diamond_sizes (shape_id, label, approx_carats, sort_order)
SELECT s.id, v.label, v.approx_carats, v.sort_order
FROM diamond_shapes s
CROSS JOIN (VALUES
  ('1.5mm',  0.015,  10),
  ('2.0mm',  0.06,   20),
  ('2.5mm',  0.10,   30),
  ('3.0mm',  0.18,   40),
  ('3.5mm',  0.27,   50),
  ('4.0mm',  0.36,   60),
  ('4.5mm',  0.50,   70),
  ('5.0mm',  0.75,   80),
  ('5.5mm',  1.00,   90),
  ('6.0mm',  1.25,  100)
) AS v(label, approx_carats, sort_order)
WHERE lower(s.name) = 'princess'
ON CONFLICT (shape_id, label) DO NOTHING;

-- Asscher — square step-cut.
INSERT INTO diamond_sizes (shape_id, label, approx_carats, sort_order)
SELECT s.id, v.label, v.approx_carats, v.sort_order
FROM diamond_shapes s
CROSS JOIN (VALUES
  ('2.5mm',  0.10,   10),
  ('3.0mm',  0.18,   20),
  ('3.5mm',  0.25,   30),
  ('4.0mm',  0.36,   40),
  ('4.5mm',  0.50,   50),
  ('5.0mm',  0.75,   60),
  ('5.5mm',  1.00,   70),
  ('6.0mm',  1.25,   80),
  ('6.5mm',  1.50,   90),
  ('7.0mm',  2.00,  100)
) AS v(label, approx_carats, sort_order)
WHERE lower(s.name) = 'asscher'
ON CONFLICT (shape_id, label) DO NOTHING;

-- Carre — small square step-cut, mostly used as side stones.
INSERT INTO diamond_sizes (shape_id, label, approx_carats, sort_order)
SELECT s.id, v.label, v.approx_carats, v.sort_order
FROM diamond_shapes s
CROSS JOIN (VALUES
  ('1.5mm',  0.020,  10),
  ('2.0mm',  0.05,   20),
  ('2.5mm',  0.09,   30),
  ('3.0mm',  0.15,   40),
  ('3.5mm',  0.25,   50),
  ('4.0mm',  0.36,   60)
) AS v(label, approx_carats, sort_order)
WHERE lower(s.name) = 'carre'
ON CONFLICT (shape_id, label) DO NOTHING;

-- Cushion — square version, mm = side length.
INSERT INTO diamond_sizes (shape_id, label, approx_carats, sort_order)
SELECT s.id, v.label, v.approx_carats, v.sort_order
FROM diamond_shapes s
CROSS JOIN (VALUES
  ('2.5mm',  0.10,   10),
  ('3.0mm',  0.16,   20),
  ('3.5mm',  0.25,   30),
  ('4.0mm',  0.36,   40),
  ('4.5mm',  0.50,   50),
  ('5.0mm',  0.75,   60),
  ('5.5mm',  1.00,   70),
  ('6.0mm',  1.25,   80),
  ('6.5mm',  1.50,   90),
  ('7.0mm',  2.00,  100)
) AS v(label, approx_carats, sort_order)
WHERE lower(s.name) = 'cushion'
ON CONFLICT (shape_id, label) DO NOTHING;

-- Rectangular Cushion — L×W mm.
INSERT INTO diamond_sizes (shape_id, label, approx_carats, sort_order)
SELECT s.id, v.label, v.approx_carats, v.sort_order
FROM diamond_shapes s
CROSS JOIN (VALUES
  ('4x3 mm',   0.18,  10),
  ('5x3 mm',   0.25,  20),
  ('5x4 mm',   0.40,  30),
  ('6x4 mm',   0.55,  40),
  ('6x5 mm',   0.75,  50),
  ('7x5 mm',   1.00,  60),
  ('8x6 mm',   1.50,  70),
  ('9x7 mm',   2.00,  80),
  ('10x8 mm',  3.00,  90)
) AS v(label, approx_carats, sort_order)
WHERE lower(s.name) = 'rectangular cushion'
ON CONFLICT (shape_id, label) DO NOTHING;

-- Radiant — square version, mm = side length.
INSERT INTO diamond_sizes (shape_id, label, approx_carats, sort_order)
SELECT s.id, v.label, v.approx_carats, v.sort_order
FROM diamond_shapes s
CROSS JOIN (VALUES
  ('3.0mm',  0.18,   10),
  ('3.5mm',  0.27,   20),
  ('4.0mm',  0.36,   30),
  ('4.5mm',  0.50,   40),
  ('5.0mm',  0.75,   50),
  ('5.5mm',  1.00,   60),
  ('6.0mm',  1.25,   70),
  ('6.5mm',  1.50,   80),
  ('7.0mm',  2.00,   90)
) AS v(label, approx_carats, sort_order)
WHERE lower(s.name) = 'radiant'
ON CONFLICT (shape_id, label) DO NOTHING;

-- Rectangular Radiant — L×W mm.
INSERT INTO diamond_sizes (shape_id, label, approx_carats, sort_order)
SELECT s.id, v.label, v.approx_carats, v.sort_order
FROM diamond_shapes s
CROSS JOIN (VALUES
  ('4x3 mm',   0.20,  10),
  ('5x3 mm',   0.30,  20),
  ('5x4 mm',   0.45,  30),
  ('6x4 mm',   0.60,  40),
  ('6x5 mm',   0.80,  50),
  ('7x5 mm',   1.00,  60),
  ('8x6 mm',   1.50,  70),
  ('9x7 mm',   2.00,  80),
  ('10x8 mm',  3.00,  90)
) AS v(label, approx_carats, sort_order)
WHERE lower(s.name) = 'rectangular radiant'
ON CONFLICT (shape_id, label) DO NOTHING;

-- Emerald — L×W mm.
INSERT INTO diamond_sizes (shape_id, label, approx_carats, sort_order)
SELECT s.id, v.label, v.approx_carats, v.sort_order
FROM diamond_shapes s
CROSS JOIN (VALUES
  ('3x2 mm',   0.07,  10),
  ('4x2 mm',   0.13,  20),
  ('4x3 mm',   0.20,  30),
  ('5x3 mm',   0.30,  40),
  ('5x4 mm',   0.45,  50),
  ('6x4 mm',   0.55,  60),
  ('7x5 mm',   1.00,  70),
  ('8x6 mm',   1.50,  80),
  ('9x7 mm',   2.00,  90),
  ('10x8 mm',  3.00, 100)
) AS v(label, approx_carats, sort_order)
WHERE lower(s.name) = 'emerald'
ON CONFLICT (shape_id, label) DO NOTHING;

-- Oval — L×W mm.
INSERT INTO diamond_sizes (shape_id, label, approx_carats, sort_order)
SELECT s.id, v.label, v.approx_carats, v.sort_order
FROM diamond_shapes s
CROSS JOIN (VALUES
  ('3x2 mm',   0.05,  10),
  ('4x2 mm',   0.10,  20),
  ('4x3 mm',   0.20,  30),
  ('5x3 mm',   0.25,  40),
  ('5x4 mm',   0.35,  50),
  ('6x4 mm',   0.50,  60),
  ('7x5 mm',   0.75,  70),
  ('8x6 mm',   1.25,  80),
  ('9x7 mm',   2.00,  90),
  ('10x8 mm',  2.50, 100)
) AS v(label, approx_carats, sort_order)
WHERE lower(s.name) = 'oval'
ON CONFLICT (shape_id, label) DO NOTHING;

-- Pear — L×W mm.
INSERT INTO diamond_sizes (shape_id, label, approx_carats, sort_order)
SELECT s.id, v.label, v.approx_carats, v.sort_order
FROM diamond_shapes s
CROSS JOIN (VALUES
  ('4x3 mm',   0.20,  10),
  ('5x3 mm',   0.25,  20),
  ('5x4 mm',   0.35,  30),
  ('6x4 mm',   0.50,  40),
  ('7x5 mm',   0.75,  50),
  ('8x5 mm',   1.00,  60),
  ('9x6 mm',   1.50,  70),
  ('10x7 mm',  2.00,  80),
  ('11x8 mm',  2.50,  90)
) AS v(label, approx_carats, sort_order)
WHERE lower(s.name) = 'pear'
ON CONFLICT (shape_id, label) DO NOTHING;

-- Marquise — L×W mm (long oval with pointed ends).
INSERT INTO diamond_sizes (shape_id, label, approx_carats, sort_order)
SELECT s.id, v.label, v.approx_carats, v.sort_order
FROM diamond_shapes s
CROSS JOIN (VALUES
  ('3x1.5 mm',  0.035, 10),
  ('4x2 mm',    0.10,  20),
  ('5x2.5 mm',  0.16,  30),
  ('6x3 mm',    0.25,  40),
  ('7x3.5 mm',  0.40,  50),
  ('8x4 mm',    0.75,  60),
  ('9x4.5 mm',  1.00,  70),
  ('10x5 mm',   1.50,  80)
) AS v(label, approx_carats, sort_order)
WHERE lower(s.name) = 'marquise'
ON CONFLICT (shape_id, label) DO NOTHING;

-- Heart — L×W mm (square-ish).
INSERT INTO diamond_sizes (shape_id, label, approx_carats, sort_order)
SELECT s.id, v.label, v.approx_carats, v.sort_order
FROM diamond_shapes s
CROSS JOIN (VALUES
  ('3x3 mm',   0.11,  10),
  ('4x4 mm',   0.21,  20),
  ('5x5 mm',   0.40,  30),
  ('6x6 mm',   0.65,  40),
  ('7x7 mm',   1.00,  50),
  ('8x8 mm',   1.75,  60),
  ('9x9 mm',   2.50,  70)
) AS v(label, approx_carats, sort_order)
WHERE lower(s.name) = 'heart'
ON CONFLICT (shape_id, label) DO NOTHING;

-- Trillion (a.k.a. Trilliant).
INSERT INTO diamond_sizes (shape_id, label, approx_carats, sort_order)
SELECT s.id, v.label, v.approx_carats, v.sort_order
FROM diamond_shapes s
CROSS JOIN (VALUES
  ('3x3 mm',   0.10,  10),
  ('4x4 mm',   0.20,  20),
  ('5x5 mm',   0.35,  30),
  ('6x6 mm',   0.50,  40),
  ('7x7 mm',   1.00,  50),
  ('8x8 mm',   1.50,  60)
) AS v(label, approx_carats, sort_order)
WHERE lower(s.name) = 'trillion'
ON CONFLICT (shape_id, label) DO NOTHING;

-- Baguette — straight rectangular step-cut, side-stone workhorse.
INSERT INTO diamond_sizes (shape_id, label, approx_carats, sort_order)
SELECT s.id, v.label, v.approx_carats, v.sort_order
FROM diamond_shapes s
CROSS JOIN (VALUES
  ('2x1 mm',     0.015, 10),
  ('2.5x1.5 mm', 0.04,  20),
  ('3x1.5 mm',   0.05,  30),
  ('3x2 mm',     0.08,  40),
  ('4x2 mm',     0.13,  50),
  ('5x3 mm',     0.30,  60),
  ('6x4 mm',     0.50,  70)
) AS v(label, approx_carats, sort_order)
WHERE lower(s.name) = 'baguette'
ON CONFLICT (shape_id, label) DO NOTHING;

-- Tapered Baguette — same trade sizes as straight baguette.
INSERT INTO diamond_sizes (shape_id, label, approx_carats, sort_order)
SELECT s.id, v.label, v.approx_carats, v.sort_order
FROM diamond_shapes s
CROSS JOIN (VALUES
  ('2x1 mm',     0.015, 10),
  ('2.5x1.5 mm', 0.04,  20),
  ('3x1.5 mm',   0.05,  30),
  ('3x2 mm',     0.08,  40),
  ('4x2 mm',     0.13,  50),
  ('5x3 mm',     0.30,  60),
  ('6x4 mm',     0.50,  70)
) AS v(label, approx_carats, sort_order)
WHERE lower(s.name) = 'tapered baguette'
ON CONFLICT (shape_id, label) DO NOTHING;

-- Half Moon.
INSERT INTO diamond_sizes (shape_id, label, approx_carats, sort_order)
SELECT s.id, v.label, v.approx_carats, v.sort_order
FROM diamond_shapes s
CROSS JOIN (VALUES
  ('3x2 mm',   0.08,  10),
  ('4x2 mm',   0.13,  20),
  ('4x3 mm',   0.18,  30),
  ('5x3 mm',   0.25,  40),
  ('6x4 mm',   0.50,  50)
) AS v(label, approx_carats, sort_order)
WHERE lower(s.name) = 'half moon'
ON CONFLICT (shape_id, label) DO NOTHING;

-- Calf.
INSERT INTO diamond_sizes (shape_id, label, approx_carats, sort_order)
SELECT s.id, v.label, v.approx_carats, v.sort_order
FROM diamond_shapes s
CROSS JOIN (VALUES
  ('3x2 mm',   0.08,  10),
  ('4x2 mm',   0.13,  20),
  ('4x3 mm',   0.18,  30),
  ('5x3 mm',   0.25,  40)
) AS v(label, approx_carats, sort_order)
WHERE lower(s.name) = 'calf'
ON CONFLICT (shape_id, label) DO NOTHING;

-- Bullet.
INSERT INTO diamond_sizes (shape_id, label, approx_carats, sort_order)
SELECT s.id, v.label, v.approx_carats, v.sort_order
FROM diamond_shapes s
CROSS JOIN (VALUES
  ('3x2 mm',   0.08,  10),
  ('4x2 mm',   0.13,  20),
  ('5x3 mm',   0.25,  30),
  ('6x3 mm',   0.35,  40),
  ('7x4 mm',   0.55,  50)
) AS v(label, approx_carats, sort_order)
WHERE lower(s.name) = 'bullet'
ON CONFLICT (shape_id, label) DO NOTHING;

-- Tapered Bullet — same trade sizes as straight bullet.
INSERT INTO diamond_sizes (shape_id, label, approx_carats, sort_order)
SELECT s.id, v.label, v.approx_carats, v.sort_order
FROM diamond_shapes s
CROSS JOIN (VALUES
  ('3x2 mm',   0.08,  10),
  ('4x2 mm',   0.13,  20),
  ('5x3 mm',   0.25,  30),
  ('6x3 mm',   0.35,  40),
  ('7x4 mm',   0.55,  50)
) AS v(label, approx_carats, sort_order)
WHERE lower(s.name) = 'tapered bullet'
ON CONFLICT (shape_id, label) DO NOTHING;

-- Shield.
INSERT INTO diamond_sizes (shape_id, label, approx_carats, sort_order)
SELECT s.id, v.label, v.approx_carats, v.sort_order
FROM diamond_shapes s
CROSS JOIN (VALUES
  ('3x3 mm',   0.12,  10),
  ('4x4 mm',   0.25,  20),
  ('5x5 mm',   0.45,  30),
  ('6x6 mm',   0.75,  40)
) AS v(label, approx_carats, sort_order)
WHERE lower(s.name) = 'shield'
ON CONFLICT (shape_id, label) DO NOTHING;

-- Kite.
INSERT INTO diamond_sizes (shape_id, label, approx_carats, sort_order)
SELECT s.id, v.label, v.approx_carats, v.sort_order
FROM diamond_shapes s
CROSS JOIN (VALUES
  ('4x2 mm',   0.10,  10),
  ('5x3 mm',   0.18,  20),
  ('6x3 mm',   0.25,  30),
  ('7x4 mm',   0.40,  40),
  ('8x5 mm',   0.75,  50)
) AS v(label, approx_carats, sort_order)
WHERE lower(s.name) = 'kite'
ON CONFLICT (shape_id, label) DO NOTHING;

-- Trapezoid.
INSERT INTO diamond_sizes (shape_id, label, approx_carats, sort_order)
SELECT s.id, v.label, v.approx_carats, v.sort_order
FROM diamond_shapes s
CROSS JOIN (VALUES
  ('4x2 mm',   0.10,  10),
  ('5x3 mm',   0.18,  20),
  ('6x3 mm',   0.25,  30),
  ('7x4 mm',   0.40,  40),
  ('8x5 mm',   0.75,  50)
) AS v(label, approx_carats, sort_order)
WHERE lower(s.name) = 'trapezoid'
ON CONFLICT (shape_id, label) DO NOTHING;

-- Hexagon.
INSERT INTO diamond_sizes (shape_id, label, approx_carats, sort_order)
SELECT s.id, v.label, v.approx_carats, v.sort_order
FROM diamond_shapes s
CROSS JOIN (VALUES
  ('4x3 mm',   0.18,  10),
  ('5x4 mm',   0.35,  20),
  ('6x5 mm',   0.55,  30),
  ('7x6 mm',   0.85,  40),
  ('8x7 mm',   1.20,  50)
) AS v(label, approx_carats, sort_order)
WHERE lower(s.name) = 'hexagon'
ON CONFLICT (shape_id, label) DO NOTHING;

-- Epaulette.
INSERT INTO diamond_sizes (shape_id, label, approx_carats, sort_order)
SELECT s.id, v.label, v.approx_carats, v.sort_order
FROM diamond_shapes s
CROSS JOIN (VALUES
  ('4x2 mm',   0.08,  10),
  ('5x3 mm',   0.18,  20),
  ('6x4 mm',   0.40,  30),
  ('7x4 mm',   0.55,  40)
) AS v(label, approx_carats, sort_order)
WHERE lower(s.name) = 'epaulette'
ON CONFLICT (shape_id, label) DO NOTHING;

-- Rose Cut — flat-bottomed dome, mm = diameter (round-ish).
INSERT INTO diamond_sizes (shape_id, label, approx_carats, sort_order)
SELECT s.id, v.label, v.approx_carats, v.sort_order
FROM diamond_shapes s
CROSS JOIN (VALUES
  ('2.5mm',  0.04,   10),
  ('3.0mm',  0.06,   20),
  ('4.0mm',  0.13,   30),
  ('5.0mm',  0.30,   40),
  ('6.0mm',  0.55,   50),
  ('7.0mm',  0.90,   60),
  ('8.0mm',  1.30,   70)
) AS v(label, approx_carats, sort_order)
WHERE lower(s.name) = 'rose cut'
ON CONFLICT (shape_id, label) DO NOTHING;

-- Done. Verify with:
--   SELECT s.name, COUNT(z.*) AS sizes
--   FROM diamond_shapes s LEFT JOIN diamond_sizes z ON z.shape_id = s.id
--   GROUP BY s.name ORDER BY s.sort_order;
