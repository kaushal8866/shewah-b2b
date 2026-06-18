# Shewah Feature Building — Decision Cheat Sheet

> Quick reference for when you're mid-build and need to know "what file do I touch?"

---

## I Need to Build a Feature That...

### ...Involves Orders (Any Flow)

**Files to touch:**
- `app/orders/page.tsx` — list view, kanban, filters
- `app/orders/[id]/page.tsx` — detail view, status transitions, manufacturing handoff
- `app/orders/new/page.tsx` — creation form
- `app/api/portal/retailer/orders/route.ts` — retailer portal creation
- `app/api/portal/retailer/orders/[id]/route.ts` — retailer portal detail/change-request
- `lib/supabase.ts` — `computeOrderCogs()`, `ORDER_STATUSES` array

**Rules:**
- Capture `gold_rate_at_order` at creation, never update it later
- Status transitions are: `brief_received → cad_in_progress → cad_sent → design_approved → production → qc → dispatched → delivered`
- Balance due = `total_amount - advance_paid` (computed, not stored by default)
- COGS fields populate from manufacturing data, not from the catalog product

---

### ...Involves Pricing or Quotes

**Files to touch:**
- `lib/quoteCompute.ts` — item-level computation, totals, GST
- `lib/quoteDefaults.ts` — default margin (28%), GST rate (3%), terms text
- `lib/quoteNumber.ts` — sequential quote number generation
- `lib/quotePdf.ts` — PDF generation
- `lib/quoteShareNotify.ts` — WhatsApp/email notifications on share
- `app/quotes/new/page.tsx` — quote builder UI
- `app/quotes/[id]/page.tsx` — quote detail, send, revise, convert
- `app/api/quotes/route.ts` — CRUD, pagination, search
- `app/api/quotes/[id]/send/route.ts` — WhatsApp send + status update
- `app/api/quotes/[id]/convert-to-order/route.ts` — conversion logic

**Rules:**
- `margin_pct` default is 28% (overridable per quote)
- `gst_rate_pct` default is 3% (overridable per quote)
- `gst_treatment` is `exclusive` (add GST on top) or `inclusive` (included in line total) or `none`
- `net_24kt_weight_g` = `gross_gold_weight_g × KARAT_FACTORS[karat]` (always computed server-side)
- `line_total` = `line_trade × quantity` (trade price is unit-level)
- Public share links live at `/q/[token]` — token is a random string, link expires when `valid_until` passes

---

### ...Involves Products / Catalog

**Files to touch:**
- `lib/karat.ts` — `computeKaratPricing()`, `deriveAllKaratWeights()`, `pure24kt()`
- `lib/supabase.ts` — `recomputeCatalogPrices()` (bulk refresh)
- `app/catalog/page.tsx` — grid, filters, margin estimates, refresh button
- `app/catalog/[id]/page.tsx` — product edit, per-karat pricing display
- `app/catalog/new/page.tsx` — product creation
- `app/api/catalog/pdf/route.ts` — catalog PDF generation
- `app/api/collections/*` — design collections API

**Rules:**
- `gold_weight_22k` is the canonical user input (the physical net weight)
- Per-karat weights are derived: `gold_weight_Xk = gold_weight_22k × 0.916 / KARAT_FACTORS[X]`
- `karat_pricing` is a JSONB cache: `{ "22": { weight, goldCost, labourCost, cogs, trade, mrp }, ... }`
- `trade_price` and `mrp_suggested` are the 22K defaults (legacy compatibility)
- When gold rate changes, call `recomputeCatalogPrices(rate24k)` — it updates all active products
- Products can be `is_active=false` (soft-hide) without deleting

---

### ...Involves Manufacturing / Karigars

