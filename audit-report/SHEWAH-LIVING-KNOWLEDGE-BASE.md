# Shewah B2B — Living Architecture Knowledge Base

> **Version:** 1.0 | **Date:** 2025-06-17 | **Purpose:** Architectural decision support for future feature building

---

## How to Use This Doc

Before building any new feature, check these three things:

1. **Which user roles touch this?** (master, sub, manufacturer, retailer, anonymous)
2. **Which data entities does it need?** (orders, products, partners, manufacturing_orders, quotes, etc.)
3. **Which existing system rule will interact with it?** (gold-rate locking, float ledger, COGS snapshots, WhatsApp webhooks, karat pricing)

This prevents you from building features that conflict with the existing business logic.

---

## 1. THE THREE-PORTAL RULE

The app is actually **three separate apps** in one codebase, separated by middleware:

| Portal | Route Prefix | Auth Role | What They Can Do |
|--------|-----------|-----------|------------------|
| **Admin** | `/` (landing), `/dashboard`, `/orders`, `/catalog`, etc. | `master`, `sub` | Everything. Master sees financials (COGS, margin, profitability). Sub users see only modules they have permissions for. |
| **Retailer** | `/portal/retailer/*` | `retailer` | Browse catalog, place orders, track orders, submit custom design briefs, browse ready-to-ship, view their own quotes. |
| **Manufacturer** | `/portal/manufacturer/*` | `manufacturer` | See assigned manufacturing orders, update status, add notes, download briefs. No pricing. No admin URLs. |

**Critical rule:** Middleware sandboxes manufacturers and retailers to ONLY their portal routes. They get 403 on everything else. Any API under `/api/portal/<role>` must validate `session.user.role` and the specific ID (e.g., `partnerId`, `manufacturingPartnerId`).

---

## 2. THE GOLD / KARAT MATHEMATICS (Immutable Rules)

These are the **most important business rules** in the entire system. Do not break them.

### 2.1 Karat Purity Factors (Single Source of Truth)

Stored in `lib/karat.ts`:

```
24K = 1.000
22K = 0.916
18K = 0.750
14K = 0.600
10K = 0.420
9K  = 0.380
```

**Rule:** All gold inventory is held as **24K-pure net weight** (`gold_24k` in material_float / stock_movements). Karat is only a **labour-rate lens** at the catalog/order edges. See Task #78.

### 2.2 Pricing Formula (Immutable)

For any product/order:

```
netGoldWeight = user-entered gross weight (stored in gold_weight_22k)
pureMassForKarat(k) = netGoldWeight × KARAT_FACTORS[k]
goldCost(k) = pureMassForKarat(k) × rate24k
labourCost(k) = retailLabourRate(k) × max(netGoldWeight, 1g)
cogs(k) = goldCost(k) + labourCost(k) + diamondCost + making_charges + igiCost
tradePrice(k) = round(cogs(k) × 1.28)   // margin multiplier
mrp(k) = round(tradePrice(k) × 1.40)    // retail markup
```

**Default karat is 22K** for trade_price and mrp_suggested.

### 2.3 Order Rate Locking (CRITICAL)

**Every order stores its own `gold_rate_at_order` snapshot at creation time.** The trade price is locked. Editing an order later never re-prices it. This is a guarantee to retailers.

- Admin: `app/orders/new/page.tsx` captures the current gold rate
- Retailer portal: `app/api/portal/retailer/orders/route.ts` captures the current gold rate
- Catalog: `recomputeCatalogPrices()` only touches `products` table, never `orders`

**Do NOT** build a feature that re-prices existing orders automatically.

### 2.4 COGS Calculation (Task #68 + #78)

```
gold_cost = gold_weight_actual × gold_rate_at_order × KARAT_FACTORS[gold_karat]
labour_cost = labour_per_gram × max(gross_weight, min_labour_grams)
total_cogs = gold_cost + labour_cost + cad_cost + stone_cost
margin = total_amount - total_cogs
```

