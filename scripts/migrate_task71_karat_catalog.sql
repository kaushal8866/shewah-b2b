-- Task #71 — Karat-Aware Catalog & Retail Labour
--
-- Adds five per-karat gross-weight columns to `products`, five retail-labour
-- columns to `gold_rates`, three karat-snapshot columns to `orders`, and a
-- `karat_pricing` jsonb cache on `products` so the retailer catalog can
-- show per-karat prices without re-deriving them on every render.
--
-- Idempotent. Run manually in Supabase SQL Editor.
--
-- Purity factors (single source of truth): 24=1, 22=0.916, 18=0.75, 14=0.60,
-- 10=0.42, 9=0.38. Cross-karat conversion holds 24kt-pure mass constant:
--   weight_in_Kx = (weight_22k × 0.916) ÷ factor_for_Kx

------------------------------------------------------------------ products
ALTER TABLE products ADD COLUMN IF NOT EXISTS gold_weight_22k numeric;
ALTER TABLE products ADD COLUMN IF NOT EXISTS gold_weight_18k numeric;
ALTER TABLE products ADD COLUMN IF NOT EXISTS gold_weight_14k numeric;
ALTER TABLE products ADD COLUMN IF NOT EXISTS gold_weight_10k numeric;
ALTER TABLE products ADD COLUMN IF NOT EXISTS gold_weight_9k  numeric;
ALTER TABLE products ADD COLUMN IF NOT EXISTS karat_pricing   jsonb;

-- Backfill: for any product missing the 22kt weight, derive all five from
-- the legacy single (gold_karat, gold_weight_g) pair so existing catalog
-- entries keep working untouched.
WITH purity AS (
  SELECT 22 AS k, 0.916::numeric AS f UNION ALL
  SELECT 18, 0.75   UNION ALL
  SELECT 14, 0.60   UNION ALL
  SELECT 10, 0.42   UNION ALL
  SELECT  9, 0.38
),
src AS (
  SELECT p.id,
         CASE
           WHEN p.gold_karat IN (9,10,14,18,22) THEN p.gold_karat
           WHEN p.gold_karat = 24 THEN 22
           ELSE 18
         END AS k,
         COALESCE(p.gold_weight_g, 0)::numeric AS w
  FROM products p
  WHERE p.gold_weight_22k IS NULL
)
UPDATE products p
SET
  gold_weight_22k = ROUND( (s.w * pf.f) / 0.916, 4 ),
  gold_weight_18k = ROUND( (s.w * pf.f) / 0.75 , 4 ),
  gold_weight_14k = ROUND( (s.w * pf.f) / 0.60 , 4 ),
  gold_weight_10k = ROUND( (s.w * pf.f) / 0.42 , 4 ),
  gold_weight_9k  = ROUND( (s.w * pf.f) / 0.38 , 4 )
FROM src s
JOIN purity pf ON pf.k = s.k
WHERE p.id = s.id;

---------------------------------------------------------------- gold_rates
ALTER TABLE gold_rates ADD COLUMN IF NOT EXISTS rate_10k          numeric;
ALTER TABLE gold_rates ADD COLUMN IF NOT EXISTS rate_9k           numeric;
ALTER TABLE gold_rates ADD COLUMN IF NOT EXISTS retail_labour_22k numeric;
ALTER TABLE gold_rates ADD COLUMN IF NOT EXISTS retail_labour_18k numeric;
ALTER TABLE gold_rates ADD COLUMN IF NOT EXISTS retail_labour_14k numeric;
ALTER TABLE gold_rates ADD COLUMN IF NOT EXISTS retail_labour_10k numeric;
ALTER TABLE gold_rates ADD COLUMN IF NOT EXISTS retail_labour_9k  numeric;

-- Backfill the per-karat metal rates we did not have before (10kt, 9kt).
UPDATE gold_rates
SET rate_10k = ROUND(rate_24k * 0.42)
WHERE rate_10k IS NULL AND rate_24k IS NOT NULL;
UPDATE gold_rates
SET rate_9k  = ROUND(rate_24k * 0.38)
WHERE rate_9k  IS NULL AND rate_24k IS NOT NULL;

-------------------------------------------------------------------- orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS selected_karat        integer;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS gross_weight_at_karat numeric;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS gold_pure_24kt_g      numeric;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS retail_labour_at_order numeric;

------------------------------------------------------------------ settings
INSERT INTO settings (key, value) VALUES
  ('purity_24k','1'),
  ('purity_22k','0.916'),
  ('purity_18k','0.75'),
  ('purity_14k','0.60'),
  ('purity_10k','0.42'),
  ('purity_9k','0.38')
ON CONFLICT (key) DO NOTHING;

-- Force PostgREST to refresh its schema cache so new columns are visible.
NOTIFY pgrst, 'reload schema';