**Files to touch:**
- `lib/centralStock.ts` — `issueToPartner()`, `receiveFromPartner()`, `recordPurchase()`, `recordAdjustment()`
- `lib/mfgOrderLifecycle.ts` — `applyMfgStatusChange()`, `cascadeOrderStatusToMfg()`
- `lib/floatBuckets.ts` — `getPartnerBuckets()`, `getAvailableForMaterial()`, `materialTypeForKarat()`
- `app/manufacturing/page.tsx` — partner list, float summary, active orders
- `app/manufacturing/orders/new/page.tsx` — issue manufacturing order
- `app/manufacturing/orders/[id]/page.tsx` — mfg order detail, status, float reservation
- `app/manufacturing/partners/[id]/page.tsx` — partner detail, per-karat labour rates
- `app/manufacturing/partners/[id]/float/page.tsx` — float ledger, deposit/return
- `app/api/portal/manufacturer/orders/route.ts` — manufacturer portal list
- `app/api/portal/manufacturer/orders/[id]/route.ts` — manufacturer portal update
- `app/api/manufacturing/orders/[id]/reserve-float/route.ts` — float reservation API
- `app/api/manufacturing/orders/[id]/share-link/route.ts` — 48h share link creation

**Rules:**
- Float reservation uses `mfg_reserve_float()` PostgreSQL function (atomic lock + pending consumption)
- Gold quantities in float are **24K-pure grams** (converted from gross-at-karat using `KARAT_FACTORS`)
- When mfg order status → `completed`: pending consumption flips to `final`
- When mfg order status → `cancelled`: consumption row is deleted (gold stays in float)
- When mfg order status → `returned`: consumption deleted + return transaction inserted
- Manufacturer portal sees **no pricing** (costs, labour, total_cogs are excluded from API)

---

### ...Involves Inventory / Stock

**Files to touch:**
- `lib/centralStock.ts` — all movement functions
- `app/stock/page.tsx` — dashboard, balances, diamond group cards
- `app/stock/issue/page.tsx` — issue to karigar (dual-write)
- `app/stock/receive/page.tsx` — receive from karigar
- `app/stock/movements/page.tsx` — full audit ledger
- `app/api/stock/balances/route.ts` — balance API
- `app/api/stock/movements/route.ts` — movement CRUD
- `app/api/stock/issue/route.ts` — issue API
- `app/api/stock/receive/route.ts` — receive API

**Rules:**
- Central stock balances are **computed from `stock_movements`** (no `balance` column)
- `stock_balances` view does the SUM: `SUM(CASE movement_type ... END)`
- `diamond_stock_by_group` view groups by `(material_type, diamond_shape_id, diamond_size_id)`
- Issuing to a karigar **dual-writes**: `stock_movements` (debit central) + `material_transactions` (credit float)
- The two rows are linked via `stock_movements.material_transaction_id`
- Findings stay in central stock only — karigars don't hold them on float

---

### ...Involves D2C / Consumers

**Files to touch:**
- `app/customers/page.tsx` — customer list
- `app/customers/[id]/page.tsx` — customer profile, addresses, enquiry history
- `app/enquiries/page.tsx` — enquiry inbox (kanban + list)
- `app/enquiries/[id]/page.tsx` — enquiry detail, timeline, activity feed
- `app/enquiries/new/page.tsx` — operator intake form
- `app/api/customers/route.ts` — de-dupe + create
- `app/api/customers/[id]/route.ts` — profile bundle
- `app/api/enquiries/route.ts` — create + log activity
- `app/api/enquiries/[id]/route.ts` — update + diff + log activity
- `app/api/enquiries/[id]/notes/route.ts` — append note activity
- `app/c/[token]/page.tsx` — consumer journey link (public, unauthenticated)
- `app/api/c/[token]/route.ts` — public sanitized payload
- `lib/consumerTheme.ts` — `deriveCurrentStage()`, consumer theme helpers

**Rules:**
- Customer de-dupe is by **normalized WhatsApp number first**, then email
- Enquiry number is `ENQ-00042` from Postgres sequence `customer_enquiry_number_seq`
- All status changes, assignments, follow-ups, image additions write to `customer_enquiry_activity` (append-only)
- Consumer journey link is unauthenticated, token expires in 90 days, mobile-first, uses champagne/ivory theme
- `production_updates` with `is_customer_visible=true` are exposed to consumers
- `orders.audience` or `orders.customer_id` determines if it's D2C

---

### ...Involves Marketing / Landing Page

