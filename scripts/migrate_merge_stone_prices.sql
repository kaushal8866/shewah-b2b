-- Migration: Unify diamond_price_matrix with cfg_stone_prices
-- Renames the populated diamond_price_matrix table to cfg_stone_prices and
-- adds columns so it serves both B2B matrix grids and configurator flows.

-- 1. Drop existing empty cfg_stone_prices table
DROP TABLE IF EXISTS cfg_stone_prices CASCADE;

-- 2. Rename diamond_price_matrix to cfg_stone_prices
ALTER TABLE IF EXISTS diamond_price_matrix RENAME TO cfg_stone_prices;

-- 3. Add columns to support both configurator and bucket-based grids
ALTER TABLE cfg_stone_prices ADD COLUMN IF NOT EXISTS stone_type_id UUID REFERENCES cfg_stone_types(id) ON DELETE CASCADE;
ALTER TABLE cfg_stone_prices ADD COLUMN IF NOT EXISTS clarity_grade_id UUID REFERENCES cfg_stone_clarity_grades(id) ON DELETE SET NULL;
ALTER TABLE cfg_stone_prices ADD COLUMN IF NOT EXISTS color_grade_id UUID REFERENCES cfg_stone_color_grades(id) ON DELETE SET NULL;
ALTER TABLE cfg_stone_prices ADD COLUMN IF NOT EXISTS is_available BOOLEAN DEFAULT true;
ALTER TABLE cfg_stone_prices ADD COLUMN IF NOT EXISTS lead_time_days INT;
ALTER TABLE cfg_stone_prices ADD COLUMN IF NOT EXISTS shape TEXT NOT NULL DEFAULT 'round';

-- 4. Enable RLS and add unified policies
ALTER TABLE cfg_stone_prices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all" ON cfg_stone_prices;
CREATE POLICY "service_role_all" ON cfg_stone_prices
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_read" ON cfg_stone_prices;
CREATE POLICY "auth_read" ON cfg_stone_prices
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "public_read_stone_prices" ON cfg_stone_prices;
CREATE POLICY "public_read_stone_prices" ON cfg_stone_prices
  FOR SELECT TO anon, authenticated USING (true);

-- Ensure UNIQUE constraints for both access patterns
ALTER TABLE cfg_stone_prices DROP CONSTRAINT IF EXISTS cfg_stone_prices_config_unique;
ALTER TABLE cfg_stone_prices ADD CONSTRAINT cfg_stone_prices_config_unique 
  UNIQUE (stone_type_id, shape_id, size_id, clarity_grade_id, color_grade_id);

ALTER TABLE cfg_stone_prices DROP CONSTRAINT IF EXISTS diamond_price_matrix_shape_id_size_id_quality_bucket_id_c_key;
ALTER TABLE cfg_stone_prices DROP CONSTRAINT IF EXISTS cfg_stone_prices_bucket_unique;
ALTER TABLE cfg_stone_prices ADD CONSTRAINT cfg_stone_prices_bucket_unique
  UNIQUE (shape_id, size_id, quality_bucket_id, color_bucket_id, type);

-- 5. Recreate indexes for speed
DROP INDEX IF EXISTS diamond_price_matrix_lookup_idx;
CREATE INDEX IF NOT EXISTS cfg_stone_prices_bucket_lookup_idx 
  ON cfg_stone_prices (shape_id, size_id, type);
