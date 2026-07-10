# Shewah B2B — Living Architecture Knowledge Base v2.0

> **Version:** 2.0 | **Date:** 2025-06-17 | **Purpose:** Comprehensive architectural decision support for future feature building

---

## How to Use This Doc

Before building any new feature, check these three things:

1. **Which user roles touch this?** (master, sub, manufacturer, retailer, anonymous)
2. **Which data entities does it need?** (orders, products, partners, manufacturing_orders, quotes, etc.)
3. **Which existing system rule will interact with it?** (gold-rate locking, float ledger, COGS snapshots, WhatsApp webhooks, karat pricing)

This prevents you from building features that conflict with existing business logic.

---

## 1. SYSTEM OVERVIEW & ARCHITECTURE

### 1.1 Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Framework | Next.js 14 (App Router) | Server Components by default, `'use client'` for interactivity |
| Language | TypeScript | Strict mode |
| Styling | Tailwind CSS | Custom brand color: `#1E3A5F` (navy blue) |
| Database | PostgreSQL (Supabase) | 35+ tables, views, triggers, functions |
| Auth | NextAuth.js (Credentials) | JWT strategy, 30-day expiry, custom session shape |
| ORM/Client | `@supabase/supabase-js` | Two clients: `supabase` (anon, RLS) + `supabaseAdmin` (service_role) |
| PDF | `pdfkit` | Server-side PDF generation for quotes, catalog, manufacturing briefs |
| Notifications | WhatsApp webhook + Resend email | Settings-driven, never throws |
| State | No global state manager | Each page loads its own data via `useEffect` + `fetch`/`supabase` |
| Icons | `lucide-react` | All UI icons |

### 1.2 Deployment

- Runs on **port 5000** in dev (`next dev -p 5000 -H 0.0.0.0`)
- Static export not used (`output: 'export'` is commented out in `next.config.js`)
- Image optimization disabled (`unoptimized: true`) — required for static export but currently active even in server mode

### 1.3 The Three-App Architecture

The codebase contains **three distinct applications** sharing one Next.js instance:

```
┌─────────────────────────────────────────────────────────┐
│                     NEXT.JS APP                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │   ADMIN     │  │  RETAILER   │  │  MANUFACTURER   │  │
│  │   /, /dash  │  │  /portal/   │  │  /portal/       │  │
│  │   /orders   │  │  retailer/* │  │  manufacturer/* │  │
│  │   /catalog  │  │             │  │                 │  │
│  │   /quotes   │  │             │  │                 │  │
│  │   /manufac  │  │             │  │                 │  │
│  └─────────────┘  └─────────────┘  └─────────────────┘  │
│         │                │                  │             │
│         ▼                ▼                  ▼             │
│  master/sub role    retailer role      manufacturer role │
│  AppShell layout    Isolated layout    Isolated layout   │
│  Full module access Module-restricted  Orders only       │
└─────────────────────────────────────────────────────────┘
```

**Critical rule:** Middleware sandboxes each role to their allowed routes. Any attempt to cross portals results in 403.

---

## 2. AUTH & SESSION ARCHITECTURE

### 2.1 Session Shape (NextAuth JWT)

The JWT token contains these fields (set in `lib/auth.ts`):

```typescript
interface SessionUser {
  id: string          // app_users.id
  username: string
  displayName: string
  role: 'master' | 'sub' | 'retailer' | 'manufacturer'
  permissions: string[]  // module names for sub users
  manufacturingPartnerId?: string  // for manufacturer role
  partnerId?: string                 // for retailer role
}
```

### 2.2 Role Permissions

| Role | Database Table | How Created |
|------|---------------|-------------|
| `master` | `app_users` | Setup page (`/setup`) — first user is always master |
| `sub` | `app_users` | Master creates via admin UI; has subset of `permissions` |
| `retailer` | `app_users` + `partners` | Admin creates partner account; `partnerId` links to `partners` row |
| `manufacturer` | `app_users` + `manufacturing_partners` | Admin creates; `manufacturingPartnerId` links to `manufacturing_partners` row |

### 2.3 Middleware Behavior (`middleware.ts`)

```
1. Public paths (matcher excluded): /api/auth, /api/setup, /api/public, /api/showcase, /api/track, /api/cron, /api/whatsapp, /api/m/, /api/cad-share/, /api/c/, /api/quotes/share/, /api/quotes/test-compute
2. Logged-in user on /login → redirect to dashboardForRole(role)
3. Manufacturer on non-/portal/manufacturer/* → 403
4. Retailer on non-/portal/retailer/* → 403
5. Everyone else → allow (master/sub can go anywhere)
```

### 2.4 Sub-User Permission System (`lib/modules.ts`)

Sub users have a `permissions` array. The module registry defines which routes each permission unlocks:

```typescript
const MODULE_PERMISSIONS: Record<string, string[]> = {
  dashboard:    ['/dashboard'],
  partners:     ['/partners', '/partners/*'],
  orders:       ['/orders', '/orders/*'],
  cad_requests: ['/cad-requests', '/cad-requests/*'],
  manufacturing: ['/manufacturing', '/manufacturing/*'],
  catalog:      ['/catalog', '/catalog/*'],
  gold_rates:   ['/gold-rates'],
  vendors:      ['/vendors'],
  circuits:     ['/circuits', '/circuits/*'],
  analytics:    ['/analytics'],
  settings:     ['/settings'],
  profitability: ['/profitability'],
  stock:        ['/stock', '/stock/*'],
  customers:    ['/customers', '/customers/*'],
  enquiries:    ['/enquiries', '/enquiries/*'],
  quotes:       ['/quotes', '/quotes/*'],
  ready_to_ship: ['/ready-to-ship'],
}
```

Master users bypass all permission checks. Sub users are blocked from `app_users`, `material_float`, `material_transactions`, `reconciliation_alerts`, `stock_movements` via the `/api/db` proxy.

---

## 3. THE GOLD / KARAT MATHEMATICS (Immutable Rules)

These are the **most important business rules** in the entire system. Do not break them.

### 3.1 Karat Purity Factors (Single Source of Truth)

Stored in `lib/karat.ts`:

```typescript
const KARAT_FACTORS: Record<number, number> = {
  24: 1.000,
  22: 0.916,
  18: 0.750,
  14: 0.600,
  10: 0.420,
   9: 0.380,
}
```

**Rule:** All gold inventory is held as **24K-pure net weight** (`gold_24k` in `material_float` / `stock_movements`). Karat is only a **labour-rate lens** at the catalog/order edges. This is Task #78.

