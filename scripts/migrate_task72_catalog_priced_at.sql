-- Task #72 — Auto-recompute catalog prices when gold rate changes
--
-- Adds two columns to `products` so the catalog can show
-- "Last priced at <rate> on <date>" without joining back to gold_rates:
--   priced_at_rate  — the 24K rate (₹/g) used for the cached karat_pricing
--   priced_at       — when that recompute ran
--
-- Idempotent. Run manually in Supabase SQL Editor.

ALTER TABLE products ADD COLUMN IF NOT EXISTS priced_at_rate numeric;
ALTER TABLE products ADD COLUMN IF NOT EXISTS priced_at      timestamptz;

-- Force PostgREST to refresh its schema cache so new columns are visible.
NOTIFY pgrst, 'reload schema';
