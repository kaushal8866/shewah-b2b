-- Migration: Add homepage sections JSONB to reseller_themes table
ALTER TABLE reseller_themes ADD COLUMN IF NOT EXISTS sections JSONB DEFAULT '[]'::jsonb;

-- Comment for documentation
COMMENT ON COLUMN reseller_themes.sections IS 'JSON array of customizable, reorderable homepage section blocks and their attributes';