### 3.2 Pricing Formula (Immutable)

```
netGoldWeight = user-entered gross weight (stored as gold_weight_22k)
pureMassForKarat(k) = netGoldWeight × KARAT_FACTORS[k]
goldCost(k) = pureMassForKarat(k) × rate24k
labourCost(k) = retailLabourRate(k) × max(netGoldWeight, 1g)
cogs(k) = goldCost(k) + labourCost(k) + diamondCost + making_charges + igiCost
tradePrice(k) = round(cogs(k) × 1.28)   // 28% margin multiplier
mrp(k) = round(tradePrice(k) × 1.40)    // 40% retail markup
```

**Default karat is 22K** for `trade_price` and `mrp_suggested` (legacy compatibility).

### 3.3 Order Rate Locking (CRITICAL)

**Every order stores its own `gold_rate_at_order` snapshot at creation time.** The trade price is locked. Editing an order later never re-prices it. This is a guarantee to retailers.

- Admin: `app/orders/new/page.tsx` captures current gold rate from `gold_rates` table
- Retailer portal: `app/api/portal/retailer/orders/route.ts` captures current gold rate
- Catalog: `recomputeCatalogPrices()` only touches `products` table, never `orders`

**Do NOT** build a feature that re-prices existing orders automatically.

### 3.4 COGS Calculation (Task #68 + #78)

```
gold_cost = gold_weight_actual × gold_rate_at_order × KARAT_FACTORS[gold_karat]
labour_cost = labour_per_gram × max(gross_weight, min_labour_grams)
total_cogs = gold_cost + labour_cost + cad_cost + stone_cost
margin = total_amount - total_cogs
```

Labour rate comes from the assigned manufacturing partner's per-karat rate (`labour_rate_22k`, `labour_rate_18k`, etc.). If no partner, falls back to `making_charges`.

**COGS lives in the `orders` row** and is calculated on-demand or when the admin saves actual manufacturing data.

### 3.5 Per-Karat Pricing Cache (`products.karat_pricing`)

The `products` table has a `karat_pricing` JSONB column that stores pre-computed prices for all sellable karats:

```json
{
  "22": { "weight": 2.18, "goldCost": 12345, "labourCost": 2180, "cogs": 15625, "trade": 20000, "mrp": 28000 },
  "18": { "weight": 2.664, "goldCost": 15098, "labourCost": 2664, "cogs": 19012, "trade": 24335, "mrp": 34069 },
  ...
}
```

When gold rate changes, `recomputeCatalogPrices()` in `lib/supabase.ts` updates this cache for all active products.

---

## 4. COMPLETE DATABASE ENTITY MAP

### 4.1 Core Business Entities

```
partners (retailers/jewelers)
├── orders
├── visits
├── cad_requests
├── design_interests
├── customer_enquiries (D2C)
└── customers (D2C)

products (catalog items)
├── design_collection_products (junction)
├── orders (FK: product_id, nullable for custom orders)
├── ready_to_ship_items
└── karat_pricing (JSONB cache per karat)

gold_rates (one row per day, source: manual/api)
└── triggers recomputeCatalogPrices() on save

orders (customer orders)
├── manufacturing_orders (1:N, nullable)
├── cad_requests (1:1, nullable)
├── order_change_requests
├── order_payments (Task #69)
├── production_updates
├── customer_journey_links
└── quotes (via convert-to-order flow)

manufacturing_partners (karigars)
├── manufacturing_orders
├── material_float (one per material type)
└── material_transactions
```

### 4.2 Inventory / Ledger System

```
stock_movements (central HQ inventory)
├── material_type: gold_24k | diamond_lgd | diamond_natural | finding
├── movement_type: purchase | issue | return_in | adjustment_in | adjustment_out
├── manufacturing_partner_id (for dual-write to float)
└── material_transaction_id (links to float ledger)

material_float (per-karigar custody — pre-computed balance columns)
├── material_type: gold_14k|gold_18k|gold_22k|diamond_* (legacy! Task #78 migrates to 24k-only)
├── total_deposited, total_returned, total_consumed, balance (stored columns)
└── unique (manufacturing_partner_id, material_type)

material_transactions (the ledger — single source of truth)
├── transaction_type: deposit | consumption | return | adjustment
├── lifecycle: pending | final
├── quantity (in 24K-pure grams for gold, carats for diamond)
└── creates_negative_balance (computed by trigger)
```

**Important:** The `material_float` table has stored balance columns (`total_deposited`, `total_returned`, `total_consumed`, `balance`) but these are **legacy**. Task #78 moved to computing balances from `material_transactions`. The `mfg_reserve_float()` PostgreSQL function computes available balance from the transaction ledger, not the stored columns.

### 4.3 D2C / Consumer Entities

```
customers (walk-in consumers)
├── customer_addresses
├── customer_enquiries
└── orders (via customer_id)

customer_enquiries
├── enquiry_number (ENQ-00042 from Postgres sequence)
├── customer_enquiry_activity (append-only timeline)
├── order_id (linked after conversion)
└── status: new | in_discussion | quoted | approved
```

### 4.4 Quotation System

```
quotes
├── quote_items (line items)
├── quote_share_links (public tokenized links, 60-day expiry)
└── partner_id (nullable for walk-in/D2C)

quote_items
├── diamonds (JSONB array of DiamondSpec)
├── karat, gross_gold_weight_g, net_24kt_weight_g
├── labour_rate_per_g, labour_total
├── line_cogs, line_trade, line_total
```

### 4.5 Marketing / Landing Page Entities

```
partner_signups (lead capture from landing page)
├── full_name, store_name, city, phone, whatsapp, email, gst_number
├── monthly_volume, note
├── utm_source, utm_medium, utm_campaign, utm_content, utm_term
├── referrer, landing_path, landing_variant, user_agent, ip_hash
├── status: new | contacted | qualified | converted
├── email_dispatch, whatsapp_dispatch (notification outcomes)

design_collections (showcase collections)
├── name, description, circuit_target, is_published
└── design_collection_products (junction)

design_interests (partner shortlists from showcase)
├── partner_id, product_id, collection_id, note, quantity_hint

showcase_views (collection view tracking)
├── collection_id, partner_id, user_agent
```

### 4.6 Settings-Driven Configuration

The `settings` table stores **all** runtime configuration:

| Key | Purpose |
|-----|---------|
| `business_name`, `owner_name` | Brand identity |
| `whatsapp_number` | Internal notification target |
| `whatsapp_notifications_enabled` | Master toggle for WhatsApp |
| `whatsapp_webhook_url`, `whatsapp_webhook_token` | WhatsApp gateway integration |
| `public_base_url` | URL for share links |
| `landing_whatsapp_e164` | Landing page floating button |
| `lead_notify_email_enabled`, `lead_notify_whatsapp_enabled` | Lead notification toggles |
| `lead_notify_email_to`, `lead_notify_whatsapp_to` | Lead notification targets |
| `reconciliation_alert_email_to`, `reconciliation_alert_email_from` | Reconciliation digest |
| `reconciliation_alert_window_days`, `reconciliation_alert_variance_g`, `reconciliation_alert_negative_count`, `reconciliation_alert_unlinked_count` | Reconciliation thresholds |
| `default_igi_cost`, `default_making_charges` | Default pricing values |
| `gold_markup_*`, `trade_margin_target`, `mrp_markup_target` | Legacy pricing defaults |
| `surat_address` | Business address |
| `whatsapp_inbound_token` | Inbound webhook auth |

---

## 5. DATA FLOW MAPS

### 5.1 Order Creation Flows

**Admin creates order:**
```
app/orders/new/page.tsx
  → Fetches latest gold rate from gold_rates
  → User fills form (partner, product/custom, quantity, karat, etc.)
  → Computes trade_price from catalog or manual entry
  → POST /api/db → orders table
    → gold_rate_at_order captured
    → total_amount = trade_price × quantity
    → balance_due = total_amount - advance_paid
```

**Retailer places order via portal:**
```
app/portal/retailer/catalog
  → Browses products with per-karat pricing
  → Selects product + karat
  → POST /api/portal/retailer/orders
    → Validates product_id, is_active
    → Captures gold_rate_at_order, selected_karat, retail_labour_at_order
    → Locks trade_price from product.karat_pricing[selected_karat]
    → Creates order row with status='brief_received'
```

**Quote converts to order:**
```
app/quotes/[id]/page.tsx
  → POST /api/quotes/[id]/convert-to-order
    → Returns pre-filled payloads for each quote item
    → Stores in sessionStorage
    → Redirects to /orders/new?source=quote
  → Admin reviews prefill, may edit
  → POST /api/db → orders table
  → PATCH /api/quotes/[id]/convert-to-order
    → Sets quote.status = 'converted_to_order'
    → Sets quote.converted_order_id = order.id
```

### 5.2 Manufacturing Assignment Flow

```
Admin: app/orders/[id]/page.tsx
  → Issue manufacturing order
  → POST /api/db → manufacturing_orders
    → Optionally: calls mfg_reserve_float() (PostgreSQL function)
    → If material_from_float=true: inserts pending consumption transaction
    → Creates mfg_share_link (48h expiring link for karigar)

Manufacturer: /portal/manufacturer/orders/[id]
  → GET /api/portal/manufacturer/orders
  → Updates status (completed triggers float finalization)
  → Status change cascade: applyMfgStatusChange() in lib/mfgOrderLifecycle.ts

Float finalization on completed:
  → pending consumption → final consumption
  → quantity updated to actual gold_weight_actual × KARAT_FACTORS[karat]
```

### 5.3 Gold Rate Change Cascade

```
Admin saves gold rate: app/gold-rates/page.tsx
  → POST /api/db → gold_rates
  → Triggers recomputeCatalogPrices() in lib/supabase.ts
    → Fetches all active products
    → For each product: computes per-karat pricing
    → Updates products.karat_pricing, trade_price, mrp_suggested, priced_at_rate, priced_at
  → Does NOT touch orders table
```

### 5.4 Lead Capture Flow

```
Visitor on /
  → Middleware sets lp_variant cookie (50/50 A/B test)
  → Renders LandingPage or LandingPageOriginal
  → Fills LeadForm
  → POST /api/public/partner-signup
    → Rate-limited (5/min, 30/hour per IP)
    → Honeypot field (website) — bots filtered silently
    → Phone validation: strict India 10-digit
    → UTM attribution from cookie or body
    → Inserts into partner_signups
    → notifyNewPartnerLead() → email (Resend) + WhatsApp (Meta API)
    → Updates partner_signups with dispatch outcomes
```

### 5.5 Quote Share Flow

```
Admin: app/quotes/[id]/page.tsx
  → Clicks "Send Quote"
  → POST /api/quotes/[id]/send
    → Generates crypto.randomBytes(16).toString('hex') token
    → Calculates expiry: min(60 days from now, valid_until + 30 days)
    → Inserts quote_share_links
    → Updates quote.status = 'sent', quote.share_token, quote.shared_at
    → sendQuoteShareLink() → WhatsApp webhook or wa.me link
  → Retailer receives link: /q/[token]
  → Clicks Accept or Request Revision
    → Accept: POST /api/quotes/[id]/accept → notifies internal team
    → Revision: POST /api/quotes/[id]/revision → notifies internal team
```

### 5.6 Customer Journey Flow (D2C)

```
Admin creates customer + enquiry
  → app/customers/new/page.tsx → POST /api/customers
  → app/enquiries/new/page.tsx → POST /api/enquiries
    → enquiry_number from sequence: ENQ-00042
    → activity logged in customer_enquiry_activity (append-only)

Admin converts enquiry to order
  → order gets customer_id, audience='consumer'
  → Admin creates customer_journey_link
    → POST /api/customer-journey-links
    → 90-day expiry token
  → Customer opens /c/[token]
    → GET /api/c/[token] → public, no auth
    → Stamped visit count
    → Returns: customer first name, order status, production updates, CAD images
    → Consumer theme: champagne/ivory, Cormorant Garamond serif
```

---

## 6. API ROUTE ARCHITECTURE

### 6.1 Admin API Proxy (`/api/db`)

All admin DB operations go through `/api/db`. It is a generic CRUD proxy:

```
POST /api/db
body: { table, op, values, filters, select, order, limit, range, single, count }
```

**Allowed tables:** `partners`, `visits`, `orders`, `products`, `gold_rates`, `circuits`, `manufacturing_partners`, `manufacturing_orders`, `design_collections`, `material_float`, `material_transactions`, `stock_movements`, `quotes`, `quote_items`, `customers`, `customer_enquiries`, `production_updates`, `customer_journey_links`, `ready_to_ship_items`, `ready_to_ship_offers`, `partner_signups`, `cad_requests`, `cad_revisions`, `cad_partner_share_links`, `cad_partner_responses`, `mfg_share_links`, `settings`, `reconciliation_alerts`, `app_users` (master only), `customer_addresses` (master only), `customer_enquiry_activity` (master only), `order_change_requests` (master only), `order_payments` (master only), `diamond_shapes` (master only), `diamond_sizes` (master only), `diamond_quality_grades` (master only), `diamond_color_grades` (master only), `metal_weights` (master only).

