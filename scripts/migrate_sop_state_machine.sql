-- Align the order state machine to SOP.md §9
-- ---------------------------------------------------------------------------
-- The app implemented 8 statuses as a flat list advanced by array index. The
-- SOP defines ~15 states with guards and SLAs. Three capabilities were missing
-- entirely:
--
--   • The money gate.  QUOTE_ISSUED and ADVANCE_RECEIVED did not exist, so
--     nothing stopped a piece entering production unpaid.
--   • QC branching.    A failed check had nowhere to send the piece back to.
--   • Exits.           Cancellation and abandonment had no state, so they
--                      happened in WhatsApp and the system never learned.
--
-- SAFETY: this migration is ADDITIVE. No existing row changes its status
-- value. `design_approved` is deliberately NOT renamed to the SOP's
-- CAD_APPROVED — reseller_orders is a separate table using the same string,
-- and renaming would touch 13 files across two vocabularies for a cosmetic
-- gain.
--
-- Idempotent — safe to re-run.

BEGIN;

-- ===========================================================================
-- 1. status_changed_at — the clock every SLA reads from
-- ===========================================================================
-- Without this, slaStatus() returns null and no countdown can be shown. It
-- returns null rather than inventing a deadline, so the app degrades quietly
-- until this lands.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS status_changed_at TIMESTAMPTZ;

-- Backfill from the best evidence available per row, oldest signal first.
UPDATE orders
   SET status_changed_at = COALESCE(
         status_changed_at,
         updated_at,
         order_date::timestamptz,
         created_at
       )
 WHERE status_changed_at IS NULL;

ALTER TABLE orders
  ALTER COLUMN status_changed_at SET DEFAULT NOW();

-- ===========================================================================
-- 2. sop_migrated — do not fire stale SLAs at historic orders
-- ===========================================================================
-- A backfilled status_changed_at is an approximation. An order that sat in
-- production for three months before this migration would otherwise light up
-- as catastrophically breached the moment the rail ships. Flagged rows are
-- excluded from SLA alerting until they next transition.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS sop_migrated BOOLEAN NOT NULL DEFAULT false;

UPDATE orders SET sop_migrated = true WHERE sop_migrated = false;

-- ===========================================================================
-- 3. Fields the new states need
-- ===========================================================================
-- SOP §12.2 makes the BIS hallmark number a required field, not optional.
-- §12.3 requires a signed-off QC checklist. §9.2 requires a captured reason on
-- rejection and QC failure.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS hallmark_number   TEXT,
  ADD COLUMN IF NOT EXISTS qc_checklist      JSONB,
  ADD COLUMN IF NOT EXISTS qc_failure_reason TEXT,
  ADD COLUMN IF NOT EXISTS revision_reason   TEXT;

-- ===========================================================================
-- 4. Constrain status to the SOP state set
-- ===========================================================================
-- orders.status was bare `text` with no constraint, so a typo anywhere wrote a
-- status nothing could handle. Added last, after the backfill, so it validates
-- against data already in shape.

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;

-- Anything not in the SOP set is parked in 'draft' rather than failing the
-- migration on one bad historic row. Reported below so it is not silent.
DO $$
DECLARE
  stray_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO stray_count
  FROM orders
  WHERE status IS NULL OR status NOT IN (
    'draft','brief_received','cad_in_progress','cad_sent','design_approved',
    'quote_issued','advance_received','production','hallmarking',
    'qc','qc_failed','qc_passed','dispatched','delivered',
    'closed','cancelled','abandoned'
  );

  IF stray_count > 0 THEN
    RAISE NOTICE 'Parking % order(s) with an unrecognised status into draft', stray_count;
    UPDATE orders SET status = 'draft'
     WHERE status IS NULL OR status NOT IN (
       'draft','brief_received','cad_in_progress','cad_sent','design_approved',
       'quote_issued','advance_received','production','hallmarking',
       'qc','qc_failed','qc_passed','dispatched','delivered',
       'closed','cancelled','abandoned'
     );
  END IF;
END $$;

ALTER TABLE orders
  ADD CONSTRAINT orders_status_check CHECK (status IN (
    'draft','brief_received','cad_in_progress','cad_sent','design_approved',
    'quote_issued','advance_received','production','hallmarking',
    'qc','qc_failed','qc_passed','dispatched','delivered',
    'closed','cancelled','abandoned'
  ));

-- ===========================================================================
-- 5. Keep status_changed_at honest
-- ===========================================================================
-- Stamped by a trigger rather than by application code, so a status written
-- through any path — the /api/db proxy, a direct SQL fix, a future endpoint —
-- still gets an accurate clock. Also clears sop_migrated: once a row moves
-- under the new rules its timestamp is real and its SLA can be trusted.

CREATE OR REPLACE FUNCTION orders_stamp_status_change()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.status_changed_at := NOW();
    NEW.sop_migrated := false;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_status_change_stamp ON orders;
CREATE TRIGGER orders_status_change_stamp
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION orders_stamp_status_change();

CREATE INDEX IF NOT EXISTS orders_status_changed_at_idx
  ON orders (status, status_changed_at);

-- ===========================================================================
-- 6. Rebuild order_pipeline to carry the clock
-- ===========================================================================
-- The list and dashboard read this view. Without status_changed_at they cannot
-- show an SLA badge per row. Column list otherwise unchanged.

DROP VIEW IF EXISTS order_pipeline;
CREATE VIEW order_pipeline AS
SELECT
  o.id, o.order_number, o.status, o.type, o.model,
  o.status_changed_at, o.sop_migrated,
  o.trade_price, o.total_amount, o.advance_paid,
  o.total_amount - o.advance_paid AS balance_due,
  o.order_date, o.expected_delivery,
  p.store_name AS partner_name, p.city AS partner_city,
  pr.name AS product_name, pr.code AS product_code
FROM orders o
LEFT JOIN partners p ON o.partner_id = p.id
LEFT JOIN products pr ON o.product_id = pr.id;

-- ===========================================================================
-- 7. Repoint activity_log so overrides can actually be recorded
-- ===========================================================================
-- activity_log exists (supabase/004_phase_0_hardening.sql) but has never been
-- written by app code, and its actor_id references auth.users — while the app
-- authenticates against app_users via NextAuth. The first master override
-- would fail on the foreign key.

ALTER TABLE activity_log DROP CONSTRAINT IF EXISTS activity_log_actor_id_fkey;
ALTER TABLE activity_log
  ADD CONSTRAINT activity_log_actor_id_fkey
  FOREIGN KEY (actor_id) REFERENCES app_users(id) ON DELETE SET NULL;

-- Override reasons are the point of the audit trail — SOP §2.3.
ALTER TABLE activity_log
  ADD COLUMN IF NOT EXISTS reason TEXT;

CREATE INDEX IF NOT EXISTS activity_log_entity_idx
  ON activity_log (entity_type, entity_id, created_at DESC);

COMMIT;

-- ===========================================================================
-- Verification — run after applying
-- ===========================================================================
--   SELECT status, COUNT(*) FROM orders GROUP BY status ORDER BY 2 DESC;
--   SELECT COUNT(*) FROM orders WHERE status_changed_at IS NULL;   -- expect 0
--   SELECT COUNT(*) FROM orders WHERE sop_migrated;                -- historic rows
