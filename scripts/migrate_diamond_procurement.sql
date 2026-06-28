-- Migration: Build the Loose Diamond Procurement & Negotiation Module
-- Idempotent script: Safe to run multiple times.

-- 1. Alter partners table to add columns for diamond tiering and discount limits
ALTER TABLE partners ADD COLUMN IF NOT EXISTS diamond_tier TEXT DEFAULT 'starter' CHECK (diamond_tier IN ('starter', 'silver', 'gold', 'platinum'));
ALTER TABLE partners ADD COLUMN IF NOT EXISTS custom_diamond_discount_limit NUMERIC DEFAULT NULL;

-- 2. Create the cfg_diamond_asks table
CREATE TABLE IF NOT EXISTS cfg_diamond_asks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  diamond_type TEXT NOT NULL CHECK (diamond_type IN ('lgd', 'natural')),
  shape_id UUID NOT NULL REFERENCES diamond_shapes(id) ON DELETE CASCADE,
  size_id UUID NOT NULL REFERENCES diamond_sizes(id) ON DELETE CASCADE,
  quality_bucket_id UUID NOT NULL REFERENCES diamond_quality_buckets(id) ON DELETE CASCADE,
  color_bucket_id UUID NOT NULL REFERENCES diamond_color_buckets(id) ON DELETE CASCADE,
  original_price_per_pc NUMERIC NOT NULL,
  original_price_per_ct NUMERIC NOT NULL,
  asked_price NUMERIC NOT NULL,
  asked_unit TEXT NOT NULL CHECK (asked_unit IN ('per_pc', 'per_ct')),
  quantity INT NOT NULL CHECK (quantity > 0),
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'under_review', 'approved', 'rejected', 'converted_to_order', 'expired')),
  approved_price NUMERIC,
  approved_unit TEXT CHECK (approved_unit IN ('per_pc', 'per_ct')),
  exceeds_limit BOOLEAN DEFAULT false,
  admin_notes TEXT,
  expiry_at TIMESTAMPTZ NOT NULL,
  purchase_window_expiry_at TIMESTAMPTZ,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Enable RLS and setup policies
ALTER TABLE cfg_diamond_asks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_asks" ON cfg_diamond_asks;
CREATE POLICY "service_role_all_asks" ON cfg_diamond_asks
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_read_asks" ON cfg_diamond_asks;
CREATE POLICY "auth_read_asks" ON cfg_diamond_asks
  FOR SELECT TO authenticated USING (true);

-- 4. Setup auto-update trigger for updated_at
DROP TRIGGER IF EXISTS cfg_diamond_asks_updated_at ON cfg_diamond_asks;
CREATE TRIGGER cfg_diamond_asks_updated_at BEFORE UPDATE ON cfg_diamond_asks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
