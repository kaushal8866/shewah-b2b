-- Task 85 — Partner-acquisition landing page
-- Captures jeweller leads from the public landing page at shewah.com/.
-- Run this in: Supabase Dashboard → SQL Editor → New query
-- Idempotent — safe to re-run.

CREATE TABLE IF NOT EXISTS partner_signups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),

  -- Contact details
  full_name      text NOT NULL,
  store_name     text NOT NULL,
  city           text NOT NULL,
  phone          text NOT NULL,
  whatsapp       text NOT NULL,
  email          text,
  gst_number     text,

  -- Qualification
  monthly_volume text,         -- '<5', '5-20', '20-50', '50+'
  note           text,         -- "what brought you here"

  -- Source attribution (captured server-side from URL + headers)
  utm_source     text,
  utm_medium     text,
  utm_campaign   text,
  utm_content    text,
  utm_term       text,
  referrer       text,
  landing_path   text,
  user_agent     text,
  ip_hash        text,         -- sha256(ip + salt) — never raw IP

  -- Internal lifecycle
  status         text NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'contacted', 'qualified', 'onboarded', 'rejected')),
  assigned_to    uuid REFERENCES app_users(id) ON DELETE SET NULL,
  internal_notes text,
  contacted_at   timestamptz,
  converted_partner_id uuid REFERENCES partners(id) ON DELETE SET NULL,

  -- Notification dispatch trail (does not block the insert if either fails)
  email_dispatch    jsonb,    -- { sent: bool, error?: string, at: iso }
  whatsapp_dispatch jsonb
);

CREATE INDEX IF NOT EXISTS partner_signups_created_at_idx
  ON partner_signups(created_at DESC);

CREATE INDEX IF NOT EXISTS partner_signups_status_idx
  ON partner_signups(status);

CREATE INDEX IF NOT EXISTS partner_signups_utm_campaign_idx
  ON partner_signups(utm_campaign);

-- RLS: locked down. The public POST endpoint uses the service-role key, so
-- it bypasses RLS. Admin reads/updates flow through /api/db (also service
-- role) once `partner_signups` is allow-listed. No anon access.
ALTER TABLE partner_signups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS partner_signups_no_anon ON partner_signups;
CREATE POLICY partner_signups_no_anon
  ON partner_signups
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- Settings rows used by the lead-capture endpoint. Insert only if missing
-- so an operator who has already tuned them keeps their values.
INSERT INTO settings (key, value)
SELECT * FROM (VALUES
  ('lead_notify_email_enabled',    'true'),
  ('lead_notify_whatsapp_enabled', 'true'),
  ('lead_notify_email_to',         ''),
  ('lead_notify_whatsapp_to',      '')
) AS v(key, value)
WHERE NOT EXISTS (
  SELECT 1 FROM settings s WHERE s.key = v.key
);
