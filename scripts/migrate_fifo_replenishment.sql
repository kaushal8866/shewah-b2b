-- Migration: Lot-Based FIFO Costing & Gold Replenishment System

-- 1. Create purchase_lots table
CREATE TABLE IF NOT EXISTS purchase_lots (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_number            TEXT UNIQUE NOT NULL,
  material_type         TEXT NOT NULL
    CHECK (material_type IN (
      'gold_24k', 'silver_925', 'silver_999',
      'diamond_lgd', 'diamond_natural', 'finding'
    )),
  purchase_date         DATE NOT NULL DEFAULT CURRENT_DATE,

  -- COST FIELDS
  unit_cost             NUMERIC(14,4) NOT NULL,
  unit_type             TEXT NOT NULL
    CHECK (unit_type IN ('gram', 'carat', 'piece')),
  total_qty             NUMERIC(12,4) NOT NULL,
  remaining_qty         NUMERIC(12,4) NOT NULL,
  total_cost            NUMERIC(14,2) NOT NULL,

  -- GOLD / SILVER FIELDS
  gold_karat            TEXT,
  gold_purity_factor    NUMERIC(6,4),

  -- DIAMOND MATCHING FIELDS
  diamond_shape         TEXT,
  diamond_color         TEXT,
  diamond_clarity       TEXT,
  diamond_size_band     TEXT,
  diamond_is_certified  BOOLEAN DEFAULT false,
  diamond_cert_number   TEXT,
  diamond_cert_lab      TEXT,
  diamond_piece_count   INTEGER,

  -- FINDING FIELDS
  finding_type          TEXT,
  finding_description   TEXT,

  -- SOURCE / AUDIT
  supplier_name         TEXT,
  invoice_reference     TEXT,
  vendor_id             UUID NOT NULL REFERENCES vendors(id),
  linked_stock_movement_id  UUID REFERENCES stock_movements(id) ON DELETE SET NULL,
  linked_cash_txn_id    UUID REFERENCES cash_transactions(id) ON DELETE SET NULL,
  notes                 TEXT,
  status                TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'exhausted', 'voided')),
  created_by            UUID NOT NULL,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create Sequences and Triggers for purchase_lots
CREATE SEQUENCE IF NOT EXISTS purchase_lot_seq START 1;

CREATE OR REPLACE FUNCTION generate_lot_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.lot_number IS NULL THEN
    NEW.lot_number := 'PL-' || LPAD(nextval('purchase_lot_seq')::TEXT, 5, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS lot_number_trigger ON purchase_lots;
CREATE TRIGGER lot_number_trigger
BEFORE INSERT ON purchase_lots
FOR EACH ROW EXECUTE FUNCTION generate_lot_number();

CREATE OR REPLACE FUNCTION check_lot_exhausted()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.remaining_qty <= 0 THEN
    NEW.status := 'exhausted';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS lot_exhausted_trigger ON purchase_lots;
CREATE TRIGGER lot_exhausted_trigger
BEFORE UPDATE ON purchase_lots
FOR EACH ROW EXECUTE FUNCTION check_lot_exhausted();

-- Indexes for purchase_lots
CREATE INDEX IF NOT EXISTS idx_lots_material_date ON purchase_lots (material_type, purchase_date ASC)
  WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_lots_diamond_key ON purchase_lots (
  diamond_shape, diamond_color, diamond_clarity, diamond_size_band, purchase_date ASC
) WHERE material_type IN ('diamond_lgd', 'diamond_natural') AND status = 'active';
CREATE INDEX IF NOT EXISTS idx_lots_cert ON purchase_lots (diamond_cert_number)
  WHERE diamond_cert_number IS NOT NULL;


-- 3. Create lot_issuances table
CREATE TABLE IF NOT EXISTS lot_issuances (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_id                  UUID NOT NULL REFERENCES purchase_lots(id) ON DELETE CASCADE,
  manufacturing_order_id  UUID NOT NULL REFERENCES manufacturing_orders(id) ON DELETE CASCADE,
  issued_qty              NUMERIC(12,4) NOT NULL,
  unit_cost               NUMERIC(14,4) NOT NULL,
  total_cost              NUMERIC(14,2) NOT NULL,
  issuance_type           TEXT NOT NULL DEFAULT 'reserved'
    CHECK (issuance_type IN ('reserved', 'final')),
  reserved_at             TIMESTAMPTZ DEFAULT NOW(),
  finalised_at            TIMESTAMPTZ,
  created_by              UUID NOT NULL,
  notes                   TEXT
);

CREATE INDEX IF NOT EXISTS idx_issuances_mfg ON lot_issuances (manufacturing_order_id);
CREATE INDEX IF NOT EXISTS idx_issuances_lot ON lot_issuances (lot_id);


-- 4. Create replenishment_obligations table
CREATE TABLE IF NOT EXISTS replenishment_obligations (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obligation_number       TEXT UNIQUE NOT NULL,
  manufacturing_order_id  UUID NOT NULL REFERENCES manufacturing_orders(id) ON DELETE CASCADE,
  material_type           TEXT NOT NULL
    CHECK (material_type IN ('gold_24k', 'silver_925', 'silver_999')),
  gold_qty_g              NUMERIC(12,4) NOT NULL,
  rate_at_completion      NUMERIC(12,2) NOT NULL,
  obligation_value        NUMERIC(14,2) NOT NULL,
  status                  TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'partially_offset', 'fully_offset')),
  remaining_qty_g         NUMERIC(12,4) NOT NULL,
  created_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE SEQUENCE IF NOT EXISTS replenishment_obligation_seq START 1;