**Master-only tables:** `app_users`, `material_float`, `material_transactions`, `reconciliation_alerts`, `stock_movements` (sub users get 403).

**Security:** Only `master` and `sub` roles can use this. Manufacturers and retailers must use their dedicated `/api/portal/*` routes.

**Critical vulnerability:** The `/api/db` proxy accepts arbitrary `filters` arrays and passes them directly to Supabase. There is no input validation, CSRF protection, or rate limiting. A malicious page could craft requests to exfiltrate data or modify records.

### 6.2 Portal API Routes

```
/api/portal/retailer/orders       → GET (own orders), POST (new order)
/api/portal/retailer/orders/[id]  → GET (own order detail), PATCH (change request)
/api/portal/retailer/catalog      → GET (browse products, excludes cost fields)
/api/portal/retailer/quote-preview → POST (price preview for karat selection)
/api/portal/retailer/profile      → GET (own profile), PATCH (update safe fields + password change)
/api/portal/retailer/ready-to-ship → GET (available items + my offers), POST (make offer)

/api/portal/manufacturer/orders       → GET (assigned orders, no cost fields)
/api/portal/manufacturer/orders/[id] → GET (order detail), PATCH (update status, notes, images)
```

### 6.3 Public/Unauthenticated Routes

```
/api/public/partner-signup    → POST (lead capture, rate-limited, honeypot, phone validation)
/api/c/[token]                → GET (customer journey link, consumer skin)
/api/q/[token]                → GET (quote share link, client view)
/api/cad-share/[token]        → GET (CAD partner review link)
/api/showcase/track           → POST (collection view tracking)
/api/showcase/interests       → POST (design interest from showcase)
/api/m/[token]                → GET (manufacturing order asset pack, 48h expiry)
```

### 6.4 Internal/Service Routes

```
/api/db                        → Generic CRUD proxy (admin only)
/api/setup                     → GET (check if setup needed), POST (create master user)
/api/auth/...                  → NextAuth.js endpoints
/api/quotes                    → GET (list), POST (create)
/api/quotes/[id]/send          → POST (generate share link + WhatsApp)
/api/quotes/[id]/convert-to-order → POST (get prefill), PATCH (link order)
/api/quotes/[id]/accept        → POST (retailer accepts quote)
/api/quotes/[id]/revision     → POST (retailer requests revision)
/api/catalog/pdf              → GET (generate catalog PDF, showPrice param)
/api/manufacturing/orders/[id]/reserve-float → POST (atomic float reservation)
/api/manufacturing/orders/[id]/share-link    → GET, POST, DELETE (48h links)
/api/stock/balances            → GET (central stock balances)
/api/stock/movements           → GET, POST (stock movement CRUD)
/api/stock/issue               → POST (issue to karigar, dual-write)
/api/stock/receive             → POST (receive from karigar)
/api/diamonds/stock            → GET (diamond group balances)
/api/cron/reconciliation-digest → GET/POST (scheduled digest, self-auth)
/api/whatsapp/inbound          → GET/POST (webhook verification + ACK parsing)
/api/customers                 → POST (create with de-dupe)
/api/customers/[id]            → GET (profile bundle)
/api/enquiries                 → POST (create + log activity)
/api/enquiries/[id]            → GET/PATCH (update + diff + log activity)
/api/enquiries/[id]/notes      → POST (append note activity)
/api/customer-journey-links    → POST (create link)
/api/ready-to-ship/offers      → POST (admin counter/accept/reject)
/api/collections/[id]/views    → GET (collection view stats)
/api/collections/[id]/products → GET (collection products for showcase)
/api/collections/[id]/interest → POST (record interest)
/api/cad-requests/[id]/share   → POST (create CAD partner share link)
/api/cad-requests/[id]/revisions → POST (add revision)
/api/cad-share/[token]         → GET (public CAD brief), POST (submit response)
/api/cad-partner/[token]       → GET (public CAD review page data)
```

---

## 7. STATE MANAGEMENT PATTERNS

### 7.1 Server-Side State

- **No global state manager** (no Redux, no Zustand, no React Context for data). Each page loads its own data.
- Client components use `useEffect` + `useState` to fetch data via `fetch()` or the `supabase` QueryBuilder proxy.
- Dashboards poll every 60 seconds (`setInterval` in `useEffect`).

### 7.2 Session / Auth

- NextAuth.js with JWT strategy (30-day expiry)
- Token contains: `id`, `username`, `displayName`, `role`, `permissions`, `manufacturingPartnerId`, `partnerId`
- Middleware reads the token and enforces role-based routing
- Portal layouts (`portal/retailer/layout.tsx`, `portal/manufacturer/layout.tsx`) are isolated — they don't use AppShell.

### 7.3 Data Sharing Between Pages

- **sessionStorage** for cross-page prefill (e.g., quote-to-order conversion)
- **URL query params** for filter state (e.g., `/catalog?tab=products`)
- **No global context** beyond NextAuth SessionProvider

---

## 8. CRITICAL FILES & THEIR RESPONSIBILITIES

