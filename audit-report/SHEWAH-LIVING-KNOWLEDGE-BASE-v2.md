# Shewah B2B — Living Architecture Knowledge Base v2.1

> **Version:** 2.1 | **Date:** 2026-07-19 | **Purpose:** Comprehensive architectural decision support for future feature building

---

## How to Use This Doc

Before building any new feature, check these three things:

1. **Which user roles touch this?** (master, sub, manufacturer, retailer, reseller, anonymous)
2. **Which data entities does it need?** (orders, products, partners, manufacturing_orders, quotes, diamond_matrix, loose_diamonds, reseller_themes, etc.)
3. **Which existing system rule will interact with it?** (gold-rate locking, float ledger, COGS snapshots, WhatsApp webhooks, karat pricing, diamond rate matrix)

This prevents you from building features that conflict with existing business logic.

---

## 1. SYSTEM OVERVIEW & ARCHITECTURE

### 1.1 Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Framework | Next.js 14 (App Router) | Server Components by default, `'use client'` for interactivity |
| Language | TypeScript | Strict mode |
| Styling | Tailwind CSS | Custom brand color: `#1E3A5F` (navy blue) |
| Database | PostgreSQL (Supabase) | 40+ tables, views, triggers, functions |
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

### 1.3 The Four-App Architecture

The codebase now contains **four distinct applications** sharing one Next.js instance:

```
┌─────────────────────────────────────────────────────────────────┐
│                         NEXT.JS APP                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐  ┌────────────┐  │
│  │  ADMIN   │  │ RETAILER │  │ MANUFACTURER │  │  RESELLER  │  │
│  │ /dash    │  │ /portal/ │  │ /portal/     │  │ /store/    │  │
│  │ /orders  │  │ retailer │  │ manufacturer │  │ /onboard   │  │
│  │ /catalog │  │          │  │              │  │ /apply     │  │
│  │ /quotes  │  │          │  │              │  │            │  │
│  │ /manufac │  │          │  │              │  │            │  │
│  └──────────┘  └──────────┘  └──────────────┘  └────────────┘  │
│       │              │               │                │          │
│       ▼              ▼               ▼                ▼          │
│  master/sub     retailer role   manufacturer    reseller role    │
│  Full access   Module-limited   Orders only    Storefront only   │
└─────────────────────────────────────────────────────────────────┘
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
  role: 'master' | 'sub' | 'retailer' | 'manufacturer' | 'reseller'
  permissions: string[]  // module names for sub users
  manufacturingPartnerId?: string  // for manufacturer role
  partnerId?: string                 // for retailer role
  resellerId?: string                // for reseller role
}
```

### 2.2 Role Permissions

| Role | Database Table | How Created |
|------|---------------|-------------|
| `master` | `app_users` | Setup page (`/setup`) — first user is always master |
| `sub` | `app_users` | Master creates via admin UI; has subset of `permissions` |
| `retailer` | `app_users` + `partners` | Admin creates partner account; `partnerId` links to `partners` row |
| `manufacturer` | `app_users` + `manufacturing_partners` | Admin creates; `manufacturingPartnerId` links to `manufacturing_partners` row |
| `reseller` | `app_users` + `resellers` | Admin onboards; `resellerId` links to `resellers` row + white-label storefront |

### 2.3 Middleware Behavior (`middleware.ts`)

