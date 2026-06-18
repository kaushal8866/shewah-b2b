-- Migration: Add Silver metal option support.
--
-- This script adds silver B2B/D2C rate settings and enables the `metal_type`
-- column throughout all relevant product and order flow tables.
--
-- Run in: Supabase Dashboard → SQL Editor → New query.

-- 1. Insert default B2B/D2C silver rates to settings table if they don't exist yet.
INSERT INTO settings (key, value) VALUES
  ('silver_rate_b2b', '80'),
  ('silver_rate_d2c', '120')
ON CONFLICT (key) DO NOTHING;

-- 2. Add metal_type column to products table (default to 'gold').
ALTER TABLE products ADD COLUMN IF NOT EXISTS metal_type text DEFAULT 'gold' CHECK (metal_type IN ('gold', 'silver'));

-- 3. Add metal_type column to orders table (default to 'gold').
ALTER TABLE orders ADD COLUMN IF NOT EXISTS metal_type text DEFAULT 'gold' CHECK (metal_type IN ('gold', 'silver'));

-- 4. Add metal_type column to cad_requests table (default to 'gold').
ALTER TABLE cad_requests ADD COLUMN IF NOT EXISTS metal_type text DEFAULT 'gold' CHECK (metal_type IN ('gold', 'silver'));

-- 5. Add metal_type column to manufacturing_orders table (default to 'gold').
ALTER TABLE manufacturing_orders ADD COLUMN IF NOT EXISTS metal_type text DEFAULT 'gold' CHECK (metal_type IN ('gold', 'silver'));