| File | What it owns | Don't touch without knowing |
|------|-------------|---------------------------|
| `lib/karat.ts` | All karat purity math, `KARAT_FACTORS`, `computeKaratPricing()`, `deriveAllKaratWeights()`, `pure24kt()`, `pureGoldMass()`, `getMetalWeight()` | Breaks pricing everywhere. |
| `lib/supabase.ts` | QueryBuilder proxy, all TypeScript types, `recomputeCatalogPrices()`, `computeOrderCogs()`, `ORDER_STATUSES`, `AppUser`, `Product`, `Order`, `Quote` types | Client-side DB contract for entire app. |
| `lib/supabaseAdmin.ts` | Service role client for server-side APIs | Must never leak to client bundle. |
| `lib/quoteCompute.ts` | Quote item calculation, `computeQuoteItem()`, `computeQuoteTotals()`, GST logic | Quote pricing engine. |
| `lib/quotePdf.ts` | `renderQuotePdf()` — generates PDF with branding, item cards, breakup tables, totals, signature, page numbers | Quote PDF output. |
| `lib/catalogPdf.ts` | `renderCatalogPdf()` — A4 grid layout, 4 items per page, image placeholders, clickable links | Catalog PDF output. |
| `lib/quoteNumber.ts` | `nextQuoteNumber()` — sequential quote number generation (Q-YYMMDD-NNN) | Quote numbering. |
| `lib/quoteDefaults.ts` | Default margin (28%), GST rate (3%), validity (30 days), terms text | Quote defaults. |
| `lib/quoteShareNotify.ts` | `sendQuoteShareLink()`, `notifyInternalQuoteResponse()` — WhatsApp + email dispatch for quote sharing | Quote notifications. |
| `lib/karigarShareNotify.ts` | `sendKarigarPackLink()` — WhatsApp dispatch for manufacturing order links | Karigar notifications. |
| `lib/leadNotify.ts` | `notifyNewPartnerLead()` — email (Resend) + WhatsApp (Meta API) for new leads | Lead notifications. |
| `lib/readyToShipNotify.ts` | `notifyRetailerOfferDecision()` — WhatsApp for RTS offer decisions | RTS notifications. |
| `lib/whatsappNotify.ts` | Inbound webhook handler for `ACK <order#>` CAD revision acknowledgment | WhatsApp inbound processing. |
| `lib/mfgOrderLifecycle.ts` | `applyMfgStatusChange()`, `cascadeOrderStatusToMfg()` — float side-effects of mfg status changes | Material ledger integrity. |
| `lib/centralStock.ts` | `issueToPartner()`, `receiveFromPartner()`, `recordPurchase()`, `recordAdjustment()` — dual-write to stock + float | Inventory accuracy. |
| `lib/floatBuckets.ts` | `getPartnerBuckets()`, `getAvailableForMaterial()`, `materialTypeForKarat()` — float balance computation | Karigar balance display. |
| `lib/pdfHelpers.ts` | `fetchImage()`, `isAllowedAssetUrl()`, `fmtDate()`, `safeName()` — shared PDF utilities | Image fetching security. |
| `lib/sanitizeDbError.ts` | `sanitizeDbError()`, `safeDbError()` — strips schema leaks from DB errors for public API responses | Security layer. |
| `lib/consumerTheme.ts` | `consumerTheme` tokens, `JOURNEY_STAGES`, `deriveCurrentStage()` — consumer-facing design system | Customer journey UI. |
| `lib/landingCopy.ts` | ALL landing page copy: `BRAND`, `HERO`, `STATS`, `VALUE_PROPS`, `HOW_IT_WORKS`, `FAQ`, `TESTIMONIALS`, `SEO` | Marketing copy. |
| `lib/landingVariant.ts` | A/B test constants, cookie management, kill-switch logic | Landing page A/B testing. |
| `lib/modules.ts` | `MODULE_PERMISSIONS` registry — defines which routes each sub-user permission unlocks | Sub-user access control. |
| `lib/auth.ts` | NextAuth configuration, session shape, bcrypt password hashing, `authorize()` credentials logic | Auth system. |
| `middleware.ts` | Route access control, A/B cookie assignment, landing variant header injection, role-based redirects | Portal security. |
| `app/api/db/route.ts` | Generic CRUD proxy for admin tables — table allowlist, master-only gates, `safeDbError` | Admin data access. |
| `app/api/setup/route.ts` | First-time setup — creates master user with full permissions | Initial provisioning. |

---

## 9. SECURITY ARCHITECTURE

### 9.1 What Protects What

| Layer | Mechanism |
|-------|-----------|
| Route access | `middleware.ts` + NextAuth token |
| API access | `getServerSession` in each route handler |
| Portal data scope | Filters by `partnerId` or `manufacturingPartnerId` in every query |
| DB row access | Supabase RLS (service_role for admin APIs, auth check for portals) |
| Public endpoints | Rate limiting (in-memory token bucket), honeypot fields, IP hashing, phone validation |
| Error sanitization | `sanitizeDbError.ts` strips schema leaks before returning to public callers |

### 9.2 Known Security Gaps

1. **No CSRF protection** on `/api/db` — the proxy blindly accepts any POST from an authenticated session. A malicious page could craft requests.
2. **No rate limiting** on `/api/db` — a sub user could flood the proxy.
3. **No input validation** on the generic `/api/db` proxy — it accepts arbitrary `filters` arrays and passes them to Supabase. Malicious `or` filters could potentially exfiltrate data.
4. **No audit log** for who changed what — no `created_by`, `updated_by` on most tables (except `stock_movements` and `customer_enquiry_activity`).
5. **No API versioning** — adding a breaking change to `/api/db` breaks all clients simultaneously.
6. **Image URL validation** in `pdfHelpers.ts` only allows `.cloudinary.com`, `.supabase.co`, `.supabase.in` — but this is not enforced on all image inputs throughout the app.
7. **Sub-user permissions are client-side** — the middleware checks `role` but the `/api/db` proxy only checks `master` vs `sub`; it doesn't validate individual `permissions` against the requested table. A sub user with `orders` permission could theoretically access `products` via the proxy if they crafted the request.

---

## 10. THE MOST IMPORTANT COORDINATION GAPS

### 10.1 Quote → Order Conversion Is Fragile

The quote-to-order flow uses `sessionStorage` to pass data between pages. If the user refreshes the order page, the prefill is lost. The PATCH endpoint does set `quote.converted_order_id` and `quote.status = 'converted_to_order'`, but there is no database-level constraint ensuring the order actually exists.

**If you build:** Better quote-to-order flow, you need to add `quote_id` to the `orders` table and make the conversion atomic (transaction wrap).

### 10.2 D2C and B2B Orders Are Mixed in One Table

`orders` serves both retailer orders (B2B) and consumer orders (D2C). The `type` column is `'catalog'` or `'custom'` — not `'b2b'` or `'d2c'`. D2C is inferred by `customer_id` being set or `audience` column. This is a semantic ambiguity that causes bugs when querying "all retailer orders" or "all consumer orders."

**If you build:** D2C-specific features, always check `customer_id` or `audience` to avoid showing consumer data to retailers and vice versa.

### 10.3 Manufacturing Orders Have No Link Back to Customer Orders for Partial Shipments

A customer order can have multiple manufacturing orders, but there's no concept of "which manufacturing order fulfilled which portion of the customer order." This makes partial delivery, multi-item orders, and split shipments impossible to track accurately.

**If you build:** Partial delivery, split order, or multi-item order tracking, you need a `fulfillment_items` junction table linking `orders` ↔ `manufacturing_orders` with quantity mapping.

### 10.4 Stock Movements and Material Float Are Dual-Written but Not Atomic