```
1. Public paths (matcher excluded): /api/auth, /api/setup, /api/public, /api/showcase, /api/track, /api/cron, /api/whatsapp, /api/m/, /api/cad-share/, /api/c/, /api/quotes/share/, /api/quotes/test-compute, /api/diamonds/ (retailer allowed)
2. Logged-in user on /login → redirect to dashboardForRole(role)
3. Manufacturer on non-/portal/manufacturer/* → 403
4. Retailer on non-/portal/retailer/* → 403
5. Reseller on non-/store/* and non-/onboard/* → 403
6. Everyone else → allow (master/sub can go anywhere)
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

**Rule:** All gold inventory is held as **24K-pure net weight** (`gold_24k` in `material_float` / `stock_movements`). Karat is only a **labour-rate lens** at the catalog/order edges.

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

**Do NOT** build a feature that re-prices existing orders automatically.

### 3.4 Diamond Cost Formula (CRITICAL — Updated July 2026)

Diamond pricing uses **rate per carat**, not rate per piece:

```
dCtPc        = approx_carats per single piece (stored in diamond row)
dTotalWeight = pieces × dCtPc                (total carats for that row)
dRate        = rate_per_pc field             (confusingly named — actually rate/carat)
dRowCost     = dTotalWeight × dRate          (total carats × rate per carat)
diamondCostPerPc = Σ(dTotalWeight × dRate) + Σ(igi_charge)
```

**Never multiply `pieces × rate_per_pc` directly** — that produces an inflated per-piece total. Always go via `weight × pieces × rate`.

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
├── order_payments
├── production_updates
├── customer_journey_links
└── quotes (via convert-to-order flow)

manufacturing_partners (karigars)
├── manufacturing_orders
├── material_float (one per material type)
└── material_transactions

resellers (white-label storefront owners)
├── reseller_themes (JSONB brand config)
└── app_users (role: 'reseller')
```

### 4.2 Inventory / Ledger System

```
stock_movements (central HQ inventory)
├── material_type: gold_24k | diamond_lgd | diamond_natural | finding
├── movement_type: purchase | issue | return_in | adjustment_in | adjustment_out
├── manufacturing_partner_id (for dual-write to float)
└── material_transaction_id (links to float ledger)

material_float (per-karigar custody — pre-computed balance columns)
├── material_type: gold_14k|gold_18k|gold_22k|diamond_* (legacy; compute from transactions)
├── total_deposited, total_returned, total_consumed, balance (stored, not auto-synced)
└── unique (manufacturing_partner_id, material_type)

material_transactions (the ledger — single source of truth)
├── transaction_type: deposit | consumption | return | adjustment
├── lifecycle: pending | final
├── quantity (in 24K-pure grams for gold, carats for diamond)
└── creates_negative_balance (computed by trigger)
```

### 4.3 Diamond System (Updated July 2026)

```
diamond_shapes     (Round, Oval, Princess, Radiant, etc.)
├── id, name, sort_order, active

diamond_sizes      (size labels with approx_carats per piece)
├── id, shape_id, label (e.g. "6.0mm"), approx_carats, sort_order

diamond_quality_grades   (VVS, VS, SI, etc.)
diamond_color_grades     (EF, GH, IJ, etc.)

metal_weights      (per-shape, per-karat, per-metal-type weight data)

diamond_price_matrix     (LGD and Natural rate lookup)
├── shape_id, size_id, quality_id, color_id
├── lgd_rate_per_ct, natural_rate_per_ct
└── Used by DiamondCatalogPicker for auto-fill

loose_diamond_procurement  (NEW — Loose Diamond Module)
├── enquiry/negotiation lifecycle for procuring loose stones
├── retailer-browsable via portal
└── admin review workspace
```

**DiamondCatalogPicker** (`components/DiamondCatalogPicker.tsx`):
- Fetches `diamond_shapes`, `diamond_sizes`, `diamond_quality_grades`, `diamond_color_grades`
- Auto-fills `approx_carats` when size is selected
- Auto-fills `rate_per_pc` from the price matrix when shape+size+quality+color match
- Writes `shape_id`, `shape_name`, `size_id`, `size_label` to the diamond row

### 4.4 Quotation System (Updated July 2026)

