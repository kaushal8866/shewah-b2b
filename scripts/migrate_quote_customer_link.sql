-- Link quotes to D2C customers table
-- Run this in: Supabase Dashboard → SQL Editor → New query

ALTER TABLE quotes ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES customers(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_quotes_customer_id ON quotes(customer_id) WHERE customer_id IS NOT NULL;
