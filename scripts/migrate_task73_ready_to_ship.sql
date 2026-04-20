-- Task #73 — Cancellation popup with Ready-to-Ship & retailer offers.
--
-- Adds two tables:
--   • ready_to_ship_items   — finished pieces parked at HQ after a
--                              cancellation, available to any retailer.
--   • ready_to_ship_offers  — single-bid offers a retailer can place
--                              against a ready-to-ship item.
--
-- Idempotent. Run manually in Supabase SQL Editor.

------------------------------------------------------- ready_to_ship_items
CREATE TABLE IF NOT EXISTS ready_to_ship_items (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at            timestamptz NOT NULL DEFAULT now(),

  product_id            uuid        REFERENCES products(id)              ON DELETE SET NULL,
  source_mfg_order_id   uuid        REFERENCES manufacturing_orders(id)  ON DELETE SET NULL,
  source_order_id       uuid        REFERENCES orders(id)                ON DELETE SET NULL,

  karat                 integer     NOT NULL,
  gross_weight          numeric     NOT NULL,
  pure_24kt_weight      numeric,
  diamond_specs         jsonb       NOT NULL DEFAULT '{}'::jsonb,
  photos                text[]      NOT NULL DEFAULT '{}',

  list_price            numeric     NOT NULL,
  original_cogs         numeric,

  status                text        NOT NULL DEFAULT 'available'
                                    CHECK (status IN ('available','reserved','sold','withdrawn')),
  sold_to_partner_id    uuid        REFERENCES partners(id)              ON DELETE SET NULL,
  sold_order_id         uuid        REFERENCES orders(id)                ON DELETE SET NULL,
  sold_at               timestamptz,

  internal_notes        text
);

CREATE INDEX IF NOT EXISTS rts_status_idx     ON ready_to_ship_items(status);
CREATE INDEX IF NOT EXISTS rts_product_idx    ON ready_to_ship_items(product_id);
CREATE INDEX IF NOT EXISTS rts_mfgorder_idx   ON ready_to_ship_items(source_mfg_order_id);

ALTER TABLE ready_to_ship_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all" ON ready_to_ship_items;
CREATE POLICY "service_role_all" ON ready_to_ship_items
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

----------------------------------------------------- ready_to_ship_offers
CREATE TABLE IF NOT EXISTS ready_to_ship_offers (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      timestamptz NOT NULL DEFAULT now(),

  item_id         uuid        NOT NULL REFERENCES ready_to_ship_items(id) ON DELETE CASCADE,
  partner_id      uuid        NOT NULL REFERENCES partners(id)            ON DELETE CASCADE,

  offer_price     numeric     NOT NULL,
  note            text,

  status          text        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending','countered','accepted','rejected','withdrawn')),
  counter_price   numeric,
  counter_note    text,
  decided_at      timestamptz,
  decided_by      uuid        REFERENCES app_users(id) ON DELETE SET NULL,

  -- Once an offer is accepted, link to the resulting customer order so the
  -- retailer can see the converted record from their portal.
  resulting_order_id uuid     REFERENCES orders(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS rts_offers_item_idx     ON ready_to_ship_offers(item_id);
CREATE INDEX IF NOT EXISTS rts_offers_partner_idx  ON ready_to_ship_offers(partner_id);
CREATE INDEX IF NOT EXISTS rts_offers_status_idx   ON ready_to_ship_offers(status);

ALTER TABLE ready_to_ship_offers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all" ON ready_to_ship_offers;
CREATE POLICY "service_role_all" ON ready_to_ship_offers
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

NOTIFY pgrst, 'reload schema';
