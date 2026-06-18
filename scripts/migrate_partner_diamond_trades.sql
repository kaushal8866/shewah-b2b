-- Migration: B2B Partner Loose Diamond Transactions
--
-- This script:
-- 1. Adds 'partner_id' to 'stock_movements' to link inventory updates to retail partners.
-- 2. Modifies the movement_type CHECK constraint on 'stock_movements' to allow 'sale' and 'partner_return'.
-- 3. Updates the 'stock_balances' and 'diamond_stock_by_group' views to subtract 'sale' and add 'partner_return'.
-- 4. Creates 'partner_diamond_trades' and 'partner_trade_payments' tables with RLS and policies.
--
-- Run in: Supabase Dashboard → SQL Editor → New query.

BEGIN;

-- 1. Add partner_id to stock_movements if it doesn't exist
ALTER TABLE stock_movements
  ADD COLUMN IF NOT EXISTS partner_id uuid REFERENCES partners(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS stock_movements_partner_retail_idx ON stock_movements(partner_id);

-- 2. Drop the existing check constraint on stock_movements.movement_type and recreate it to include 'sale' and 'partner_return'
DO $$
DECLARE
  c text;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
     WHERE conrelid = 'stock_movements'::regclass
       AND contype = 'c'
       AND pg_get_constraintdef(oid) ILIKE '%movement_type%'
  LOOP
    EXECUTE format('ALTER TABLE stock_movements DROP CONSTRAINT %I', c);
  END LOOP;
END$$;

ALTER TABLE stock_movements
  ADD CONSTRAINT stock_movements_movement_type_check CHECK (
    movement_type IN (
      'purchase',       -- vendor → central stock        (+)
      'issue',          -- central stock → karigar       (-)
      'return_in',      -- karigar → central stock       (+)
      'adjustment_in',  -- found / re-weigh up           (+)
      'adjustment_out', -- shrinkage / re-weigh down     (-)
      'sale',           -- central stock → partner       (-)
      'partner_return'  -- partner → central stock       (+)
    )
  );

-- Add safety check: sale and partner_return must have partner_id
ALTER TABLE stock_movements DROP CONSTRAINT IF EXISTS stock_movements_partner_when_trade_event;
ALTER TABLE stock_movements
  ADD CONSTRAINT stock_movements_partner_when_trade_event CHECK (
    movement_type NOT IN ('sale', 'partner_return') OR partner_id IS NOT NULL
  );

-- 3. Re-create stock_balances view
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
      WHEN 'partner_return' THEN  quantity
      WHEN 'issue'          THEN -quantity
      WHEN 'adjustment_out' THEN -quantity
      WHEN 'sale'           THEN -quantity
      ELSE 0
    END
  ) AS balance,
  MAX(movement_date) AS last_movement_date
FROM stock_movements
GROUP BY material_type, COALESCE(item_label, ''), unit;

-- 4. Re-create diamond_stock_by_group view
CREATE OR REPLACE VIEW diamond_stock_by_group AS
SELECT
  s.material_type,
  s.diamond_shape_id,
  sh.name                      AS shape_name,
  s.diamond_size_id,
  sz.label                     AS size_label,
  sz.approx_carats             AS size_approx_carats,
  sz.reorder_threshold_pieces  AS reorder_threshold_pieces,
  COALESCE(SUM(CASE s.movement_type
    WHEN 'purchase'       THEN  s.quantity
    WHEN 'return_in'      THEN  s.quantity
    WHEN 'adjustment_in'  THEN  s.quantity
    WHEN 'partner_return' THEN  s.quantity
    WHEN 'issue'          THEN -s.quantity
    WHEN 'adjustment_out' THEN -s.quantity
    WHEN 'sale'           THEN -s.quantity
    ELSE 0 END), 0) AS carats,
  COALESCE(SUM(CASE s.movement_type
    WHEN 'purchase'       THEN  COALESCE(s.pieces, 0)
    WHEN 'return_in'      THEN  COALESCE(s.pieces, 0)
    WHEN 'adjustment_in'  THEN  COALESCE(s.pieces, 0)
    WHEN 'partner_return' THEN  COALESCE(s.pieces, 0)
    WHEN 'issue'          THEN -COALESCE(s.pieces, 0)
    WHEN 'adjustment_out' THEN -COALESCE(s.pieces, 0)
    WHEN 'sale'           THEN -COALESCE(s.pieces, 0)
    ELSE 0 END), 0) AS pieces,
  MAX(s.movement_date) AS last_movement_date
FROM stock_movements s
LEFT JOIN diamond_shapes sh ON sh.id = s.diamond_shape_id
LEFT JOIN diamond_sizes  sz ON sz.id = s.diamond_size_id
WHERE s.material_type IN ('diamond_lgd','diamond_natural')
GROUP BY
  s.material_type, s.diamond_shape_id, sh.name,
  s.diamond_size_id, sz.label, sz.approx_carats, sz.reorder_threshold_pieces;

-- 5. Create partner_diamond_trades table
CREATE TABLE IF NOT EXISTS partner_diamond_trades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  trade_type text NOT NULL CHECK (trade_type IN ('sale', 'return')),
  trade_date date NOT NULL DEFAULT CURRENT_DATE,
  material_type text NOT NULL CHECK (material_type IN ('diamond_lgd', 'diamond_natural')),
  diamond_shape_id uuid NOT NULL REFERENCES diamond_shapes(id),
  diamond_size_id uuid NOT NULL REFERENCES diamond_sizes(id),
  carats numeric NOT NULL CHECK (carats > 0),
  pieces integer NOT NULL CHECK (pieces > 0),
  rate_per_carat numeric NOT NULL CHECK (rate_per_carat >= 0),
  total_amount numeric NOT NULL CHECK (total_amount >= 0),
  paid_amount numeric NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
  payment_status text NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'partially_paid', 'paid', 'refunded')),
  notes text,
  stock_movement_id uuid REFERENCES stock_movements(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS partner_diamond_trades_partner_idx
  ON partner_diamond_trades(partner_id, trade_date DESC);

-- 6. Create partner_trade_payments table
CREATE TABLE IF NOT EXISTS partner_trade_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id uuid NOT NULL REFERENCES partner_diamond_trades(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount > 0),
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  reference text,
  method text CHECK (method IN ('upi', 'bank', 'cheque', 'cash', 'card', 'other')),
  notes text,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS partner_trade_payments_trade_idx
  ON partner_trade_payments(trade_id, payment_date DESC);

-- 7. RLS and Policies
ALTER TABLE partner_diamond_trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_trade_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all" ON partner_diamond_trades;
CREATE POLICY "service_role_all" ON partner_diamond_trades
  FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_select" ON partner_diamond_trades;
CREATE POLICY "auth_select" ON partner_diamond_trades
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "service_role_all" ON partner_trade_payments;
CREATE POLICY "service_role_all" ON partner_trade_payments
  FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_select" ON partner_trade_payments;
CREATE POLICY "auth_select" ON partner_trade_payments
  FOR SELECT TO authenticated USING (true);

COMMIT;
