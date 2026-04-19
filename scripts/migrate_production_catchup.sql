-- Production catch-up migration
-- =====================================================================
-- Combines every migration that was missing on the live Supabase project
-- as of 2026-04-18. Idempotent and safe to re-run. Paste the whole file
-- into Supabase Dashboard → SQL Editor → New query → Run.
--
-- Covers:migrate_production_catchup.sqlmigrate_production_catchup.sqlmigrate_production_catchup.sql
--   • orders.gold_karat               (the order-save crash)
--   • manufacturing_orders.order_id   (link to customer order)
--   • Task 46: float lifecycle + karigar share links
--   • Task 47/49: CAD partner public share + uploads
--   • Task 48: CAD partner directory
--   • Task 40: CAD revision WhatsApp acknowledgement column

create extension if not exists "uuid-ossp";

-- ── 0. gold_karat hotfix (orders only — cad_requests / mfg_orders done) ──
ALTER TABLE orders               ADD COLUMN IF NOT EXISTS gold_karat integer;
ALTER TABLE cad_requests         ADD COLUMN IF NOT EXISTS gold_karat integer;
ALTER TABLE manufacturing_orders ADD COLUMN IF NOT EXISTS gold_karat integer;

-- ── 1. manufacturing_orders.order_id — link mfg order ↔ customer order ──
ALTER TABLE manufacturing_orders
  ADD COLUMN IF NOT EXISTS order_id uuid
    REFERENCES orders(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS manufacturing_orders_order_idx
  ON manufacturing_orders(order_id) WHERE order_id IS NOT NULL;

-- ── 2. Task 46: CAD/STL files + lifecycle + reservation helpers ─────────
ALTER TABLE manufacturing_orders
  ADD COLUMN IF NOT EXISTS cad_files       text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS cad_file_names  text[] DEFAULT '{}';

ALTER TABLE material_transactions
  ADD COLUMN IF NOT EXISTS lifecycle text NOT NULL DEFAULT 'final';

ALTER TABLE material_transactions
  DROP CONSTRAINT IF EXISTS material_transactions_lifecycle_check;
ALTER TABLE material_transactions
  ADD CONSTRAINT material_transactions_lifecycle_check
  CHECK (lifecycle IN ('pending', 'final'));

ALTER TABLE material_transactions
  ADD COLUMN IF NOT EXISTS manufacturing_order_id uuid
    REFERENCES manufacturing_orders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS material_transactions_mfg_order_idx
  ON material_transactions(manufacturing_order_id)
  WHERE manufacturing_order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS material_transactions_partner_lifecycle_idx
  ON material_transactions(manufacturing_partner_id, lifecycle);

-- Negative-balance trigger that skips lifecycle='pending' reservations.
CREATE OR REPLACE FUNCTION mt_flag_negative_balance()
RETURNS TRIGGER AS $func$
DECLARE v_balance numeric := 0; v_delta numeric := 0;
BEGIN
  IF NEW.lifecycle = 'pending' THEN
    NEW.creates_negative_balance := false;
    RETURN NEW;
  END IF;
  SELECT COALESCE(mf.balance, 0) INTO v_balance FROM material_float mf WHERE mf.id = NEW.float_id;
  v_delta := CASE NEW.transaction_type
               WHEN 'deposit'     THEN  NEW.quantity
               WHEN 'consumption' THEN -NEW.quantity
               WHEN 'return'      THEN -NEW.quantity
               WHEN 'adjustment'  THEN  NEW.quantity
               ELSE 0 END;
  NEW.creates_negative_balance := ((v_balance + v_delta) < 0);
  RETURN NEW;
END;
$func$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS mt_flag_negative_balance_trg ON material_transactions;
CREATE TRIGGER mt_flag_negative_balance_trg
  BEFORE INSERT ON material_transactions
  FOR EACH ROW EXECUTE FUNCTION mt_flag_negative_balance();

-- 48h karigar WhatsApp asset links
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
DROP POLICY IF EXISTS "deny_authenticated_default" ON mfg_share_links;
DROP POLICY IF EXISTS "service_role_all" ON mfg_share_links;
CREATE POLICY "service_role_all" ON mfg_share_links
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Atomic float reservation
CREATE OR REPLACE FUNCTION mfg_reserve_float(
  p_partner_id uuid, p_material_type text, p_quantity numeric,
  p_mfg_order_id uuid, p_customer_order_id uuid, p_notes text
) RETURNS uuid AS $func$
DECLARE
  v_float_id uuid; v_unit text;
  v_in_custody numeric; v_reserved numeric; v_available numeric;
  v_tx_id uuid;
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN RAISE EXCEPTION 'invalid_quantity'; END IF;

  SELECT id, unit INTO v_float_id, v_unit
    FROM material_float
   WHERE manufacturing_partner_id = p_partner_id AND material_type = p_material_type
   FOR UPDATE;

  IF v_float_id IS NULL THEN
    INSERT INTO material_float (manufacturing_partner_id, material_type, unit, total_deposited, total_consumed)
      VALUES (p_partner_id, p_material_type,
              CASE WHEN p_material_type LIKE 'diamond%' THEN 'carats' ELSE 'grams' END, 0, 0)
      RETURNING id, unit INTO v_float_id, v_unit;
    PERFORM 1 FROM material_float WHERE id = v_float_id FOR UPDATE;
  END IF;

  SELECT COALESCE(SUM(CASE
           WHEN transaction_type = 'deposit'                              THEN  quantity
           WHEN transaction_type = 'return'                               THEN -quantity
           WHEN transaction_type = 'adjustment'                           THEN  quantity
           WHEN transaction_type = 'consumption' AND lifecycle = 'final'  THEN -quantity
           ELSE 0 END), 0)
    INTO v_in_custody
    FROM material_transactions
   WHERE manufacturing_partner_id = p_partner_id AND float_id = v_float_id;

  SELECT COALESCE(SUM(quantity), 0) INTO v_reserved
    FROM material_transactions
   WHERE manufacturing_partner_id = p_partner_id AND float_id = v_float_id
     AND transaction_type = 'consumption' AND lifecycle = 'pending';

  v_available := v_in_custody - v_reserved;
  IF v_available + 1e-9 < p_quantity THEN
    RAISE EXCEPTION 'over_issue: available=% required=%', v_available, p_quantity USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO material_transactions (
    float_id, manufacturing_partner_id, manufacturing_order_id, order_id,
    transaction_type, lifecycle, quantity, unit, notes
  ) VALUES (
    v_float_id, p_partner_id, p_mfg_order_id, p_customer_order_id,
    'consumption', 'pending', p_quantity, COALESCE(v_unit, 'grams'), p_notes
  ) RETURNING id INTO v_tx_id;
  RETURN v_tx_id;
END;
$func$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION mfg_share_link_record_download(p_token uuid) RETURNS void AS $func$
  UPDATE mfg_share_links SET download_count = download_count + 1, last_accessed_at = now() WHERE token = p_token;
$func$ LANGUAGE sql;
CREATE OR REPLACE FUNCTION mfg_share_link_record_visit(p_token uuid) RETURNS void AS $func$
  UPDATE mfg_share_links SET last_accessed_at = now() WHERE token = p_token;
$func$ LANGUAGE sql;

-- ── 3. Task 47/49: CAD partner public share + uploads ───────────────────
CREATE TABLE IF NOT EXISTS cad_partner_share_links (
  token              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  cad_request_id     uuid        NOT NULL REFERENCES cad_requests(id) ON DELETE CASCADE,
  partner_name       text,
  partner_phone      text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  created_by         uuid,
  expires_at         timestamptz NOT NULL,
  revoked_at         timestamptz,
  last_opened_at     timestamptz
);
CREATE INDEX IF NOT EXISTS cad_partner_share_links_request_idx
  ON cad_partner_share_links(cad_request_id, created_at DESC);
ALTER TABLE cad_partner_share_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all" ON cad_partner_share_links;
CREATE POLICY "service_role_all" ON cad_partner_share_links
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE TABLE IF NOT EXISTS cad_partner_responses (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id         uuid        NOT NULL REFERENCES cad_partner_share_links(token) ON DELETE CASCADE,
  cad_request_id  uuid        NOT NULL REFERENCES cad_requests(id) ON DELETE CASCADE,
  decision        text        NOT NULL CHECK (decision IN ('approved','revision')),
  comment         text,
  partner_name    text,
  ip              text,
  user_agent      text,
  responded_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cad_partner_responses_request_idx
  ON cad_partner_responses(cad_request_id, responded_at DESC);
ALTER TABLE cad_partner_responses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all" ON cad_partner_responses;
CREATE POLICY "service_role_all" ON cad_partner_responses
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE OR REPLACE FUNCTION cad_partner_share_record_visit(p_token uuid) RETURNS void AS $func$
  UPDATE cad_partner_share_links SET last_opened_at = now() WHERE token = p_token;
$func$ LANGUAGE sql;

CREATE TABLE IF NOT EXISTS cad_partner_uploads (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id         uuid        NOT NULL REFERENCES cad_partner_share_links(token) ON DELETE CASCADE,
  cad_request_id  uuid        NOT NULL REFERENCES cad_requests(id) ON DELETE CASCADE,
  partner_name    text,
  url             text        NOT NULL,
  filename        text        NOT NULL,
  resource_type   text        NOT NULL CHECK (resource_type IN ('image','raw')),
  bytes           bigint,
  ip              text,
  user_agent      text,
  uploaded_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cad_partner_uploads_request_idx
  ON cad_partner_uploads(cad_request_id, uploaded_at DESC);
CREATE INDEX IF NOT EXISTS cad_partner_uploads_link_idx
  ON cad_partner_uploads(link_id, uploaded_at DESC);
ALTER TABLE cad_partner_uploads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all" ON cad_partner_uploads;
CREATE POLICY "service_role_all" ON cad_partner_uploads
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Extend cad_revisions kind check to include 'partner_upload'
DO $$
DECLARE cname text;
BEGIN
  FOR cname IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'cad_revisions'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%kind%'
  LOOP
    EXECUTE format('alter table cad_revisions drop constraint %I', cname);
  END LOOP;
  ALTER TABLE cad_revisions
    ADD CONSTRAINT cad_revisions_kind_check
    CHECK (kind IN ('render','revision_request','approval','partner_upload'));
END $$;

-- ── 4. Task 48: CAD partner directory ───────────────────────────────────
CREATE TABLE IF NOT EXISTS cad_partners (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name              text        NOT NULL,
  phone             text,
  notes             text,
  default_ttl_days  integer     NOT NULL DEFAULT 7
                                CHECK (default_ttl_days BETWEEN 1 AND 30),
  is_active         boolean     NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS cad_partners_name_lower_idx
  ON cad_partners (lower(name));
ALTER TABLE cad_partners ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all" ON cad_partners;
CREATE POLICY "service_role_all" ON cad_partners
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

ALTER TABLE cad_partner_share_links
  ADD COLUMN IF NOT EXISTS cad_partner_id uuid
    REFERENCES cad_partners(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS cad_partner_share_links_partner_idx
  ON cad_partner_share_links(cad_partner_id, created_at DESC);

-- ── 5. Task 40: CAD revision ACK ────────────────────────────────────────
ALTER TABLE cad_revisions
  ADD COLUMN IF NOT EXISTS acknowledged_at timestamptz;

INSERT INTO settings (key, value)
VALUES ('whatsapp_inbound_token', '')
ON CONFLICT (key) DO NOTHING;

-- ── Refresh PostgREST schema cache so new columns/tables are visible now ─
NOTIFY pgrst, 'reload schema';
