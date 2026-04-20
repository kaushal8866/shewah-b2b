-- Task 77 — Add gross_weight to products for finished-jewelry tracking.
-- Idempotent: safe to re-run.
-- Run in: Supabase Dashboard → SQL Editor → New query.
--
-- Context:
--   gold_weight_22k  = net gold weight (just the gold in the piece, at 22kt)
--   gross_weight     = total finished-piece weight (gold + diamonds + alloys + setting)
--
-- The 24kt-pure gold mass is always: gold_weight_22k × 0.916

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS gross_weight numeric;

-- Notify PostgREST to reload schema so the new column is immediately accessible.
NOTIFY pgrst, 'reload schema';
