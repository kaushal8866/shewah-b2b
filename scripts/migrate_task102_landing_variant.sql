-- Task 102 — A/B test the new landing layout against the previous one
-- Adds a column tagging which landing variant each lead saw, so we can read
-- conversion rates per variant in /partners/leads.
-- Run this in: Supabase Dashboard → SQL Editor → New query
-- Idempotent — safe to re-run.

ALTER TABLE partner_signups
  ADD COLUMN IF NOT EXISTS landing_variant text;

CREATE INDEX IF NOT EXISTS partner_signups_landing_variant_idx
  ON partner_signups(landing_variant);
