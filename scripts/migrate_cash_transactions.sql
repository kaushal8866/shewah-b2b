-- Migration: Cash Transactions Table and Policies
-- Run this in your Supabase SQL Editor

-- 1. Create cash transactions table
CREATE TABLE IF NOT EXISTS cash_transactions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  txn_number          TEXT UNIQUE NOT NULL,
  txn_date            DATE NOT NULL DEFAULT CURRENT_DATE,
  txn_type            TEXT NOT NULL CHECK (txn_type IN ('income', 'expense')),
  category_group      TEXT NOT NULL,
  category            TEXT NOT NULL,
  amount              NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  payment_mode        TEXT NOT NULL DEFAULT 'cash'
                        CHECK (payment_mode IN ('cash', 'upi', 'bank_transfer', 'cheque', 'other')),
  note                TEXT,
  party_name          TEXT,
  linked_order_id     UUID REFERENCES orders(id) ON DELETE SET NULL,
  linked_partner_id   UUID REFERENCES partners(id) ON DELETE SET NULL,
  is_cogs             BOOLEAN NOT NULL DEFAULT false,
  created_by          UUID NOT NULL,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  is_void             BOOLEAN NOT NULL DEFAULT false,
  void_reason         TEXT,
  voided_at           TIMESTAMPTZ,
  voided_by           UUID
);

-- 2. Auto-increment sequence trigger for txn_number (CT-00001)
CREATE SEQUENCE IF NOT EXISTS cash_txn_seq START 1;

CREATE OR REPLACE FUNCTION generate_cash_txn_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.txn_number IS NULL THEN
    NEW.txn_number := 'CT-' || LPAD(nextval('cash_txn_seq')::TEXT, 5, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS cash_txn_number_trigger ON cash_transactions;
CREATE TRIGGER cash_txn_number_trigger
BEFORE INSERT ON cash_transactions
FOR EACH ROW EXECUTE FUNCTION generate_cash_txn_number();

-- 3. Query performance indexes
CREATE INDEX IF NOT EXISTS idx_cash_txn_date ON cash_transactions (txn_date DESC);
CREATE INDEX IF NOT EXISTS idx_cash_txn_type ON cash_transactions (txn_type, is_void);
CREATE INDEX IF NOT EXISTS idx_cash_txn_category ON cash_transactions (category_group, category);
CREATE INDEX IF NOT EXISTS idx_cash_txn_order ON cash_transactions (linked_order_id) WHERE linked_order_id IS NOT NULL;

-- 4. Enable Row Level Security and add standard authenticated users access policy
ALTER TABLE cash_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can do everything on cash_transactions" ON cash_transactions;
CREATE POLICY "Authenticated users can do everything on cash_transactions" ON cash_transactions
  FOR ALL USING (auth.role() = 'authenticated');
