-- Migration: Dynamic Category-Driven Product Attributes

-- 1. Create product_categories table
CREATE TABLE IF NOT EXISTS product_categories (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT UNIQUE NOT NULL,
  slug            TEXT UNIQUE NOT NULL,
  attribute_schema JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  sort_order      INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Add attributes JSONB column to products table if not present
ALTER TABLE products ADD COLUMN IF NOT EXISTS attributes JSONB DEFAULT '{}'::jsonb;

-- 3. Seed default categories with schemas
INSERT INTO product_categories (name, slug, sort_order, attribute_schema) VALUES
(
  'Ring',
  'ring',
  1,
  '[
    {"key": "ring_size", "label": "Ring Size", "type": "number", "required": true, "unit": "mm", "min": 1, "max": 30},
    {"key": "band_width", "label": "Band Width", "type": "number", "required": false, "unit": "mm", "min": 0.5, "max": 20},
    {"key": "engraving", "label": "Engraving Text", "type": "text", "required": false, "max_length": 100, "placeholder": "Enter custom engraving"}
  ]'::jsonb
),
(
  'Necklace',
  'necklace',
  2,
  '[
    {"key": "chain_length", "label": "Chain Length", "type": "number", "required": true, "unit": "inches", "min": 10, "max": 40},
    {"key": "clasp_type", "label": "Clasp Type", "type": "select", "required": false, "options": ["Lobster", "Spring Ring", "Box", "Hook"]},
    {"key": "pendant_compatible", "label": "Pendant Compatible", "type": "boolean", "required": false}
  ]'::jsonb
),
(
  'Earring',
  'earring',
  3,
  '[
    {"key": "earring_type", "label": "Earring Type", "type": "select", "required": true, "options": ["Stud", "Hoop", "Drop", "Dangle"]},
    {"key": "back_type", "label": "Back Type", "type": "select", "required": false, "options": ["Push Back", "Screw Back", "Latch Back"]},
    {"key": "weight_per_pair", "label": "Weight per Pair", "type": "number", "required": true, "unit": "grams", "min": 0.1, "max": 50}
  ]'::jsonb
),
(
  'Bracelet',
  'bracelet',
  4,
  '[
    {"key": "wrist_size", "label": "Wrist Size", "type": "number", "required": true, "unit": "inches", "min": 3, "max": 12},
    {"key": "chain_type", "label": "Chain Type", "type": "select", "required": false, "options": ["Cuban", "Rope", "Snake", "Box"]}
  ]'::jsonb
)
ON CONFLICT (name) DO UPDATE SET
  attribute_schema = EXCLUDED.attribute_schema,
  sort_order = EXCLUDED.sort_order;

-- 4. Enable Row Level Security (RLS) and grant authenticated users full rights
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can do everything on product_categories" ON product_categories;
CREATE POLICY "Authenticated users can do everything on product_categories" ON product_categories
  FOR ALL USING (auth.role() = 'authenticated');