`issueToPartner()` in `lib/centralStock.ts` writes a `material_transactions` row first, then a `stock_movements` row. If the second write fails, it tries to delete the first. But there's no database-level atomicity (no 2PC). Under a crash or network failure, the two ledgers can diverge.

**If you build:** More sophisticated inventory operations, you need a transaction wrapper or a queue-based reconciliation job.

### 10.5 There's No Audit Trail for Order Changes

The `orders` table has `updated_at` but no `updated_by` and no change history. The `order_change_requests` table captures retailer-initiated changes, but admin edits are invisible. There's no way to answer "who changed this price and when?"

**If you build:** Audit trails, compliance features, or "who changed this price" queries, you need an `order_history` table or use a PostgreSQL trigger + audit table.

### 10.6 Payments Are Not Integrated

`order_payments` exists as a simple ledger (date, amount, method, reference), but there's no:
- Integration with Razorpay, UPI, or any payment gateway
- Automatic reconciliation of payment status
- Payment link generation for customers
- Payment status on the retailer portal
- Balance due auto-calculation on payment receipt

**If you build:** Payment integration, the existing `order_payments` table is a good starting point but you'll need a payment gateway webhook handler and a status machine (`pending`, `confirmed`, `failed`, `refunded`).

### 10.7 No Inventory Reservation for Orders

When an order is placed, nothing is reserved from stock or float. The manufacturing order is issued manually later. There's no "check if we have enough gold to fulfill this order" logic. This means you can accept orders that you cannot manufacture.

**If you build:** Inventory-aware order validation, you need to compute `required_gold = sum(orders.gold_weight_estimated × KARAT_FACTORS[gold_karat])` against `stock_balances` and `material_float.available`.

### 10.8 Ready-to-Ship Items Have No Atomic Reservation Logic

`ready_to_ship_items` tracks items with status (`available`, `reserved`, `sold`, `withdrawn`), but there's no atomic reservation mechanism. A retailer could theoretically claim the same item twice if requests arrive simultaneously. The `ready_to_ship_offers` table tracks offers, but the item status update and offer creation are not in a transaction.

**If you build:** E-commerce-style ready-to-ship purchasing, you need a `reserved_until` timestamp and a lock mechanism (e.g., `SELECT FOR UPDATE` on the item row).

### 10.9 No Multi-User Coordination for CAD Reviews

CAD revisions use `cad_revisions` table, but there's no assignment of who is the CAD designer, no work queue, and no "CAD designer X is working on this" locking. Multiple designers could overwrite each other's work or duplicate effort.

**If you build:** CAD team workflow, you need a `cad_assignments` table or a `assigned_to` field on `cad_requests` indicating who is currently assigned.

### 10.10 No Commission or Partner Revenue Sharing

The system tracks `margin` per order (selling price - COGS), but there's no concept of:
- Sales rep commissions
- Retailer volume discounts or tiered pricing
- Partner loyalty programs or credits
- Profit sharing with manufacturing partners
- Sales team performance tracking

**If you build:** Incentive systems, you'll need to add commission tables, discount tiers, or partner credit ledgers.

### 10.11 No Reconciliation Between Float Ledger and Stored Float Balance

The `material_float` table has stored columns (`total_deposited`, `total_returned`, `total_consumed`, `balance`) that are **not automatically kept in sync** with `material_transactions`. The `mfg_reserve_float()` function computes from the transaction ledger, but old code might still read the stored columns. This creates data drift.

**If you build:** Float reporting, always compute from `material_transactions`, not from `material_float.balance`.

### 10.12 The `/api/db` Proxy Is a Security Risk

The generic CRUD proxy has no:
- Input validation on `filters` (could be used for SQL injection via PostgREST)
- CSRF tokens
- Rate limiting
- Audit logging
- Row-level permission checks for sub users

This is the single biggest security risk in the application.

---

## 11. FEATURE BUILDING DECISION TREE

Use this when someone asks you to build a new feature:

```
Q1: Which user role initiates it?
  → master/sub → Admin API / /api/db
  → retailer → /api/portal/retailer/* + validate partnerId
  → manufacturer → /api/portal/manufacturer/* + validate manufacturingPartnerId
  → anonymous → Public route, rate limit, no auth

Q2: Does it touch pricing?
  → Yes → Use lib/quoteCompute.ts or lib/supabase.ts computeOrderCogs
  → Yes and it's a new product → Add to karat_pricing cache, trigger recompute
  → No → Skip gold math

Q3: Does it touch inventory/float?
  → Yes → Use lib/centralStock.ts (dual-write) or lib/mfgOrderLifecycle.ts (status changes)
  → No → Skip inventory

Q4: Does it need real-time notification?
  → Yes → Use lib/whatsappNotify.ts or lib/leadNotify.ts or lib/quoteShareNotify.ts
  → No → Skip notifications

Q5: Does it need public sharing?
  → Yes → Create tokenized link table, expiry logic, public page at /x/[token]
  → No → Keep behind auth

Q6: Does it need a PDF?
  → Yes → Use pdfkit (server-side via API route), see lib/quotePdf.ts or lib/catalogPdf.ts
  → No → Skip

Q7: Does it need to be visible to customers?
  → Yes → Check if D2C (customer_id exists) or B2B (partner_id exists)
  → Yes, consumer-facing → Use consumer theme (champagne/ivory, Cormorant Garamond)
  → No → Admin or portal theme

Q8: Does it need scheduled/background processing?
  → Yes → Use /api/cron/* route with CRON_SECRET self-auth
  → No → Skip
```

---

## 12. THE "WHAT WILL BREAK IF YOU CHANGE THIS" LIST

| If you change... | What will break |
|-----------------|-----------------|
| `KARAT_FACTORS` | All pricing, all COGS, all float conversions, all inventory balances, all quote computations |
| `products` table schema | `/api/db` allowlist needs update; `recomputeCatalogPrices()` may need update; retailer portal pricing may break; catalog PDF generation may break |
| `orders` table schema | `order_pipeline` view needs update; retailer portal order list needs update; `/api/portal/retailer/orders` may need update; COGS calculation needs update; manufacturing order linkage may break |
| `gold_rates` table schema | `recomputeCatalogPrices()` needs update; `calculateGoldRates()` needs update; quote preview API needs update |
| `middleware.ts` matcher | Public routes may become 403; portal routes may leak to wrong roles; A/B test may break |
| `ALLOWED_TABLES` in `/api/db` | Admin pages that used that table will break with "Table not allowed" error |
| `next-auth` session shape | Every page that reads `session.user.role`, `permissions`, `partnerId`, or `manufacturingPartnerId` will break |
| `lib/supabase.ts` QueryBuilder | Every page in the app that does client-side DB calls will break |
| `lib/quoteCompute.ts` formula | All quote creation, all PDF generation, all quote-to-order conversions |
| `MODULE_PERMISSIONS` in `lib/modules.ts` | Sub users may gain or lose access to modules |
| `DEFAULT_QUOTE_MARGIN_PCT` or `DEFAULT_QUOTE_GST_RATE_PCT` | All new quotes will use different defaults |
| `settings` table keys | Features that depend on those settings will fail silently (no error, just empty values) |
| `whatsappNotify.ts` webhook format | All WhatsApp notifications stop working |
| `consumerTheme.ts` colors | Customer journey page will look broken |
| `landingCopy.ts` constants | Landing page copy changes (safe, but all marketing text lives here) |

