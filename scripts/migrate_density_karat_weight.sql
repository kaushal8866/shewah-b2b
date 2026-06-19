-- Migration: Density-Based Karat Weight Auto-Calculation
-- Run this in Supabase Dashboard -> SQL Editor

-- 1. Add new columns to products
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS metal_weights JSONB DEFAULT '{}'::jsonb;

ALTER TABLE products
ADD COLUMN IF NOT EXISTS ref_karat TEXT,
ADD COLUMN IF NOT EXISTS ref_color TEXT;

-- 2. Index for querying by metal weights
CREATE INDEX IF NOT EXISTS idx_products_metal_weights ON products USING gin(metal_weights);

-- 3. Add gold_color to orders
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS gold_color TEXT DEFAULT 'yellow'
CHECK (gold_color IN ('yellow', 'white', 'rose'));

-- 4. One-time migration for existing products
UPDATE products
SET metal_weights = jsonb_build_object('22K_yellow', gold_weight_22k),
    ref_karat = '22K',
    ref_color = 'yellow'
WHERE gold_weight_22k IS NOT NULL
  AND gold_weight_22k > 0
  AND (metal_weights IS NULL OR metal_weights = '{}'::jsonb);
