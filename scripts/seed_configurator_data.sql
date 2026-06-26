-- Seed Data: Intelligent Jewelry Configurator & Master Data Engine
--
-- This script inserts the default seed data for all configurator components,
-- ensuring idempotency using subqueries and NOT EXISTS checks.
--
-- Run in: Supabase Dashboard → SQL Editor → New query (after running migration).

-- ==========================================
-- 1. Seed Metals
-- ==========================================

INSERT INTO cfg_metals (name, metal_type, color_hex, color_name, sort_order)
SELECT v.name, v.metal_type, v.color_hex, v.color_name, v.sort_order
FROM (VALUES
  ('Yellow Gold', 'gold', '#FFD700', 'Yellow', 10),
  ('White Gold', 'gold', '#E8E8E8', 'White', 20),
  ('Rose Gold', 'gold', '#E8B4B8', 'Rose', 30),
  ('Silver', 'silver', '#C0C0C0', 'Silver', 40),
  ('Platinum', 'platinum', '#E5E4E2', 'Platinum', 50)
) v(name, metal_type, color_hex, color_name, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM cfg_metals m WHERE lower(m.name) = lower(v.name));

-- ==========================================
-- 2. Seed Karats per Metal
-- ==========================================

INSERT INTO cfg_karats (metal_id, karat, karat_label, purity_factor, sort_order)
SELECT m.id, v.karat, v.karat_label, v.purity_factor, v.sort_order
FROM (VALUES
  ('Yellow Gold', 24, '24K', 1.0, 10),
  ('Yellow Gold', 22, '22K', 0.916, 20),
  ('Yellow Gold', 18, '18K', 0.75, 30),
  ('Yellow Gold', 14, '14K', 0.60, 40),
  ('Yellow Gold', 10, '10K', 0.42, 50),
  ('Yellow Gold', 9, '9K', 0.38, 60),

  ('White Gold', 24, '24K', 1.0, 10),
  ('White Gold', 22, '22K', 0.916, 20),
  ('White Gold', 18, '18K', 0.75, 30),
  ('White Gold', 14, '14K', 0.60, 40),
  ('White Gold', 10, '10K', 0.42, 50),
  ('White Gold', 9, '9K', 0.38, 60),

  ('Rose Gold', 24, '24K', 1.0, 10),
  ('Rose Gold', 22, '22K', 0.916, 20),
  ('Rose Gold', 18, '18K', 0.75, 30),
  ('Rose Gold', 14, '14K', 0.60, 40),
  ('Rose Gold', 10, '10K', 0.42, 50),
  ('Rose Gold', 9, '9K', 0.38, 60),

  ('Silver', 925, '925', 0.925, 10),

  ('Platinum', 950, '950', 0.95, 10)
) v(metal_name, karat, karat_label, purity_factor, sort_order)
JOIN cfg_metals m ON lower(m.name) = lower(v.metal_name)
WHERE NOT EXISTS (
  SELECT 1 FROM cfg_karats k
  WHERE k.metal_id = m.id AND k.karat = v.karat
);

-- ==========================================
-- 3. Seed Finishes
-- ==========================================

INSERT INTO cfg_finishes (name, labour_surcharge_percent, sort_order)
SELECT v.name, v.labour_surcharge_percent, v.sort_order
FROM (VALUES
  ('High Polish', 0.0, 10),
  ('Matte', 0.05, 20),
  ('Satin', 0.05, 30),
  ('Brushed', 0.08, 40),
  ('Hammered', 0.10, 50),
  ('Antique', 0.12, 60),
  ('Sandblasted', 0.08, 70)
) v(name, labour_surcharge_percent, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM cfg_finishes f WHERE lower(f.name) = lower(v.name));

-- ==========================================
-- 4. Seed Finish-Metal Compatibility
-- ==========================================

INSERT INTO cfg_finish_metal_compat (finish_id, metal_id)
SELECT f.id, m.id
FROM (VALUES
  ('High Polish', 'Yellow Gold'), ('High Polish', 'White Gold'), ('High Polish', 'Rose Gold'), ('High Polish', 'Silver'), ('High Polish', 'Platinum'),
  ('Matte', 'Yellow Gold'), ('Matte', 'White Gold'), ('Matte', 'Rose Gold'), ('Matte', 'Silver'), ('Matte', 'Platinum'),
  ('Satin', 'Yellow Gold'), ('Satin', 'White Gold'), ('Satin', 'Rose Gold'), ('Satin', 'Silver'), ('Satin', 'Platinum'),
  ('Brushed', 'Yellow Gold'), ('Brushed', 'White Gold'), ('Brushed', 'Rose Gold'), ('Brushed', 'Silver'), ('Brushed', 'Platinum'),
  ('Hammered', 'Yellow Gold'), ('Hammered', 'White Gold'), ('Hammered', 'Rose Gold'),
  ('Antique', 'Yellow Gold'), ('Antique', 'White Gold'), ('Antique', 'Rose Gold'),
  ('Sandblasted', 'Yellow Gold'), ('Sandblasted', 'White Gold'), ('Sandblasted', 'Rose Gold'), ('Sandblasted', 'Platinum')
) v(finish_name, metal_name)
JOIN cfg_finishes f ON lower(f.name) = lower(v.finish_name)
JOIN cfg_metals m ON lower(m.name) = lower(v.metal_name)
WHERE NOT EXISTS (
  SELECT 1 FROM cfg_finish_metal_compat c
  WHERE c.finish_id = f.id AND c.metal_id = m.id AND c.karat IS NULL
);