```
quotes
├── quote_items (line items)
├── quote_share_links (public tokenized links, 60-day expiry)
├── partner_id (nullable for walk-in/D2C)
└── customer_id (nullable — D2C customer selection now supported)

quote_items
├── diamonds (JSONB array of DiamondSpec)
│   └── Each spec: {id, role, shape_id, shape_name, size_id, size_label,
│                   color_id, quality_id, pieces, approx_carats, weight,
│                   rate_per_pc, igi_charge, color_label, clarity_label}
├── karat, gross_gold_weight_g, net_24kt_weight_g
├── labour_rate_per_g, labour_total
├── line_cogs, line_trade, line_total
├── metal_weights (JSONB — per-karat computed weights)
└── reference_images (array of Cloudinary/Supabase URLs)
```

**Quote PDF** (`lib/quotePdf.ts`) — Diamond Break-up table columns (as of July 2026):
- Size | Color | Clarity | Shape | Count | Price | Weight | **CT/PC** | **TOTAL**
- CT/PC = `approx_carats` per piece (carats per single stone)
- TOTAL = `total_weight × rate_per_carat` (row cost with margin)
- Grand TOTAL = sum of all row TOTALs = matches DIAMOND "Value" in summary
- Shape is resolved: `shape_name → shape_label → d.name → '—'` (never falls back to `role`)
- Both PDF routes (`/api/quotes/[id]/pdf` and `/api/quotes/share/[token]/pdf`) backfill `shape_name` from `diamond_shapes` lookup if the stored value is null

**Quote share page** (`/q/[token]/page.tsx`) — Updated July 2026:
- Removed the "Line Items" sidebar
- Full-width PDF iframe + compact totals strip only

### 4.5 Set / Pair Selling (New July 2026)

- Products can be grouped as **sets** (e.g., necklace + earrings)
- `set_products` junction table or `parent_product_id` column tracks set membership
- Retailer can add a set to cart and checkout all child items together
- Default karat selection on catalog creation applies to all set children

### 4.6 Reseller White-Label Storefront (New July 2026)

```
resellers
├── id, name, subdomain, status (active|inactive), created_at

reseller_themes
├── reseller_id
├── config (JSONB): brand colors, fonts, logo, hero image, trust signals,
│                   category grid, video showcase, reviews, etc.
└── Edited via /store/brand-studio visual editor

app/store/[...]/         → Public reseller storefront (no AppShell)
app/onboard/             → Reseller onboarding flow
app/apply/               → Reseller application page
```

- Reseller storefront bypasses AppShell layout entirely
- Theme config is fully customizable via brand studio (Palmonas-style visual editor)
- Background support chat polling on both admin and reseller portals
- Active resellers only can access storefront; inactive → redirect
- Configurator (stone prices, quality-color matrix) is a separate admin module

### 4.7 D2C / Consumer Entities

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

### 4.8 Settings-Driven Configuration

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
| `reconciliation_alert_window_days`, `reconciliation_alert_variance_g`, etc. | Reconciliation thresholds |
| `default_igi_cost`, `default_making_charges` | Default pricing values |
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

### 5.2 Quote Lifecycle (Updated July 2026)

```
Admin: app/quotes/new/page.tsx
  → Adds items with DiamondCatalogPicker (auto-fills shape/size/rate)
  → Live price breakup drawer shows gold + diamond breakdown per item
  → POST /api/quotes → creates quote + quote_items
    → computeQuoteItem() calculates:
        diamondCost = Σ(pieces × approx_carats × rate_per_pc) + igi
        goldCost    = net24ktWeight × gold_rate_24k × KARAT_FACTORS[karat]
  → POST /api/quotes/[id]/send
    → Generates 32-char hex token
    → Creates quote_share_links (expiry: min 60 days, valid_until+30)
    → Sends WhatsApp link to partner

Retailer: /q/[token]
  → Full-width PDF iframe + compact totals strip
  → Accept → POST /api/quotes/[id]/accept
  → Revision → POST /api/quotes/[id]/revision

Quote Deletion (New July 2026):
  → Admin can permanently delete ANY quote from list or detail view
  → DELETE /api/quotes/[id] — cascades quote_items, quote_share_links
```

