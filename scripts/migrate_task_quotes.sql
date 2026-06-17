-- Task #115 — Custom Quote Generator
--
-- Provisions tables for quotes, quote_items, and quote_share_links.
--
-- Run this in: Supabase Dashboard → SQL Editor → New query
-- Idempotent — safe to re-run.
--

-- ─────────────────────────────────────────────────────────────────────
-- 1. quotes table
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quotes (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_number            text UNIQUE NOT NULL,
  partner_id              uuid REFERENCES partners(id) ON DELETE SET NULL,
  walk_in_name            text,
  walk_in_phone           text,
  walk_in_city            text,
  reference_no            text,
  prepared_by             uuid REFERENCES app_users(id) ON DELETE SET NULL,
  quote_date              date NOT NULL DEFAULT CURRENT_DATE,
  valid_until             date NOT NULL,
  gst_treatment           text NOT NULL DEFAULT 'exclusive' CHECK (gst_treatment IN ('exclusive', 'inclusive', 'none')),
  gst_rate_pct            numeric NOT NULL DEFAULT 3.0,
  margin_pct              numeric NOT NULL DEFAULT 28.0,
  show_breakup            boolean NOT NULL DEFAULT true,
  show_24kt_column        boolean NOT NULL DEFAULT true,
  cover_note              text,
  terms_text              text,
  subtotal                numeric NOT NULL DEFAULT 0.0,
  gst_amount              numeric NOT NULL DEFAULT 0.0,
  grand_total             numeric NOT NULL DEFAULT 0.0,
  status                  text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'viewed', 'accepted', 'expired', 'converted_to_order')),
  share_token             text,
  shared_at               timestamptz,
  viewed_at               timestamptz,
  accepted_at             timestamptz,
  customer_response_note  text,
  converted_order_id      uuid REFERENCES orders(id) ON DELETE SET NULL,
  parent_quote_id         uuid REFERENCES quotes(id) ON DELETE SET NULL,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quotes_partner_id ON quotes(partner_id) WHERE partner_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_quotes_quote_number ON quotes(quote_number);
CREATE INDEX IF NOT EXISTS idx_quotes_status ON quotes(status);
CREATE INDEX IF NOT EXISTS idx_quotes_share_token ON quotes(share_token) WHERE share_token IS NOT NULL;

ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS quotes_no_anon ON quotes;
CREATE POLICY quotes_no_anon ON quotes
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- ─────────────────────────────────────────────────────────────────────
-- 2. quote_items table
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quote_items (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id              uuid NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  position              integer NOT NULL,
  product_id            uuid REFERENCES products(id) ON DELETE SET NULL,
  name                  text NOT NULL,
  category              text,
  ring_size             text,
  quantity              integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  karat                 text NOT NULL,
  gross_gold_weight_g   numeric NOT NULL DEFAULT 0.0,
  net_24kt_weight_g     numeric NOT NULL DEFAULT 0.0,
  gold_rate_24k         numeric NOT NULL DEFAULT 0.0,
  labour_source         text NOT NULL DEFAULT 'partner' CHECK (labour_source IN ('partner', 'manual')),
  labour_partner_id     uuid REFERENCES manufacturing_partners(id) ON DELETE SET NULL, -- karigar
  labour_rate_per_g     numeric NOT NULL DEFAULT 0.0,
  labour_total          numeric NOT NULL DEFAULT 0.0,
  diamonds              jsonb NOT NULL DEFAULT '[]'::jsonb, -- Array of shapes, sizes, etc.
  making_charges        numeric NOT NULL DEFAULT 0.0,
  hallmarking           numeric NOT NULL DEFAULT 0.0,
  other_charges         numeric NOT NULL DEFAULT 0.0,
  other_charges_label   text,
  line_cogs             numeric NOT NULL DEFAULT 0.0,
  line_trade            numeric NOT NULL DEFAULT 0.0,
  line_total            numeric NOT NULL DEFAULT 0.0,
  reference_images      text[] NOT NULL DEFAULT '{}'::text[],
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quote_items_quote_id ON quote_items(quote_id);

ALTER TABLE quote_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS quote_items_no_anon ON quote_items;
CREATE POLICY quote_items_no_anon ON quote_items
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- ─────────────────────────────────────────────────────────────────────
-- 3. quote_share_links table
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quote_share_links (
  token                 text PRIMARY KEY,
  quote_id              uuid NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  expires_at            timestamptz NOT NULL,
  revoked_at            timestamptz,
  opened_at             timestamptz,
  opened_count          integer NOT NULL DEFAULT 0,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quote_share_links_quote_id ON quote_share_links(quote_id);
CREATE INDEX IF NOT EXISTS idx_quote_share_links_token ON quote_share_links(token);

ALTER TABLE quote_share_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS quote_share_links_no_anon ON quote_share_links;
CREATE POLICY quote_share_links_no_anon ON quote_share_links
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
