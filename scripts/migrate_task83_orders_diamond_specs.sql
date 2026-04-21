-- Task #83: structured diamond rows on admin orders.
-- Mirrors products.diamond_specs (jsonb array of {role, shape, weight, quality,
-- color, type, pieces, cost, shape_id, size_id, size_label}) so an order created
-- from the /orders/new admin form keeps the same picker + matrix-chip detail
-- the catalog form already captures.
--
-- IMPORTANT: this project uses raw SQL migrations applied manually via the
-- Supabase SQL Editor. Run this file from there. The /orders/new page is
-- tolerant of the column being absent (42703) and will fall back to omitting
-- diamond_specs until this migration lands.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS diamond_specs jsonb;

COMMENT ON COLUMN orders.diamond_specs IS
  'Structured diamond rows for the order, mirroring products.diamond_specs. '
  'Populated from /orders/new admin form; legacy orders may be NULL.';
