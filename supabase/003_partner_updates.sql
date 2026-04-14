-- ============================================================
-- Shewah B2B Admin — 003 Partner Portal Updates
-- Run this in Supabase SQL Editor → New Query
-- ============================================================

-- 1. Allow city and state to be null for partial applications
alter table partners alter column city drop not null;
alter table partners alter column state drop not null;

-- 2. Add 'pending_approval' to stages if checked, or just assume it is a valid text value.
-- (stage is just a text field with default 'prospect'. So 'pending_approval' is perfectly valid).

-- 3. Add catalog access tracking
create table if not exists catalog_access_requests (
  id uuid primary key default uuid_generate_v4(),
  partner_id uuid references partners(id) on delete cascade,
  status text default 'pending', -- 'pending', 'approved', 'expired'
  granted_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz default now()
);

alter table catalog_access_requests enable row level security;

create policy "Admins can do everything on catalog_access_requests"
  on catalog_access_requests for all
  using ( (select role from user_roles where user_id = auth.uid()) = 'admin' );

create policy "Partners can view own requests"
  on catalog_access_requests for select
  using ( partner_id = (select id from partners where user_id = auth.uid()) );

create policy "Partners can create requests"
  on catalog_access_requests for insert
  with check ( partner_id = (select id from partners where user_id = auth.uid()) );

-- 4. Order Placements directly from collections
alter table order_pipeline add column if not exists advance_reference_number text;
