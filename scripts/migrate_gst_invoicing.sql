-- Migration: GST Invoicing Module
--
-- This script:
-- 1. Adds a nullable 'gst_number' column to the 'partners' table.
-- 2. Creates the sequence 'gst_invoice_number_seq' for unique invoice numbering.
-- 3. Creates the 'gst_invoices' table to store tax split details and frozen items.
-- 4. Inserts default business settings keys.
--
-- Run in: Supabase Dashboard → SQL Editor → New query.

BEGIN;

-- 1. Alter partners table to add gst_number if not exists
ALTER TABLE partners ADD COLUMN IF NOT EXISTS gst_number text;

-- 2. Create sequence for invoice numbers
CREATE SEQUENCE IF NOT EXISTS gst_invoice_number_seq START WITH 1;

-- 3. Create gst_invoices table
CREATE TABLE IF NOT EXISTS gst_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text UNIQUE NOT NULL,
  invoice_date date NOT NULL DEFAULT CURRENT_DATE,
  invoice_type text NOT NULL CHECK (invoice_type IN ('order', 'diamond_trade')),
  
  -- Associations
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  diamond_trade_id uuid REFERENCES partner_diamond_trades(id) ON DELETE SET NULL,
  partner_id uuid REFERENCES partners(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,

  -- Buyer snapshot at generation
  buyer_name text NOT NULL,
  buyer_address text,
  buyer_gstin text,
  buyer_state text NOT NULL,

  -- Seller snapshot at generation
  seller_name text NOT NULL DEFAULT 'Shewah',
  seller_address text NOT NULL,
  seller_gstin text,
  seller_state text NOT NULL DEFAULT 'Gujarat',

  -- Pricing snapshots
  subtotal_amount numeric NOT NULL CHECK (subtotal_amount >= 0),
  cgst_rate numeric NOT NULL DEFAULT 0 CHECK (cgst_rate >= 0),
  cgst_amount numeric NOT NULL DEFAULT 0 CHECK (cgst_amount >= 0),
  sgst_rate numeric NOT NULL DEFAULT 0 CHECK (sgst_rate >= 0),
  sgst_amount numeric NOT NULL DEFAULT 0 CHECK (sgst_amount >= 0),
  igst_rate numeric NOT NULL DEFAULT 0 CHECK (igst_rate >= 0),
  igst_amount numeric NOT NULL DEFAULT 0 CHECK (igst_amount >= 0),
  total_tax numeric NOT NULL DEFAULT 0 CHECK (total_tax >= 0),
  grand_total numeric NOT NULL CHECK (grand_total >= 0),

  -- Line items: Array of { description: text, hsn_code: text, qty: numeric, rate: numeric, amount: numeric }
  items jsonb NOT NULL,

  -- Audit trail
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled')),
  cancelled_at timestamptz,
  cancelled_reason text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS gst_invoices_order_idx ON gst_invoices(order_id);
CREATE INDEX IF NOT EXISTS gst_invoices_diamond_trade_idx ON gst_invoices(diamond_trade_id);
CREATE INDEX IF NOT EXISTS gst_invoices_partner_idx ON gst_invoices(partner_id, invoice_date DESC);
CREATE INDEX IF NOT EXISTS gst_invoices_number_idx ON gst_invoices(invoice_number);

-- 4. Enable RLS and add policies
ALTER TABLE gst_invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all" ON gst_invoices;
CREATE POLICY "service_role_all" ON gst_invoices
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_select" ON gst_invoices;
CREATE POLICY "auth_select" ON gst_invoices
  FOR SELECT TO authenticated USING (true);

-- 5. Default Settings
INSERT INTO settings (key, value) VALUES
  ('business_gstin', ''),
  ('business_billing_address', 'Surat, Gujarat'),
  ('business_state', 'Gujarat'),
  ('bank_details_account_name', 'Shewah'),
  ('bank_details_bank_name', ''),
  ('bank_details_account_no', ''),
  ('bank_details_ifsc', ''),
  ('invoice_terms_conditions', '1. Goods once sold will not be taken back.\n2. Subject to Surat jurisdiction.')
ON CONFLICT (key) DO NOTHING;

-- 6. Helper RPC function to fetch the next invoice sequence number safely
CREATE OR REPLACE FUNCTION next_invoice_number() 
RETURNS bigint AS $$
BEGIN
  RETURN nextval('gst_invoice_number_seq');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