### 5.3 Manufacturing Assignment Flow

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

### 5.4 Gold Rate Change Cascade

```
Admin saves gold rate: app/gold-rates/page.tsx
  → POST /api/db → gold_rates
  → Triggers recomputeCatalogPrices() in lib/supabase.ts
    → Fetches all active products
    → For each product: computes per-karat pricing
    → Updates products.karat_pricing, trade_price, mrp_suggested, priced_at_rate, priced_at
  → Does NOT touch orders table
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
    → Full-width PDF iframe (Line Items sidebar removed)
    → Compact totals strip below iframe
  → Clicks Accept or Request Revision
    → Accept: POST /api/quotes/[id]/accept → notifies internal team
    → Revision: POST /api/quotes/[id]/revision → notifies internal team
```

---

## 6. API ROUTE ARCHITECTURE

### 6.1 Admin API Proxy (`/api/db`)

All admin DB operations go through `/api/db`. It is a generic CRUD proxy:

```
POST /api/db
body: { table, op, values, filters, select, order, limit, range, single, count }
```

**Allowed tables:** `partners`, `visits`, `orders`, `products`, `gold_rates`, `circuits`, `manufacturing_partners`, `manufacturing_orders`, `design_collections`, `material_float`, `material_transactions`, `stock_movements`, `quotes`, `quote_items`, `customers`, `customer_enquiries`, `production_updates`, `customer_journey_links`, `ready_to_ship_items`, `ready_to_ship_offers`, `partner_signups`, `cad_requests`, `cad_revisions`, `cad_partner_share_links`, `cad_partner_responses`, `mfg_share_links`, `settings`, `reconciliation_alerts`, `app_users` (master only), `customer_addresses` (master only), `customer_enquiry_activity` (master only), `order_change_requests` (master only), `order_payments` (master only), `diamond_shapes` (master only), `diamond_sizes` (master only), `diamond_quality_grades` (master only), `diamond_color_grades` (master only), `metal_weights` (master only), `resellers` (master only), `reseller_themes` (master only).

**Master-only tables:** `app_users`, `material_float`, `material_transactions`, `reconciliation_alerts`, `stock_movements` (sub users get 403).

**Security:** Only `master` and `sub` roles can use this. Manufacturers and retailers must use their dedicated `/api/portal/*` routes.

**Critical vulnerability:** The `/api/db` proxy accepts arbitrary `filters` arrays and passes them directly to Supabase. There is no input validation, CSRF protection, or rate limiting.

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

### 6.3 Quotes-Specific Routes (Updated July 2026)

```
/api/quotes                        → GET (list), POST (create)
/api/quotes/[id]                   → GET, PATCH (update), DELETE (permanent delete — any status)
/api/quotes/[id]/send              → POST (generate share link + WhatsApp)
/api/quotes/[id]/convert-to-order → POST (get prefill), PATCH (link order)
/api/quotes/[id]/accept            → POST (retailer accepts quote)
/api/quotes/[id]/revision         → POST (retailer requests revision)
/api/quotes/[id]/pdf              → GET (admin PDF download — backfills shape_name from DB)
/api/quotes/share/[token]         → GET (public quote data)
/api/quotes/share/[token]/pdf     → GET (public PDF — backfills shape_name from DB)
/api/quotes/share/[token]/respond → POST (accept/revision from public link)
```

### 6.4 Diamond Routes (Updated July 2026)

```
/api/diamonds/shapes              → GET (list all shapes), POST (create) — master only
/api/diamonds/shapes/[id]         → PATCH (toggle active/inactive), DELETE
/api/diamonds/sizes               → GET (list), POST (create)
/api/diamonds/quality-grades      → GET (list)
/api/diamonds/color-grades        → GET (list)
/api/diamonds/stock               → GET (diamond group balances from view)
/api/diamonds/matrix              → GET/POST/PATCH/DELETE (LGD + Natural price matrix)
```

