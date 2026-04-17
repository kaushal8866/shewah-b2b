-- ============================================================
-- Shewah B2B — Phase 0: Hardening
-- Doctrine: SOP v1.0
-- ============================================================

-- 0. Drop views to allow column changes
drop view if exists order_pipeline;
drop view if exists partner_summary;

-- 1. Enums and Role Harmonization (§2.1, §11.2)
do $$ 
begin
  if not exists (select 1 from pg_type where typname = 'partner_status') then
    create type partner_status as enum ('hot', 'warm', 'cold');
  end if;
  if not exists (select 1 from pg_type where typname = 'partner_stage') then
    create type partner_stage as enum ('prospect', 'contacted', 'pending_approval', 'sample_sent', 'active', 'inactive');
  end if;
end $$;

-- Re-create user_roles with SOP-compliant roles
do $$ 
begin
  if not exists (select 1 from pg_tables where tablename = 'user_roles') then
    create table user_roles (
      user_id uuid primary key references auth.users(id) on delete cascade,
      role text not null check (role in ('owner', 'rep', 'partner')),
      created_at timestamptz default now()
    );
  else
    alter table user_roles drop constraint if exists user_roles_role_check;
    alter table user_roles add constraint user_roles_role_check check (role in ('owner', 'rep', 'partner'));
  end if;
end $$;

-- 2. Audit & Infrastructure columns (§4.2)
-- Helper function to add standard columns
create or replace function add_audit_columns(table_name text)
returns void as $$
begin
  execute format('alter table %I add column if not exists deleted_at timestamptz', table_name);
  execute format('alter table %I add column if not exists created_by uuid references auth.users(id)', table_name);
  execute format('alter table %I add column if not exists updated_by uuid references auth.users(id)', table_name);
end;
$$ language plpgsql;

-- Apply to all major tables
select add_audit_columns('partners');
select add_audit_columns('products');
select add_audit_columns('orders');
select add_audit_columns('cad_requests');
select add_audit_columns('gold_rates');
select add_audit_columns('circuits');
select add_audit_columns('visits');
select add_audit_columns('vendors');
select add_audit_columns('manufacturing_partners');
select add_audit_columns('manufacturing_orders');
select add_audit_columns('material_float');
select add_audit_columns('inventory');
select add_audit_columns('settings');
select add_audit_columns('catalog_access_requests');


-- 3. Data Type Hardening (Money as Paise, Weight as MG) (§4.2)
-- Partners: Convert status/stage to Enums
alter table partners 
  alter column status drop default,
  alter column stage drop default;

alter table partners 
  alter column status type partner_status using status::partner_status,
  alter column stage type partner_stage using stage::partner_stage;

alter table partners 
  alter column status set default 'cold'::partner_status,
  alter column stage set default 'prospect'::partner_stage;

-- Orders: Convert to bigint (multiply existing Rupees by 100 to get Paise)
alter table orders 
  alter column total_amount type bigint using (coalesce(total_amount, 0) * 100)::bigint,
  alter column trade_price type bigint using (coalesce(trade_price, 0) * 100)::bigint,
  alter column advance_paid type bigint using (coalesce(advance_paid, 0) * 100)::bigint,
  alter column balance_due type bigint using (coalesce(balance_due, 0) * 100)::bigint;

-- Products: Gold weight to milligrams (multiply grams by 1000)
alter table products 
  alter column gold_weight_g type integer using (coalesce(gold_weight_g, 0) * 1000)::integer;
comment on column products.gold_weight_g is 'Gold weight in milligrams (mg)';


-- 4. Activity Log (§2.3)
create table if not exists activity_log (
  id            uuid primary key default uuid_generate_v4(),
  created_at    timestamptz default now(),
  actor_id      uuid references auth.users(id),
  actor_role    text,
  action        text not null,
  entity_type   text not null,
  entity_id     uuid not null,
  before_value  jsonb,
  after_value   jsonb,
  ip            text,
  user_agent    text
);

alter table activity_log enable row level security;
create policy "Owners can read all logs" on activity_log
  for select using ((select role from user_roles where user_id = auth.uid()) = 'owner');

-- 5. Global Soft Delete Filter
-- Note: Supabase RLS policies are the best place to enforce this globally
create or replace function is_not_deleted()
returns boolean as $$
begin
  return (current_setting('app.include_deleted', true) = 'true') or (deleted_at is null);
end;
$$ language plpgsql;

-- 6. Strict RLS Reinforcement (§2.6)
-- Reset all existing policies first
do $$ 
declare
  pol record;
begin
  for pol in (select policyname, tablename from pg_policies where schemaname = 'public') loop
    execute format('drop policy %I on %I', pol.policyname, pol.tablename);
  end loop;
end $$;

-- Global helper to check roles
create or replace function get_my_role()
returns text as $$
  select role from user_roles where user_id = auth.uid();
$$ language sql security definer;

-- Example: Strict policies for Partners table
alter table partners enable row level security;
create policy "Owners can do everything" on partners for all 
  using (get_my_role() = 'owner');
create policy "Reps can see assigned partners" on partners for select
  using (get_my_role() = 'rep'); -- Assignment logic to be refined in Task 0.5
create policy "Partners can see own data" on partners for select
  using (user_id = auth.uid());

-- Re-enable RLS on all tables
alter table products enable row level security;
alter table orders enable row level security;
alter table cad_requests enable row level security;
alter table gold_rates enable row level security;
alter table circuits enable row level security;
alter table visits enable row level security;
alter table settings enable row level security;

-- Base policy: Owner-only for sensitive tables
create policy "Owner only full access" on settings for all using (get_my_role() = 'owner');
create policy "Owner only full access" on gold_rates for all using (get_my_role() = 'owner');

-- Base policy: Catalog visibility (§110 in 002)
create policy "Authenticated can view active catalog" on products for select
  using (auth.role() = 'authenticated' and is_active = true and deleted_at is null);

-- 7. Restore Views (updated for types)
create view order_pipeline as
select
  o.id, o.order_number, o.status, o.type, o.model,
  o.trade_price, o.total_amount, o.advance_paid,
  o.total_amount - o.advance_paid as balance_due,
  o.order_date, o.expected_delivery,
  o.advance_reference_number,
  p.store_name as partner_name, p.city as partner_city, p.id as partner_id,
  pr.name as product_name, pr.code as product_code
from orders o
left join partners p on o.partner_id = p.id
left join products pr on o.product_id = pr.id
where o.deleted_at is null;

create view partner_summary as
select
  p.id, p.store_name, p.owner_name, p.phone,
  p.city, p.circuit, p.status, p.stage,
  count(distinct o.id) as total_orders,
  coalesce(sum(o.total_amount), 0) as total_revenue,
  max(v.visit_date) as last_visit_date,
  count(distinct v.id) as total_visits
from partners p
left join orders o on o.partner_id = p.id and o.deleted_at is null
left join visits v on v.partner_id = p.id
where p.deleted_at is null
group by p.id;
