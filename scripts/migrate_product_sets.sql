-- Migration: Product Sets / Pair Selling Mechanism
-- Adds columns to products and orders tables to support selling products as sets

-- ============================================================
-- 1. Add set-related columns to the existing products table
-- ============================================================

-- Parent reference: NULL for standalone products and set parents.
-- Points to the parent product ID for set components.
ALTER TABLE products ADD COLUMN IF NOT EXISTS
  set_parent_id UUID REFERENCES products(id) ON DELETE CASCADE;

-- Selling mode:
--   'single'             — Standalone product (default, backward compatible)
--   'set_only'           — Must be bought as a complete set
--   'set_or_individual'  — Can buy the set or individual pieces
--   'individual_only'    — Pieces listed together but always sold separately
ALTER TABLE products ADD COLUMN IF NOT EXISTS
  sell_mode TEXT DEFAULT 'single';

-- Human-friendly label for the component within a set
-- e.g. 'Pendant', 'Earring Pair', 'Ring'
ALTER TABLE products ADD COLUMN IF NOT EXISTS
  component_label TEXT;

-- Optional discount when buying the entire set (percentage, 0-100)
ALTER TABLE products ADD COLUMN IF NOT EXISTS
  set_discount_pct NUMERIC DEFAULT 0;

-- Display ordering for components within a set
ALTER TABLE products ADD COLUMN IF NOT EXISTS
  component_sort_order INTEGER DEFAULT 0;

-- Index for fast child → parent lookups
CREATE INDEX IF NOT EXISTS idx_products_set_parent
  ON products(set_parent_id)
  WHERE set_parent_id IS NOT NULL;

-- ============================================================
-- 2. Add set-order linking columns to orders table
-- ============================================================

-- Groups component orders that belong to one set purchase
ALTER TABLE orders ADD COLUMN IF NOT EXISTS
  set_order_group_id UUID;

-- Label of the component this order is for (e.g. 'Pendant', 'Earring')
ALTER TABLE orders ADD COLUMN IF NOT EXISTS
  component_label TEXT;

-- Index for grouping set orders
CREATE INDEX IF NOT EXISTS idx_orders_set_group
  ON orders(set_order_group_id)
  WHERE set_order_group_id IS NOT NULL;
