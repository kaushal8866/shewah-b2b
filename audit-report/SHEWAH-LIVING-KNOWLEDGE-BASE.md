# Shewah B2B — Living Architecture Knowledge Base

> **Version:** 2.0 | **Date:** 2026-06-27 | **Purpose:** Architectural decision support for future feature building

---

## How to Use This Doc

Before building any new feature, check these three things:

1. **Which user roles touch this?** (master, sub, manufacturer, retailer, reseller, storefront consumer, anonymous)
2. **Which data entities does it need?** (orders, products, partners, vendors, resellers, storefront configurations, configurator options, etc.)
3. **Which existing system rule will interact with it?** (gold-rate locking, float ledger, COGS snapshots, reseller active check, inventory/stock check constraint, karat purity factors)

This prevents you from building features that conflict with the existing business logic.

---

## 1. THE FOUR-PORTAL RULE

The app is split into **four separate apps** in one codebase, separated by middleware routing rules:

| Portal | Route Prefix | Auth Role | What They Can Do |
|--------|-----------|-----------|------------------|
| **Admin** | `/` (landing), `/dashboard`, `/orders`, `/catalog`, `/vendors`, etc. | `master`, `sub` | Everything. Master sees financials (COGS, margin, profitability). Sub users see only modules they have permissions for. |
| **Retailer** | `/portal/retailer/*` | `retailer` | Browse catalog, place orders, track orders, submit custom design briefs, browse ready-to-ship, view their own quotes. |
| **Manufacturer** | `/portal/manufacturer/*` | `manufacturer` | See assigned manufacturing orders, update status, add notes, download briefs. No pricing. No admin URLs. |
| **Reseller** | `/portal/reseller/*` | `reseller` | Configure white-labeled storefront (`/r/[token]`), set markups, manage sample inventory, handle storefront customer orders, check messaging. |

**Critical Sandbox Rule:** Middleware sandboxes manufacturers, retailers, and resellers to ONLY their portal routes. They get 403 on everything else. Any API under `/api/portal/<role>` must validate `session.user.role` and the specific ID (e.g., `partnerId`, `resellerId`, `manufacturingPartnerId`).

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

**Rule:** All gold inventory is held as **24K-pure net weight** (`gold_24k` in material_float / stock_movements). Karat is only a **labour-rate lens** at the catalog/order edges.

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

### 2.4 COGS Calculation

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

### 3.1 Core Business & Reseller Entities

```
partners (retailers/jewelers)
├── orders
├── visits
├── cad_requests
├── design_interests
├── customer_enquiries (D2C)
└── customers (D2C)

resellers (independent storefront operators)
├── reseller_invitations (onboarding flow)
├── reseller_themes (storefront customization settings)
├── reseller_product_prices (markup overrides per product)
├── reseller_orders (consumer purchases via storefront)
├── reseller_sample_ledger (assigned physical samples)
├── reseller_customers (consumers buying from reseller)
├── reseller_share_links (tokenized links for collections)
└── reseller_messages (chat support line)

products (catalog items)
├── design_collection_products (junction)
├── orders (FK: product_id, nullable for custom orders)
├── ready_to_ship_items
└── karat_pricing (JSONB cache per karat)
```

### 3.2 Inventory, Vendors & Ledger System

```
vendors (suppliers for metals, gems, boxes, findings)
└── inventory (linked inventory items for tracking and procurement)

stock_movements (central HQ inventory)
├── material_type: gold_24k | diamond_lgd | diamond_natural | finding
├── movement_type: purchase | issue | return_in | adjustment_in | adjustment_out
├── vendor_id (CHECK constraint: must be provided for 'purchase' type)
├── manufacturing_partner_id (for dual-write)
└── material_transaction_id (links to float)

material_float (per-karigar custody)
├── material_type: gold_24k | diamond_lgd | diamond_natural | silver
├── computed from material_transactions (no stored balance column)
└── balance = sum(deposits) - sum(returns) - sum(final_consumptions)
```

**Crucial stock constraint rule:** The database contains a `CHECK` constraint enforcing that all stock movements with `movement_type = 'purchase'` must contain a valid `vendor_id`. A vendor with a purchase history cannot be deleted (setting the ID to NULL violates this constraint). The UI must intercept deletes and offer to mark the vendor as `inactive` instead.

---

## 4. WHITE-LABEL STOREFRONT ARCHITECTURE (`/r/[token]`)

The system supports white-label e-commerce storefronts under `/r/[token]`, enabling resellers to host public catalogs.

### 4.1 Reseller Active Gate
Any visitor hitting `/r/[token]` or its associated pricing APIs (/api/r/[token]/price) must pass the **Active status check**:
1. Check the database to locate the reseller record matching the URL token.
2. If the reseller's status is not explicitly `'active'`, the storefront immediately renders a **"Storefront Temporarily Suspended"** notification (and the API routes return a `403 Forbidden` response).

### 4.2 Array Integrity Protection
Theme customization arrays (slides, reviews, navLinks, footer columns, catalog filters) are saved in the `reseller_themes` table. Since legacy themes might have stored arrays as objects, all loops and visual customizers must protect loops with `Array.isArray(x) ? x : []` safety guards to prevent client-side React rendering crashes.

---

## 5. API ROUTE CONVENTIONS

### 5.1 Admin API Proxy (`/api/db`)

All admin DB operations go through `/api/db`. It is a generic CRUD proxy:

```
POST /api/db
body: { table, op, values, filters, select, order, limit, range, single, count }
```

**Security:** Only `master` and `sub` roles can use this. Manufacturers, retailers, and resellers must use their dedicated `/api/portal/*` routes.

---

## 6. CONFIGURATOR CORE RULES

The configurator system under `/configurator/*` allows full dynamic configuration of metals, stones, finishes, and categories:
1. **cfg_metals & cfg_karats:** Central options and purity conversions.
2. **cfg_finishes:** Compatibility lists to restrict finishes based on metal or karat.
3. **cfg_stone_prices:** Multi-dimensional pricing grids matching diamond shapes, sizes, clarity grades, and color grades.
4. **cfg_rules:** Conditional engine to enforce exclusions or dependencies (e.g., hiding specific stone sizes on specific band profiles).

---

## 7. RECOMMENDED NEXT SESSION PROTOCOL

When you come back to build a feature, tell me:

1. **Which module/area** is it in? (orders, resellers, vendors, catalog configurator, etc.)
2. **Which user role** uses it? (master, sub, retailer, manufacturer, reseller, consumer)
3. **Does it interact with existing data?** (gold rates, vendor inventory, stock CHECK constraints, reseller active check, etc.)

I'll reference this knowledge base and give you the exact files to touch, the exact API routes to create, and the exact database changes needed — without rebuilding the whole system.

---

*End of Living Knowledge Base*