-- ==========================================
-- 5. Seed Stone Types
-- ==========================================

INSERT INTO cfg_stone_types (name, category, default_cert_body, sort_order)
SELECT v.name, v.category, v.default_cert_body, v.sort_order
FROM (VALUES
  ('Natural Diamond', 'diamond', 'GIA', 10),
  ('Lab-Grown Diamond', 'diamond', 'IGI', 20),
  ('Moissanite', 'moissanite', NULL, 30),
  ('Cubic Zirconia', 'cz', NULL, 40),
  ('Ruby', 'gemstone', NULL, 50),
  ('Sapphire', 'gemstone', NULL, 60),
  ('Emerald', 'gemstone', NULL, 70)
) v(name, category, default_cert_body, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM cfg_stone_types s WHERE lower(s.name) = lower(v.name));

-- ==========================================
-- 6. Seed Clarity Grades (mapped to quality buckets)
-- ==========================================

INSERT INTO cfg_stone_clarity_grades (code, label, bucket_id, sort_order)
SELECT v.code, v.label, b.id, v.sort_order
FROM (VALUES
  ('FL', 'Flawless', 'VVS', 10),
  ('IF', 'Internally Flawless', 'VVS', 20),
  ('VVS1', 'VVS1', 'VVS', 30),
  ('VVS2', 'VVS2', 'VVS', 40),
  ('VS1', 'VS1', 'VS', 50),
  ('VS2', 'VS2', 'VS', 60),
  ('SI1', 'SI1', 'SI', 70),
  ('SI2', 'SI2', 'SI', 80)
) v(code, label, bucket_label, sort_order)
LEFT JOIN diamond_quality_buckets b ON lower(b.label) = lower(v.bucket_label)
WHERE NOT EXISTS (SELECT 1 FROM cfg_stone_clarity_grades g WHERE lower(g.code) = lower(v.code));

-- ==========================================
-- 7. Seed Color Grades (mapped to color buckets)
-- ==========================================

INSERT INTO cfg_stone_color_grades (code, label, bucket_id, sort_order)
SELECT v.code, v.label, b.id, v.sort_order
FROM (VALUES
  ('D', 'D', 'DEF', 10),
  ('E', 'E', 'DEF', 20),
  ('F', 'F', 'DEF', 30),
  ('G', 'G', 'GH', 40),
  ('H', 'H', 'GH', 50),
  ('I', 'I', 'IJ', 60),
  ('J', 'J', 'IJ', 70)
) v(code, label, bucket_label, sort_order)
LEFT JOIN diamond_color_buckets b ON lower(b.label) = lower(v.bucket_label)
WHERE NOT EXISTS (SELECT 1 FROM cfg_stone_color_grades g WHERE lower(g.code) = lower(v.code));

-- ==========================================
-- 8. Seed Category Options
-- ==========================================

