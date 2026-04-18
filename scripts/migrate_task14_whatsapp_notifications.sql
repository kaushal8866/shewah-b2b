-- ============================================================
-- Task 14: Retailer WhatsApp notifications on order status change
-- Run this in Supabase SQL Editor (or Postgres psql).
-- ============================================================

-- Per-retailer toggle. Default ON so existing partners keep getting pings.
alter table partners
  add column if not exists notify_whatsapp boolean not null default true;

-- Global enable/disable + outbound webhook config.
insert into settings (key, value) values
  ('whatsapp_notifications_enabled', 'true'),
  ('whatsapp_webhook_url', ''),
  ('whatsapp_webhook_token', '')
on conflict (key) do nothing;
