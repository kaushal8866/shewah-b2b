-- Manufacturer Handoff & Float Lifecycle — Task 46
-- Run in: Supabase Dashboard → SQL Editor → New query
-- Idempotent: safe to re-run.

-- ── 1. CAD/STL files on manufacturing_orders ───────────────────────────
ALTER TABLE manufacturing_orders
  ADD COLUMN IF NOT EXISTS cad_files       text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS cad_file_names  text[] DEFAULT '{}';

-- ── 2. Lifecycle column on material_transactions ───────────────────────
-- Existing rows are treated as 'final' (already-consumed) so all current
-- ledger math keeps working unchanged.
ALTER TABLE material_transactions
  ADD COLUMN IF NOT EXISTS lifecycle text NOT NULL DEFAULT 'final';

ALTER TABLE material_transactions
  DROP CONSTRAINT IF EXISTS material_transactions_lifecycle_check;

ALTER TABLE material_transactions
  ADD CONSTRAINT material_transactions_lifecycle_check
  CHECK (lifecycle IN ('pending', 'final'));

-- Pending reservations are linked back to the manufacturing order they were
-- issued for so the completion / cancellation handler can find them again.
ALTER TABLE material_transactions
  ADD COLUMN IF NOT EXISTS manufacturing_order_id uuid
    REFERENCES manufacturing_orders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS material_transactions_mfg_order_idx
  ON material_transactions(manufacturing_order_id)
  WHERE manufacturing_order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS material_transactions_partner_lifecycle_idx
  ON material_transactions(manufacturing_partner_id, lifecycle);

-- The negative-balance trigger should only flag genuine final writes —
-- pending reservations are bookkeeping for the "available" bucket and do not
-- physically remove gold from the karigar's custody.
CREATE OR REPLACE FUNCTION mt_flag_negative_balance()
RETURNS TRIGGER AS $func$
#variable_conflict use_variable
DECLARE
  v_balance numeric := 0;
  v_delta   numeric := 0;
BEGIN
  IF NEW.lifecycle = 'pending' THEN
    NEW.creates_negative_balance := false;
    RETURN NEW;
  END IF;

  SELECT COALESCE(mf.balance, 0)
    INTO v_balance
    FROM material_float mf
   WHERE mf.id = NEW.float_id;

  v_delta := CASE NEW.transaction_type
               WHEN 'deposit'     THEN  NEW.quantity
               WHEN 'consumption' THEN -NEW.quantity
               WHEN 'return'      THEN -NEW.quantity
               WHEN 'adjustment'  THEN  NEW.quantity
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

-- ── 3. mfg_share_links: 48h expirable WhatsApp asset links ─────────────
CREATE TABLE IF NOT EXISTS mfg_share_links (
  token                   uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  manufacturing_order_id  uuid NOT NULL REFERENCES manufacturing_orders(id) ON DELETE CASCADE,
  created_at              timestamptz NOT NULL DEFAULT now(),
  created_by              uuid REFERENCES app_users(id) ON DELETE SET NULL,
  expires_at              timestamptz NOT NULL,
  revoked                 boolean NOT NULL DEFAULT false,
  last_accessed_at        timestamptz,
  download_count          integer NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS mfg_share_links_order_idx
  ON mfg_share_links(manufacturing_order_id, created_at DESC);

ALTER TABLE mfg_share_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can do everything" ON mfg_share_links;
CREATE POLICY "Authenticated users can do everything" ON mfg_share_links
  FOR ALL USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "service_role_all" ON mfg_share_links;
CREATE POLICY "service_role_all" ON mfg_share_links
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
