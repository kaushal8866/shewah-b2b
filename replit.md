# Shewah B2B

A Next.js 14 B2B admin panel for Shewah jewelry, built with Supabase as the database backend.

## Architecture

- **Framework**: Next.js 14 (App Router)
- **Database**: Supabase (PostgreSQL)
- **Auth**: NextAuth.js (credentials provider, JWT sessions; roles: master / sub / manufacturer / retailer)
- **Styling**: Tailwind CSS
- **Charts**: Recharts
- **Icons**: Lucide React

## Project Structure

- `app/` - Next.js App Router pages
  - `analytics/` - Analytics dashboard
  - `cad-requests/` - CAD request management
  - `catalog/` - Product catalog with 3 tabs (Products / Collections / Interest)
    - `collections/new/` - Create new design collection
    - `collections/[id]/` - Collection detail: product picker + partner link generator + view analytics
  - `circuits/` - Sales circuits
  - `gold-rates/` - Gold rate tracking
  - `manufacturing/` - Manufacturing tracking
  - `orders/` - Order management
  - `partners/` - Partner/retailer management
  - `settings/` - App settings (master only)
  - `showcase/[collectionId]/[partnerId]/` - **Public** partner showcase portal (no auth)
  - `vendors/` - Vendor management
  - `api/showcase/track/` - POST endpoint for showcase view tracking
