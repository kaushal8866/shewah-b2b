-- Task 97 — Trim partner-signup form to 3 required fields
-- The default lead form now collects only name + WhatsApp + city up-front;
-- store_name moves into an optional second step. Drop the NOT NULL so
-- inserts from the trimmed form succeed.
-- Run this in: Supabase Dashboard → SQL Editor → New query
-- Idempotent — safe to re-run.

ALTER TABLE partner_signups
  ALTER COLUMN store_name DROP NOT NULL;
