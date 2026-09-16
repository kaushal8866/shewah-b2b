-- ============================================================================
-- SHEWAH INTERNATIONAL D2C COMMERCE TRANSFORMATION — PHASE 2 MIGRATION
-- File: scripts/migrate_d2c_storefront_phase2.sql
-- 
-- Strictly additive and idempotent. Preserves 100% compatibility with existing
-- B2B, reseller, manufacturer, atelier, accounting, and Aurora tables.
-- Run in: Supabase Dashboard → SQL Editor → New query
-- ============================================================================

-- 1. d2c_market_prices (Normalized Multi-Market Pricing)
CREATE TABLE IF NOT EXISTS d2c_market_prices (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id        uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  market_code       text NOT NULL,                 -- 'US', 'GB', 'AU', 'DE', 'FR', etc.
  currency          text NOT NULL,                 -- 'USD', 'GBP', 'AUD', 'EUR', etc.
  price             numeric NOT NULL CHECK (price >= 0),
  compare_at_price  numeric CHECK (compare_at_price >= 0),
  pricing_mode      text NOT NULL DEFAULT 'fixed'  -- 'fixed' | 'formula_base'
    CHECK (pricing_mode IN ('fixed', 'formula_base')),
  effective_from    timestamptz NOT NULL DEFAULT now(),
  effective_to      timestamptz,                   -- NULL = open-ended
  is_active         boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS d2c_market_prices_lookup_idx 
  ON d2c_market_prices(product_id, market_code, is_active, effective_from DESC);

-- Enable RLS on d2c_market_prices (Public read of active prices, write restricted to service role)
ALTER TABLE d2c_market_prices ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'd2c_market_prices' AND policyname = 'Public read active d2c_market_prices'
  ) THEN
    CREATE POLICY "Public read active d2c_market_prices"
      ON d2c_market_prices FOR SELECT USING (is_active = true);
  END IF;
END $$;

-- 2. products — D2C presentation, policy, and SEO metadata
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS slug                   text UNIQUE,
  ADD COLUMN IF NOT EXISTS d2c_status             text NOT NULL DEFAULT 'draft'
    CHECK (d2c_status IN ('draft', 'published', 'temporarily_unavailable', 'market_restricted', 'archived')),
  ADD COLUMN IF NOT EXISTS d2c_featured           boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS d2c_title              text,
  ADD COLUMN IF NOT EXISTS d2c_subtitle           text,
  ADD COLUMN IF NOT EXISTS d2c_description        text,
  ADD COLUMN IF NOT EXISTS d2c_crafting_lead_days integer,
  ADD COLUMN IF NOT EXISTS return_policy_type     text
    CHECK (return_policy_type IN ('standard', 'made_to_order', 'custom_bespoke', 'final_sale')),
  ADD COLUMN IF NOT EXISTS return_window_days     integer,
  ADD COLUMN IF NOT EXISTS return_eligible        boolean,
  ADD COLUMN IF NOT EXISTS seo_meta_title         text,
  ADD COLUMN IF NOT EXISTS seo_meta_description   text,
  ADD COLUMN IF NOT EXISTS d2c_details            jsonb DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS products_slug_idx ON products(slug) WHERE slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS products_d2c_status_idx ON products(d2c_status);

-- 3. product_slug_redirects — 301 SEO redirection when slugs change
CREATE TABLE IF NOT EXISTS product_slug_redirects (
  old_slug    text PRIMARY KEY,
  product_id  uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on product_slug_redirects (Public read-only, write restricted to service role)
ALTER TABLE product_slug_redirects ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'product_slug_redirects' AND policyname = 'Public read product_slug_redirects'
  ) THEN
    CREATE POLICY "Public read product_slug_redirects"
      ON product_slug_redirects FOR SELECT USING (true);
  END IF;
END $$;

-- 4. orders — D2C commercial channel, review gates, and immutable snapshots
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS order_channel            text NOT NULL DEFAULT 'b2b'
    CHECK (order_channel IN ('d2c', 'b2b', 'retailer', 'reseller')),
  ADD COLUMN IF NOT EXISTS order_review_status      text NOT NULL DEFAULT 'not_required'
    CHECK (order_review_status IN ('not_required', 'pending_review', 'approved', 'held', 'cancelled')),
  ADD COLUMN IF NOT EXISTS currency                 text NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS subtotal_amount          numeric,
  ADD COLUMN IF NOT EXISTS tax_amount               numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shipping_amount          numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS duty_amount              numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_status           text NOT NULL DEFAULT 'pending'
    CHECK (payment_status IN ('pending', 'authorized', 'paid', 'failed', 'refunded')),
  ADD COLUMN IF NOT EXISTS payment_provider         text,
  ADD COLUMN IF NOT EXISTS payment_reference        text,
  ADD COLUMN IF NOT EXISTS payment_method           text,
  ADD COLUMN IF NOT EXISTS shipping_address_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS d2c_items                jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS price_snapshot_version   text DEFAULT '1.0';

CREATE INDEX IF NOT EXISTS orders_order_channel_idx ON orders(order_channel);
CREATE INDEX IF NOT EXISTS orders_order_review_status_idx ON orders(order_review_status);

-- 5. customers — Explicit international consent tracking
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS marketing_consent        boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS marketing_consent_at     timestamptz,
  ADD COLUMN IF NOT EXISTS privacy_policy_agreed    boolean NOT NULL DEFAULT false;

-- 6. design_collections — D2C collection discovery
ALTER TABLE design_collections
  ADD COLUMN IF NOT EXISTS slug             text UNIQUE,
  ADD COLUMN IF NOT EXISTS hero_image_url   text,
  ADD COLUMN IF NOT EXISTS tagline          text,
  ADD COLUMN IF NOT EXISTS sort_order       integer DEFAULT 0;

CREATE INDEX IF NOT EXISTS design_collections_slug_idx ON design_collections(slug) WHERE slug IS NOT NULL;
