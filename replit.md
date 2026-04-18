# Shewah B2B

A Next.js 14 B2B admin panel for Shewah jewelry, built with Supabase as the database backend.

## Architecture

- **Framework**: Next.js 14 (App Router)
- **Database**: Supabase (PostgreSQL)
- **Auth**: NextAuth.js (credentials provider, JWT sessions, master/sub roles)
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

## Notes

- Migrated from Vercel to Replit
- Dev server binds to 0.0.0.0:5000 for Replit preview pane compatibility
- TypeScript target not set; use `Array.from(new Set(...))` instead of `[...new Set(...)]`
- AppShell skips rendering for `/login`, `/setup/*`, and `/showcase/*` paths
- `order_pipeline` view used for orders list
- Auth: username/password via `app_users` table (service role key required for RLS bypass)
- All client-side `supabase.from(...)` calls go through `/api/db` (NextAuth-gated DB proxy at `app/api/db/route.ts`) using service role; client wrapper in `lib/supabase.ts` is a thenable QueryBuilder. `app_users` is master-only. Public `/showcase/*` and `/api/showcase/*` use their own server routes with `supabaseAdmin`.