Note: `/api/diamonds/*` routes are accessible to `retailer` role (middleware whitelisted).

### 6.5 Public/Unauthenticated Routes

```
/api/public/partner-signup    → POST (lead capture, rate-limited, honeypot, phone validation)
/api/c/[token]                → GET (customer journey link, consumer skin)
/api/q/[token]                → GET (quote share link, client view)
/api/cad-share/[token]        → GET (CAD partner review link)
/api/showcase/track           → POST (collection view tracking)
/api/showcase/interests       → POST (design interest from showcase)
/api/m/[token]                → GET (manufacturing order asset pack, 48h expiry)
```

---

## 7. STATE MANAGEMENT PATTERNS

### 7.1 Server-Side State

- **No global state manager** (no Redux, no Zustand, no React Context for data). Each page loads its own data.
- Client components use `useEffect` + `useState` to fetch data via `fetch()` or the `supabase` QueryBuilder proxy.
- Dashboards poll every 60 seconds (`setInterval` in `useEffect`).

### 7.2 Session / Auth

- NextAuth.js with JWT strategy (30-day expiry)
- Token contains: `id`, `username`, `displayName`, `role`, `permissions`, `manufacturingPartnerId`, `partnerId`, `resellerId`
- Middleware reads the token and enforces role-based routing
- Portal layouts are isolated — they don't use AppShell.

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
| `lib/quoteCompute.ts` | Quote item calculation, `computeQuoteItem()`, `computeQuoteTotals()`, GST logic | Quote pricing engine. Diamond cost = `Σ(weight × pieces × rate_per_ct) + igi` |
| `lib/quotePdf.ts` | `renderQuotePdf()` — A4 PDF with branding, item cards, Diamond Break-up table (9 cols incl. CT/PC + TOTAL), totals, signature, page numbers | Quote PDF output. |
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
| `components/DiamondCatalogPicker.tsx` | Diamond row picker — fetches shapes/sizes/grades, auto-fills approx_carats + rate from matrix, writes shape_name | Diamond spec entry. |

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

1. **No CSRF protection** on `/api/db` — the proxy blindly accepts any POST from an authenticated session.
2. **No rate limiting** on `/api/db` — a sub user could flood the proxy.
3. **No input validation** on the generic `/api/db` proxy — arbitrary `filters` arrays.
4. **No audit log** for who changed what — no `created_by`, `updated_by` on most tables.
5. **Sub-user permissions are client-side** — `/api/db` only checks `master` vs `sub`; it doesn't validate individual `permissions` against the requested table.
6. **Image URL validation** in `pdfHelpers.ts` only allows `.cloudinary.com`, `.supabase.co`, `.supabase.in`.

---

## 10. KNOWN ARCHITECTURAL GAPS

### 10.1 Quote → Order Conversion Is Fragile
Uses `sessionStorage` to pass data. If user refreshes, prefill is lost. Need `quote_id` on `orders` table for true atomicity.

### 10.2 D2C and B2B Orders Are Mixed
`orders` has no reliable discriminator. Use `customer_id IS NOT NULL` for D2C, `partner_id IS NOT NULL` for B2B.

### 10.3 Stock Dual-Write Is Not Atomic
`issueToPartner()` writes `material_transactions` first, then `stock_movements`. No 2PC — can diverge on crash.

### 10.4 No Inventory Reservation for Orders
Nothing is reserved from stock when an order is placed. No "can we fulfill this?" check.

### 10.5 Ready-to-Ship Has No Atomic Reservation
No `SELECT FOR UPDATE` on item rows — concurrent claims are possible.

### 10.6 Payments Not Integrated
`order_payments` exists as a ledger only (no gateway, no reconciliation, no status machine).

### 10.7 Float Ledger and Stored Balance Can Drift
`material_float.balance` stored columns are not auto-synced from `material_transactions`. Always compute from transactions.