---

## 13. RECOMMENDED NEXT SESSION PROTOCOL

When you come back to build a feature, tell me:

1. **Which module/area** is it in? (orders, quotes, catalog, manufacturing, D2C, marketing, payments, inventory, etc.)
2. **Which user role** uses it? (master, sub, retailer, manufacturer, consumer, anonymous)
3. **Does it interact with existing data?** (gold rates, inventory, orders, partners, products, etc.)
4. **Does it need public sharing or notifications?**
5. **Does it need PDF generation or scheduled processing?**

I'll reference this knowledge base and give you the exact files to touch, the exact API routes to create, and the exact database changes needed — without rebuilding the whole system.

---

## 14. QUICK REFERENCE: TABLE SCHEMAS AT A GLANCE

### orders (core table)
```
id, order_number, partner_id, product_id, type, model, quantity, ring_size
special_notes, brief_text, brief_images, cad_request_id
gold_rate_at_order, trade_price, total_amount, advance_paid, balance_due
status (brief_received → cad_in_progress → cad_sent → design_approved → production → qc → dispatched → delivered)
order_date, expected_delivery, actual_delivery, tracking_number, courier, dispatch_date
internal_notes, gold_source, gold_weight_estimated, gold_weight_actual, making_charges, cad_cost, stone_cost, total_cogs, margin
assigned_manufacturer_id, selected_karat, gross_weight_at_karat, gold_pure_24kt_g, retail_labour_at_order
```

### manufacturing_orders
```
id, order_number, manufacturing_partner_id, customer_order_id, description
quantity, ring_size, special_notes, reference_images, cad_files, cad_file_names
material_from_float, gold_weight_required, gold_weight_actual, gold_karat, diamond_weight
material_notes, labour_per_gram, labour_amount, other_charges, total_manufacturing_cost
expected_date, issued_date, completed_date, status
```

### quotes
```
id, quote_number, partner_id, walk_in_name, walk_in_phone, walk_in_city
reference_no, prepared_by, quote_date, valid_until, status (draft → sent → viewed → accepted → converted_to_order → expired)
gst_treatment, gst_rate_pct, margin_pct, show_breakup, show_24kt_column, cover_note, terms_text
subtotal, gst_amount, grand_total, share_token, converted_order_id
```

### quote_items
```
id, quote_id, position, product_id, name, category, ring_size, quantity
karat, gross_gold_weight_g, net_24kt_weight_g, gold_rate_24k
labour_source, labour_partner_id, labour_rate_per_g, labour_total
diamonds (JSONB), making_charges, hallmarking, other_charges, other_charges_label
line_cogs, line_trade, line_total, reference_images
```

### products
```
id, code, name, description, category, diamond_weight, diamond_shape, diamond_quality, diamond_color, diamond_type
gold_karat, gold_weight_g, gold_weight_22k, gold_weight_18k, gold_weight_14k, gold_weight_10k, gold_weight_9k
karat_pricing (JSONB), diamond_cost, making_charges, igi_cert_cost, trade_price, mrp_suggested
priced_at_rate, priced_at, photo_urls, is_active, delivery_days, models_available, tags
```

### partner_signups
```
id, full_name, store_name, city, phone, whatsapp, email, gst_number, monthly_volume, note
utm_source, utm_medium, utm_campaign, utm_content, utm_term, referrer, landing_path, landing_variant
user_agent, ip_hash, status, email_dispatch, whatsapp_dispatch, created_at
```

### ready_to_ship_items
```
id, product_id, source_mfg_order_id, source_order_id, karat, gross_weight, pure_24kt_weight
 diamond_specs (JSONB), photos, list_price, original_cogs, status (available|reserved|sold|withdrawn)
sold_to_partner_id, sold_order_id, sold_at, internal_notes
```

### ready_to_ship_offers
```
id, item_id, partner_id, offer_price, note, status (pending|countered|accepted|rejected|withdrawn)
counter_price, counter_note, decided_at, decided_by, resulting_order_id
```

### customer_enquiries
```
id, enquiry_number, customer_id, source, status (new|in_discussion|quoted|approved|converted|closed)
product_interest, budget_hint, deadline_hint, notes, order_id, created_at
```

### customer_enquiry_activity
```
id, enquiry_id, kind, actor, note, before, after, created_at
```

### customer_journey_links
```
id, token, customer_id, order_id, enquiry_id, expires_at, revoked_at, opened_count, last_opened_at, first_opened_at
```

### reconciliation_alerts
```
id, partner_id, run_date, window_days, consumed_total, benchmark_total, variance_total
negative_count, unlinked_count, unlinked_consumed, triggered_reasons, notified_at, notify_channel, notify_error
```

---

## 15. COMPLETE PAGE DIRECTORY MAP

### Admin Pages (`app/`)

