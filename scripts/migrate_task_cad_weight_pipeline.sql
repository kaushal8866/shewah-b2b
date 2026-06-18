-- Migration: CAD Weight Pipeline Schema Updates
-- Run this in Supabase Dashboard -> SQL Editor

ALTER TABLE orders ADD COLUMN IF NOT EXISTS gross_volume           numeric;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS stone_seat_volume      numeric;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS hollow_volume          numeric;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS gallery_cut_volume     numeric;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS net_volume             numeric;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS alloy_density_used     numeric;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS casting_weight_g       numeric;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS final_weight_g         numeric;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS metal_tone             text;
