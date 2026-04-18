-- Daily karigar reconciliation digest — Task 17
-- Run this in: Supabase Dashboard → SQL Editor → New query

-- ── Per-run alert snapshots ──────────────────────────────
-- One row per (active partner, run_date) when the partner trips one or more
-- thresholds. Mirrors the metrics shown on
-- /manufacturing/partners/[id]/reconciliation so masters can review the same
-- numbers from the daily digest.
CREATE TABLE IF NOT EXISTS reconciliation_alerts (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id          uuid NOT NULL REFERENCES manufacturing_partners(id) ON DELETE CASCADE,
  run_date            date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Kolkata')::date,
  window_days         integer NOT NULL,
  consumed_total      numeric NOT NULL DEFAULT 0,
  benchmark_total     numeric NOT NULL DEFAULT 0,
  variance_total      numeric NOT NULL DEFAULT 0,
  negative_count      integer NOT NULL DEFAULT 0,
  unlinked_count      integer NOT NULL DEFAULT 0,
  unlinked_consumed   numeric NOT NULL DEFAULT 0,
  triggered_reasons   text[] NOT NULL DEFAULT '{}',
  notified_at         timestamptz,
  notify_channel      text,
  notify_error        text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (partner_id, run_date)
);

-- Older installs may already have the table without notify_* columns.
ALTER TABLE reconciliation_alerts
  ADD COLUMN IF NOT EXISTS notified_at    timestamptz,
  ADD COLUMN IF NOT EXISTS notify_channel text,
  ADD COLUMN IF NOT EXISTS notify_error   text;

CREATE INDEX IF NOT EXISTS reconciliation_alerts_run_date_idx
  ON reconciliation_alerts(run_date DESC);

ALTER TABLE reconciliation_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deny_anon" ON reconciliation_alerts;
CREATE POLICY "deny_anon" ON reconciliation_alerts FOR ALL USING (false);

-- ── Default threshold settings ───────────────────────────
INSERT INTO settings (key, value) VALUES
  ('reconciliation_alert_window_days',     '7'),
  ('reconciliation_alert_variance_g',      '2.0'),
  ('reconciliation_alert_negative_count',  '1'),
  ('reconciliation_alert_unlinked_count',  '3'),
  ('reconciliation_alert_email_to',        ''),
  ('reconciliation_alert_email_from',      '')
ON CONFLICT (key) DO NOTHING;
