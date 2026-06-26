-- Migration: Intelligent Jewelry Configurator & Master Data Engine
--
-- This script creates the core configurator tables, triggers, constraints,
-- and RLS policies for the white-label jewelry customization platform.
--
-- Run in: Supabase Dashboard → SQL Editor → New query.

-- ==========================================
-- 1. Create Configurator Tables
-- ==========================================

-- A. cfg_metals — Metal options
CREATE TABLE IF NOT EXISTS cfg_metals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,                -- 'Yellow Gold', 'White Gold', 'Rose Gold', 'Silver', 'Platinum'
  metal_type TEXT NOT NULL,          -- 'gold', 'silver', 'platinum'
  color_hex TEXT,                    -- '#FFD700', '#E8E8E8', '#E8B4B8', '#C0C0C0', '#E5E4E2'
  color_name TEXT,                   -- 'Yellow', 'White', 'Rose', 'Silver', 'Platinum'
  swatch_url TEXT,                   -- Optional swatch image
  alloy_notes TEXT,                  -- Alloy composition notes
  sort_order INT DEFAULT 100,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS cfg_metals_name_lower_idx ON cfg_metals (lower(name));

-- B. cfg_karats — Karat grades per metal
CREATE TABLE IF NOT EXISTS cfg_karats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metal_id UUID NOT NULL REFERENCES cfg_metals(id) ON DELETE CASCADE,
  karat INT NOT NULL,                -- 24, 22, 18, 14, 10, 9 for gold; 925 for silver; 950 for platinum
  karat_label TEXT NOT NULL,         -- '24K', '22K', '18K', '14K', '10K', '9K', '925', '950'
  purity_factor NUMERIC NOT NULL,    -- 1.0, 0.916, 0.75, 0.60, 0.42, 0.38, 0.925, 0.95
  is_active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 100,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(metal_id, karat)
);

-- C. cfg_finishes — Surface finishes
CREATE TABLE IF NOT EXISTS cfg_finishes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,                -- 'High Polish', 'Matte', 'Satin', 'Brushed', 'Hammered', 'Antique', 'Sandblasted'
  description TEXT,
  swatch_url TEXT,                   -- Texture image URL
  labour_surcharge_percent NUMERIC DEFAULT 0,
  sort_order INT DEFAULT 100,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS cfg_finishes_name_lower_idx ON cfg_finishes (lower(name));

-- D. cfg_finish_metal_compat — Finish ↔ Metal compatibility
CREATE TABLE IF NOT EXISTS cfg_finish_metal_compat (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  finish_id UUID NOT NULL REFERENCES cfg_finishes(id) ON DELETE CASCADE,
  metal_id UUID NOT NULL REFERENCES cfg_metals(id) ON DELETE CASCADE,
  karat INT,                         -- NULL = all karats for this metal
  UNIQUE(finish_id, metal_id, karat)
);

-- E. cfg_stone_types — Stone type registry
CREATE TABLE IF NOT EXISTS cfg_stone_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL,            -- 'diamond', 'moissanite', 'cz', 'gemstone'
  default_cert_body TEXT,            -- 'IGI', 'GIA', 'SGL', NULL
  sort_order INT DEFAULT 100,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS cfg_stone_types_name_lower_idx ON cfg_stone_types (lower(name));

-- F. cfg_stone_clarity_grades — Individual clarity grades
CREATE TABLE IF NOT EXISTS cfg_stone_clarity_grades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL,                -- 'FL', 'IF', 'VVS1', 'VVS2', 'VS1', 'VS2', 'SI1', 'SI2'
  label TEXT NOT NULL,
  bucket_id UUID REFERENCES diamond_quality_buckets(id) ON DELETE SET NULL,
  sort_order INT DEFAULT 100,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS cfg_stone_clarity_grades_code_lower_idx ON cfg_stone_clarity_grades (lower(code));

-- G. cfg_stone_color_grades — Individual color grades
CREATE TABLE IF NOT EXISTS cfg_stone_color_grades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL,                -- 'D', 'E', 'F', 'G', 'H', 'I', 'J'
  label TEXT NOT NULL,
  bucket_id UUID REFERENCES diamond_color_buckets(id) ON DELETE SET NULL,
  sort_order INT DEFAULT 100,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS cfg_stone_color_grades_code_lower_idx ON cfg_stone_color_grades (lower(code));