| Route | File | Purpose | Role |
|-------|------|---------|------|
| `/` | `page.tsx` | Landing page (A/B test) | Anonymous |
| `/login` | `login/page.tsx` | Login form | All |
| `/setup` | `setup/page.tsx` | First-time master creation | Anonymous (one-time) |
| `/dashboard` | `dashboard/page.tsx` | Admin dashboard with KPIs | master/sub |
| `/orders` | `orders/page.tsx` | Order list, kanban, filters | master/sub (orders perm) |
| `/orders/new` | `orders/new/page.tsx` | Order creation form | master/sub (orders perm) |
| `/orders/[id]` | `orders/[id]/page.tsx` | Order detail, status, manufacturing handoff | master/sub (orders perm) |
| `/catalog` | `catalog/page.tsx` | Product grid, collections, interests | master/sub (catalog perm) |
| `/catalog/new` | `catalog/new/page.tsx` | Product creation | master/sub (catalog perm) |
| `/catalog/[id]` | `catalog/[id]/page.tsx` | Product edit, per-karat pricing | master/sub (catalog perm) |
| `/catalog/categories` | `catalog/categories/page.tsx` | Category management | master/sub (catalog perm) |
| `/catalog/collections/new` | `catalog/collections/new/page.tsx` | Create collection | master/sub (catalog perm) |
| `/catalog/collections/[id]` | `catalog/collections/[id]/page.tsx` | Edit collection | master/sub (catalog perm) |
| `/quotes` | `quotes/page.tsx` | Quote list, pagination, search | master/sub (quotes perm) |
| `/quotes/new` | `quotes/new/page.tsx` | Quote builder | master/sub (quotes perm) |
| `/quotes/[id]` | `quotes/[id]/page.tsx` | Quote detail, send, revise, convert | master/sub (quotes perm) |
| `/manufacturing` | `manufacturing/page.tsx` | Partner list, float summary, active orders | master/sub (manufacturing perm) |
| `/manufacturing/orders/new` | `manufacturing/orders/new/page.tsx` | Issue manufacturing order | master/sub (manufacturing perm) |
| `/manufacturing/orders/[id]` | `manufacturing/orders/[id]/page.tsx` | Mfg order detail, float reservation | master/sub (manufacturing perm) |
| `/manufacturing/partners/[id]` | `manufacturing/partners/[id]/page.tsx` | Partner detail, per-karat labour rates | master/sub (manufacturing perm) |
| `/manufacturing/partners/[id]/float` | `manufacturing/partners/[id]/float/page.tsx` | Float ledger, deposit/return | master/sub (manufacturing perm) |
| `/manufacturing/partners/[id]/reconciliation` | `manufacturing/partners/[id]/reconciliation/page.tsx` | Reconciliation report | master/sub (manufacturing perm) |
| `/stock` | `stock/page.tsx` | Dashboard, balances, diamond groups | master/sub (stock perm) |
| `/stock/issue` | `stock/issue/page.tsx` | Issue to karigar (dual-write) | master/sub (stock perm) |
| `/stock/receive` | `stock/receive/page.tsx` | Receive from karigar | master/sub (stock perm) |
| `/stock/movements` | `stock/movements/page.tsx` | Full audit ledger | master/sub (stock perm) |
| `/partners` | `partners/page.tsx` | Partner CRM list | master/sub (partners perm) |
| `/partners/[id]` | `partners/[id]/page.tsx` | Partner detail, orders, visits | master/sub (partners perm) |
| `/partners/leads` | `partners/leads/page.tsx` | Lead inbox, variant conversion stats | master/sub (partners perm) |
| `/circuits` | `circuits/page.tsx` | Circuit trip planning | master/sub (circuits perm) |
| `/circuits/[id]` | `circuits/[id]/page.tsx` | Circuit detail | master/sub (circuits perm) |
| `/gold-rates` | `gold-rates/page.tsx` | Gold rate entry, history | master/sub (gold_rates perm) |
| `/analytics` | `analytics/page.tsx` | Revenue charts, funnel, top partners | master/sub (analytics perm) |
| `/profitability` | `profitability/page.tsx` | COGS / margin dashboard | master/sub (profitability perm) |
| `/customers` | `customers/page.tsx` | Consumer list (D2C) | master/sub (customers perm) |
| `/customers/[id]` | `customers/[id]/page.tsx` | Consumer profile, addresses, enquiries | master/sub (customers perm) |
| `/enquiries` | `enquiries/page.tsx` | Enquiry inbox (kanban + list) | master/sub (enquiries perm) |
| `/enquiries/[id]` | `enquiries/[id]/page.tsx` | Enquiry detail, timeline, activity | master/sub (enquiries perm) |
| `/enquiries/new` | `enquiries/new/page.tsx` | Operator intake form | master/sub (enquiries perm) |
| `/ready-to-ship` | `ready-to-ship/page.tsx` | Inventory listing, offer management | master/sub (ready_to_ship perm) |
| `/cad-requests` | `cad-requests/page.tsx` | CAD request list | master/sub (cad_requests perm) |
| `/cad-requests/[id]` | `cad-requests/[id]/page.tsx` | CAD request detail, revisions | master/sub (cad_requests perm) |
| `/settings` | `settings/page.tsx` | Admin settings, notifications | master/sub (settings perm) |
| `/vendors` | `vendors/page.tsx` | Vendor management | master/sub (vendors perm) |
| `/showcase` | `showcase/page.tsx` | Public design showcase | Anonymous |
| `/showcase/[id]` | `showcase/[id]/page.tsx` | Collection showcase page | Anonymous |

### Retailer Portal Pages (`app/portal/retailer/`)

| Route | File | Purpose |
|-------|------|---------|
| `/portal/retailer` | `page.tsx` | Retailer dashboard |
| `/portal/retailer/layout` | `layout.tsx` | Isolated layout (no AppShell) |
| `/portal/retailer/catalog` | `catalog/page.tsx` | Browse products with karat pricing |
| `/portal/retailer/orders` | `orders/page.tsx` | Own orders list |
| `/portal/retailer/orders/[id]` | `orders/[id]/page.tsx` | Order detail, change request |
| `/portal/retailer/ready-to-ship` | `ready-to-ship/page.tsx` | Browse available items, make offers |
| `/portal/retailer/profile` | `profile/page.tsx` | Edit profile, change password |
| `/portal/retailer/quotes` | `quotes/page.tsx` | View own quotes |

### Manufacturer Portal Pages (`app/portal/manufacturer/`)

| Route | File | Purpose |
|-------|------|---------|
| `/portal/manufacturer` | `page.tsx` | Manufacturer dashboard |
| `/portal/manufacturer/layout` | `layout.tsx` | Isolated layout (no AppShell) |
| `/portal/manufacturer/orders` | `orders/page.tsx` | Assigned orders list |
| `/portal/manufacturer/orders/[id]` | `orders/[id]/page.tsx` | Order detail, update status, notes, images |

### Public Pages (`app/`)

| Route | File | Purpose |
|-------|------|---------|
| `/q/[token]` | `q/[token]/page.tsx` | Quote share link (client view) |
| `/c/[token]` | `c/[token]/page.tsx` | Customer journey link (consumer skin) |
| `/m/[token]` | `m/[token]/page.tsx` | Manufacturing asset pack (48h expiry) |
| `/cad-share/[token]` | `cad-share/[token]/page.tsx` | CAD partner review link |
| `/partner-signup` | `partner-signup/page.tsx` | Full-page signup form |

---

*End of Living Knowledge Base v2.0*
