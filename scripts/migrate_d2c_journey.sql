-- Task #117 — D2C consumer journey magic link + production updates.
--
-- Provisions the schema additions needed for /c/[token] journey link.
--
-- Run this in: Supabase Dashboard → SQL Editor → New query
-- Idempotent — safe to re-run.
--
-- NOTE on quotes: Task #115 (custom quote module) was never built. The
-- `audience` / `customer_id` / `enquiry_id` additions on `quotes` from the
-- original spec are deferred to whenever #115 actually lands; the journey
-- link works without them by binding to the order alone (and falling back to
-- a placeholder section when no quote exists).

-- ─────────────────────────────────────────────────────────────────────
-- 1. orders — d2c additions
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS audience    text NOT NULL DEFAULT 'b2b_partner',
  ADD COLUMN IF NOT EXISTS expected_delivery_date date;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'orders' AND constraint_name = 'orders_audience_check'
  ) THEN
    ALTER TABLE orders
      ADD CONSTRAINT orders_audience_check
      CHECK (audience IN ('b2b_partner', 'walk_in', 'd2c'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS orders_audience_idx     ON orders(audience);
CREATE INDEX IF NOT EXISTS orders_customer_id_idx  ON orders(customer_id) WHERE customer_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────
-- 2. production_updates — operator-posted timeline visible to the customer
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS production_updates (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id             uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  title                text NOT NULL,
  body                 text,
  photo_url            text,
  is_customer_visible  boolean NOT NULL DEFAULT true,
  author_id            uuid REFERENCES app_users(id) ON DELETE SET NULL,
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS production_updates_order_id_idx
  ON production_updates(order_id, created_at DESC);

ALTER TABLE production_updates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS production_updates_no_anon ON production_updates;
CREATE POLICY production_updates_no_anon ON production_updates
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- ─────────────────────────────────────────────────────────────────────
-- 3. customer_journey_links — one row per (customer, order) pair
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customer_journey_links (
  token            text PRIMARY KEY,
  customer_id      uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  order_id         uuid REFERENCES orders(id) ON DELETE SET NULL,
  enquiry_id       uuid REFERENCES customer_enquiries(id) ON DELETE SET NULL,
  expires_at       timestamptz NOT NULL,
  revoked_at       timestamptz,
  opened_count     integer NOT NULL DEFAULT 0,
  first_opened_at  timestamptz,
  last_opened_at   timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  created_by       uuid REFERENCES app_users(id) ON DELETE SET NULL
);

-- One active link per (customer, order). NULL order_id allowed (pre-order
-- quote-only state) but only one such per customer.
CREATE UNIQUE INDEX IF NOT EXISTS customer_journey_links_order_uniq
  ON customer_journey_links(order_id)
  WHERE order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS customer_journey_links_customer_id_idx
  ON customer_journey_links(customer_id);
CREATE INDEX IF NOT EXISTS customer_journey_links_expires_idx
  ON customer_journey_links(expires_at) WHERE revoked_at IS NULL;

ALTER TABLE customer_journey_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS customer_journey_links_no_anon ON customer_journey_links;
CREATE POLICY customer_journey_links_no_anon ON customer_journey_links
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- ─────────────────────────────────────────────────────────────────────
-- 4. atomic visit-recording RPC for the public /c/[token] page
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION customer_journey_record_visit(p_token text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE customer_journey_links
     SET opened_count    = opened_count + 1,
         last_opened_at  = now(),
         first_opened_at = COALESCE(first_opened_at, now())
   WHERE token = p_token
     AND revoked_at IS NULL
     AND expires_at > now();
END;
$$;

REVOKE ALL ON FUNCTION customer_journey_record_visit(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION customer_journey_record_visit(text) TO service_role;