-- H. cfg_stone_prices — Stone pricing
CREATE TABLE IF NOT EXISTS cfg_stone_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stone_type_id UUID NOT NULL REFERENCES cfg_stone_types(id) ON DELETE CASCADE,
  shape_id UUID NOT NULL REFERENCES diamond_shapes(id) ON DELETE CASCADE,
  size_id UUID NOT NULL REFERENCES diamond_sizes(id) ON DELETE CASCADE,
  clarity_grade_id UUID REFERENCES cfg_stone_clarity_grades(id) ON DELETE SET NULL,
  color_grade_id UUID REFERENCES cfg_stone_color_grades(id) ON DELETE SET NULL,
  price_per_piece NUMERIC NOT NULL CHECK (price_per_piece >= 0),
  is_available BOOLEAN DEFAULT true,
  lead_time_days INT,                -- NULL = in stock
  updated_by TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(stone_type_id, shape_id, size_id, clarity_grade_id, color_grade_id)
);
CREATE INDEX IF NOT EXISTS cfg_stone_prices_lookup_idx ON cfg_stone_prices (stone_type_id, shape_id, size_id);

-- I. cfg_rules — Configuration rules engine
CREATE TABLE IF NOT EXISTS cfg_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('exclusion', 'dependency', 'dimension', 'category', 'metal_karat', 'stone_setting', 'finish_metal')),
  category TEXT,                     -- NULL = all categories
  conditions JSONB NOT NULL DEFAULT '{}'::jsonb,
  action TEXT NOT NULL CHECK (action IN ('disable', 'require', 'warn', 'hide')),
  action_message TEXT,
  priority INT DEFAULT 100,
  is_active BOOLEAN DEFAULT true,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS cfg_rules_type_idx ON cfg_rules (rule_type, is_active);
CREATE INDEX IF NOT EXISTS cfg_rules_category_idx ON cfg_rules (category) WHERE category IS NOT NULL;

-- J. cfg_labour_rates — Labour cost matrix
CREATE TABLE IF NOT EXISTS cfg_labour_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metal_id UUID NOT NULL REFERENCES cfg_metals(id) ON DELETE CASCADE,
  karat INT,                         -- NULL = all karats
  finish_id UUID REFERENCES cfg_finishes(id) ON DELETE SET NULL, -- NULL = default finish
  category TEXT,                     -- NULL = all categories
  rate_per_gram NUMERIC NOT NULL CHECK (rate_per_gram >= 0),
  updated_by TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(metal_id, karat, finish_id, category)
);

-- K. cfg_product_addons — Add-on options
CREATE TABLE IF NOT EXISTS cfg_product_addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  addon_type TEXT NOT NULL CHECK (addon_type IN ('engraving', 'certification', 'packaging', 'shipping', 'insurance')),
  pricing_type TEXT NOT NULL CHECK (pricing_type IN ('fixed', 'per_character', 'percent')),
  price NUMERIC NOT NULL CHECK (price >= 0),
  description TEXT,
  max_characters INT,                -- For engraving
  font_options JSONB,                -- For engraving: [{"value": "serif", "label": "Classic Serif"}]
  is_active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 100,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- L. cfg_product_addon_map — Addon ↔ Product mapping
CREATE TABLE IF NOT EXISTS cfg_product_addon_map (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  addon_id UUID NOT NULL REFERENCES cfg_product_addons(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  UNIQUE(addon_id, product_id)
);

-- M. cfg_category_options — Category-specific options
CREATE TABLE IF NOT EXISTS cfg_category_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  option_key TEXT NOT NULL,
  option_label TEXT NOT NULL,
  option_type TEXT NOT NULL CHECK (option_type IN ('select', 'number', 'text', 'range')),
  options JSONB,                     -- For select: [{"value": "prong", "label": "Prong Setting"}]
  default_value TEXT,
  min_value NUMERIC,
  max_value NUMERIC,
  unit TEXT,                         -- 'mm', 'inches', etc.
  is_required BOOLEAN DEFAULT false,
  sort_order INT DEFAULT 100,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(category, option_key)
);

-- N. cfg_reseller_overrides — Per-reseller curation
CREATE TABLE IF NOT EXISTS cfg_reseller_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id UUID NOT NULL REFERENCES resellers(id) ON DELETE CASCADE,
  override_type TEXT NOT NULL CHECK (override_type IN ('hide_stone_type', 'hide_metal', 'hide_karat', 'hide_finish', 'default_selection', 'hide_addon', 'show_price_detail')),
  target_key TEXT NOT NULL,
  target_value TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(reseller_id, override_type, target_key)
);
CREATE INDEX IF NOT EXISTS cfg_reseller_overrides_reseller_idx ON cfg_reseller_overrides (reseller_id, is_active);

