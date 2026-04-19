-- Task #58 — manufacturing_orders.completed_date + retailer change-request workflow
-- Run in Supabase: Dashboard → SQL Editor → New query → paste → Run.
-- Safe to re-run.

-- 1. Add the missing `completed_date` column on manufacturing_orders.
--    This was referenced by the manufacturer portal and the admin manufacturing
--    detail page but never created on the production DB, causing
--    "column manufacturing_orders.completed_date does not exist".
ALTER TABLE manufacturing_orders
  ADD COLUMN IF NOT EXISTS completed_date date;

-- 2. Order change-request workflow.
--    Retailers can request edits to their own order (quantity, ring size,
--    notes, custom-design brief). The change is NOT applied immediately —
--    a master must approve it before the order row is modified.
CREATE TABLE IF NOT EXISTS order_change_requests (
  id              uuid        primary key default gen_random_uuid(),
  created_at      timestamptz default now(),
  order_id        uuid        not null references orders(id) on delete cascade,
  partner_id      uuid        not null references partners(id) on delete cascade,
  requested_by    uuid        references app_users(id) on delete set null,
  -- proposed changes — only whitelisted, non-financial fields are accepted
  -- by the API: quantity, ring_size, special_notes, brief_text.
  changes         jsonb       not null default '{}'::jsonb,
  retailer_note   text,
  status          text        not null default 'pending'
                              check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  reviewed_by     uuid        references app_users(id) on delete set null,
  reviewed_at     timestamptz,
  review_note     text
);

CREATE INDEX IF NOT EXISTS idx_ocr_order      ON order_change_requests(order_id);
CREATE INDEX IF NOT EXISTS idx_ocr_partner    ON order_change_requests(partner_id);
CREATE INDEX IF NOT EXISTS idx_ocr_status     ON order_change_requests(status);

ALTER TABLE order_change_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all" ON order_change_requests;
CREATE POLICY "service_role_all" ON order_change_requests
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