### 10.8 No Audit Trail for Order Changes
`orders.updated_at` exists but no `updated_by`, no change history. Admin edits are invisible.

### 10.9 The `/api/db` Proxy Is a Security Risk
No input validation, CSRF tokens, rate limiting, audit logging, or per-table sub-user permission checks.

---

## 11. FEATURE BUILDING DECISION TREE

```
Q1: Which user role initiates it?
  → master/sub → Admin API / /api/db
  → retailer → /api/portal/retailer/* + validate partnerId
  → manufacturer → /api/portal/manufacturer/* + validate manufacturingPartnerId
  → reseller → /api/store/* + validate resellerId
  → anonymous → Public route, rate limit, no auth

Q2: Does it touch pricing?
  → Yes → Use lib/quoteCompute.ts or lib/supabase.ts computeOrderCogs
  → Diamond pricing → weight × pieces × rate_per_ct (rate_per_pc is per carat!)
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

Q9: Does it involve diamonds?
  → Yes → Use DiamondCatalogPicker for UI; rate is per-carat; shape_name from diamond_shapes
  → Never use d.role as the shape display value
```

---

## 12. THE "WHAT WILL BREAK IF YOU CHANGE THIS" LIST

| If you change... | What will break |
|-----------------|-----------------|
| `KARAT_FACTORS` | All pricing, all COGS, all float conversions, all inventory balances, all quote computations |
| Diamond cost formula in `quoteCompute.ts` | Quote prices, PDF totals, line_trade values — DIAMOND Value in summary must equal break-up TOTAL |
| `shape_name` field on diamond rows | PDF break-up will show '—'; shape backfill in PDF routes tries `shape_id → shapeMap` |
| `products` table schema | `/api/db` allowlist, `recomputeCatalogPrices()`, retailer portal pricing, catalog PDF |
| `orders` table schema | `order_pipeline` view, retailer portal order list, COGS calculation |
| `middleware.ts` matcher | Public routes may 403; portal routes may leak; A/B test may break; `/api/diamonds/` retailer access may break |
| `ALLOWED_TABLES` in `/api/db` | Admin pages that used that table will break with "Table not allowed" error |
| `next-auth` session shape | Every page that reads `session.user.role`, `permissions`, `partnerId`, `resellerId` will break |
| `lib/quoteCompute.ts` formula | All quote creation, all PDF generation, all quote-to-order conversions |
| `MODULE_PERMISSIONS` in `lib/modules.ts` | Sub users may gain or lose access to modules |
| `DEFAULT_QUOTE_MARGIN_PCT` or `DEFAULT_QUOTE_GST_RATE_PCT` | All new quotes will use different defaults |
| `settings` table keys | Features that depend on those settings will fail silently |
| `reseller_themes` config JSONB shape | Brand studio visual editor will fail or render incorrectly |

---

## 13. QUICK REFERENCE: TABLE SCHEMAS AT A GLANCE

### quotes
```
id, quote_number, partner_id, customer_id (nullable — D2C), walk_in_name, walk_in_phone, walk_in_city
reference_no, prepared_by, quote_date, valid_until, status (draft → sent → viewed → accepted → converted_to_order → expired)
gst_treatment, gst_rate_pct, margin_pct, show_breakup, show_24kt_column, cover_note, terms_text
subtotal, gst_amount, grand_total, share_token, converted_order_id
shared_at
```

### quote_items
```
id, quote_id, position, product_id, name, category, ring_size, quantity
karat, gross_gold_weight_g, net_24kt_weight_g, gold_rate_24k
labour_source, labour_partner_id, labour_rate_per_g, labour_total
diamonds (JSONB: [{id, role, shape_id, shape_name, size_id, size_label, color_id, quality_id,
                   pieces, approx_carats, weight, rate_per_pc, igi_charge, color_label, clarity_label}])
making_charges, hallmarking, other_charges, other_charges_label
line_cogs, line_trade, line_total
reference_images (array)
metal_weights (JSONB)
```

