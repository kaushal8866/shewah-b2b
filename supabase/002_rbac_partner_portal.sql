-- ============================================================
-- Shewah B2B Admin — 002 Partner Portal RBAC
-- Run this in Supabase SQL Editor → New Query
-- ============================================================

-- 1. Create user_roles table to manage access levels
create table if not exists user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'partner')),
  created_at timestamptz default now()
);

-- Enable RLS on user_roles
alter table user_roles enable row level security;

-- Admins can read all roles, partners can read own role
create policy "Users can read own role"
  on user_roles for select
  using (auth.uid() = user_id);

create policy "Admins can manage roles"
  on user_roles for all
  using (
    (select role from user_roles where user_id = auth.uid()) = 'admin'
  );


-- 2. Link Partners to Auth Users
-- Add an optional user_id to partners so a partner CRM record can be tied to a login
alter table partners 
add column if not exists user_id uuid references auth.users(id) on delete set null;

-- Enable RLS on partners
alter table partners enable row level security;

-- Admins can read/write all partners
create policy "Admins can do everything on partners"
  on partners for all
  using (
    (select role from user_roles where user_id = auth.uid()) = 'admin'
  );

-- Partners can read only their own partner profile
create policy "Partners can read own profile"
  on partners for select
  using (user_id = auth.uid());


-- 3. Secure Order Pipeline
alter table order_pipeline enable row level security;

create policy "Admins can do everything on orders"
  on order_pipeline for all
  using (
    (select role from user_roles where user_id = auth.uid()) = 'admin'
  );

create policy "Partners can read own orders"
  on order_pipeline for select
  using (
    partner_id = (select id from partners where user_id = auth.uid())
  );

-- 4. Secure CAD Requests
alter table cad_requests enable row level security;

create policy "Admins can do everything on cad requests"
  on cad_requests for all
  using (
    (select role from user_roles where user_id = auth.uid()) = 'admin'
  );

create policy "Partners can read own cad requests"
  on cad_requests for select
  using (
    partner_id = (select id from partners where user_id = auth.uid())
  );

create policy "Partners can create cad requests for themselves"
  on cad_requests for insert
  with check (
    partner_id = (select id from partners where user_id = auth.uid())
  );


-- 5. Secure Inventory Transactions
alter table inventory_transactions enable row level security;

create policy "Admins can do everything on inventory transactions"
  on inventory_transactions for all
  using (
    (select role from user_roles where user_id = auth.uid()) = 'admin'
  );

create policy "Partners can read their own received material transactions"
  on inventory_transactions for select
  using (
    partner_id = (select id from partners where user_id = auth.uid())
  );

-- 6. Make Products (Catalog) readable by everyone authenticated
alter table products enable row level security;

create policy "Admins can do everything on products"
  on products for all
  using (
    (select role from user_roles where user_id = auth.uid()) = 'admin'
  );

create policy "Anyone authenticated can view active products"
  on products for select
  using (auth.role() = 'authenticated' and is_active = true);
