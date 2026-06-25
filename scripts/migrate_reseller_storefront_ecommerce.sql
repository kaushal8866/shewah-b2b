-- Migration: Full-Stack White-Label Reseller E-Commerce Storefront & Communication Hub

-- 1. Create reseller_storefront_customers
CREATE TABLE IF NOT EXISTS reseller_storefront_customers (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id         UUID NOT NULL REFERENCES resellers(id) ON DELETE CASCADE,
  phone               TEXT NOT NULL,
  name                TEXT NOT NULL,
  email               TEXT,
  saved_addresses     JSONB DEFAULT '[]'::jsonb, -- array of addresses
  wishlist_product_ids UUID[] DEFAULT '{}'::uuid[],
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(reseller_id, phone)
);

-- 2. Create reseller_storefront_otps (for phone OTP validation)
CREATE TABLE IF NOT EXISTS reseller_storefront_otps (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id         UUID NOT NULL REFERENCES resellers(id) ON DELETE CASCADE,
  phone               TEXT NOT NULL,
  otp_code            TEXT NOT NULL,
  expires_at          TIMESTAMPTZ NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Create reseller_storefront_carts (for cross-device cart synchronization)
CREATE TABLE IF NOT EXISTS reseller_storefront_carts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id         UUID UNIQUE NOT NULL REFERENCES reseller_storefront_customers(id) ON DELETE CASCADE,
  items               JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Alter reseller_orders to associate with customer and custom specifications
ALTER TABLE reseller_orders ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES reseller_storefront_customers(id) ON DELETE SET NULL;
ALTER TABLE reseller_orders ADD COLUMN IF NOT EXISTS customer_notes TEXT;
ALTER TABLE reseller_orders ADD COLUMN IF NOT EXISTS configuration_summary JSONB;
ALTER TABLE reseller_orders ADD COLUMN IF NOT EXISTS customer_payment_status TEXT DEFAULT 'pending';

-- 5. Create reseller_messages (unified communication hub)
CREATE TABLE IF NOT EXISTS reseller_messages (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id             UUID NOT NULL REFERENCES resellers(id) ON DELETE CASCADE,
  sender_role             TEXT NOT NULL, -- 'reseller', 'admin', 'system'
  sender_id               UUID REFERENCES app_users(id) ON DELETE SET NULL,
  message_type            TEXT NOT NULL DEFAULT 'text', -- 'text', 'system', 'image', 'file'
  body                    TEXT NOT NULL,
  file_url                TEXT,
  thread_type             TEXT NOT NULL, -- 'general', 'order', 'sample'
  linked_order_id         UUID REFERENCES reseller_orders(id) ON DELETE SET NULL,
  linked_sample_id        UUID REFERENCES reseller_sample_ledger(id) ON DELETE SET NULL,
  is_read_by_reseller     BOOLEAN NOT NULL DEFAULT false,
  is_read_by_admin        BOOLEAN NOT NULL DEFAULT false,
  assigned_admin_id       UUID REFERENCES app_users(id) ON DELETE SET NULL,
  internal_notes          TEXT, -- visible only to admins
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Create reseller_storefront_reviews
CREATE TABLE IF NOT EXISTS reseller_storefront_reviews (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id             UUID NOT NULL REFERENCES resellers(id) ON DELETE CASCADE,
  customer_id             UUID REFERENCES reseller_storefront_customers(id) ON DELETE SET NULL,
  product_id              UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  rating                  INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text             TEXT,
  photo_urls              TEXT[] DEFAULT '{}'::text[],
  reseller_reply          TEXT,
  status                  TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Create reseller_storefront_coupons (discount recovery codes)
CREATE TABLE IF NOT EXISTS reseller_storefront_coupons (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id             UUID NOT NULL REFERENCES resellers(id) ON DELETE CASCADE,
  code                    TEXT NOT NULL,
  discount_type           TEXT NOT NULL, -- 'percent', 'amount'
  discount_value          NUMERIC NOT NULL,
  is_active               BOOLEAN NOT NULL DEFAULT true,
  expires_at              TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(reseller_id, code)
);

-- 8. Create reseller_storefront_abandoned_carts
CREATE TABLE IF NOT EXISTS reseller_storefront_abandoned_carts (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id             UUID NOT NULL REFERENCES resellers(id) ON DELETE CASCADE,
  customer_id             UUID REFERENCES reseller_storefront_customers(id) ON DELETE SET NULL,
  guest_phone             TEXT,
  guest_name              TEXT,
  items                   JSONB NOT NULL DEFAULT '[]'::jsonb,
  recovery_attempts       INTEGER NOT NULL DEFAULT 0,
  last_attempt_at         TIMESTAMPTZ,
  status                  TEXT NOT NULL DEFAULT 'active', -- 'active', 'recovered', 'abandoned'
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. Create reseller_notifications
CREATE TABLE IF NOT EXISTS reseller_notifications (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id             UUID NOT NULL REFERENCES resellers(id) ON DELETE CASCADE,
  title                   TEXT NOT NULL,
  body                    TEXT NOT NULL,
  type                    TEXT NOT NULL, -- 'order', 'message', 'sample', 'payment'
  link                    TEXT,
  is_read                 BOOLEAN NOT NULL DEFAULT false,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE reseller_storefront_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE reseller_storefront_otps ENABLE ROW LEVEL SECURITY;
ALTER TABLE reseller_storefront_carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE reseller_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE reseller_storefront_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE reseller_storefront_coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE reseller_storefront_abandoned_carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE reseller_notifications ENABLE ROW LEVEL SECURITY;

-- 10. RLS Policies
-- Allow authenticated app users full access
DROP POLICY IF EXISTS "Authenticated users full access on reseller_storefront_customers" ON reseller_storefront_customers;
CREATE POLICY "Authenticated users full access on reseller_storefront_customers" ON reseller_storefront_customers
  FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users full access on reseller_storefront_otps" ON reseller_storefront_otps;
CREATE POLICY "Authenticated users full access on reseller_storefront_otps" ON reseller_storefront_otps
  FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users full access on reseller_storefront_carts" ON reseller_storefront_carts;
CREATE POLICY "Authenticated users full access on reseller_storefront_carts" ON reseller_storefront_carts
  FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users full access on reseller_messages" ON reseller_messages;
CREATE POLICY "Authenticated users full access on reseller_messages" ON reseller_messages
  FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users full access on reseller_storefront_reviews" ON reseller_storefront_reviews;
CREATE POLICY "Authenticated users full access on reseller_storefront_reviews" ON reseller_storefront_reviews
  FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users full access on reseller_storefront_coupons" ON reseller_storefront_coupons;
CREATE POLICY "Authenticated users full access on reseller_storefront_coupons" ON reseller_storefront_coupons
  FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users full access on reseller_storefront_abandoned_carts" ON reseller_storefront_abandoned_carts;
CREATE POLICY "Authenticated users full access on reseller_storefront_abandoned_carts" ON reseller_storefront_abandoned_carts
  FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users full access on reseller_notifications" ON reseller_notifications;
CREATE POLICY "Authenticated users full access on reseller_notifications" ON reseller_notifications
  FOR ALL USING (auth.role() = 'authenticated');

-- Public Select Policies / Insert Policies for unauthenticated storefront operations
DROP POLICY IF EXISTS "Public select/insert on reseller_storefront_customers" ON reseller_storefront_customers;
CREATE POLICY "Public select/insert on reseller_storefront_customers" ON reseller_storefront_customers
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public select/insert/delete on reseller_storefront_otps" ON reseller_storefront_otps;
CREATE POLICY "Public select/insert/delete on reseller_storefront_otps" ON reseller_storefront_otps
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public select/insert/update on reseller_storefront_carts" ON reseller_storefront_carts;
CREATE POLICY "Public select/insert/update on reseller_storefront_carts" ON reseller_storefront_carts
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public select/insert on reseller_storefront_reviews" ON reseller_storefront_reviews;
CREATE POLICY "Public select/insert on reseller_storefront_reviews" ON reseller_storefront_reviews
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public select on reseller_storefront_coupons" ON reseller_storefront_coupons;
CREATE POLICY "Public select on reseller_storefront_coupons" ON reseller_storefront_coupons
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public select/insert/update on reseller_storefront_abandoned_carts" ON reseller_storefront_abandoned_carts;
CREATE POLICY "Public select/insert/update on reseller_storefront_abandoned_carts" ON reseller_storefront_abandoned_carts
  FOR ALL USING (true) WITH CHECK (true);