- `components/AppShell.tsx` - Admin sidebar/nav (bypassed for /showcase/* routes)
- `lib/` - Shared utilities and Supabase client
- `middleware.ts` - Auth guard (excludes /showcase/* and /api/showcase/*)
- `scripts/setup_collections.sql` - Migration for 4 new tables (must run manually in Supabase Dashboard)
- `scripts/setup_material_ledger.sql` - **Task 5 migration: must run manually in Supabase SQL Editor.** Adds COGS/gold columns to `orders` (gold_weight_estimated/actual, gold_source, making_charges, cad_cost, stone_cost, total_cogs, margin, assigned_manufacturer_id), ensures `material_transactions.order_id` FK + negative-balance flag columns + BEFORE-INSERT trigger that flags (does not block) negative-balance rows, renames `total_withdrawn`→`total_returned` on `material_float`, and migrates the `transaction_type` value `withdrawal`→`return`. Canonical 4-type set: `deposit`, `consumption`, `return`, `adjustment`.
- `scripts/migrate_task14_whatsapp_notifications.sql` - **Task 14 migration: must run manually.** Adds `partners.notify_whatsapp boolean default true` and seeds settings keys `whatsapp_notifications_enabled`, `whatsapp_webhook_url`, `whatsapp_webhook_token`, `public_base_url`.

## Retailer WhatsApp notifications (Task 14)

`lib/whatsappNotify.ts` is a server-only util that sends a WhatsApp ping to the linked retailer when an admin order update changes `status` to a milestone (`cad_sent`, `design_approved`, `dispatched`, `delivered`) or fills/changes `tracking_number` / `courier`. The dispatcher is wired into `app/api/db/route.ts`: for any `op=update` on `orders`, the route snapshots the prior rows, performs the update, and then fire-and-forget calls `notifyRetailerOrderUpdate` per affected order. Failures are logged and never block the admin save.

Outbound delivery is a generic JSON POST to a configurable `whatsapp_webhook_url` (with optional `whatsapp_webhook_token` as `Authorization: Bearer ...`). Payload: `{ phone, message, orderId, trigger }`. Dispatch is gated by the global `whatsapp_notifications_enabled` setting and the per-retailer `partners.notify_whatsapp` flag (both editable from Settings → General and the partner edit page respectively). Message links use `public_base_url` and point at `/portal/retailer/orders/[id]`.

## Material ledger access control

`material_float` and `material_transactions` are master-only via the `/api/db` proxy and the float route is gated in `middleware.ts` (`/manufacturing/partners/*/float`). Sub users see no float widgets, no "Manage float" button, and the float page redirects them back to `/manufacturing`.

## Order COGS / gold integrity rules

Order detail / new pages collect COGS inputs and compute `total_cogs = (gold weight × gold rate × karat purity) + making + CAD + stone` and `margin = total_amount − total_cogs` via `computeOrderCogs()` in `lib/supabase.ts`.

Completion guard: an order **cannot** advance to `qc`, `dispatched` or `delivered` unless `gold_weight_actual` and `making_charges` are filled. When `gold_source = 'self'` it additionally requires a row in `material_transactions` with `order_id = <this order>` and `transaction_type = 'consumption'`. The order detail page surfaces a "Record gold consumption for this order" action that deep-links into the assigned manufacturer's float page with `?order_id=…&type=consumption&material_type=gold_<karat>k`. The float page reads those params and pre-fills the consumption form.

## Environment Variables

- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (used by NextAuth for user lookup)
- `NEXTAUTH_SECRET` - Session signing secret
- `NEXTAUTH_URL` - App URL for auth callbacks

## Development

- Runs on port 5000 (Replit compatible), host 0.0.0.0
- `npm run dev` - Start development server
- `npm run build` - Build for production

## Database Tables

Core tables: `partners`, `orders`, `order_items`, `cad_requests`, `products`, `gold_rates`, `vendors`, `vendor_inventory`, `circuits`, `manufacturing_partners`, `manufacturing_orders`, `app_users`

Design Portal tables (run `scripts/setup_collections.sql` first):
- `design_collections` - Curated product collections with publish status
- `design_collection_products` - Junction: collection ↔ products with sort order
- `design_interests` - Partner shortlists: partner + product + collection + note + quantity
- `showcase_views` - Visit tracking: partner × collection × timestamp

## Partner Design Portal Flow

1. Admin creates a collection in `/catalog` → Collections tab
2. Adds products to collection via product picker
3. Publishes the collection (flips `is_published = true`)
4. Copies a personalized link for each partner: `/showcase/[collectionId]/[partnerId]`
5. Pastes link in WhatsApp; partner opens on phone (no login required)
6. Partner browses product cards, taps heart to shortlist, optionally adds qty + notes
7. Interests auto-saved to `design_interests`; view recorded in `showcase_views`
8. Admin sees shortlisted items in `/catalog` → Interest tab with → Order / → CAD buttons
9. View counts per partner shown in collection admin with eye icon badge

## Pages

Admin routes (require login):
- List pages: `/partners`, `/orders`, `/cad-requests`, `/manufacturing`, `/catalog`, `/gold-rates`, `/vendors`, `/circuits`, `/analytics`, `/settings`
- Create forms: `/partners/new`, `/orders/new`, `/cad-requests/new`, `/catalog/new`, `/catalog/collections/new`, `/circuits/new`, `/manufacturing/orders/new`, `/manufacturing/partners/new`, `/vendors/new`, `/vendors/inventory/new`
- Detail pages: `/partners/[id]`, `/orders/[id]`, `/cad-requests/[id]`, `/circuits/[id]`, `/manufacturing/orders/[id]`, `/manufacturing/partners/[id]`, `/vendors/[id]`, `/catalog/collections/[id]`

Public routes (no auth):
- `/showcase/[collectionId]/[partnerId]` - Partner design showcase portal

Manufacturer Portal (Task #6 — requires `scripts/migrate_task6_manufacturer_portal.sql`):
- `/portal/manufacturer` - Order list scoped to logged-in manufacturer's `manufacturing_partner_id`
- `/portal/manufacturer/orders/[id]` - Detail: status update, manufacturer notes, progress photos
- API: `/api/portal/manufacturer/orders` (GET list) and `/api/portal/manufacturer/orders/[id]` (GET / PATCH)
- Manufacturers cannot reach `/api/db` or any admin route — middleware redirects them to their portal
- Master admins create manufacturer logins from Settings → User management → "Manufacturer" tile

Retailer Portal (Task #7 — uses the same `partner_id` column added in Task #6 migration):
- `/portal/retailer` - Catalog grid (active products, no internal cost / margin fields)
- `/portal/retailer/catalog/[id]` - Product detail + inline catalog order form
- `/portal/retailer/custom` - Custom design brief form (text + reference image uploads)
- `/portal/retailer/orders` - List of the retailer's own orders with pipeline status
- `/portal/retailer/orders/[id]` - Order detail with status pipeline and dispatch / tracking info
- API: `/api/portal/retailer/catalog`, `/api/portal/retailer/catalog/[id]`,
  `/api/portal/retailer/orders` (GET list / POST new), `/api/portal/retailer/orders/[id]` (GET)
- Retailers cannot reach `/api/db` or any admin route — middleware redirects them to their portal
- Master admins create retailer logins from Settings → User management → "Retailer" tile, picking
  the linked row in `partners`

## Notes

- Migrated from Vercel to Replit
- Dev server binds to 0.0.0.0:5000 for Replit preview pane compatibility
- TypeScript target not set; use `Array.from(new Set(...))` instead of `[...new Set(...)]`
- AppShell skips rendering for `/login`, `/setup/*`, and `/showcase/*` paths
- `order_pipeline` view used for orders list
- Auth: username/password via `app_users` table (service role key required for RLS bypass)
- All client-side `supabase.from(...)` calls go through `/api/db` (NextAuth-gated DB proxy at `app/api/db/route.ts`) using service role; client wrapper in `lib/supabase.ts` is a thenable QueryBuilder. `app_users` is master-only. Public `/showcase/*` and `/api/showcase/*` use their own server routes with `supabaseAdmin`. The `/api/db` proxy is restricted to roles `master | sub` only — manufacturer/retailer logins must use their own portal API endpoints.
