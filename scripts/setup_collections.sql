-- Design Collections & Partner Interest Tracker
-- Run this in: Supabase Dashboard → SQL Editor → New query

-- ── DESIGN COLLECTIONS ───────────────────────────────────
CREATE TABLE IF NOT EXISTS design_collections (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now(),
  name           text        NOT NULL,
  description    text,
  circuit_target text,
  is_published   boolean     DEFAULT false
);

CREATE OR REPLACE FUNCTION update_design_collections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS design_collections_updated_at ON design_collections;
CREATE TRIGGER design_collections_updated_at
  BEFORE UPDATE ON design_collections
  FOR EACH ROW EXECUTE FUNCTION update_design_collections_updated_at();

-- ── DESIGN COLLECTION PRODUCTS (junction) ────────────────
CREATE TABLE IF NOT EXISTS design_collection_products (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id uuid NOT NULL REFERENCES design_collections(id) ON DELETE CASCADE,
  product_id    uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sort_order    integer DEFAULT 0,
  UNIQUE(collection_id, product_id)
);

-- ── DESIGN INTERESTS (partner shortlists) ────────────────
CREATE TABLE IF NOT EXISTS design_interests (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    timestamptz DEFAULT now(),
  partner_id    uuid        REFERENCES partners(id) ON DELETE SET NULL,
  product_id    uuid        REFERENCES products(id) ON DELETE SET NULL,
  collection_id uuid        REFERENCES design_collections(id) ON DELETE SET NULL,
  note          text,
  quantity_hint integer,
  UNIQUE(partner_id, product_id, collection_id)
);

-- ── RLS ──────────────────────────────────────────────────
ALTER TABLE design_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE design_collection_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE design_interests ENABLE ROW LEVEL SECURITY;

-- Admin tables: public SELECT (showcase reads them), writes restricted to service_role
-- (The Next.js admin panel writes to these tables only through server-side API routes
--  that authenticate with the service role key.)
DROP POLICY IF EXISTS "Allow all"          ON design_collections;
DROP POLICY IF EXISTS "select_published"   ON design_collections;
DROP POLICY IF EXISTS "write_service_role" ON design_collections;

CREATE POLICY "select_all"         ON design_collections FOR SELECT USING (true);
CREATE POLICY "write_service_role" ON design_collections
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Allow all"          ON design_collection_products;
DROP POLICY IF EXISTS "select_all"         ON design_collection_products;
DROP POLICY IF EXISTS "write_service_role" ON design_collection_products;

CREATE POLICY "select_all"         ON design_collection_products FOR SELECT USING (true);
CREATE POLICY "write_service_role" ON design_collection_products
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- design_interests: public write needed — partner shortlists come from the public showcase portal
DROP POLICY IF EXISTS "Allow all" ON design_interests;
CREATE POLICY "Allow all" ON design_interests FOR ALL USING (true) WITH CHECK (true);

-- ── SHOWCASE VIEWS (visit tracking) ──────────────────────
CREATE TABLE IF NOT EXISTS showcase_views (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    timestamptz DEFAULT now(),
  collection_id uuid        REFERENCES design_collections(id) ON DELETE SET NULL,
  partner_id    uuid        REFERENCES partners(id) ON DELETE SET NULL,
  user_agent    text
);

ALTER TABLE showcase_views ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON showcase_views;
CREATE POLICY "Allow all" ON showcase_views FOR ALL USING (true) WITH CHECK (true);
