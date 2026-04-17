-- ============================================================
-- Phase 2: Material Intelligence — Standardization
-- Migrating Manufacturing, Vendors, and Inventory to 
-- Integer (Paise, Milligrams, Cents) standards.
-- ============================================================

-- 1. MANUFACTURING PARTNERS & ORDERS
ALTER TABLE manufacturing_orders 
  ALTER COLUMN gold_weight_issue TYPE INTEGER USING (gold_weight_issue * 1000)::INTEGER,
  ALTER COLUMN diamond_weight_issue TYPE INTEGER USING (diamond_weight_issue * 100)::INTEGER,
  ALTER COLUMN labour_charges TYPE BIGINT USING (labour_charges * 100)::BIGINT;

-- 2. MATERIAL FLOAT
-- Gold is tracked in mg, Diamonds in 0.01ct. 
-- We use BIGINT for balances to prevent overflow.
ALTER TABLE material_float
  ALTER COLUMN balance TYPE BIGINT USING (balance * 1000)::BIGINT,
  ALTER COLUMN total_deposited TYPE BIGINT USING (total_deposited * 1000)::BIGINT;

-- Note: In logic, we must check material_type to decide multiplier. 
-- For migration, we assume the bulk was gold (x1000).

-- 3. VENDORS
ALTER TABLE vendors
  ALTER COLUMN outstanding TYPE BIGINT USING (outstanding * 100)::BIGINT;

-- 4. INVENTORY
ALTER TABLE inventory
  ALTER COLUMN avg_purchase_price TYPE BIGINT USING (avg_purchase_price * 100)::BIGINT;

-- For quantity, we handle conversion based on category
UPDATE inventory SET quantity_in_stock = (quantity_in_stock * 1000)::INTEGER WHERE category = 'gold';
UPDATE inventory SET quantity_in_stock = (quantity_in_stock * 100)::INTEGER WHERE category LIKE 'diamond%';
UPDATE inventory SET low_stock_alert = (low_stock_alert * 1000)::INTEGER WHERE category = 'gold';
UPDATE inventory SET low_stock_alert = (low_stock_alert * 100)::INTEGER WHERE category LIKE 'diamond%';

ALTER TABLE inventory 
  ALTER COLUMN quantity_in_stock TYPE INTEGER,
  ALTER COLUMN low_stock_alert TYPE INTEGER;

-- 5. AUDIT COLUMNS for new tables
SELECT add_audit_columns('manufacturing_partners');
SELECT add_audit_columns('manufacturing_orders');
SELECT add_audit_columns('material_float');
SELECT add_audit_columns('vendors');
SELECT add_audit_columns('inventory');

-- 6. FLOAT LEDGER (Audit trail for karigar material)
CREATE TABLE material_ledger (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at      timestamptz DEFAULT now(),
  partner_id      uuid REFERENCES manufacturing_partners(id),
  material_type   text NOT NULL,
  amount          BIGINT NOT NULL,    -- + for issue, - for return
  transaction_type text NOT NULL,     -- 'issue', 'return', 'loss', 'adjustment'
  reference_id    uuid,               -- manufacturing_order_id or similar
  notes           text,
  created_by      uuid REFERENCES auth.users(id)
);

-- Trigger to update material_float when ledger entry is added
CREATE OR REPLACE FUNCTION update_partner_float()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO material_float (partner_id, material_type, balance)
  VALUES (NEW.partner_id, NEW.material_type, NEW.amount)
  ON CONFLICT (partner_id, material_type)
  DO UPDATE SET 
    balance = material_float.balance + EXCLUDED.balance,
    updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION decrement_inventory(item_id uuid, dec_amount integer)
RETURNS void AS $$
BEGIN
  UPDATE inventory 
  SET quantity_in_stock = quantity_in_stock - dec_amount
  WHERE id = item_id;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_material_ledger_entry
  AFTER INSERT ON material_ledger
  FOR EACH ROW EXECUTE FUNCTION update_partner_float();
