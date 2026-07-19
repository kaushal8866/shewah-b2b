# Shewah Feature Building — Decision Cheat Sheet v2.1

> Quick reference for when you're actively building. Find your feature, get the exact files, routes, and rules.

---

## Table of Contents

1. [I Need to Build a Feature That...](#i-need-to-build-a-feature-that)
   - [Involves Orders](#involves-orders-any-flow)
   - [Involves Pricing or Quotes](#involves-pricing-or-quotes)
   - [Involves Products / Catalog](#involves-products--catalog)
   - [Involves Manufacturing / Karigars](#involves-manufacturing--karigars)
   - [Involves Inventory / Stock](#involves-inventory--stock)
   - [Involves Diamonds (Loose or Matrix)](#involves-diamonds-loose-or-matrix)
   - [Involves Reseller Storefronts / Theme customization](#involves-reseller-storefronts--theme-customization)
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
- `app/quotes/new/page.tsx` — quote builder UI with item cards, DiamondCatalogPicker, karat selector, D2C customer lookup, live price breakup drawer
- `app/quotes/[id]/page.tsx` — quote detail, send, revise, convert-to-order, PDF preview, permanent delete action

**API routes:**
- `app/api/quotes/route.ts` — GET (list), POST (create with computeQuoteItem)
- `app/api/quotes/[id]/route.ts` — GET, PATCH, DELETE (perm delete)
- `app/api/quotes/[id]/send/route.ts` — POST (generate token, WhatsApp dispatch)
- `app/api/quotes/[id]/convert-to-order/route.ts` — POST (get prefill), PATCH (link order)
- `app/api/quotes/[id]/accept/route.ts` — POST (retailer acceptance)
- `app/api/quotes/[id]/revision/route.ts` — POST (retailer revision request)
- `app/api/portal/retailer/quote-preview/route.ts` — POST (price preview for karat selection)

**Lib files:**
- `lib/quoteCompute.ts` — `computeQuoteItem()`, `computeQuoteTotals()` — the pricing engine
- `lib/quoteDefaults.ts` — `DEFAULT_QUOTE_MARGIN_PCT` (28%), `DEFAULT_QUOTE_GST_RATE_PCT` (3%), `DEFAULT_QUOTE_TERMS`
- `lib/quoteNumber.ts` — `nextQuoteNumber()` — sequential quote number generation (Q-YYMMDD-NNN)
- `lib/quotePdf.ts` — `renderQuotePdf()` — A4 PDF with branding, item cards, 9-column breakup tables (Size \| Color \| Clarity \| Shape \| Count \| Price \| Weight \| CT/PC \| TOTAL), totals, signature, page numbers
- `lib/quoteShareNotify.ts` — `sendQuoteShareLink()`, `notifyInternalQuoteResponse()` — WhatsApp + email dispatch

**Rules:**
- `margin_pct` default is **28%** (overridable per quote)
- `gst_rate_pct` default is **3%** (overridable per quote)
- `gst_treatment` is `'exclusive'` (add GST on top), `'inclusive'` (included in line total), or `'none'`
- `net_24kt_weight_g` = `gross_gold_weight_g × KARAT_FACTORS[karat]` (always computed server-side in `computeQuoteItem()`)
- `line_total` = `line_trade × quantity` (trade price is unit-level)
- Quote validity default: **30 days** from `quote_date`
- Public share links live at `/q/[token]` — token is a 32-char hex string, expiry is `min(60 days from now, valid_until + 30 days)`
- Quote share page (`/q/[token]`) contains a full-width PDF iframe and a compact totals strip (Line Items sidebar removed).
- Quote creation does **5 retry attempts** on `quote_number` unique constraint
- `computeQuoteItem()` handles silver specially: if `karat === 'silver'`, gold cost uses silver rate directly, no karat conversion
- Diamond Cost = `Σ(weight × pieces × rate_per_ct) + Σ(igi_charge)`. Rate stored in `rate_per_pc` is always rate per-carat.

---

### ...Involves Products / Catalog

**Admin catalog pages:**
- `app/catalog/page.tsx` — grid, filters, margin estimates, refresh button, collections tab, interest tab, set/pair indicator
- `app/catalog/[id]/page.tsx` — product edit, per-karat pricing display, photo management
- `app/catalog/new/page.tsx` — product creation form, set/pair options, default karat selection
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
- Sets and Pairs: Default karat selection on catalog creation scales to child components.

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

---

### ...Involves Diamonds (Loose or Matrix)

**Pages:**
- `app/diamonds/matrix/page.tsx` — click-to-edit pricing grid switcher for LGD vs Natural diamonds with filter/sort toolbars and sieve size groups.
- `app/diamonds/procurement/page.tsx` — loose diamond procurement and negotiation review tracker.

**API routes:**
- `/api/diamonds/shapes` — GET (all active shapes), POST (create)
- `/api/diamonds/sizes` — GET (all sizes under shape), POST (create)
- `/api/diamonds/matrix` — GET/POST/PATCH/DELETE (LGD vs Natural rates)
- `/api/diamonds/procurement` — GET/POST/PATCH (loose diamond module pipeline)

**Picker Component:**
- `components/DiamondCatalogPicker.tsx` — handles sizing auto-fill of approx_carats, and pricing matrix lookup based on selected color, shape, quality, and size.

**Rules:**
- Matrix rates are per-carat price lookups.
- LGD and Natural lookups use distinct scaling logic.
- Natural matrix values are fetched using dynamic quality/color bucket parameters from database.
- Sieve size groups merge overlapping dimensions.
- The `shape_name` should be resolved from `diamond_shapes` lookup, never falling back to generic row `role` names.

---

### ...Involves Reseller Storefronts / Theme customization

**Pages & Tools:**
- `/store/brand-studio` — Palmonas-grade visual layout editor for white-label reseller storefront themes.
- `/store/[...subdomain]` — Customer-facing storefront application (bypasses AppShell).
- `/onboard` — Reseller onboarding flow.
- `/apply` — Public reseller application page.

**API routes:**
- `/api/portal/reseller/theme` — GET (reseller theme config), POST (update config)
- `/api/portal/reseller/checkout` — POST (curated checkout of catalog items/sets)

**Rules:**
- Access to store and brand-studio is restricted to active resellers (`status = 'active'`).
- Theme configuration uses a standard JSONB schema in `reseller_themes`.
- Storefront header and layouts bypass standard admin AppShell wrapper and use dynamic styles based on theme configuration variables.

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
- `deriveCurrentStage()` maps internal order status to 7 consumer-facing stages.

---

### ...Involves Marketing / Landing Page

**Landing page files:**
- `app/page.tsx` — server-side variant selection, redirect logged-in users, SEO metadata
- `app/LandingPage.tsx` — outcome-first variant
- `app/LandingPageOriginal.tsx` — original variant
- `app/LeadForm.tsx` — lead capture form (used by both variants)
- `app/partner-signup/page.tsx` — full-page signup form
- `app/opengraph-image.tsx` — dynamic OG image generation

**API routes:**
- `app/api/public/partner-signup/route.ts` — POST (lead capture, rate-limited, honeypot, phone validation)

**Lib files:**
- `lib/landingCopy.ts` — **ALL** copy: `BRAND`, `HERO`, `STATS`, `VALUE_PROPS`, `HOW_IT_WORKS`, `FAQ`, `TESTIMONIALS`, `SEO`, `TRUST`
- `lib/landingVariant.ts` — A/B test constants, cookie management, kill-switch logic, random variant picker

**Rules:**
- A/B test is controlled by `lp_variant` cookie (50/50), set in `middleware.ts` on first visit
- Kill switch: `LANDING_VARIANT_OVERRIDE` env var forces all visitors to one variant
- Copy lives **ONLY** in `lib/landingCopy.ts` — never hardcode marketing text in JSX
- Lead form has **honeypot field** (`website`) — bots that fill it get silent success response
- Rate limit: **5 requests per minute, 30 per hour** per IP (in-memory token bucket)
- Phone validation: strict India 10-digit after stripping `+91`/`0` prefix, must start with 6-9

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
All notification behavior is controlled by the `settings` table.

**Rules:**
- Notifications are **fire-and-forget** — they never block the main operation
- Outbound WhatsApp notifications use settings webhook tokens or fall back to Meta Graph API.
- Inbound webhook verifies `Authorization: Bearer <whatsapp_inbound_token>` if configured.
- Cron endpoints must self-auth with `Authorization: Bearer ${CRON_SECRET}` header.

---

### ...Involves Analytics / Reporting

**Admin analytics pages:**
- `app/analytics/page.tsx` — revenue charts, conversion funnel, top partners, model split, gold rate trends
- `app/profitability/page.tsx` — COGS / margin dashboard, per-order profitability, partner profitability
- `app/manufacturing/partners/[id]/reconciliation/page.tsx` — per-karigar reconciliation

**Database views:**
- `order_pipeline` — joins `orders` + `partners` + `products`
- `partner_summary` — aggregates orders, revenue, visits per partner
- `stock_balances` — computed balances per material_type
- `diamond_stock_by_group` — computed diamond balances per shape×size group

**Rules:**
- `profitability` page requires `master` role or `profitability` module permission
- Reconciliation compares `material_transactions.consumption` against `orders.gold_weight_actual` (or `gold_weight_estimated` if actual not yet recorded).

---

### ...Involves Payments

**Current state:** `order_payments` exists as a simple ledger but has **no payment gateway integration**.

**Table schema:**
```
order_payments: id, order_id, amount, method, reference, date, notes, created_at
```

**Rules:**
- Update `balance_due` automatically when payment is recorded.
- Retailer portal should show payment status and history.

---

### ...Involves Audit / Compliance

**Current state:** No audit trail except `customer_enquiry_activity`.

**Rules:**
- Never expose raw DB errors to public users (use `sanitizeDbError.ts`).
- Log all admin actions that modify financial data.

---

### ...Involves Multi-User / Team Workflow

**Current state:** No user assignment, work queues, or locking.
- CAD revisions use `cad_revisions` table.
- Order assignment can be mapped via `assigned_to` on custom requests.

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

For **portal routes** (retailer/manufacturer/reseller):

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

// Reseller
if (!user || user.role !== 'reseller' || !user.resellerId) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}
```

---

## Quick Database Migration Pattern

When adding a new table or column:

1. **Write SQL** in `scripts/migrate_taskNN_descriptive_name.sql`
2. Make it **idempotent** (use `CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`)
3. Add **RLS policy**: `service_role_all` for tables accessed via server APIs
4. Add **indexes** on foreign key relationships
5. Update `ALLOWED_TABLES` in `app/api/db/route.ts` if admin clients need it
6. Add **type definition** in `lib/supabase.ts`

---

## Common Gotchas

### 1. Role mismatch: `'admin'` vs `'master'`
Some files check `user.role !== 'master' && user.role !== 'admin'`. Always use `'master'` or `'sub'` roles for admin access.

### 2. `products` table weights
`gold_weight_g` is the legacy column. `gold_weight_22k` is the canonical column. Always use `gold_weight_22k`.

### 3. Stored float balances drift
`material_float` stored columns (`balance`, `total_deposited`, etc.) do not auto-calculate. Always compute balances dynamically from `material_transactions`.

### 4. Diamond Rate Per Carat scaling
The column name `rate_per_pc` in diamonds is **always per carat**. Ensure diamond total cost is `weight × pieces × rate` and not `pieces × rate`.

### 5. PDF shape name fallback
If `d.shape_name` is missing from database records, look up `shape_name` dynamically via `diamond_shapes` using `shape_id` to prevent falling back to `role` (like "accent") on PDF outputs.

### 6. Dynamic ordering size categories
Rings require Ring sizes, while necklaces/bracelets require Gauges, lengths or other metrics. Render sizes dynamically by category instead of forcing Ring size everywhere.

---

## Environment Variables Reference

| Variable | Required | Used By | Description |
|----------|----------|---------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | All | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | `supabaseAdmin.ts` | Supabase service role key (server-side only) |
| `NEXTAUTH_SECRET` | Yes | `lib/auth.ts` | NextAuth JWT encryption key |
| `NEXTAUTH_URL` | Yes | `lib/auth.ts` | Base URL of the app |
| `CRON_SECRET` | No | `app/api/cron/*` | Secret for cron job self-auth |
| `RESEND_API_KEY` | No | `lib/leadNotify.ts` | Resend API key for email |
| `META_WHATSAPP_ACCESS_TOKEN` | No | `lib/leadNotify.ts` | Meta WhatsApp API token |
| `META_WHATSAPP_PHONE_NUMBER_ID` | No | `lib/leadNotify.ts` | Meta WhatsApp phone number ID |

---

*End of Decision Cheat Sheet v2.1 — Updated 2026-07-19*
