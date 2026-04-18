-- Hotfix: ensure `gold_karat integer` exists on the three tables that
-- reference it. Older production installs were created from a schema
-- snapshot that pre-dates this column, which causes
--   "Could not find the 'gold_karat' column of 'orders' in the schema cache"
-- when the order / CAD / manufacturing-order forms try to save.
--
-- Idempotent: safe to re-run; does nothing if the column already exists.
-- Run manually in Supabase SQL Editor.

ALTER TABLE orders                ADD COLUMN IF NOT EXISTS gold_karat integer;
ALTER TABLE cad_requests          ADD COLUMN IF NOT EXISTS gold_karat integer;
ALTER TABLE manufacturing_orders  ADD COLUMN IF NOT EXISTS gold_karat integer;

-- Force PostgREST to reload its schema cache so the column is visible
-- to the app immediately without restarting Supabase.
NOTIFY pgrst, 'reload schema';
