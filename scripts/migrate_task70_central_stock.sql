-- Task 70 — Central Stock module (separate from Vendors).
-- Run this in: Supabase Dashboard → SQL Editor → New query.
-- Idempotent: safe to re-run.

-- ─────────────────────────────────────────────────────────────────────
-- 1. stock_movements — single ledger for all central-stock activity.
--    Every gram of gold, every carat of diamond, every finding that
--    moves into or out of central stock writes one row here.
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock_movements (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),

  movement_type text NOT NULL CHECK (movement_type IN (
    'purchase',       -- vendor → central stock        (+)
    'issue',          -- central stock → karigar       (-)
    'return_in',      -- karigar → central stock       (+)
    'adjustment_in',  -- found / re-weigh up           (+)
    'adjustment_out'  -- shrinkage / re-weigh down     (-)
  )),

  -- Material identity. Gold/diamond use the same canonical types as the
  -- karigar float (gold_14k / gold_18k / gold_22k / diamond_lgd /
  -- diamond_natural). For 'finding', item_label carries the SKU name.
  material_type text NOT NULL CHECK (material_type IN (
    'gold_14k','gold_18k','gold_22k',
    'diamond_lgd','diamond_natural',
    'finding'
  )),
  item_label text,                              -- required when material_type='finding'
  unit text NOT NULL DEFAULT 'grams',           -- grams | carats | pieces

  quantity numeric NOT NULL CHECK (quantity > 0),  -- always positive; sign comes from movement_type

  -- Counterparty: vendor for purchases, manufacturing partner for issues/returns.
  vendor_id uuid REFERENCES vendors(id) ON DELETE SET NULL,
  manufacturing_partner_id uuid REFERENCES manufacturing_partners(id) ON DELETE SET NULL,

  -- When an issue/return also writes into the karigar float ledger
  -- (gold + diamond only — findings stay central-only), we link here so
  -- the two ledgers can be reconciled.
  material_transaction_id uuid REFERENCES material_transactions(id) ON DELETE SET NULL,

  reference text,                               -- bill no / challan no
  notes text,
  movement_date date NOT NULL DEFAULT CURRENT_DATE,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT stock_movements_finding_label_required
    CHECK (material_type <> 'finding' OR (item_label IS NOT NULL AND length(trim(item_label)) > 0)),

  CONSTRAINT stock_movements_purchase_has_vendor
    CHECK (movement_type <> 'purchase' OR vendor_id IS NOT NULL),

  CONSTRAINT stock_movements_partner_when_karigar_event
    CHECK (movement_type NOT IN ('issue','return_in') OR manufacturing_partner_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS stock_movements_material_idx
  ON stock_movements(material_type, item_label);
CREATE INDEX IF NOT EXISTS stock_movements_partner_idx
  ON stock_movements(manufacturing_partner_id);
CREATE INDEX IF NOT EXISTS stock_movements_vendor_idx
  ON stock_movements(vendor_id);
CREATE INDEX IF NOT EXISTS stock_movements_date_idx
  ON stock_movements(movement_date DESC, created_at DESC);

-- ─────────────────────────────────────────────────────────────────────
-- 2. stock_balances — live view derived from the ledger. The Stock
--    dashboard reads this so the on-hand quantity can never drift from
--    the audit log.
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW stock_balances AS
SELECT
  material_type,
  COALESCE(item_label, '') AS item_label,
  unit,
  SUM(
    CASE movement_type
      WHEN 'purchase'       THEN  quantity
      WHEN 'return_in'      THEN  quantity
      WHEN 'adjustment_in'  THEN  quantity
      WHEN 'issue'          THEN -quantity
      WHEN 'adjustment_out' THEN -quantity
      ELSE 0
    END
  ) AS balance,
  MAX(movement_date) AS last_movement_date
FROM stock_movements
GROUP BY material_type, COALESCE(item_label, ''), unit;

-- ─────────────────────────────────────────────────────────────────────
-- 3. RLS — match the karigar ledger. Service role only (writes happen
--    through the master-only /api/db proxy + dedicated /api/stock routes).
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_stock_movements" ON stock_movements;
CREATE POLICY "service_role_all_stock_movements" ON stock_movements
  FOR ALL TO service_role USING (true) WITH CHECK (true);