Labour rate comes from the assigned manufacturing partner's per-karat rate (`labour_rate_22k`, `labour_rate_18k`, etc.). If no partner, falls back to `making_charges`.

**COGS lives in the `orders` row** and is calculated on-demand or when the admin saves actual manufacturing data.

---

## 3. DATABASE ENTITY MAP

### 3.1 Core Business Entities

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

### 3.2 Inventory / Ledger System

```
stock_movements (central HQ inventory)
├── material_type: gold_24k | diamond_lgd | diamond_natural | finding
├── movement_type: purchase | issue | return_in | adjustment_in | adjustment_out
├── manufacturing_partner_id (for dual-write)
└── material_transaction_id (links to float)

material_float (per-karigar custody)
├── material_type: gold_24k | diamond_lgd | diamond_natural | silver
├── computed from material_transactions (no stored balance column)
└── balance = sum(deposits) - sum(returns) - sum(final_consumptions)

material_transactions (the ledger)
├── transaction_type: deposit | consumption | return | adjustment
├── lifecycle: pending | final
└── quantity (in 24K-pure grams for gold, carats for diamond)
```

### 3.3 D2C / Consumer Entities

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

### 3.4 Quotation System

```
quotes
├── quote_items (line items)
├── quote_share_links (public tokenized links)
└── partner_id (nullable for walk-in/D2C)

quote_items
├── diamonds (JSONB array of DiamondSpec)
├── karat, gross_gold_weight_g, net_24kt_weight_g
├── labour_rate_per_g, labour_total
├── line_cogs, line_trade, line_total
```

---

## 4. DATA FLOW MAPS

### 4.1 Order Creation Flows

**Admin creates order:**
```
app/orders/new/page.tsx → POST /api/db → orders table
                          (captures gold_rate_at_order from latest gold_rates)
```

**Retailer places order via portal:**
```
app/portal/retailer/catalog → POST /api/portal/retailer/orders
  → Validates product_id, is_active
  → Captures gold_rate_at_order, selected_karat, retail_labour_at_order
  → Locks trade_price from product.karat_pricing[selected_karat]
  → Creates order row with status='brief_received'
```

**Quote converts to order:**
```
app/quotes/[id]/page.tsx → POST /api/quotes/[id]/convert-to-order
  → Extracts first quote item as prefill payload
  → Stores in sessionStorage
  → Redirects to /orders/new?source=quote
```

### 4.2 Manufacturing Assignment Flow

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
```

### 4.3 Gold Rate Change Cascade

```
Admin saves gold rate: app/gold-rates/page.tsx
  → POST /api/db → gold_rates
  → Triggers recomputeCatalogPrices() in lib/supabase.ts
    → Fetches all active products
    → For each product: computes per-karat pricing
    → Updates products.karat_pricing, trade_price, mrp_suggested, priced_at_rate, priced_at
  → Does NOT touch orders table
