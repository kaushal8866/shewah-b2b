-- ============================================================
-- Shewah B2B — Phase 1: Internal Governance
-- Doctrine: SOP §5 (Sales Ops) & §6 (Ethics)
-- ============================================================

-- 0. Identity Extension: Profiles
create table if not exists app_users (
  id            uuid primary key references auth.users(id) on delete cascade,
  full_name     text not null,
  phone         text,
  avatar_url    text,
  is_active     boolean default true,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

alter table app_users enable row level security;
create policy "Users can view all app_users" on app_users for select using (auth.role() = 'authenticated');
create policy "Users can update own profile" on app_users for update using (auth.uid() = id);

-- 1. Partner Governance
alter table partners 
  add column if not exists assigned_rep_id uuid references auth.users(id),
  add column if not exists credit_limit_paise bigint default 0,
  add column if not exists credit_approval_required boolean default false;

-- 2. Visit Hardening (SOP §5.1)
alter table visits 
  add column if not exists rep_id uuid references auth.users(id),
  add column if not exists lat numeric,
  add column if not exists long numeric,
  add column if not exists verification_distance_meters integer,
  add column if not exists is_geotagged boolean default false;

-- 3. Circuit Lifecycle (SOP §5.2)
alter table circuits 
  add column if not exists active_trip_rep_id uuid references auth.users(id),
  add column if not exists started_at timestamptz,
  add column if not exists closed_at timestamptz,
  add column if not exists expense_ledger jsonb default '{"petrol": 0, "stay": 0, "food": 0, "other": 0}'::jsonb,
  add column if not exists start_km integer,
  add column if not exists end_km integer;

-- 4. Order Ethics & Gates (§6.12)
do $$ 
begin
  if not exists (select 1 from pg_type where typname = 'governance_status') then
    create type governance_status as enum ('auto_approved', 'pending_approval', 'denied', 'owner_approved');
  end if;
end $$;

alter table orders 
  add column if not exists gov_status governance_status default 'auto_approved',
  add column if not exists gov_notes text;

-- 5. Tighten RLS for Sales Reps
-- Reset existing policies for tables being tightened
drop policy if exists "Reps can see assigned partners" on partners;
drop policy if exists "Authenticated can view active catalog" on products;

-- Partners: Reps see assigned only
create policy "Reps can see assigned partners" on partners for select
  using (
    (assigned_rep_id = auth.uid()) OR (get_my_role() = 'owner')
  );

-- Visits: Reps see own visits
create policy "Reps can see own visits" on visits for select
  using (
    (rep_id = auth.uid()) OR (get_my_role() = 'owner')
  );

-- Circuits: Reps see own circuits
create policy "Reps can see own circuits" on circuits for select
  using (
    (active_trip_rep_id = auth.uid()) OR (get_my_role() = 'owner')
  );

-- Products: Stay readable by all authenticated
create policy "Authenticated can view active catalog" on products for select
  using (auth.role() = 'authenticated' and is_active = true and deleted_at is null);

-- 6. Trigger for updated_at on app_users
create trigger app_users_updated_at before update on app_users
  for each row execute function update_updated_at();