### orders
```
id, order_number, partner_id, product_id, type, model, quantity, ring_size
special_notes, brief_text, brief_images, cad_request_id
gold_rate_at_order, trade_price, total_amount, advance_paid, balance_due
status (brief_received → cad_in_progress → cad_sent → design_approved → production → qc → dispatched → delivered)
order_date, expected_delivery, actual_delivery, tracking_number, courier, dispatch_date
internal_notes, gold_source, gold_weight_estimated, gold_weight_actual, making_charges, cad_cost, stone_cost, total_cogs, margin
assigned_manufacturer_id, selected_karat, gross_weight_at_karat, gold_pure_24kt_g, retail_labour_at_order
customer_id (nullable — D2C), audience
```

### products
```
id, code, name, description, category, diamond_weight, diamond_shape, diamond_quality, diamond_color, diamond_type
gold_karat, gold_weight_g, gold_weight_22k, gold_weight_18k, gold_weight_14k, gold_weight_10k, gold_weight_9k
karat_pricing (JSONB), diamond_cost, making_charges, igi_cert_cost, trade_price, mrp_suggested
priced_at_rate, priced_at, photo_urls, is_active, delivery_days, models_available, tags
default_karat (new — used for set/catalog default selection)
```

### diamond_shapes
```
id (uuid), name, sort_order, active
```

### diamond_sizes
```
id (uuid), shape_id → diamond_shapes, label, approx_carats, sort_order
```

### resellers
```
id, name, subdomain, status (active|inactive), created_at
```

### reseller_themes
```
id, reseller_id → resellers, config (JSONB), updated_at
```

---

## 14. COMPLETE PAGE DIRECTORY MAP

### Admin Pages (`app/`)

| Route | Purpose | Role |
|-------|---------|------|
| `/` | Landing page (A/B test) | Anonymous |
| `/login` | Login form | All |
| `/setup` | First-time master creation | Anonymous (one-time) |
| `/dashboard` | Admin dashboard with KPIs | master/sub |
| `/orders` | Order list, kanban, filters | master/sub (orders) |
| `/orders/new` | Order creation form | master/sub (orders) |
| `/orders/[id]` | Order detail, status, mfg handoff | master/sub (orders) |
| `/catalog` | Product grid, collections, interests | master/sub (catalog) |
| `/catalog/new` | Product creation | master/sub (catalog) |
| `/catalog/[id]` | Product edit, per-karat pricing | master/sub (catalog) |
| `/catalog/categories` | Category management | master/sub (catalog) |
| `/catalog/collections/*` | Collection CRUD | master/sub (catalog) |
| `/quotes` | Quote list, pagination, search | master/sub (quotes) |
| `/quotes/new` | Quote builder with DiamondCatalogPicker | master/sub (quotes) |
| `/quotes/[id]` | Quote detail, send, revise, convert, delete | master/sub (quotes) |
| `/manufacturing` | Partner list, float summary, active orders | master/sub (manufacturing) |
| `/manufacturing/orders/new` | Issue manufacturing order | master/sub (manufacturing) |
| `/manufacturing/orders/[id]` | Mfg order detail, float reservation | master/sub (manufacturing) |
| `/manufacturing/partners/[id]` | Partner detail, per-karat labour rates | master/sub (manufacturing) |
| `/manufacturing/partners/[id]/float` | Float ledger, deposit/return | master/sub (manufacturing) |
| `/manufacturing/partners/[id]/reconciliation` | Reconciliation report | master/sub (manufacturing) |
| `/stock` | Dashboard, balances, diamond groups | master/sub (stock) |
| `/stock/issue` | Issue to karigar (dual-write) | master/sub (stock) |
| `/stock/receive` | Receive from karigar | master/sub (stock) |
| `/stock/movements` | Full audit ledger | master/sub (stock) |
| `/partners` | Partner CRM list | master/sub (partners) |
| `/partners/[id]` | Partner detail, orders, visits | master/sub (partners) |
| `/partners/leads` | Lead inbox, variant conversion stats | master/sub (partners) |
| `/circuits` | Circuit trip planning | master/sub (circuits) |
| `/gold-rates` | Gold rate entry, history | master/sub (gold_rates) |
| `/analytics` | Revenue charts, funnel, top partners | master/sub (analytics) |
| `/profitability` | COGS / margin dashboard | master/sub (profitability) |
| `/customers` | Consumer list (D2C) | master/sub (customers) |
| `/customers/[id]` | Consumer profile, addresses, enquiries | master/sub (customers) |
| `/enquiries` | Enquiry inbox (kanban + list) | master/sub (enquiries) |
| `/enquiries/[id]` | Enquiry detail, timeline, activity | master/sub (enquiries) |
| `/enquiries/new` | Operator intake form | master/sub (enquiries) |
| `/ready-to-ship` | Inventory listing, offer management | master/sub (ready_to_ship) |
| `/cad-requests` | CAD request list | master/sub (cad_requests) |
| `/cad-requests/[id]` | CAD request detail, revisions | master/sub (cad_requests) |
| `/settings` | Admin settings, notifications | master/sub (settings) |
| `/vendors` | Vendor management (with inline edit/delete) | master/sub (vendors) |
| `/showcase` | Public design showcase | Anonymous |
| `/showcase/[id]` | Collection showcase page | Anonymous |

