-- Gold Ledger, Order COGS & Integrity Rules — Task 5
-- Run this in: Supabase Dashboard → SQL Editor → New query

-- ── ORDERS: add COGS / gold-source columns ───────────────
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS gold_weight_estimated numeric,
  ADD COLUMN IF NOT EXISTS gold_weight_actual    numeric,
  ADD COLUMN IF NOT EXISTS gold_source           text DEFAULT 'self'
    CHECK (gold_source IN ('self', 'manufacturer')),
  ADD COLUMN IF NOT EXISTS making_charges        numeric,
  ADD COLUMN IF NOT EXISTS cad_cost              numeric,
  ADD COLUMN IF NOT EXISTS stone_cost            numeric,
  ADD COLUMN IF NOT EXISTS total_cogs            numeric,
  ADD COLUMN IF NOT EXISTS margin                numeric,
  ADD COLUMN IF NOT EXISTS assigned_manufacturer_id uuid
    REFERENCES manufacturing_partners(id) ON DELETE SET NULL;

-- ── MATERIAL_TRANSACTIONS: ensure order_id FK + flag column ──
ALTER TABLE material_transactions
  ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS creates_negative_balance boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS negative_confirmed boolean DEFAULT false;

CREATE INDEX IF NOT EXISTS material_transactions_order_id_idx
  ON material_transactions(order_id);

-- ── Rename "withdrawal" → "return" everywhere ────────────
UPDATE material_transactions
   SET transaction_type = 'return'
 WHERE transaction_type = 'withdrawal';

-- Drop any existing CHECK constraint on transaction_type and re-add with the new
-- canonical 4-value set.
DO $$
DECLARE
  c text;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
     WHERE conrelid = 'material_transactions'::regclass
       AND contype = 'c'
       AND pg_get_constraintdef(oid) ILIKE '%transaction_type%'
  LOOP
    EXECUTE format('ALTER TABLE material_transactions DROP CONSTRAINT %I', c);
  END LOOP;
END$$;

ALTER TABLE material_transactions
  ADD CONSTRAINT material_transactions_type_check
  CHECK (transaction_type IN ('deposit', 'consumption', 'return', 'adjustment'));

-- Rename column total_withdrawn → total_returned on float (if present)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'material_float' AND column_name = 'total_withdrawn'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'material_float' AND column_name = 'total_returned'
  ) THEN
    EXECUTE 'ALTER TABLE material_float RENAME COLUMN total_withdrawn TO total_returned';
  END IF;
END$$;

-- ── Negative balance flag trigger ────────────────────────
-- Marks a row that would drive the running balance below zero. Does NOT block
-- the insert; UI is responsible for warning + requiring confirmation. Stored
-- so that integrity reports / audits can flag these rows later.
CREATE OR REPLACE FUNCTION mt_flag_negative_balance()
RETURNS TRIGGER AS $func$
#variable_conflict use_variable
DECLARE
  v_balance numeric := 0;
  v_delta   numeric := 0;
BEGIN
  SELECT COALESCE(mf.balance, 0)
    INTO v_balance
    FROM material_float mf
   WHERE mf.id = NEW.float_id;

  v_delta := CASE NEW.transaction_type
               WHEN 'deposit'     THEN  NEW.quantity
               WHEN 'consumption' THEN -NEW.quantity
               WHEN 'return'      THEN -NEW.quantity
               WHEN 'adjustment'  THEN  NEW.quantity   -- signed by caller
               ELSE 0
             END;

  IF (v_balance + v_delta) < 0 THEN
    NEW.creates_negative_balance := true;
  ELSE
    NEW.creates_negative_balance := false;
  END IF;

  RETURN NEW;
END;
$func$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS mt_flag_negative_balance_trg ON material_transactions;
CREATE TRIGGER mt_flag_negative_balance_trg
  BEFORE INSERT ON material_transactions
  FOR EACH ROW EXECUTE FUNCTION mt_flag_negative_balance();