INSERT INTO cfg_category_options (category, option_key, option_label, option_type, options, default_value, min_value, max_value, unit, is_required, sort_order)
SELECT v.category, v.option_key, v.option_label, v.option_type, v.options::jsonb, v.default_value, v.min_value, v.max_value, v.unit, v.is_required, v.sort_order
FROM (VALUES
  ('ring', 'ring_size', 'Ring Size', 'select',
   '[{"value":"4","label":"4"},{"value":"4.5","label":"4.5"},{"value":"5","label":"5"},{"value":"5.5","label":"5.5"},{"value":"6","label":"6"},{"value":"6.5","label":"6.5"},{"value":"7","label":"7"},{"value":"7.5","label":"7.5"},{"value":"8","label":"8"},{"value":"8.5","label":"8.5"},{"value":"9","label":"9"},{"value":"9.5","label":"9.5"},{"value":"10","label":"10"},{"value":"10.5","label":"10.5"},{"value":"11","label":"11"},{"value":"11.5","label":"11.5"},{"value":"12","label":"12"},{"value":"12.5","label":"12.5"},{"value":"13","label":"13"},{"value":"13.5","label":"13.5"},{"value":"14","label":"14"},{"value":"14.5","label":"14.5"},{"value":"15","label":"15"},{"value":"15.5","label":"15.5"},{"value":"16","label":"16"},{"value":"16.5","label":"16.5"},{"value":"17","label":"17"},{"value":"17.5","label":"17.5"},{"value":"18","label":"18"},{"value":"18.5","label":"18.5"},{"value":"19","label":"19"},{"value":"19.5","label":"19.5"},{"value":"20","label":"20"},{"value":"20.5","label":"20.5"},{"value":"21","label":"21"},{"value":"21.5","label":"21.5"},{"value":"22","label":"22"},{"value":"22.5","label":"22.5"},{"value":"23","label":"23"},{"value":"23.5","label":"23.5"},{"value":"24","label":"24"},{"value":"24.5","label":"24.5"},{"value":"25","label":"25"},{"value":"25.5","label":"25.5"},{"value":"26","label":"26"},{"value":"26.5","label":"26.5"},{"value":"27","label":"27"},{"value":"27.5","label":"27.5"},{"value":"28","label":"28"}]',
   '7', NULL, NULL, NULL, true, 10),
  ('ring', 'band_width', 'Band Width', 'select',
   '[{"value":"1.5mm","label":"1.5 mm"},{"value":"2.0mm","label":"2.0 mm"},{"value":"2.5mm","label":"2.5 mm"},{"value":"3.0mm","label":"3.0 mm"},{"value":"4.0mm","label":"4.0 mm"},{"value":"5.0mm","label":"5.0 mm"}]',
   '2.0mm', NULL, NULL, NULL, false, 20),
  ('ring', 'band_profile', 'Band Profile', 'select',
   '[{"value":"Flat","label":"Flat"},{"value":"Comfort Fit","label":"Comfort Fit"},{"value":"D-Shape","label":"D-Shape"},{"value":"Court","label":"Court"}]',
   'Comfort Fit', NULL, NULL, NULL, false, 30),
  ('ring', 'setting_type', 'Setting Type', 'select',
   '[{"value":"Prong","label":"Prong"},{"value":"Bezel","label":"Bezel"},{"value":"Channel","label":"Channel"},{"value":"Pave","label":"Pave"},{"value":"Tension","label":"Tension"},{"value":"Cathedral","label":"Cathedral"},{"value":"Halo","label":"Halo"}]',
   'Prong', NULL, NULL, NULL, false, 40),

  ('necklace', 'chain_length', 'Chain Length', 'select',
   '[{"value":"14\"","label":"14 inches"},{"value":"16\"","label":"16 inches"},{"value":"18\"","label":"18 inches"},{"value":"20\"","label":"20 inches"},{"value":"22\"","label":"22 inches"},{"value":"24\"","label":"24 inches"},{"value":"26\"","label":"26 inches"},{"value":"28\"","label":"28 inches"},{"value":"30\"","label":"30 inches"}]',
   '18\"', NULL, NULL, NULL, true, 10),
  ('necklace', 'chain_type', 'Chain Type', 'select',
   '[{"value":"Cable","label":"Cable"},{"value":"Box","label":"Box"},{"value":"Rope","label":"Rope"},{"value":"Singapore","label":"Singapore"},{"value":"Curb","label":"Curb"},{"value":"Figaro","label":"Figaro"},{"value":"Snake","label":"Snake"},{"value":"Wheat","label":"Wheat"}]',
   'Cable', NULL, NULL, NULL, false, 20),
  ('necklace', 'chain_gauge', 'Chain Gauge', 'select',
   '[{"value":"Light","label":"Light"},{"value":"Medium","label":"Medium"},{"value":"Heavy","label":"Heavy"}]',
   'Medium', NULL, NULL, NULL, false, 30),
  ('necklace', 'clasp_type', 'Clasp Type', 'select',
   '[{"value":"Spring Ring","label":"Spring Ring"},{"value":"Lobster Claw","label":"Lobster Claw"},{"value":"Toggle","label":"Toggle"},{"value":"Box Clasp","label":"Box Clasp"},{"value":"Magnetic","label":"Magnetic"}]',
   'Lobster Claw', NULL, NULL, NULL, false, 40),

  ('earring', 'earring_back', 'Earring Back', 'select',
   '[{"value":"Push Back","label":"Push Back"},{"value":"Screw Back","label":"Screw Back"},{"value":"Lever Back","label":"Lever Back"},{"value":"Hinge","label":"Hinge"},{"value":"Hook","label":"Hook"}]',
   'Push Back', NULL, NULL, NULL, true, 10),
  ('earring', 'drop_length', 'Drop Length', 'number',
   NULL,
   '0', 0, 100, 'mm', false, 20),
  ('earring', 'hoop_diameter', 'Hoop Diameter', 'number',
   NULL,
   '15', 8, 80, 'mm', false, 30),
  ('earring', 'ordering_type', 'Ordering Type', 'select',
   '[{"value":"Pair","label":"Pair"},{"value":"Single","label":"Single"}]',
   'Pair', NULL, NULL, NULL, false, 40),

  ('bracelet', 'wrist_size', 'Wrist Size', 'select',
   '[{"value":"6\"","label":"6.0 inches"},{"value":"6.5\"","label":"6.5 inches"},{"value":"7\"","label":"7.0 inches"},{"value":"7.5\"","label":"7.5 inches"},{"value":"8\"","label":"8.0 inches"},{"value":"8.5\"","label":"8.5 inches"},{"value":"9\"","label":"9.0 inches"}]',
   '7\"', NULL, NULL, NULL, true, 10),
  ('bracelet', 'bracelet_type', 'Bracelet Type', 'select',
   '[{"value":"Chain","label":"Chain"},{"value":"Bangle","label":"Bangle"},{"value":"Cuff","label":"Cuff"},{"value":"Tennis","label":"Tennis"},{"value":"Charm","label":"Charm"}]',
   'Chain', NULL, NULL, NULL, false, 20),
  ('bracelet', 'clasp_type', 'Clasp Type', 'select',
   '[{"value":"Lobster Claw","label":"Lobster Claw"},{"value":"Toggle","label":"Toggle"},{"value":"Box Clasp","label":"Box Clasp"},{"value":"Magnetic","label":"Magnetic"},{"value":"Fold-over","label":"Fold-over"}]',
   'Lobster Claw', NULL, NULL, NULL, false, 30)
) v(category, option_key, option_label, option_type, options, default_value, min_value, max_value, unit, is_required, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM cfg_category_options o
  WHERE o.category = v.category AND o.option_key = v.option_key
);