CREATE OR REPLACE FUNCTION generate_obligation_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.obligation_number IS NULL THEN
    NEW.obligation_number := 'RO-' || LPAD(nextval('replenishment_obligation_seq')::TEXT, 5, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS obligation_number_trigger ON replenishment_obligations;
CREATE TRIGGER obligation_number_trigger
BEFORE INSERT ON replenishment_obligations
FOR EACH ROW EXECUTE FUNCTION generate_obligation_number();

CREATE INDEX IF NOT EXISTS idx_obligations_status ON replenishment_obligations (status, created_at ASC)
  WHERE status IN ('pending', 'partially_offset');
CREATE INDEX IF NOT EXISTS idx_obligations_mfg ON replenishment_obligations (manufacturing_order_id);


-- 5. Create replenishment_offsets table
CREATE TABLE IF NOT EXISTS replenishment_offsets (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obligation_id           UUID NOT NULL REFERENCES replenishment_obligations(id) ON DELETE CASCADE,
  purchase_lot_id         UUID NOT NULL REFERENCES purchase_lots(id) ON DELETE CASCADE,
  qty_offset_g            NUMERIC(12,4) NOT NULL,
  obligation_rate         NUMERIC(12,2) NOT NULL,
  purchase_rate           NUMERIC(12,2) NOT NULL,
  delta                   NUMERIC(14,2) NOT NULL,
  offset_date             DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_offsets_obligation ON replenishment_offsets (obligation_id);
CREATE INDEX IF NOT EXISTS idx_offsets_lot ON replenishment_offsets (purchase_lot_id);
CREATE INDEX IF NOT EXISTS idx_offsets_date ON replenishment_offsets (offset_date DESC);


-- 6. RPC Functions
CREATE OR REPLACE FUNCTION decrement_lot_qty(p_lot_id UUID, p_qty NUMERIC)
RETURNS void AS $$
BEGIN
  UPDATE purchase_lots
  SET remaining_qty = remaining_qty - p_qty
  WHERE id = p_lot_id AND remaining_qty >= p_qty;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Insufficient qty in lot %', p_lot_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION increment_lot_qty(p_lot_id UUID, p_qty NUMERIC)
RETURNS void AS $$
BEGIN
  UPDATE purchase_lots
  SET remaining_qty = remaining_qty + p_qty,
      status = 'active'
  WHERE id = p_lot_id;
END;
$$ LANGUAGE plpgsql;


-- 7. Add columns to existing tables
ALTER TABLE manufacturing_orders
  ADD COLUMN IF NOT EXISTS lot_based_gold_cost    NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS lot_based_diamond_cost NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS lot_based_finding_cost NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS lot_based_total_cogs   NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS fifo_costed            BOOLEAN DEFAULT false;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS lot_based_cogs         NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS lot_based_margin       NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS replacement_variance   NUMERIC(14,2);


-- 8. Enable RLS and add basic authenticated policies
ALTER TABLE purchase_lots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can do everything on purchase_lots" ON purchase_lots;
CREATE POLICY "Authenticated users can do everything on purchase_lots" ON purchase_lots
  FOR ALL USING (auth.role() = 'authenticated');

ALTER TABLE lot_issuances ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can do everything on lot_issuances" ON lot_issuances;
CREATE POLICY "Authenticated users can do everything on lot_issuances" ON lot_issuances
  FOR ALL USING (auth.role() = 'authenticated');

ALTER TABLE replenishment_obligations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can do everything on replenishment_obligations" ON replenishment_obligations;
CREATE POLICY "Authenticated users can do everything on replenishment_obligations" ON replenishment_obligations
  FOR ALL USING (auth.role() = 'authenticated');

ALTER TABLE replenishment_offsets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can do everything on replenishment_offsets" ON replenishment_offsets;
CREATE POLICY "Authenticated users can do everything on replenishment_offsets" ON replenishment_offsets
  FOR ALL USING (auth.role() = 'authenticated');
