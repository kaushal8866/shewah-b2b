# Shewah B2B

A Next.js 14 B2B admin panel for Shewah jewelry, built with Supabase as the database backend.

## Architecture

- **Framework**: Next.js 14 (App Router)
- **Database**: Supabase (PostgreSQL)
- **Styling**: Tailwind CSS
- **Charts**: Recharts
- **Icons**: Lucide React

## Project Structure

- `app/` - Next.js App Router pages
  - `analytics/` - Analytics dashboard
  - `cad-requests/` - CAD request management
  - `catalog/` - Product catalog
  - `circuits/` - Sales circuits
  - `gold-rates/` - Gold rate tracking
  - `manufacturing/` - Manufacturing tracking
  - `orders/` - Order management
  - `partners/` - Partner/retailer management
  - `portal/` - Partner portal
  - `settings/` - App settings
  - `vendors/` - Vendor management
- `lib/` - Shared utilities and Supabase client
- `supabase/` - Database schema

## Environment Variables

- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key

## Development

- Runs on port 5000 (Replit compatible)
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server

## Notes

- Migrated from Vercel to Replit
- Dev server binds to 0.0.0.0:5000 for Replit preview pane compatibility