### Retailer Portal Pages (`app/portal/retailer/`)

| Route | Purpose |
|-------|---------|
| `/portal/retailer` | Retailer dashboard |
| `/portal/retailer/catalog` | Browse products with karat pricing + price breakup drawer |
| `/portal/retailer/orders` | Own orders list |
| `/portal/retailer/orders/[id]` | Order detail, change request |
| `/portal/retailer/ready-to-ship` | Browse available items, make offers |
| `/portal/retailer/profile` | Edit profile, change password |
| `/portal/retailer/quotes` | View own quotes |

### Manufacturer Portal Pages (`app/portal/manufacturer/`)

| Route | Purpose |
|-------|---------|
| `/portal/manufacturer` | Manufacturer dashboard |
| `/portal/manufacturer/orders` | Assigned orders list |
| `/portal/manufacturer/orders/[id]` | Order detail, update status, notes, images |

### Reseller / Storefront Pages (New July 2026)

| Route | Purpose |
|-------|---------|
| `/store/*` | White-label storefront (per reseller, no AppShell) |
| `/store/brand-studio` | Visual editor for storefront theme config |
| `/onboard/*` | Reseller onboarding flow |
| `/apply` | Reseller application page |

### Public Pages

| Route | Purpose |
|-------|---------|
| `/q/[token]` | Quote share link (full-width PDF iframe + totals strip) |
| `/c/[token]` | Customer journey link (consumer skin) |
| `/m/[token]` | Manufacturing asset pack (48h expiry) |
| `/cad-share/[token]` | CAD partner review link |
| `/partner-signup` | Full-page signup form |

---

## 15. RECOMMENDED NEXT SESSION PROTOCOL

When you come back to build a feature, tell me:

1. **Which module/area** is it in? (orders, quotes, catalog, manufacturing, D2C, marketing, payments, inventory, diamonds, reseller storefront, etc.)
2. **Which user role** uses it? (master, sub, retailer, manufacturer, reseller, consumer, anonymous)
3. **Does it interact with existing data?** (gold rates, inventory, orders, partners, products, diamonds, etc.)
4. **Does it need public sharing or notifications?**
5. **Does it need PDF generation or scheduled processing?**

I'll reference this knowledge base and give you the exact files to touch, the exact API routes to create, and the exact database changes needed — without rebuilding the whole system.

---

*End of Living Architecture Knowledge Base v2.1 — Updated 2026-07-19*
