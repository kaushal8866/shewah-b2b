# Shewah Feature Building — Decision Cheat Sheet v2.0

> Quick reference for when you're actively building. Find your feature, get the exact files, routes, and rules.

---

## Table of Contents

1. [I Need to Build a Feature That...](#i-need-to-build-a-feature-that)
   - [Involves Orders](#involves-orders-any-flow)
   - [Involves Pricing or Quotes](#involves-pricing-or-quotes)
   - [Involves Products / Catalog](#involves-products--catalog)
   - [Involves Manufacturing / Karigars](#involves-manufacturing--karigars)
   - [Involves Inventory / Stock](#involves-inventory--stock)
   - [Involves D2C / Consumers](#involves-d2c--consumers)
   - [Involves Marketing / Landing Page](#involves-marketing--landing-page)
   - [Involves Notifications (WhatsApp / Email)](#involves-notifications-whatsapp--email)
   - [Involves Analytics / Reporting](#involves-analytics--reporting)
   - [Involves Payments](#involves-payments)
   - [Involves Audit / Compliance](#involves-audit--compliance)
   - [Involves Multi-User / Team Workflow](#involves-multi-user--team-workflow)
2. [Quick API Route Template](#quick-api-route-template)
3. [Quick Database Migration Pattern](#quick-database-migration-pattern)
4. [Common Gotchas](#common-gotchas)
5. [Environment Variables Reference](#environment-variables-reference)

---

## I Need to Build a Feature That...

### ...Involves Orders (Any Flow)

**Admin order pages:**
- `app/orders/page.tsx` — list view, kanban, filters, pagination
- `app/orders/[id]/page.tsx` — detail view, status transitions, manufacturing handoff, production updates, change request review
- `app/orders/new/page.tsx` — creation form, captures gold_rate_at_order

**Retailer portal order pages:**
- `app/portal/retailer/orders/page.tsx` — own orders list
- `app/portal/retailer/orders/[id]/page.tsx` — order detail, submit change request
- `app/api/portal/retailer/orders/route.ts` — GET (own orders), POST (new order)
- `app/api/portal/retailer/orders/[id]/route.ts` — GET (own order), PATCH (change request)

**API routes:**
- `app/api/db/route.ts` — admin CRUD (table: `orders`)
- `app/api/portal/retailer/orders/route.ts` — retailer creation
- `app/api/portal/retailer/orders/[id]/route.ts` — retailer detail/change-request

**Lib files:**
- `lib/supabase.ts` — `computeOrderCogs()`, `ORDER_STATUSES` array, Order type
- `lib/mfgOrderLifecycle.ts` — `applyMfgStatusChange()`, `cascadeOrderStatusToMfg()`

**Rules:**
- Capture `gold_rate_at_order` at creation, **never update it later**
- Status transitions: `brief_received → cad_in_progress → cad_sent → design_approved → production → qc → dispatched → delivered`
- Balance due = `total_amount - advance_paid` (computed, not stored by default)
- COGS fields populate from manufacturing data, not from the catalog product
- `type` is `'catalog'` or `'custom'` — not `'b2b'` or `'d2c'`
- D2C inferred by `customer_id` being set or `audience` column

---

### ...Involves Pricing or Quotes

**Admin quote pages:**
- `app/quotes/page.tsx` — quote list, pagination, search, status filters
- `app/quotes/new/page.tsx` — quote builder UI with item cards, diamond picker, karat selector
- `app/quotes/[id]/page.tsx` — quote detail, send, revise, convert-to-order, PDF preview

**API routes:**
- `app/api/quotes/route.ts` — GET (list), POST (create with computeQuoteItem)
- `app/api/quotes/[id]/send/route.ts` — POST (generate token, WhatsApp dispatch)
- `app/api/quotes/[id]/convert-to-order/route.ts` — POST (get prefill), PATCH (link order)
- `app/api/quotes/[id]/accept/route.ts` — POST (retailer acceptance)
- `app/api/quotes/[id]/revision/route.ts` — POST (retailer revision request)
- `app/api/portal/retailer/quote-preview/route.ts` — POST (price preview for karat selection)

**Lib files:**
- `lib/quoteCompute.ts` — `computeQuoteItem()`, `computeQuoteTotals()` — the pricing engine
- `lib/quoteDefaults.ts` — `DEFAULT_QUOTE_MARGIN_PCT` (28%), `DEFAULT_QUOTE_GST_RATE_PCT` (3%), `DEFAULT_QUOTE_TERMS`
- `lib/quoteNumber.ts` — `nextQuoteNumber()` — sequential quote number generation (Q-YYMMDD-NNN)
- `lib/quotePdf.ts` — `renderQuotePdf()` — A4 PDF with branding, item cards, breakup tables, totals, signature, page numbers
- `lib/quoteShareNotify.ts` — `sendQuoteShareLink()`, `notifyInternalQuoteResponse()` — WhatsApp + email dispatch

**Rules:**
- `margin_pct` default is **28%** (overridable per quote)
- `gst_rate_pct` default is **3%** (overridable per quote)
- `gst_treatment` is `'exclusive'` (add GST on top), `'inclusive'` (included in line total), or `'none'`
- `net_24kt_weight_g` = `gross_gold_weight_g × KARAT_FACTORS[karat]` (always computed server-side in `computeQuoteItem()`)
- `line_total` = `line_trade × quantity` (trade price is unit-level)
- Quote validity default: **30 days** from `quote_date`
- Public share links live at `/q/[token]` — token is a 32-char hex string, expiry is `min(60 days from now, valid_until + 30 days)`
- Quote number format: `Q-YYMMDD-NNN` (e.g., `Q-250617-001`)
- Quote creation does **5 retry attempts** on `quote_number` unique constraint
- `computeQuoteItem()` handles silver specially: if `karat === 'silver'`, gold cost uses silver rate directly, no karat conversion

---

### ...Involves Products / Catalog

**Admin catalog pages:**
- `app/catalog/page.tsx` — grid, filters, margin estimates, refresh button, collections tab, interest tab
- `app/catalog/[id]/page.tsx` — product edit, per-karat pricing display, photo management
- `app/catalog/new/page.tsx` — product creation form
- `app/catalog/categories/page.tsx` — category management
- `app/catalog/collections/new/page.tsx` — create collection
- `app/catalog/collections/[id]/page.tsx` — edit collection, add/remove products

**API routes:**
- `app/api/db/route.ts` — admin CRUD (table: `products`)
- `app/api/catalog/pdf/route.ts` — GET (generate catalog PDF, `showPrice` param)
- `app/api/collections/[id]/views/route.ts` — GET (collection view stats)
- `app/api/collections/[id]/products/route.ts` — GET (collection products for showcase)
- `app/api/collections/[id]/interest/route.ts` — POST (record interest)
- `app/api/showcase/track/route.ts` — POST (collection view tracking)
- `app/api/showcase/interests/route.ts` — POST (design interest from showcase)

**Lib files:**
- `lib/karat.ts` — `computeKaratPricing()`, `deriveAllKaratWeights()`, `pure24kt()`, `pureGoldMass()`, `getMetalWeight()`, `SELLABLE_KARATS`
- `lib/supabase.ts` — `recomputeCatalogPrices()` (bulk refresh), `Product` type
- `lib/catalogPdf.ts` — `renderCatalogPdf()` — A4 grid, 4 items per page, image placeholders, clickable links

**Rules:**
- `gold_weight_22k` is the **canonical user input** (the physical net weight)
- Per-karat weights are derived: `gold_weight_Xk = gold_weight_22k × 0.916 / KARAT_FACTORS[X]`
- `karat_pricing` is a JSONB cache: `{ "22": { weight, goldCost, labourCost, cogs, trade, mrp }, ... }`
- `trade_price` and `mrp_suggested` are the **22K defaults** (legacy compatibility)
- When gold rate changes, call `recomputeCatalogPrices(rate24k)` — it updates all active products
- Products can be `is_active=false` (soft-hide) without deleting
- `metal_weights` table stores per-shape, per-karat, per-metal-type weight data for the diamond picker
- `diamond_shapes`, `diamond_sizes`, `diamond_quality_grades`, `diamond_color_grades` are lookup tables
- Catalog PDF has two modes: `showPrice=false` (no prices) and `showPrice=true&priceType=both` (trade + MRP)

---

### ...Involves Manufacturing / Karigars

**Admin manufacturing pages:**
- `app/manufacturing/page.tsx` — partner list, float summary cards, active orders
- `app/manufacturing/orders/new/page.tsx` — issue manufacturing order, select partner, set labour rates
- `app/manufacturing/orders/[id]/page.tsx` — mfg order detail, status, float reservation, share link management
- `app/manufacturing/partners/[id]/page.tsx` — partner detail, per-karat labour rates, phone, status
- `app/manufacturing/partners/[id]/float/page.tsx` — float ledger, deposit/return, balance history
- `app/manufacturing/partners/[id]/reconciliation/page.tsx` — reconciliation report, variance analysis

**API routes:**
- `app/api/db/route.ts` — admin CRUD (tables: `manufacturing_partners`, `manufacturing_orders`, `material_float`, `material_transactions`)
- `app/api/manufacturing/orders/[id]/reserve-float/route.ts` — POST (atomic float reservation via `mfg_reserve_float()` PostgreSQL function)
- `app/api/manufacturing/orders/[id]/share-link/route.ts` — GET (list links), POST (create/revoke + WhatsApp), DELETE (revoke specific)
- `app/api/portal/manufacturer/orders/route.ts` — GET (assigned orders, no cost fields)
- `app/api/portal/manufacturer/orders/[id]/route.ts` — GET (order detail), PATCH (update status, notes, images)

**Lib files:**
- `lib/centralStock.ts` — `issueToPartner()`, `receiveFromPartner()`, `recordPurchase()`, `recordAdjustment()` — dual-write to stock + float
- `lib/mfgOrderLifecycle.ts` — `applyMfgStatusChange()`, `cascadeOrderStatusToMfg()` — float side-effects on status changes
- `lib/floatBuckets.ts` — `getPartnerBuckets()`, `getAvailableForMaterial()`, `materialTypeForKarat()` — float balance computation
- `lib/karigarShareNotify.ts` — `sendKarigarPackLink()` — WhatsApp dispatch for 48h manufacturing links
- `lib/karat.ts` — `KARAT_FACTORS` — used when finalizing consumption quantity

**Rules:**
- Float reservation uses `mfg_reserve_float()` PostgreSQL function (atomic lock + pending consumption)
- Gold quantities in float are **24K-pure grams** (converted from gross-at-karat using `KARAT_FACTORS`)
- When mfg order status → `completed`: pending consumption flips to `final`, quantity updated to actual
- When mfg order status → `cancelled`: consumption row is deleted (gold stays in float)
- When mfg order status → `returned`: consumption deleted + return transaction inserted
- Manufacturer portal sees **no pricing** (costs, labour, total_cogs are excluded from API responses)
- Share links expire in **48 hours** (`mfg_share_links.expires_at`)
- Only **one active share link** per manufacturing order at a time (revoke others on creation)
- Reconciliation digest runs via `/api/cron/reconciliation-digest` — self-auths with `CRON_SECRET`

---

### ...Involves Inventory / Stock

**Admin stock pages:**
- `app/stock/page.tsx` — dashboard, balance cards, diamond group cards, negative balance alerts
- `app/stock/issue/page.tsx` — issue to karigar (dual-write: stock_movements + material_transactions)
- `app/stock/receive/page.tsx` — receive from karigar (reverse dual-write)
- `app/stock/movements/page.tsx` — full audit ledger, filters

**API routes:**
- `app/api/stock/balances/route.ts` — GET (central stock balances from `stock_balances` view)
- `app/api/stock/movements/route.ts` — GET, POST (movement CRUD)
- `app/api/stock/issue/route.ts` — POST (issue API, dual-write)
- `app/api/stock/receive/route.ts` — POST (receive API, dual-write)
- `app/api/diamonds/stock/route.ts` — GET (diamond group balances from `diamond_stock_by_group` view)

**Lib files:**
- `lib/centralStock.ts` — all movement functions, dual-write logic, fallback deletion on failure
- `lib/floatBuckets.ts` — float balance computation

**Rules:**
- Central stock balances are **computed from `stock_movements`** (no `balance` column)
- `stock_balances` view does the SUM: `SUM(CASE movement_type ... END)` per material_type
- `diamond_stock_by_group` view groups by `(material_type, diamond_shape_id, diamond_size_id)`
- Issuing to a karigar **dual-writes**: `stock_movements` (debit central) + `material_transactions` (credit float)
- The two rows are linked via `stock_movements.material_transaction_id`
- Findings (jewelry findings) stay in central stock only — karigars don't hold them on float
- **Negative balances are possible** and flagged in the UI with `AlertTriangle` icon
- `creates_negative_balance` flag on `material_transactions` is set by PostgreSQL trigger `mt_flag_negative_balance_trg`

---

### ...Involves D2C / Consumers

**Admin consumer pages:**
- `app/customers/page.tsx` — customer list, search, city filters
- `app/customers/[id]/page.tsx` — customer profile, addresses, enquiry history, order history
- `app/enquiries/page.tsx` — enquiry inbox (kanban + list), filters, assignment
- `app/enquiries/[id]/page.tsx` — enquiry detail, timeline, activity feed, status changes, conversion
- `app/enquiries/new/page.tsx` — operator intake form, customer de-dupe

**Public consumer pages:**
- `app/c/[token]/page.tsx` — customer journey link (public, unauthenticated, consumer theme)

**API routes:**
- `app/api/customers/route.ts` — POST (create with de-dupe by normalized WhatsApp number, then email)
- `app/api/customers/[id]/route.ts` — GET (profile bundle with addresses, enquiries, orders)
- `app/api/enquiries/route.ts` — POST (create + log activity in `customer_enquiry_activity`)
- `app/api/enquiries/[id]/route.ts` — GET/PATCH (update + diff + log activity)
- `app/api/enquiries/[id]/notes/route.ts` — POST (append note activity)
- `app/api/c/[token]/route.ts` — GET (public sanitized payload)
- `app/api/customer-journey-links/route.ts` — POST (create link with 90-day expiry)

**Lib files:**
- `lib/consumerTheme.ts` — `consumerTheme` tokens, `JOURNEY_STAGES`, `deriveCurrentStage()`

**Rules:**
- Customer de-dupe is by **normalized WhatsApp number first**, then email
- Enquiry number is `ENQ-00042` from Postgres sequence `customer_enquiry_number_seq`
- All status changes, assignments, follow-ups, image additions write to `customer_enquiry_activity` (append-only)
- `customer_enquiry_activity` has `before` and `after` JSONB columns for diff tracking
- Consumer journey link is **unauthenticated**, token expires in **90 days**, mobile-first, uses champagne/ivory theme (`#C9A86A`, `#FBF7F0`)
- `production_updates` with `is_customer_visible=true` are exposed to consumers
- `orders.audience` or `orders.customer_id` determines if it's D2C
- `deriveCurrentStage()` maps internal order status to 7 consumer-facing stages: `enquiry_received → quote_shared → design_approved → in_production → quality_check → dispatched → delivered`

---

### ...Involves Marketing / Landing Page

**Landing page files:**
- `app/page.tsx` — server-side variant selection, redirect logged-in users, SEO metadata
- `app/LandingPage.tsx` — outcome-first variant (live, task #96)
- `app/LandingPageOriginal.tsx` — original variant (fallback, task #85)
- `app/LeadForm.tsx` — lead capture form (used by both variants)
- `app/partner-signup/page.tsx` — full-page signup form
- `app/opengraph-image.tsx` — dynamic OG image generation

**API routes:**
- `app/api/public/partner-signup/route.ts` — POST (lead capture, rate-limited, honeypot, phone validation)
- `app/api/showcase/track/route.ts` — POST (collection view tracking)
- `app/api/showcase/interests/route.ts` — POST (design interest from showcase)

**Lib files:**
- `lib/landingCopy.ts` — **ALL** copy: `BRAND`, `HERO`, `STATS`, `VALUE_PROPS`, `HOW_IT_WORKS`, `FAQ`, `TESTIMONIALS`, `SEO`, `TRUST`
- `lib/landingVariant.ts` — A/B test constants, cookie management, kill-switch logic, random variant picker

**Rules:**
- A/B test is controlled by `lp_variant` cookie (50/50), set in `middleware.ts` on first visit
- Kill switch: `LANDING_VARIANT_OVERRIDE` env var forces all visitors to one variant
- `partner_signups` table stores UTM params, referrer, IP hash, landing variant, per-channel notify status
- Copy lives **ONLY** in `lib/landingCopy.ts` — never hardcode marketing text in JSX
- Meta Pixel + GA4 are optional (enabled by `NEXT_PUBLIC_META_PIXEL_ID` and `NEXT_PUBLIC_GA_ID`)
- Testimonials, founder photo, partner logos are intentionally empty in `landingCopy.ts` — add real ones after collecting consent
- Lead form has **honeypot field** (`website`) — bots that fill it get silent success response
- Rate limit: **5 requests per minute, 30 per hour** per IP (in-memory token bucket)
- Phone validation: strict India 10-digit after stripping `+91`/`0` prefix, must start with 6-9
- Email validation: simple regex `^[^\s@]+@[^\s@]+\.[^\s@]+$`
- Monthly volume must be one of: `''`, `'<5'`, `'5-20'`, `'20-50'`, `'50+'`

---

### ...Involves Notifications (WhatsApp / Email)

**Notification lib files:**
- `lib/leadNotify.ts` — `notifyNewPartnerLead()` — email (Resend) + WhatsApp (Meta Graph API) for new leads
- `lib/quoteShareNotify.ts` — `sendQuoteShareLink()`, `notifyInternalQuoteResponse()` — quote share + acceptance/revision
- `lib/karigarShareNotify.ts` — `sendKarigarPackLink()` — manufacturing order WhatsApp links
- `lib/readyToShipNotify.ts` — `notifyRetailerOfferDecision()` — RTS offer decisions
- `lib/whatsappNotify.ts` — Inbound webhook handler for `ACK <order#>` CAD revision acknowledgment

**API routes:**
- `app/api/whatsapp/inbound/route.ts` — GET (webhook verification), POST (ACK command parsing)
- `app/api/cron/reconciliation-digest/route.ts` — GET/POST (scheduled reconciliation email digest)

**Settings-driven configuration:**
All notification behavior is controlled by the `settings` table:

```
whatsapp_notifications_enabled    → master toggle for WhatsApp
whatsapp_webhook_url              → WhatsApp gateway URL
whatsapp_webhook_token            → WhatsApp gateway auth token
whatsapp_number                   → internal notification target number
public_base_url                   → base URL for share links
lead_notify_email_enabled         → lead email toggle
lead_notify_whatsapp_enabled      → lead WhatsApp toggle
lead_notify_email_to              → lead email recipients
lead_notify_whatsapp_to           → lead WhatsApp recipients
reconciliation_alert_email_from   → email sender address
reconciliation_alert_email_to       → reconciliation digest recipients
```

**Rules:**
- Notifications are **fire-and-forget** — they never block the main operation
- Retailer notifications respect `partners.notify_whatsapp` (opt-out)
- Internal notifications go to `settings.whatsapp_number` (comma-separated for multiple recipients)
- Email uses **Resend API** (`RESEND_API_KEY` env var)
- WhatsApp outbound uses **Meta Graph API** (`META_WHATSAPP_ACCESS_TOKEN`, `META_WHATSAPP_PHONE_NUMBER_ID` env vars)
- WhatsApp inbound webhook verifies `Authorization: Bearer <whatsapp_inbound_token>` if configured
- Inbound `ACK <order#>` command is case-insensitive, parses `\bACK\b[\s:#-]*([A-Za-z0-9_\-\/]+)`
- Cron endpoints must self-auth with `Authorization: Bearer ${CRON_SECRET}` header
- All notification helpers are **never-throw** — they catch all errors and return result objects

---

### ...Involves Analytics / Reporting

**Admin analytics pages:**
- `app/analytics/page.tsx` — revenue charts, conversion funnel, top partners, model split, gold rate trends
- `app/profitability/page.tsx` — COGS / margin dashboard, per-order profitability, partner profitability
- `app/manufacturing/partners/[id]/reconciliation/page.tsx` — per-karigar reconciliation

**API routes:**
- `app/api/db/route.ts` — queries via `order_pipeline` view, `partner_summary` view
- `app/api/cron/reconciliation-digest/route.ts` — scheduled reconciliation report

**Database views:**
- `order_pipeline` — joins `orders` + `partners` + `products` for rich reporting
- `partner_summary` — aggregates orders, revenue, visits per partner
- `stock_balances` — computed balances per material_type
- `diamond_stock_by_group` — computed diamond balances per shape×size group

**Rules:**
- `profitability` page requires `master` role or `profitability` module permission
- Gold reconciliation alerts are master-only (`manufacturing/reconciliation-alerts`)
- No real-time analytics pipeline — all reports are query-on-demand from PostgreSQL views
- Reconciliation digest thresholds are configurable in settings: `reconciliation_alert_window_days` (default 7), `reconciliation_alert_variance_g` (default 2.0), `reconciliation_alert_negative_count` (default 1), `reconciliation_alert_unlinked_count` (default 3)
- Reconciliation compares `material_transactions.consumption` against `orders.gold_weight_actual` (or `gold_weight_estimated` if actual not yet recorded)

---

### ...Involves Payments

**Current state:** `order_payments` exists as a simple ledger but has **no payment gateway integration**.

**Table schema:**
```
order_payments: id, order_id, amount, method, reference, date, notes, created_at
```

**If you build payment integration:**

**New files to create:**
- `app/api/payments/razorpay/create-order/route.ts` — create Razorpay order
- `app/api/payments/razorpay/webhook/route.ts` — verify Razorpay webhook signature
- `app/api/payments/verify/route.ts` — verify payment signature client-side
- `lib/payments.ts` — payment helper functions, status machine
- `app/payments/page.tsx` — payment status dashboard

**Database changes needed:**
- Add `payment_status` to `orders` table: `pending`, `partial`, `confirmed`, `failed`, `refunded`
- Add `payment_link_url` to `orders` table
- Add `razorpay_order_id`, `razorpay_payment_id` to `order_payments` table

**Rules:**
- The existing `order_payments` table is a good starting point
- You'll need a payment gateway webhook handler and a status machine
- Update `balance_due` automatically when payment is recorded
- Retailer portal should show payment status and history
- Consider partial payment support (advance + balance on dispatch)

---

### ...Involves Audit / Compliance

**Current state:** No audit trail except `customer_enquiry_activity`.

**If you build audit trails:**

**New files to create:**
- `lib/audit.ts` — audit log helper
- `app/api/audit/route.ts` — query audit log
- `app/audit/page.tsx` — audit log viewer

**Database changes needed:**
- Create `audit_log` table:
  ```sql
  create table audit_log (
    id uuid primary key default gen_random_uuid(),
    created_at timestamptz default now(),
    table_name text not null,
    record_id uuid not null,
    action text not null check (action in ('insert', 'update', 'delete')),
    user_id uuid references app_users(id),
    user_role text,
    old_values jsonb,
    new_values jsonb,
    ip_address text,
    user_agent text
  );
  ```
- Or use PostgreSQL trigger-based audit on critical tables (`orders`, `products`, `gold_rates`, `quotes`)

**Rules:**
- Never expose raw DB errors to public users (use `sanitizeDbError.ts`)
- Log all admin actions that modify financial data
- Consider GDPR compliance for `partner_signups` and `customers` data

---

### ...Involves Multi-User / Team Workflow

**Current state:** No user assignment, work queues, or locking.

**If you build team workflow:**

**CAD designer assignment:**
- Add `assigned_to` (uuid → app_users) to `cad_requests` table
- Add `cad_assignments` table or use `cad_requests.status = 'assigned'`
- Create `app/cad-team/queue/page.tsx` — work queue for CAD designers

**Order assignment:**
- Add `assigned_to` (uuid → app_users) to `orders` table
- Add `app/orders/assigned/page.tsx` — my assigned orders

**Sales rep commission:**
- Create `commissions` table: `id, order_id, app_user_id, amount, status, paid_at`
- Create `sales_targets` table: `app_user_id, month, target_amount, actual_amount`
- Create `app/sales/performance/page.tsx` — sales dashboard

---

## Quick API Route Template

When creating a new API route, use this template:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { safeDbError } from '@/lib/sanitizeDbError'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  // Validate role
  if (!session || (role !== 'master' && role !== 'sub')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }
  // ... handler
}
```

For **portal routes** (retailer/manufacturer):

```typescript
// Retailer
const user = session?.user as any
if (!user || user.role !== 'retailer' || !user.partnerId) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}
// Always filter by .eq('partner_id', user.partnerId)

// Manufacturer
if (!user || user.role !== 'manufacturer' || !user.manufacturingPartnerId) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}
// Always filter by .eq('manufacturing_partner_id', user.manufacturingPartnerId)
```

For **public routes** (unauthenticated):

```typescript
// Rate limit (in-memory or Redis)
// Honeypot field validation
// Input sanitization
// No user session required
```

For **cron routes** (scheduled):

```typescript
export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization') || ''
  const expected = process.env.CRON_SECRET
  if (!expected || auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  // ... run scheduled task
}
```

---

## Quick Database Migration Pattern

When adding a new table or column:

1. **Write SQL** in `scripts/migrate_taskNN_descriptive_name.sql`
2. Make it **idempotent** (use `CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`)
3. Add **RLS policy**: `service_role_all` for tables accessed via server APIs
4. Add **indexes** on foreign keys and frequently queried columns
5. Update `ALLOWED_TABLES` in `app/api/db/route.ts` if admin clients need it
6. Add **type definition** in `lib/supabase.ts` if admin UI uses it
7. Add **module permission** in `lib/modules.ts` if sub users need access
8. Add **updated_at trigger** if the table needs it

**Example migration template:**

```sql
-- scripts/migrate_task99_new_feature.sql
-- Idempotent migration for [feature description]

-- 1. Create table (if not exists)
create table if not exists new_table (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  -- your columns here
);

-- 2. Add indexes
create index if not exists idx_new_table_created_at on new_table(created_at);

-- 3. Enable RLS
alter table new_table enable row level security;

-- 4. Add policy
create policy "service_role_all" on new_table
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

-- 5. Add updated_at trigger (if needed)
create or replace function update_new_table_updated_at()
returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

drop trigger if exists new_table_updated_at on new_table;
create trigger new_table_updated_at
  before update on new_table
  for each row execute function update_new_table_updated_at();
```

---

## Common Gotchas

### 1. The `role` field uses `'admin'` in some places, `'master'` in others

In `app/api/manufacturing/orders/[id]/reserve-float/route.ts` and `app/api/manufacturing/orders/[id]/share-link/route.ts`, the role check is `user.role !== 'master' && user.role !== 'admin'`. But everywhere else in the app, the admin role is `'master'` and `'sub'`. The `'admin'` string is likely a bug or legacy. **Always use `'master'`** for new code.

### 2. `products` table has both `gold_weight_g` and `gold_weight_22k`

`gold_weight_g` is the old column. `gold_weight_22k` is the canonical column (Task #78). Some code may still read `gold_weight_g`. **Always use `gold_weight_22k`** for new features.

### 3. `material_float` has stored balance columns AND a transaction ledger

The stored columns (`total_deposited`, `total_returned`, `total_consumed`, `balance`) are **not automatically updated** by the transaction ledger. The `mfg_reserve_float()` function computes from the ledger. **Always compute float balances from `material_transactions`**, not from `material_float.balance`.

### 4. `orders` table mixes B2B and D2C with no discriminator

Use `customer_id IS NOT NULL` or `audience = 'consumer'` to identify D2C orders. `partner_id IS NOT NULL` identifies B2B orders. Never assume `type = 'catalog'` means B2B.

### 5. Quote-to-order conversion uses `sessionStorage`

If the user refreshes `/orders/new?source=quote`, the prefill data from `sessionStorage` is lost. The PATCH endpoint sets `converted_order_id` on the quote, but the order doesn't store `quote_id`. **Always check `sessionStorage` availability** and handle the null case gracefully.

### 6. `fetchImage()` only allows Cloudinary and Supabase URLs

If you add a new image host (e.g., AWS S3), update `ALLOWED_HOST_SUFFIXES` in `lib/pdfHelpers.ts` or PDF generation will fail silently with blank placeholders.

### 7. `computeQuoteItem()` uses `approx_carats` or `weight` for diamond weight

The function checks both fields: `Number((d as any).weight || (d as any).approx_carats) || 0`. Make sure your diamond data has one of these fields populated.

### 8. The `sub` user role is `'sub'`, not `'admin'` or `'user'`

In `lib/auth.ts`, the `authorize()` function returns `role: 'master' | 'sub'`. In the `app_users` table, the column is `role`. The setup page creates the first user with `role: 'master'`. Sub users are created via admin UI with `role: 'sub'`.

### 9. `landingCopy.ts` stats are placeholder values

The `STATS` array has hardcoded values (`'12,000+'`, `'180+'`, etc.) that are **not dynamically computed**. If you want real stats, either query the database or update the constants manually.

### 10. `partner_signups` has `landing_variant` column but no index

If you query by `landing_variant` frequently (e.g., for A/B conversion stats), add an index: `create index idx_partner_signups_variant on partner_signups(landing_variant, status, created_at);`

---

## Environment Variables Reference

| Variable | Required | Used By | Description |
|----------|----------|---------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | All | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | `supabaseAdmin.ts`, setup | Supabase service role key (server-side only) |
| `NEXTAUTH_SECRET` | Yes | `lib/auth.ts` | NextAuth JWT encryption key |
| `NEXTAUTH_URL` | Yes | `lib/auth.ts`, landing | Base URL of the app |
| `NEXT_PUBLIC_SITE_URL` | No | `app/page.tsx` | Public site URL for SEO |
| `CRON_SECRET` | No | `app/api/cron/*` | Secret for cron job self-auth |
| `RESEND_API_KEY` | No | `lib/leadNotify.ts`, reconciliation | Resend API key for email |
| `RESEND_FROM` | No | `lib/leadNotify.ts` | Default sender email |
| `LEAD_NOTIFY_EMAIL` | No | `lib/leadNotify.ts` | Lead notification email target |
| `LEAD_NOTIFY_WHATSAPP_TO` | No | `lib/leadNotify.ts` | Lead notification WhatsApp target |
| `META_WHATSAPP_ACCESS_TOKEN` | No | `lib/leadNotify.ts` | Meta WhatsApp API token |
| `META_WHATSAPP_PHONE_NUMBER_ID` | No | `lib/leadNotify.ts` | Meta WhatsApp phone number ID |
| `LANDING_VARIANT_OVERRIDE` | No | `lib/landingVariant.ts` | Force A/B variant |
| `NEXT_PUBLIC_META_PIXEL_ID` | No | `app/layout.tsx` | Meta Pixel ID |
| `NEXT_PUBLIC_GA_ID` | No | `app/layout.tsx` | Google Analytics ID |

**Important:** `SUPABASE_SERVICE_ROLE_KEY` must **never** be exposed to the client. It is only used in server-side API routes and the `supabaseAdmin.ts` file.

---

*End of Decision Cheat Sheet v2.0*
