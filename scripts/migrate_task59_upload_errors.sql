-- Task #59 — capture failed retailer file uploads so we can diagnose them.
-- Run in Supabase: Dashboard → SQL Editor → New query → paste → Run.
-- Safe to re-run.

CREATE TABLE IF NOT EXISTS upload_errors (
  id            uuid        primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  user_id       uuid        references app_users(id) on delete set null,
  username      text,
  user_role     text,
  file_name     text,
  file_size     bigint,
  file_type     text,
  status_code   int,
  error_message text,
  source        text  -- caller hint, e.g. 'retailer-custom', 'cad-share'
);

CREATE INDEX IF NOT EXISTS idx_upload_errors_created_at
  ON upload_errors (created_at DESC);

ALTER TABLE upload_errors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all" ON upload_errors;
CREATE POLICY "service_role_all" ON upload_errors
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