-- O. cfg_order_configurations — Full config snapshot at order time
CREATE TABLE IF NOT EXISTS cfg_order_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_order_id UUID REFERENCES reseller_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,

  -- Metal selection
  metal_id UUID REFERENCES cfg_metals(id) ON DELETE SET NULL,
  metal_name TEXT,
  karat INT,
  finish_id UUID REFERENCES cfg_finishes(id) ON DELETE SET NULL,
  finish_name TEXT,

  -- Stone selection
  stone_type_id UUID REFERENCES cfg_stone_types(id) ON DELETE SET NULL,
  stone_type_name TEXT,
  shape_id UUID REFERENCES diamond_shapes(id) ON DELETE SET NULL,
  shape_name TEXT,
  size_id UUID REFERENCES diamond_sizes(id) ON DELETE SET NULL,
  size_label TEXT,
  carat_weight NUMERIC,
  clarity_grade TEXT,
  color_grade TEXT,

  -- Category-specific options
  category_options JSONB DEFAULT '{}'::jsonb,

  -- Engraving
  engraving_text TEXT,
  engraving_font TEXT,
  engraving_placement TEXT,

  -- Addons
  selected_addons JSONB DEFAULT '[]'::jsonb,

  -- Custom brief
  custom_brief_text TEXT,
  custom_brief_images TEXT[] DEFAULT '{}'::text[],
  custom_budget_range TEXT,
  custom_timeline TEXT,

  -- Price lock snapshot
  metal_cost_locked NUMERIC,
  stone_cost_locked NUMERIC,
  labour_cost_locked NUMERIC,
  addon_cost_locked NUMERIC,
  total_cost_locked NUMERIC,
  customer_price_locked NUMERIC,     -- The price the customer pays (with reseller markup)
  gold_rate_locked NUMERIC,
  gross_weight_locked NUMERIC,

  -- Manufacturing spec
  manufacturing_notes TEXT,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  modified_at TIMESTAMPTZ,
  modified_by TEXT,
  modification_reason TEXT
);
CREATE INDEX IF NOT EXISTS cfg_order_configurations_order_idx ON cfg_order_configurations (reseller_order_id);

-- P. cfg_substitution_suggestions
CREATE TABLE IF NOT EXISTS cfg_substitution_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('stone_type', 'metal', 'chain_type', 'finish')),
  trigger_value TEXT NOT NULL,
  suggest_type TEXT NOT NULL,
  suggest_value TEXT NOT NULL,
  message TEXT NOT NULL,
  savings_text TEXT,                 -- 'Save up to 40%'
  sort_order INT DEFAULT 100,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 2. Extend Existing Tables
-- ==========================================

-- Extend reseller_product_prices table
ALTER TABLE reseller_product_prices ADD COLUMN IF NOT EXISTS markup_type TEXT DEFAULT 'percent';
ALTER TABLE reseller_product_prices ADD COLUMN IF NOT EXISTS markup_value NUMERIC;
ALTER TABLE reseller_product_prices ADD COLUMN IF NOT EXISTS show_price_breakup BOOLEAN DEFAULT true;

-- Extend products table for configurator
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_configurable BOOLEAN DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS canonical_weight_g NUMERIC;
ALTER TABLE products ADD COLUMN IF NOT EXISTS dimension_constraints JSONB;
ALTER TABLE products ADD COLUMN IF NOT EXISTS configurator_options JSONB;
ALTER TABLE products ADD COLUMN IF NOT EXISTS variant_images JSONB DEFAULT '{}'::jsonb;
ALTER TABLE products ADD COLUMN IF NOT EXISTS setting_types TEXT[];

-- ==========================================
-- 3. Update Check Constraints for Platinum
-- ==========================================

-- Dynamic script to drop auto-generated or custom constraints restricting metal_type to 'gold','silver'
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT tc.constraint_name, tc.table_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name AND ccu.table_name = tc.table_name
        WHERE tc.constraint_type = 'CHECK'
          AND ccu.column_name = 'metal_type'
          AND tc.table_name IN ('products', 'orders', 'cad_requests', 'manufacturing_orders')
    LOOP
        EXECUTE 'ALTER TABLE ' || quote_ident(r.table_name) || ' DROP CONSTRAINT ' || quote_ident(r.constraint_name);
    END LOOP;
END $$;

-- Re-add the updated check constraints supporting 'platinum'
ALTER TABLE products ADD CONSTRAINT products_metal_type_check CHECK (metal_type IN ('gold', 'silver', 'platinum'));
ALTER TABLE orders ADD CONSTRAINT orders_metal_type_check CHECK (metal_type IN ('gold', 'silver', 'platinum'));
ALTER TABLE cad_requests ADD CONSTRAINT cad_requests_metal_type_check CHECK (metal_type IN ('gold', 'silver', 'platinum'));
ALTER TABLE manufacturing_orders ADD CONSTRAINT manufacturing_orders_metal_type_check CHECK (metal_type IN ('gold', 'silver', 'platinum'));

-- ==========================================
-- 4. Enable RLS and Configure Policies
-- ==========================================