**Files to touch:**
- `app/LandingPage.tsx` — outcome-first variant (live)
- `app/LandingPageOriginal.tsx` — original variant (fallback)
- `app/page.tsx` — server-side variant selection + redirect
- `app/LeadForm.tsx` — lead capture form (used by both variants)
- `app/partner-signup/page.tsx` — full-page signup form
- `lib/landingCopy.ts` — ALL copy, value props, sections, testimonials, founder, partner logos
- `lib/landingVariant.ts` — A/B cookie constants, variant selection logic
- `app/api/public/partner-signup/route.ts` — public signup API (rate-limited, honeypot)
- `lib/leadNotify.ts` — email + WhatsApp notification on new lead
- `app/opengraph-image.tsx` — dynamic OG image
- `middleware.ts` — A/B cookie assignment

**Rules:**
- A/B test is controlled by `lp_variant` cookie (50/50), set in `middleware.ts`
- Kill switch: `LANDING_VARIANT_OVERRIDE` env var forces all visitors to one variant
- `partner_signups` table stores UTM params, referrer, IP hash, landing variant, per-channel notify status
- Copy lives ONLY in `lib/landingCopy.ts` — never hardcode in JSX
- Meta Pixel + GA4 are optional (enabled by `NEXT_PUBLIC_META_PIXEL_ID` and `NEXT_PUBLIC_GA_ID`)
- Testimonials, founder photo, partner logos are intentionally empty — add real ones via `lib/landingCopy.ts` after collecting consent

---

### ...Involves Notifications (WhatsApp / Email)

**Files to touch:**
- `lib/whatsappNotify.ts` — all retailer + internal WhatsApp notifications
- `lib/leadNotify.ts` — lead notification (email + WhatsApp)
- `lib/quoteShareNotify.ts` — quote share notification
- `lib/karigarShareNotify.ts` — manufacturing order share notification
- `lib/cadPartnerShareNotify.ts` — CAD partner share notification
- `lib/readyToShipNotify.ts` — ready-to-ship offer notification
- `app/api/whatsapp/inbound/route.ts` — inbound WhatsApp webhook (reply parsing)
- `app/api/cron/reconciliation-digest/route.ts` — scheduled digest email

**Rules:**
- WhatsApp webhook URL + token are stored in `settings` table (`whatsapp_webhook_url`, `whatsapp_webhook_token`)
- Notifications are **fire-and-forget** — they never block the main operation
- Retailer notifications respect `partners.notify_whatsapp` (opt-out)
- Internal notifications go to `settings.whatsapp_number` (comma-separated for multiple recipients)
- Email uses Resend API (`RESEND_API_KEY` env var)
- Cron endpoints must self-auth with `Bearer ${CRON_SECRET}` header

---

### ...Involves Analytics / Reporting

**Files to touch:**
- `app/analytics/page.tsx` — revenue charts, conversion funnel, top partners, model split
- `app/profitability/page.tsx` — COGS / margin dashboard (master-only or `profitability` permission)
- `app/api/db/route.ts` — queries via `order_pipeline` view, `partner_summary` view
- `app/api/cron/reconciliation-digest/route.ts` — scheduled reconciliation report

**Rules:**
- `order_pipeline` view joins `orders` + `partners` + `products` for rich reporting
- `partner_summary` view aggregates orders, revenue, visits per partner
- `profitability` page requires `master` role or `profitability` module permission
- Gold reconciliation alerts are master-only (`manufacturing/reconciliation-alerts`)
- No real-time analytics pipeline — all reports are query-on-demand from PostgreSQL views

---

## Quick API Route Pattern

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

For portal routes:

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

---

## Quick Database Migration Pattern

When adding a new table or column:

1. Write SQL in `scripts/migrate_taskNN_descriptive_name.sql`
2. Make it **idempotent** (use `CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`)
3. Add RLS policy: `service_role_all` for tables accessed via server APIs
4. Update `ALLOWED_TABLES` in `app/api/db/route.ts` if admin clients need it
5. Add type definition in `lib/supabase.ts` if admin UI uses it
6. Add module permission in `lib/modules.ts` if sub users need access

---

*End of Decision Cheat Sheet*
