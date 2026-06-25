-- Migration: Invite-Only White-Label Reseller Network

-- 1. Create resellers table
CREATE TABLE IF NOT EXISTS resellers (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     UUID, -- references app_users(id), will add constraint after table creation
  reseller_code               TEXT UNIQUE NOT NULL,
  store_name                  TEXT NOT NULL,
  owner_name                  TEXT NOT NULL,
  phone                       TEXT NOT NULL,
  email                       TEXT,
  city                        TEXT NOT NULL,
  address                     TEXT NOT NULL,
  bank_name                   TEXT,
  account_number              TEXT,
  ifsc_code                   TEXT,
  upi_id                      TEXT,
  kyc_document_type           TEXT,
  kyc_document_number         TEXT,
  kyc_document_url            TEXT,
  profile_photo_url           TEXT,
  status                      TEXT NOT NULL DEFAULT 'invited', -- 'invited', 'onboarding', 'active', 'suspended'
  invited_by                  UUID,
  approved_by                 UUID,
  credit_limit_paise          BIGINT NOT NULL DEFAULT 0,
  default_markup_percent      NUMERIC NOT NULL DEFAULT 15.00,
  performance_tier            TEXT NOT NULL DEFAULT 'bronze', -- 'bronze', 'silver', 'gold', 'platinum'
  lifetime_sales_paise        BIGINT NOT NULL DEFAULT 0,
  outstanding_balance_paise   BIGINT NOT NULL DEFAULT 0,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Create reseller_invitations table
CREATE TABLE IF NOT EXISTS reseller_invitations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invitation_code     TEXT UNIQUE NOT NULL,
  recipient_name      TEXT NOT NULL,
  recipient_phone     TEXT NOT NULL,
  recipient_email     TEXT,
  personal_message    TEXT,
  expiry_date         TIMESTAMPTZ NOT NULL,
  status              TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'accepted', 'expired', 'revoked'
  created_by          UUID,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Create reseller_product_prices table
CREATE TABLE IF NOT EXISTS reseller_product_prices (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id          UUID UNIQUE NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  floor_price_paise   BIGINT NOT NULL, -- minimum price reseller must pay Shewah (in paise)
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Create reseller_orders table
CREATE TABLE IF NOT EXISTS reseller_orders (
  id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number                    TEXT UNIQUE NOT NULL,
  reseller_id                     UUID NOT NULL REFERENCES resellers(id) ON DELETE RESTRICT,
  product_id                      UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity                        INTEGER NOT NULL DEFAULT 1,
  ring_size                       TEXT,
  custom_attributes               JSONB DEFAULT '{}'::jsonb, -- dynamic attributes for this order
  customer_selling_price_paise    BIGINT NOT NULL, -- selling price to consumer
  reseller_cost_paise             BIGINT NOT NULL, -- locked floor price at time of order
  reseller_earnings_paise         BIGINT NOT NULL, -- difference
  payment_status                  TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'paid', 'partially_paid'
  shipping_name                   TEXT NOT NULL,
  shipping_phone                  TEXT NOT NULL,
  shipping_address                TEXT NOT NULL,
  status                          TEXT NOT NULL DEFAULT 'payment_pending', -- 'payment_pending', 'brief_received', 'cad_in_progress', 'cad_sent', 'design_approved', 'production', 'qc', 'dispatched', 'delivered', 'cancelled'
  payment_deadline                TIMESTAMPTZ NOT NULL,
  created_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Create reseller_sample_ledger table
CREATE TABLE IF NOT EXISTS reseller_sample_ledger (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id             UUID NOT NULL REFERENCES resellers(id) ON DELETE RESTRICT,
  product_id              UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  sample_type             TEXT NOT NULL, -- 'credit', 'deposit'
  sample_value_paise      BIGINT NOT NULL,
  deposit_amount_paise    BIGINT DEFAULT 0,
  deposit_status          TEXT, -- 'pending_proof', 'confirmed', 'refunded', 'forfeited'
  issue_date              TIMESTAMPTZ,
  return_due_date         TIMESTAMPTZ NOT NULL,
  status                  TEXT NOT NULL DEFAULT 'requested', -- 'requested', 'approved', 'issued', 'returned', 'lost', 'sold', 'rejected'
  notes                   TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Create reseller_payments table
CREATE TABLE IF NOT EXISTS reseller_payments (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id             UUID NOT NULL REFERENCES resellers(id) ON DELETE RESTRICT,
  amount_paise            BIGINT NOT NULL,
  payment_method          TEXT NOT NULL, -- 'upi', 'bank_transfer', 'cash', etc.
  transaction_reference   TEXT,
  proof_screenshot_url    TEXT,
  payment_type            TEXT NOT NULL, -- 'order_payment', 'sample_deposit', 'outstanding_clear'
  linked_order_id         UUID REFERENCES reseller_orders(id) ON DELETE SET NULL,
  linked_sample_id        UUID REFERENCES reseller_sample_ledger(id) ON DELETE SET NULL,
  status                  TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'confirmed', 'rejected'
  confirmed_by            UUID,
  confirmed_at            TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Create reseller_customers table
CREATE TABLE IF NOT EXISTS reseller_customers (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id             UUID NOT NULL REFERENCES resellers(id) ON DELETE RESTRICT,
  name                    TEXT NOT NULL,
  phone                   TEXT NOT NULL,
  email                   TEXT,
  first_order_date        TIMESTAMPTZ,
  last_order_date         TIMESTAMPTZ,
  total_orders            INTEGER NOT NULL DEFAULT 0,
  total_value_paise       BIGINT NOT NULL DEFAULT 0,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(reseller_id, phone)
);

-- 8. Create reseller_share_links table
CREATE TABLE IF NOT EXISTS reseller_share_links (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id             UUID NOT NULL REFERENCES resellers(id) ON DELETE RESTRICT,
  link_token              TEXT UNIQUE NOT NULL, -- 32 hex chars
  link_name               TEXT NOT NULL, -- e.g. 'My Collection'
  markup_percent          NUMERIC NOT NULL DEFAULT 15.00,
  scope                   TEXT NOT NULL DEFAULT 'full', -- 'full', 'curated'
  curated_product_ids     UUID[], -- array of product UUIDs
  is_active               BOOLEAN NOT NULL DEFAULT true,
  click_count             INTEGER NOT NULL DEFAULT 0,
  enquiry_count           INTEGER NOT NULL DEFAULT 0,
  order_count             INTEGER NOT NULL DEFAULT 0,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. Create reseller_themes table
CREATE TABLE IF NOT EXISTS reseller_themes (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id             UUID UNIQUE NOT NULL REFERENCES resellers(id) ON DELETE CASCADE,
  store_name              TEXT NOT NULL,
  logo_url                TEXT,
  favicon_url             TEXT,
  colors                  JSONB NOT NULL DEFAULT '{"primary": "#1E3A5F", "secondary": "#C9A86A", "background": "#FFFFFF", "surface": "#F5F5F5", "text": "#1C1917", "borders": "#E7E5E4", "accent": "#F59E0B"}'::jsonb,
  typography              JSONB NOT NULL DEFAULT '{"heading": "Inter", "body": "Inter", "scale": "medium"}'::jsonb,
  buttons                 JSONB NOT NULL DEFAULT '{"shape": "rounded-xl", "style": "fill", "hover": "darken", "shadow": "sm"}'::jsonb,
  layout                  JSONB NOT NULL DEFAULT '{"density": "comfortable", "spacing": "medium"}'::jsonb,
  is_active               BOOLEAN NOT NULL DEFAULT true,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. Alter app_users to link to resellers
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS reseller_id UUID REFERENCES resellers(id) ON DELETE SET NULL;

-- Update role constraint on app_users to allow 'reseller'
ALTER TABLE app_users DROP CONSTRAINT IF EXISTS app_users_role_check;
ALTER TABLE app_users ADD CONSTRAINT app_users_role_check CHECK (role IN ('master', 'sub', 'manufacturer', 'retailer', 'reseller'));

-- 11. Add constraints on resellers table pointing back to app_users
ALTER TABLE resellers DROP CONSTRAINT IF EXISTS resellers_user_id_fkey;
ALTER TABLE resellers ADD CONSTRAINT resellers_user_id_fkey FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE SET NULL;

ALTER TABLE resellers DROP CONSTRAINT IF EXISTS resellers_invited_by_fkey;
ALTER TABLE resellers ADD CONSTRAINT resellers_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES app_users(id) ON DELETE SET NULL;

ALTER TABLE resellers DROP CONSTRAINT IF EXISTS resellers_approved_by_fkey;
ALTER TABLE resellers ADD CONSTRAINT resellers_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES app_users(id) ON DELETE SET NULL;

-- 12. Add constraints on other tables referencing app_users
ALTER TABLE reseller_invitations DROP CONSTRAINT IF EXISTS reseller_invitations_created_by_fkey;
ALTER TABLE reseller_invitations ADD CONSTRAINT reseller_invitations_created_by_fkey FOREIGN KEY (created_by) REFERENCES app_users(id) ON DELETE SET NULL;

ALTER TABLE reseller_payments DROP CONSTRAINT IF EXISTS reseller_payments_confirmed_by_fkey;
ALTER TABLE reseller_payments ADD CONSTRAINT reseller_payments_confirmed_by_fkey FOREIGN KEY (confirmed_by) REFERENCES app_users(id) ON DELETE SET NULL;

-- 13. Enable Row Level Security (RLS) on all new tables
ALTER TABLE resellers ENABLE ROW LEVEL SECURITY;
ALTER TABLE reseller_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE reseller_product_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE reseller_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE reseller_sample_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE reseller_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE reseller_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE reseller_share_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE reseller_themes ENABLE ROW LEVEL SECURITY;

-- 14. Create RLS Policies granting authenticated users full rights
-- (And public read rights for share links/themes to load the public storefronts)

DROP POLICY IF EXISTS "Authenticated users can do everything on resellers" ON resellers;
CREATE POLICY "Authenticated users can do everything on resellers" ON resellers
  FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can do everything on reseller_invitations" ON reseller_invitations;
CREATE POLICY "Authenticated users can do everything on reseller_invitations" ON reseller_invitations
  FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can do everything on reseller_product_prices" ON reseller_product_prices;
CREATE POLICY "Authenticated users can do everything on reseller_product_prices" ON reseller_product_prices
  FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can do everything on reseller_orders" ON reseller_orders;
CREATE POLICY "Authenticated users can do everything on reseller_orders" ON reseller_orders
  FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can do everything on reseller_sample_ledger" ON reseller_sample_ledger;
CREATE POLICY "Authenticated users can do everything on reseller_sample_ledger" ON reseller_sample_ledger
  FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can do everything on reseller_payments" ON reseller_payments;
CREATE POLICY "Authenticated users can do everything on reseller_payments" ON reseller_payments
  FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can do everything on reseller_customers" ON reseller_customers;
CREATE POLICY "Authenticated users can do everything on reseller_customers" ON reseller_customers
  FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can do everything on reseller_share_links" ON reseller_share_links;
CREATE POLICY "Authenticated users can do everything on reseller_share_links" ON reseller_share_links
  FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can do everything on reseller_themes" ON reseller_themes;
CREATE POLICY "Authenticated users can do everything on reseller_themes" ON reseller_themes
  FOR ALL USING (auth.role() = 'authenticated');

-- Public Select Policies for Storefront
DROP POLICY IF EXISTS "Public read on reseller_themes" ON reseller_themes;
CREATE POLICY "Public read on reseller_themes" ON reseller_themes
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read on reseller_share_links" ON reseller_share_links;
CREATE POLICY "Public read on reseller_share_links" ON reseller_share_links
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read on resellers" ON resellers;
CREATE POLICY "Public read on resellers" ON resellers
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read on reseller_product_prices" ON reseller_product_prices;
CREATE POLICY "Public read on reseller_product_prices" ON reseller_product_prices
  FOR SELECT USING (true);