-- ==========================================
-- 9. Seed Default Add-ons
-- ==========================================

INSERT INTO cfg_product_addons (name, addon_type, pricing_type, price, description, max_characters, font_options, sort_order)
SELECT v.name, v.addon_type, v.pricing_type, v.price, v.description, v.max_characters, v.font_options::jsonb, v.sort_order
FROM (VALUES
  ('Text Engraving', 'engraving', 'per_character', 50.0, 'Personalize your jewelry with a custom engraving inside the band.', 30,
   '[{"value":"Classic Serif","label":"Classic Serif"},{"value":"Modern Sans","label":"Modern Sans"},{"value":"Script","label":"Script"},{"value":"Block","label":"Block"}]', 10),
  ('IGI Certification', 'certification', 'fixed', 1500.0, 'Official diamond grading report by International Gemological Institute.', NULL, NULL, 20),
  ('GIA Certification', 'certification', 'fixed', 5000.0, 'Official diamond grading report by Gemological Institute of America.', NULL, NULL, 30),
  ('Premium Gift Packaging', 'packaging', 'fixed', 500.0, 'Includes a premium leatherette box, LED light display, and personalized message card.', NULL, NULL, 40),
  ('Express Manufacturing', 'shipping', 'fixed', 2000.0, 'Cuts standard production time by 50% (ships within 7 business days).', NULL, NULL, 50),
  ('Shipping Insurance', 'insurance', 'percent', 0.02, 'Full transit cover against loss, damage, or theft during courier transit.', NULL, NULL, 60)
) v(name, addon_type, pricing_type, price, description, max_characters, font_options, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM cfg_product_addons a WHERE lower(a.name) = lower(v.name));

-- ==========================================
-- 10. Seed Default Substitution Suggestions
-- ==========================================

INSERT INTO cfg_substitution_suggestions (trigger_type, trigger_value, suggest_type, suggest_value, message, savings_text, sort_order)
SELECT v.trigger_type, v.trigger_value, v.suggest_type, v.suggest_value, v.message, v.savings_text, v.sort_order
FROM (VALUES
  ('stone_type', 'Natural Diamond', 'stone_type', 'Lab-Grown Diamond', 'Same optical, physical, and chemical properties at a fraction of the cost.', 'Save up to 40%', 10),
  ('metal', 'Silver', 'metal', 'White Gold', 'Upgrade to 14K White Gold for lasting premium beauty, durability, and daily wear resistance.', NULL, 20),
  ('chain_type', 'Cable', 'chain_type', 'Rope', 'Upgrade to a Rope chain for enhanced strength and a richer premium textured look.', NULL, 30)
) v(trigger_type, trigger_value, suggest_type, suggest_value, message, savings_text, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM cfg_substitution_suggestions s
  WHERE s.trigger_type = v.trigger_type AND lower(s.trigger_value) = lower(v.trigger_value)
);
