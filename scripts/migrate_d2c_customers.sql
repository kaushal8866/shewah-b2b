-- Task 116 — D2C foundation: customer record + enquiry intake + admin inbox.
--
-- Provisions the four tables that back the new D2C surfaces:
--   • customers                  — one row per consumer (de-duped by whatsapp/email in the API)
--   • customer_addresses         — 0..N delivery addresses per customer
--   • customer_enquiries         — one row per design enquiry (becomes a quote, then an order)
--   • customer_enquiry_activity  — append-only timeline (notes, status changes, assignments, images)
--
-- Run this in: Supabase Dashboard → SQL Editor → New query
-- Idempotent — safe to re-run.

-- ─────────────────────────────────────────────────────────────────────
-- 1. customers
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  full_name       text NOT NULL,
  whatsapp        text NOT NULL,                -- digits-only, includes country code (e.g. 919876543210)
  phone           text,                          -- alt phone, optional
  email           text,
  city            text,
  pincode         text,
  gst_number      text,                          -- if the customer wants a GST invoice in their name
  birthday        date,
  anniversary     date,

  preferred_contact text NOT NULL DEFAULT 'whatsapp'
    CHECK (preferred_contact IN ('whatsapp', 'phone', 'email')),

  source            text,                        -- 'walk-in' | 'referral' | 'instagram' | 'facebook' | 'website' | 'event' | 'other'
  referral_source   text,                        -- free text — who referred them
  internal_notes    text,

  created_by      uuid REFERENCES app_users(id) ON DELETE SET NULL,
  archived_at     timestamptz                    -- soft delete
);

CREATE INDEX IF NOT EXISTS customers_created_at_idx ON customers(created_at DESC);
CREATE INDEX IF NOT EXISTS customers_whatsapp_idx   ON customers(whatsapp);
CREATE INDEX IF NOT EXISTS customers_email_idx      ON customers(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS customers_full_name_idx  ON customers(lower(full_name));
CREATE INDEX IF NOT EXISTS customers_archived_idx   ON customers(archived_at) WHERE archived_at IS NULL;

-- Partial-unique indexes give the API a race-safe dedupe target. Only active
-- (non-archived) rows are constrained — an archived duplicate must not block a
-- legitimate re-onboard. Email is lower-cased to make matching case-insensitive.
CREATE UNIQUE INDEX IF NOT EXISTS customers_whatsapp_active_uniq
  ON customers(whatsapp)
  WHERE archived_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS customers_email_active_uniq
  ON customers(lower(email))
  WHERE archived_at IS NULL AND email IS NOT NULL AND email <> '';

-- ─────────────────────────────────────────────────────────────────────
-- 2. customer_addresses
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customer_addresses (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  customer_id   uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,

  label         text,                            -- 'Home', 'Office', …
  line1         text NOT NULL,
  line2         text,
  city          text NOT NULL,
  state         text,
  pincode       text NOT NULL,
  country       text NOT NULL DEFAULT 'India',
  is_default    boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS customer_addresses_customer_idx
  ON customer_addresses(customer_id);

-- ─────────────────────────────────────────────────────────────────────
-- 3. customer_enquiries
-- ─────────────────────────────────────────────────────────────────────
-- Sequence-backed human ID so operators can quote "ENQ-00042" on a call.
CREATE SEQUENCE IF NOT EXISTS customer_enquiry_number_seq START 1;

CREATE TABLE IF NOT EXISTS customer_enquiries (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  enquiry_number  text NOT NULL UNIQUE
    DEFAULT ('ENQ-' || lpad(nextval('customer_enquiry_number_seq')::text, 5, '0')),

  customer_id     uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,

  title           text NOT NULL,                 -- e.g. "Engagement ring — solitaire"
  product_type    text,                          -- 'ring' | 'necklace' | 'earring' | 'pendant' | 'bracelet' | 'bangle' | 'other'
  occasion        text,                          -- 'engagement' | 'wedding' | 'birthday' | 'anniversary' | 'gift' | 'self' | 'other'
  target_date     date,

  budget_min      numeric(12,2),
  budget_max      numeric(12,2),

  karat           integer,                       -- 14 | 18 | 22 (gold itself is stored as 24kt-net everywhere)
  gold_weight_estimate_g  numeric(10,4),
  diamond_specs   jsonb,                          -- free-form structured spec captured at intake

  reference_image_urls text[] NOT NULL DEFAULT '{}'::text[],   -- Cloudinary URLs
  description     text,

  status          text NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'in_discussion', 'quoted', 'approved', 'rejected', 'converted_to_order', 'dropped')),

  assigned_to     uuid REFERENCES app_users(id) ON DELETE SET NULL,
  created_by      uuid REFERENCES app_users(id) ON DELETE SET NULL,
  internal_notes  text,
  next_followup_at timestamptz,

  -- Loose link to a future order — no FK constraint yet because the orders
  -- table is currently B2B-only. Task #117/#118 will tighten this once the
  -- D2C order/quote flow lands.
  converted_order_id uuid
);

CREATE INDEX IF NOT EXISTS customer_enquiries_customer_idx
  ON customer_enquiries(customer_id);
CREATE INDEX IF NOT EXISTS customer_enquiries_status_idx
  ON customer_enquiries(status);
CREATE INDEX IF NOT EXISTS customer_enquiries_assigned_idx
  ON customer_enquiries(assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX IF NOT EXISTS customer_enquiries_followup_idx
  ON customer_enquiries(next_followup_at) WHERE next_followup_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS customer_enquiries_created_at_idx
  ON customer_enquiries(created_at DESC);

-- ─────────────────────────────────────────────────────────────────────
-- 4. customer_enquiry_activity — append-only timeline
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customer_enquiry_activity (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  enquiry_id    uuid NOT NULL REFERENCES customer_enquiries(id) ON DELETE CASCADE,
  actor_id      uuid REFERENCES app_users(id) ON DELETE SET NULL,
  type          text NOT NULL
    CHECK (type IN ('created', 'note', 'status_change', 'assigned', 'image_added', 'updated', 'followup_set')),
  payload       jsonb,                            -- structured details (e.g. { from: 'new', to: 'in_discussion' })
  body          text                              -- free-text note body
);

CREATE INDEX IF NOT EXISTS customer_enquiry_activity_enquiry_idx
  ON customer_enquiry_activity(enquiry_id, created_at DESC);

-- ─────────────────────────────────────────────────────────────────────
-- 5. RLS — locked down. Admin reads/writes flow through /api/db with the
--    service role, mirroring the partner_signups pattern from task 85.
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE customers                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_addresses         ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_enquiries         ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_enquiry_activity  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS customers_no_anon                 ON customers;
DROP POLICY IF EXISTS customer_addresses_no_anon        ON customer_addresses;
DROP POLICY IF EXISTS customer_enquiries_no_anon        ON customer_enquiries;
DROP POLICY IF EXISTS customer_enquiry_activity_no_anon ON customer_enquiry_activity;

CREATE POLICY customers_no_anon                 ON customers                 FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY customer_addresses_no_anon        ON customer_addresses        FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY customer_enquiries_no_anon        ON customer_enquiries        FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY customer_enquiry_activity_no_anon ON customer_enquiry_activity FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