```

---

## 5. API ROUTE CONVENTIONS

### 5.1 Admin API Proxy (`/api/db`)

All admin DB operations go through `/api/db`. It is a generic CRUD proxy:

```
POST /api/db
body: { table, op, values, filters, select, order, limit, range, single, count }
```

**Allowed tables:** `partners`, `visits`, `orders`, `products`, `gold_rates`, `circuits`, `manufacturing_partners`, `manufacturing_orders`, `design_collections`, `material_float`, `material_transactions`, `stock_movements`, `quotes`, `quote_items`, `customers`, `customer_enquiries`, `production_updates`, `customer_journey_links`, etc.

**Master-only tables:** `app_users`, `material_float`, `material_transactions`, `reconciliation_alerts`, `stock_movements` (sub users get 403).

**Security:** Only `master` and `sub` roles can use this. Manufacturers and retailers must use their dedicated `/api/portal/*` routes.

### 5.2 Portal API Routes

```
/api/portal/retailer/orders       → GET (own orders), POST (new order)
/api/portal/retailer/orders/[id]  → GET (own order), PATCH (change request)
/api/portal/retailer/catalog      → GET (browse products with karat pricing)
/api/portal/retailer/quote-preview → GET (price preview for karat selection)
/api/portal/retailer/profile      → GET/PATCH (own profile)
/api/portal/retailer/ready-to-ship → GET (available items), POST (offer)

/api/portal/manufacturer/orders       → GET (assigned orders)
/api/portal/manufacturer/orders/[id] → GET/PATCH (update status, notes)
```

### 5.3 Public/Unauthenticated Routes

```
/api/public/partner-signup    → POST (lead capture, rate-limited, honeypot)
/api/c/[token]                → GET (customer journey link, consumer skin)
/api/q/[token]                → GET (quote share link, client view)
/api/cad-share/[token]        → GET (CAD partner review link)
/api/showcase/track           → POST (collection view tracking)
/api/showcase/interests       → POST (design interest from showcase)
```

---

## 6. STATE MANAGEMENT PATTERNS

### 6.1 Server-Side State

- **No global state manager** (no Redux, no Zustand). Each page loads its own data.
- Client components use `useEffect` + `useState` to fetch data via `supabase` client (the QueryBuilder proxy) or direct `fetch`.
- Dashboards poll every 60 seconds (`setInterval` in `useEffect`).

### 6.2 Session / Auth

- NextAuth.js with JWT strategy (30-day expiry)
- Token contains: `id`, `username`, `displayName`, `role`, `permissions`, `manufacturingPartnerId`, `partnerId`
- Middleware reads the token and enforces role-based routing
- Portal layouts (`portal/retailer/layout.tsx`, `portal/manufacturer/layout.tsx`) are isolated — they don't use AppShell.

### 6.3 Data Sharing Between Pages

- **sessionStorage** for cross-page prefill (e.g., quote-to-order conversion)
- **URL query params** for filter state (e.g., `/catalog?tab=products`)
- **No global context** beyond NextAuth SessionProvider

---

## 7. CRITICAL FILES & THEIR RESPONSIBILITIES

| File | What it owns | Don't touch without knowing |
|------|-------------|---------------------------|
| `lib/karat.ts` | All karat purity math. | Breaks pricing everywhere. |
| `lib/supabase.ts` | QueryBuilder proxy, all types, price recomputation, COGS helper. | Client-side DB contract. |
| `lib/supabaseAdmin.ts` | Service role client for server-side APIs. | Must never leak to client. |
| `lib/quoteCompute.ts` | Quote item calculation, totals, GST logic. | Quote pricing engine. |
| `lib/mfgOrderLifecycle.ts` | Float side-effects of mfg status changes. | Material ledger integrity. |
| `lib/centralStock.ts` | Central stock movements, dual-write to float. | Inventory accuracy. |
| `lib/floatBuckets.ts` | Float bucket computation (available/reserved/used). | Karigar balance display. |
| `middleware.ts` | Route access control, A/B cookie, landing variant. | Portal security. |
| `app/api/db/route.ts` | Generic CRUD proxy for admin tables. | Table allowlist, master-only gates. |
| `lib/whatsappNotify.ts` | WhatsApp webhook integration. | All notification logic. |

---

## 8. SECURITY ARCHITECTURE

### 8.1 What Protects What

| Layer | Mechanism |
|-------|-----------|
| Route access | `middleware.ts` + NextAuth token |
| API access | `getServerSession` in each route handler |
| Portal data scope | Filters by `partnerId` or `manufacturingPartnerId` |
| DB row access | Supabase RLS (service_role for admin, auth check for portals) |
| Public endpoints | Rate limiting, honeypot fields, IP hashing |

### 8.2 Known Security Gaps

1. **No CSRF protection** on `/api/db` — the proxy blindly accepts any POST from an authenticated session. A malicious page could craft requests.
2. **No rate limiting** on `/api/db` — a sub user could flood the proxy.
3. **No input validation** on the generic `/api/db` proxy — it accepts arbitrary `filters` arrays and passes them to Supabase. Malicious `or` filters could potentially exfiltrate data.
4. **No audit log** for who changed what — no `created_by`, `updated_by` on most tables (except `stock_movements` and `customer_enquiry_activity`).
5. **No API versioning** — adding a breaking change to `/api/db` breaks all clients simultaneously.

---

## 9. THE MOST IMPORTANT COORDINATION GAPS

### 9.1 Quote → Order Conversion Is Fragile

The quote-to-order flow uses `sessionStorage` to pass data between pages. If the user refreshes the order page, the prefill is lost. There's no database-level link between a quote and the resulting order (the quote gets `status='converted_to_order'` but the order doesn't know it came from a quote).

**If you build:** Better quote-to-order flow, you need to add `quote_id` to the `orders` table and make the conversion atomic.

### 9.2 D2C and B2B Orders Are Mixed in One Table

`orders` serves both retailer orders (B2B) and consumer orders (D2C). The `type` column is `'catalog'` or `'custom'` — not `'b2b'` or `'d2c'`. D2C is inferred by `customer_id` being set or `audience` column.

**If you build:** D2C-specific features, always check `customer_id` or `audience` to avoid showing consumer data to retailers and vice versa.

### 9.3 Manufacturing Orders Have No Link Back to Customer Orders for Partial Shipments

A customer order can have multiple manufacturing orders, but there's no concept of "which manufacturing order fulfilled which portion of the customer order." This makes partial delivery and splitting orders difficult.

**If you build:** Partial delivery, split order, or multi-item order tracking, you need a `fulfillment_items` junction table linking `orders` ↔ `manufacturing_orders` with quantity mapping.

### 9.4 Stock Movements and Material Float Are Dual-Written but Not Atomic

`issueToPartner()` in `lib/centralStock.ts` writes a `material_transactions` row first, then a `stock_movements` row. If the second write fails, it tries to delete the first. But there's no database-level atomicity (no 2PC). Under a crash or network failure, the two ledgers can diverge.

**If you build:** More sophisticated inventory operations, you need a transaction wrapper or a queue-based reconciliation job.

### 9.5 There's No Audit Trail for Order Changes

The `orders` table has `updated_at` but no `updated_by` and no change history. The `order_change_requests` table captures retailer-initiated changes, but admin edits are invisible.

**If you build:** Audit trails, compliance features, or "who changed this price" queries, you need an `order_history` table or use a PostgreSQL trigger + audit table.

### 9.6 Payments Are Not Integrated

`order_payments` exists as a simple ledger (date, amount, method, reference), but there's no:
- Integration with Razorpay, UPI, or any payment gateway
- Automatic reconciliation of payment status
- Payment link generation for customers
- Payment status on the retailer portal

**If you build:** Payment integration, the existing `order_payments` table is a good starting point but you'll need a payment gateway webhook handler and a status machine (`pending`, `confirmed`, `failed`, `refunded`).

### 9.7 No Inventory Reservation for Orders

When an order is placed, nothing is reserved from stock or float. The manufacturing order is issued manually later. There's no "check if we have enough gold to fulfill this order" logic.

**If you build:** Inventory-aware order validation, you need to compute `required_gold = sum(orders.gold_weight_estimated × KARAT_FACTORS[gold_karat])` against `stock_balances` and `material_float.available`.

### 9.8 Ready-to-Ship Items Have No Reservation Logic

`ready_to_ship_items` tracks items with status (`available`, `reserved`, `sold`, `withdrawn`), but there's no atomic reservation mechanism. A retailer could theoretically claim the same item twice if requests arrive simultaneously.

**If you build:** E-commerce-style ready-to-ship purchasing, you need a `reserved_until` timestamp and a lock mechanism.

### 9.9 No Multi-User Coordination for CAD Reviews

CAD revisions use `cad_revisions` table, but there's no assignment of who is the CAD designer, no work queue, and no "CAD designer X is working on this" locking. Multiple designers could overwrite each other's work.

**If you build:** CAD team workflow, you need a `cad_assignments` table or a status field on `cad_requests` indicating who is currently assigned.

### 9.10 No Commission or Partner Revenue Sharing

The system tracks `margin` per order (selling price - COGS), but there's no concept of:
- Sales rep commissions
- Retailer volume discounts or tiered pricing
- Partner loyalty programs or credits
- Profit sharing with manufacturing partners

**If you build:** Incentive systems, you'll need to add commission tables, discount tiers, or partner credit ledgers.

---

## 10. FEATURE BUILDING DECISION TREE

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
  → Yes → Use lib/whatsappNotify.ts or lib/leadNotify.ts
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
```

---

## 11. THE "WHAT WILL BREAK IF YOU CHANGE THIS" LIST

| If you change... | What will break |
|-----------------|-----------------|
| `KARAT_FACTORS` | All pricing, all COGS, all float conversions, all inventory balances |
| `products` table schema (add column) | `/api/db` allowlist needs update; `recomputeCatalogPrices()` may need update; retailer portal pricing may break |
| `orders` table schema | `order_pipeline` view needs update; retailer portal order list needs update; `/api/portal/retailer/orders` may need update; COGS calculation needs update |
| `gold_rates` table schema | `recomputeCatalogPrices()` needs update; `calculateGoldRates()` needs update |
| `middleware.ts` matcher | Public routes may become 403; portal routes may leak to wrong roles |
| `ALLOWED_TABLES` in `/api/db` | Admin pages that used that table will break |
| `next-auth` session shape | Every page that reads `session.user.role`, `permissions`, `partnerId`, or `manufacturingPartnerId` will break |
| `lib/supabase.ts` QueryBuilder | Every page in the app that does client-side DB calls will break |
| `whatsappNotify.ts` webhook format | All WhatsApp notifications stop working |

---

## 12. RECOMMENDED NEXT SESSION PROTOCOL

When you come back to build a feature, tell me:

1. **Which module/area** is it in? (orders, quotes, catalog, manufacturing, D2C, marketing, payments, etc.)
2. **Which user role** uses it? (master, sub, retailer, manufacturer, consumer, anonymous)
3. **Does it interact with existing data?** (gold rates, inventory, orders, partners, products, etc.)
4. **Does it need public sharing or notifications?**

I'll reference this knowledge base and give you the exact files to touch, the exact API routes to create, and the exact database changes needed — without rebuilding the whole system.

---

## 13. QUICK REFERENCE: TABLE SCHEMAS AT A GLANCE

### orders (core table)
```
id, order_number, partner_id, product_id, type, model, quantity, ring_size
special_notes, brief_text, brief_images, cad_request_id
gold_rate_at_order, trade_price, total_amount, advance_paid, balance_due
status (brief_received → cad_in_progress → cad_sent → design_approved → production → qc → dispatched → delivered)
order_date, expected_delivery, actual_delivery, tracking_number, courier, dispatch_date
internal_notes, gold_source, gold_weight_estimated, gold_weight_actual, making_charges, cad_cost, stone_cost, total_cogs, margin
assigned_manufacturer_id
selected_karat, gross_weight_at_karat, gold_pure_24kt_g, retail_labour_at_order
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
subtotal, gst_amount, grand_total, share_token
```

### products
```
id, code, name, description, category, diamond_weight, diamond_shape, diamond_quality, diamond_color, diamond_type
gold_karat, gold_weight_g, gold_weight_22k, gold_weight_18k, gold_weight_14k, gold_weight_10k, gold_weight_9k
karat_pricing (JSONB), diamond_cost, making_charges, igi_cert_cost, trade_price, mrp_suggested
priced_at_rate, priced_at, photo_urls, is_active, delivery_days, models_available, tags
```

---

*End of Living Knowledge Base*
