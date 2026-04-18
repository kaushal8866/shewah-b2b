-- Task #6 — Manufacturer Portal
-- Run this in Supabase: Dashboard → SQL Editor → New query → paste → Run.
-- Safe to re-run.

-- 1. Allow new roles (manufacturer + retailer reserved for Task #7).
ALTER TABLE app_users DROP CONSTRAINT IF EXISTS app_users_role_check;
ALTER TABLE app_users
  ADD CONSTRAINT app_users_role_check
  CHECK (role IN ('master', 'sub', 'manufacturer', 'retailer'));

-- 2. Link manufacturer logins to a manufacturing partner.
ALTER TABLE app_users
  ADD COLUMN IF NOT EXISTS manufacturing_partner_id uuid
  REFERENCES manufacturing_partners(id) ON DELETE CASCADE;

-- (Reserved for retailer portal — added now to avoid a second migration.)
ALTER TABLE app_users
  ADD COLUMN IF NOT EXISTS partner_id uuid
  REFERENCES partners(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_app_users_mfg_partner
  ON app_users(manufacturing_partner_id);
CREATE INDEX IF NOT EXISTS idx_app_users_partner
  ON app_users(partner_id);

-- 3. Manufacturer-side audit log on each manufacturing order update.
ALTER TABLE manufacturing_orders
  ADD COLUMN IF NOT EXISTS manufacturer_notes text,
  ADD COLUMN IF NOT EXISTS manufacturer_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS manufacturer_updated_by uuid REFERENCES app_users(id) ON DELETE SET NULL;