-- Enable RLS
ALTER TABLE cfg_metals ENABLE ROW LEVEL SECURITY;
ALTER TABLE cfg_karats ENABLE ROW LEVEL SECURITY;
ALTER TABLE cfg_finishes ENABLE ROW LEVEL SECURITY;
ALTER TABLE cfg_finish_metal_compat ENABLE ROW LEVEL SECURITY;
ALTER TABLE cfg_stone_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE cfg_stone_clarity_grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE cfg_stone_color_grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE cfg_stone_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE cfg_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE cfg_labour_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE cfg_product_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE cfg_product_addon_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE cfg_category_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE cfg_reseller_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE cfg_order_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE cfg_substitution_suggestions ENABLE ROW LEVEL SECURITY;

-- service_role policies for ALL tables (Allows full write/read from server side with service role key)
CREATE POLICY service_role_all ON cfg_metals FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY service_role_all ON cfg_karats FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY service_role_all ON cfg_finishes FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY service_role_all ON cfg_finish_metal_compat FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY service_role_all ON cfg_stone_types FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY service_role_all ON cfg_stone_clarity_grades FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY service_role_all ON cfg_stone_color_grades FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY service_role_all ON cfg_stone_prices FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY service_role_all ON cfg_rules FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY service_role_all ON cfg_labour_rates FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY service_role_all ON cfg_product_addons FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY service_role_all ON cfg_product_addon_map FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY service_role_all ON cfg_category_options FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY service_role_all ON cfg_reseller_overrides FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY service_role_all ON cfg_order_configurations FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY service_role_all ON cfg_substitution_suggestions FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- auth_read policies (Allow select access to authenticated reseller/admin users)
CREATE POLICY auth_read ON cfg_metals FOR SELECT TO authenticated USING (true);
CREATE POLICY auth_read ON cfg_karats FOR SELECT TO authenticated USING (true);
CREATE POLICY auth_read ON cfg_finishes FOR SELECT TO authenticated USING (true);
CREATE POLICY auth_read ON cfg_finish_metal_compat FOR SELECT TO authenticated USING (true);
CREATE POLICY auth_read ON cfg_stone_types FOR SELECT TO authenticated USING (true);
CREATE POLICY auth_read ON cfg_stone_clarity_grades FOR SELECT TO authenticated USING (true);
CREATE POLICY auth_read ON cfg_stone_color_grades FOR SELECT TO authenticated USING (true);
CREATE POLICY auth_read ON cfg_stone_prices FOR SELECT TO authenticated USING (true);
CREATE POLICY auth_read ON cfg_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY auth_read ON cfg_labour_rates FOR SELECT TO authenticated USING (true);
CREATE POLICY auth_read ON cfg_product_addons FOR SELECT TO authenticated USING (true);
CREATE POLICY auth_read ON cfg_product_addon_map FOR SELECT TO authenticated USING (true);
CREATE POLICY auth_read ON cfg_category_options FOR SELECT TO authenticated USING (true);
CREATE POLICY auth_read ON cfg_reseller_overrides FOR SELECT TO authenticated USING (true);
CREATE POLICY auth_read ON cfg_order_configurations FOR SELECT TO authenticated USING (true);
CREATE POLICY auth_read ON cfg_substitution_suggestions FOR SELECT TO authenticated USING (true);

-- Public access policies for storefront
CREATE POLICY public_read_overrides ON cfg_reseller_overrides FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY public_read_metals ON cfg_metals FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY public_read_karats ON cfg_karats FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY public_read_finishes ON cfg_finishes FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY public_read_finish_compat ON cfg_finish_metal_compat FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY public_read_stone_types ON cfg_stone_types FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY public_read_clarity ON cfg_stone_clarity_grades FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY public_read_color ON cfg_stone_color_grades FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY public_read_stone_prices ON cfg_stone_prices FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY public_read_category_opts ON cfg_category_options FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY public_read_addons ON cfg_product_addons FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY public_read_addon_map ON cfg_product_addon_map FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY public_read_suggestions ON cfg_substitution_suggestions FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY public_read_rules ON cfg_rules FOR SELECT TO anon, authenticated USING (true);

-- Order configuration public insertions
CREATE POLICY public_insert ON cfg_order_configurations FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY public_read ON cfg_order_configurations FOR SELECT TO anon, authenticated USING (true);

-- ==========================================
-- 5. Add updated_at Triggers
-- ==========================================

CREATE TRIGGER cfg_rules_updated_at BEFORE UPDATE ON cfg_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER cfg_labour_rates_updated_at BEFORE UPDATE ON cfg_labour_rates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER cfg_stone_prices_updated_at BEFORE UPDATE ON cfg_stone_prices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
