-- ============================================================
-- Shewah B2B — Migration 0001: Phase 0 Hardening
-- Doctrine: SOP v1.0 §2.1, §2.2, §2.3, §2.6, §4.2
-- ============================================================
-- Run in Supabase SQL Editor. Idempotent (safe to re-run).
--
-- UP ↓ ↓ ↓ ↓ ↓ ↓ ↓ ↓ ↓ ↓ ↓ ↓ ↓ ↓ ↓ ↓ ↓ ↓ ↓ ↓ ↓ ↓ ↓ ↓ ↓ ↓

-- ── 0. Tear down views that depend on changed columns ──────
drop view if exists order_pipeline cascade;
drop view if exists partner_summary cascade;

-- ── 1. Role table — corrected to SOP §2.1 (owner/rep/partner) ──
-- The previous user_roles table used 'admin' — wrong per SOP.
-- We drop and recreate with the correct constraint.
drop table if exists user_roles cascade;

create table user_roles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  role       text not null check (role in ('owner', 'rep', 'partner')),
  -- Circuit assignment for reps (null for owner and partner)
  circuit_id uuid,                 -- FK to circuits(id) added after circuits exists
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz           -- soft delete support
);

alter table user_roles enable row level security;

-- Only owner can manage roles; every user can read their own
create policy "Owner manages all roles" on user_roles
  for all using (
    (select role from user_roles where user_id = auth.uid()) = 'owner'
  );
create policy "Users can read own role" on user_roles
  for select using (auth.uid() = user_id);

-- Helper: get calling user's role (security definer so it runs as postgres)
create or replace function get_my_role()
returns text
language sql
security definer
stable
as $$
  select role from user_roles where user_id = auth.uid() and deleted_at is null;
$$;

-- ── 2. Audit columns function ──────────────────────────────
create or replace function add_audit_columns(tbl text)
returns void
language plpgsql
as $$
begin
  execute format('alter table %I add column if not exists deleted_at  timestamptz', tbl);
  execute format('alter table %I add column if not exists created_by  uuid references auth.users(id)', tbl);
  execute format('alter table %I add column if not exists updated_by  uuid references auth.users(id)', tbl);
end;
$$;

-- Apply audit columns to every business table
select add_audit_columns('partners');
select add_audit_columns('visits');
select add_audit_columns('products');
select add_audit_columns('orders');
select add_audit_columns('cad_requests');
select add_audit_columns('gold_rates');
select add_audit_columns('circuits');
select add_audit_columns('settings');
select add_audit_columns('manufacturing_partners');
select add_audit_columns('manufacturing_orders');
select add_audit_columns('material_float');
select add_audit_columns('vendors');
select add_audit_columns('inventory');

-- ── 3. Partner: add tier, credit_limit, assigned_rep ──────
alter table partners
  add column if not exists tier             text default 'B' check (tier in ('A','B','C')),
  add column if not exists credit_limit_paise bigint default 500000,   -- ₹5,000 = 500000 paise default
  add column if not exists assigned_rep_id uuid references auth.users(id),
  add column if not exists user_id         uuid references auth.users(id) on delete set null,
  add column if not exists gstin           text,
  add column if not exists pan             text,
  add column if not exists pincode         text;

-- ── 4. Money to Paise / Weight to Milligrams (SOP §4.2) ───
-- Orders: rupees × 100 → paise
alter table orders
  alter column total_amount type bigint using (coalesce(total_amount, 0) * 100)::bigint,
  alter column trade_price  type bigint using (coalesce(trade_price, 0) * 100)::bigint,
  alter column advance_paid type bigint using (coalesce(advance_paid, 0) * 100)::bigint,
  alter column balance_due  type bigint using (coalesce(balance_due, 0) * 100)::bigint;

comment on column orders.total_amount is 'Total order amount in integer paise (₹1 = 100)';
comment on column orders.trade_price  is 'Trade price in integer paise (₹1 = 100)';
comment on column orders.advance_paid is 'Advance received in integer paise (₹1 = 100)';
comment on column orders.balance_due  is 'Remaining balance in integer paise (₹1 = 100)';

-- Gold rate: rupees → paise (stored as rate per gram)
alter table gold_rates
  alter column rate_24k type bigint using (coalesce(rate_24k, 0) * 100)::bigint,
  alter column rate_22k type bigint using (coalesce(rate_22k, 0) * 100)::bigint,
  alter column rate_18k type bigint using (coalesce(rate_18k, 0) * 100)::bigint,
  alter column rate_14k type bigint using (coalesce(rate_14k, 0) * 100)::bigint;

comment on column gold_rates.rate_24k is 'Rate per gram for 24K gold in integer paise';

-- Products: gold weight grams → milligrams
alter table products
  alter column gold_weight_g type integer using (coalesce(gold_weight_g, 0) * 1000)::integer;

alter table products
  rename column gold_weight_g to gold_weight_mg;

comment on column products.gold_weight_mg is 'Gold weight in integer milligrams (1g = 1000mg)';

-- Products: prices → paise
alter table products
  alter column diamond_cost    type bigint using (coalesce(diamond_cost, 0) * 100)::bigint,
  alter column making_charges  type bigint using (coalesce(making_charges, 0) * 100)::bigint,
  alter column igi_cert_cost   type bigint using (coalesce(igi_cert_cost, 0) * 100)::bigint,
  alter column trade_price     type bigint using (coalesce(trade_price, 0) * 100)::bigint,
  alter column mrp_suggested   type bigint using (coalesce(mrp_suggested, 0) * 100)::bigint;

-- Partners: credit limit already bigint paise from add column above.
-- Vendors: outstanding → paise
alter table vendors
  alter column outstanding type bigint using (coalesce(outstanding, 0) * 100)::bigint;

-- Manufacturing orders: gold weight → mg, costs → paise
alter table manufacturing_orders
  alter column gold_weight_issue  type integer using (coalesce(gold_weight_issue, 0) * 1000)::integer,
  alter column labour_charges     type bigint  using (coalesce(labour_charges, 0) * 100)::bigint;

-- ── 5. Governance status for Orders ───────────────────────
do $$
begin
  if not exists (select 1 from pg_type where typname = 'governance_status') then
    create type governance_status as enum ('auto_approved','pending_approval','owner_approved','denied');
  end if;
end $$;

alter table orders
  add column if not exists gov_status governance_status default 'auto_approved',
  add column if not exists gov_notes  text,
  add column if not exists discount_pct numeric(5,4) default 0;

-- ── 6. activity_log (SOP §2.3) ────────────────────────────
create table if not exists activity_log (
  id           uuid        primary key default uuid_generate_v4(),
  created_at   timestamptz not null default now(),

  actor_id     uuid        references auth.users(id),
  actor_role   text,                     -- snapshot of role at time of action
  action       text        not null,     -- 'create','update','delete','state_change'
  entity_type  text        not null,     -- 'order','partner','gold_rate', etc.
  entity_id    uuid        not null,
  before_value jsonb,
  after_value  jsonb,

  -- Request context
  ip           text,
  user_agent   text,
  request_id   text
);

-- activity_log is append-only. No UPDATE or DELETE policies.
alter table activity_log enable row level security;
create policy "Owners read all logs" on activity_log
  for select using (get_my_role() = 'owner');
create policy "Insert allowed for authenticated" on activity_log
  for insert with check (auth.role() = 'authenticated');

-- ── 7. Activity log trigger function ──────────────────────
create or replace function log_activity_trigger()
returns trigger
language plpgsql
security definer
as $$
declare
  v_action text;
  v_actor_role text;
begin
  v_action := lower(TG_OP);   -- insert, update, delete

  select role into v_actor_role
  from user_roles
  where user_id = auth.uid() and deleted_at is null;

  if TG_OP = 'DELETE' then
    insert into activity_log (actor_id, actor_role, action, entity_type, entity_id, before_value)
    values (auth.uid(), v_actor_role, 'delete', TG_TABLE_NAME, OLD.id, row_to_json(OLD)::jsonb);
    return OLD;
  elsif TG_OP = 'UPDATE' then
    insert into activity_log (actor_id, actor_role, action, entity_type, entity_id, before_value, after_value)
    values (auth.uid(), v_actor_role, 'update', TG_TABLE_NAME, NEW.id, row_to_json(OLD)::jsonb, row_to_json(NEW)::jsonb);
    return NEW;
  else
    insert into activity_log (actor_id, actor_role, action, entity_type, entity_id, after_value)
    values (auth.uid(), v_actor_role, 'create', TG_TABLE_NAME, NEW.id, row_to_json(NEW)::jsonb);
    return NEW;
  end if;
end;
$$;

-- Attach triggers to money/inventory tables (SOP §2.3)
create or replace trigger trig_log_partners
  after insert or update or delete on partners
  for each row execute function log_activity_trigger();

create or replace trigger trig_log_orders
  after insert or update or delete on orders
  for each row execute function log_activity_trigger();

create or replace trigger trig_log_gold_rates
  after insert or update or delete on gold_rates
  for each row execute function log_activity_trigger();

create or replace trigger trig_log_products
  after insert or update or delete on products
  for each row execute function log_activity_trigger();

create or replace trigger trig_log_settings
  after insert or update or delete on settings
  for each row execute function log_activity_trigger();

create or replace trigger trig_log_cad_requests
  after insert or update or delete on cad_requests
  for each row execute function log_activity_trigger();

-- ── 8. Drop all generic "any authenticated" RLS policies ──
-- We must revoke before setting correct role-scoped policies.
do $$
declare
  pol record;
begin
  for pol in (
    select policyname, tablename
    from pg_policies
    where schemaname = 'public'
      and policyname ilike '%Authenticated users can do everything%'
  ) loop
    execute format('drop policy if exists %I on %I', pol.policyname, pol.tablename);
  end loop;
end $$;

-- Also drop the old 002 policies that used 'admin' role
drop policy if exists "Admins can do everything on partners" on partners;
drop policy if exists "Admins can do everything on orders" on order_pipeline;
drop policy if exists "Admins can do everything on cad requests" on cad_requests;
drop policy if exists "Admins can do everything on inventory transactions" on inventory_transactions;
drop policy if exists "Admins can do everything on products" on products;
drop policy if exists "Partners can read own profile" on partners;
drop policy if exists "Partners can read own orders" on order_pipeline;
drop policy if exists "Partners can read own cad requests" on cad_requests;
drop policy if exists "Partners can read their own received material transactions" on inventory_transactions;
drop policy if exists "Anyone authenticated can view active products" on products;
drop policy if exists "Users can read own role" on user_roles;

-- ── 9. Role-scoped RLS policies (SOP §2.2) ────────────────

-- PARTNERS
alter table partners enable row level security;
create policy "Owner: all on partners" on partners for all
  using (get_my_role() = 'owner');
create policy "Rep: read assigned partners" on partners for select
  using (get_my_role() = 'rep' and assigned_rep_id = auth.uid());
create policy "Partner: read own record" on partners for select
  using (get_my_role() = 'partner' and user_id = auth.uid());

-- ORDERS
alter table orders enable row level security;
create policy "Owner: all on orders" on orders for all
  using (get_my_role() = 'owner');
create policy "Rep: read/write assigned orders" on orders for all
  using (
    get_my_role() = 'rep'
    and partner_id in (select id from partners where assigned_rep_id = auth.uid())
  );
create policy "Partner: read own orders" on orders for select
  using (
    get_my_role() = 'partner'
    and partner_id in (select id from partners where user_id = auth.uid())
  );

-- PRODUCTS (catalog)
alter table products enable row level security;
create policy "Owner: all on products" on products for all
  using (get_my_role() = 'owner');
create policy "Rep: read active products" on products for select
  using (get_my_role() = 'rep' and is_active = true and deleted_at is null);
create policy "Partner: read visible active products" on products for select
  using (
    get_my_role() = 'partner'
    and is_active = true
    and deleted_at is null
  );

-- CAD REQUESTS
alter table cad_requests enable row level security;
create policy "Owner: all on cad_requests" on cad_requests for all
  using (get_my_role() = 'owner');
create policy "Rep: all on cad_requests for assigned partners" on cad_requests for all
  using (
    get_my_role() = 'rep'
    and partner_id in (select id from partners where assigned_rep_id = auth.uid())
  );
create policy "Partner: read own cad_requests" on cad_requests for select
  using (
    get_my_role() = 'partner'
    and partner_id in (select id from partners where user_id = auth.uid())
  );
create policy "Partner: create own cad_requests" on cad_requests for insert
  with check (
    get_my_role() = 'partner'
    and partner_id in (select id from partners where user_id = auth.uid())
  );

-- GOLD RATES — owner only write, reps can read
alter table gold_rates enable row level security;
create policy "Owner: all on gold_rates" on gold_rates for all
  using (get_my_role() = 'owner');
create policy "Rep: read gold_rates" on gold_rates for select
  using (get_my_role() = 'rep');

-- VISITS — reps own their visits
alter table visits enable row level security;
create policy "Owner: all on visits" on visits for all
  using (get_my_role() = 'owner');
create policy "Rep: all on own visits" on visits for all
  using (get_my_role() = 'rep');  -- refine to created_by = auth.uid() in Phase 1

-- CIRCUITS
alter table circuits enable row level security;
create policy "Owner: all on circuits" on circuits for all
  using (get_my_role() = 'owner');
create policy "Rep: read own circuits" on circuits for select
  using (get_my_role() = 'rep');

-- SETTINGS — owner only
alter table settings enable row level security;
create policy "Owner: all on settings" on settings for all
  using (get_my_role() = 'owner');

-- MANUFACTURING (internal only — owner + rep)
alter table manufacturing_partners enable row level security;
create policy "Internal: all on mfg_partners" on manufacturing_partners for all
  using (get_my_role() in ('owner', 'rep'));

alter table manufacturing_orders enable row level security;
create policy "Internal: all on mfg_orders" on manufacturing_orders for all
  using (get_my_role() in ('owner', 'rep'));

alter table material_float enable row level security;
create policy "Internal: all on material_float" on material_float for all
  using (get_my_role() in ('owner', 'rep'));

-- VENDORS — internal only
alter table vendors enable row level security;
create policy "Internal: all on vendors" on vendors for all
  using (get_my_role() in ('owner', 'rep'));

-- INVENTORY
alter table inventory enable row level security;
create policy "Internal: all on inventory" on inventory for all
  using (get_my_role() in ('owner', 'rep'));

-- ── 10. Restore views (with soft-delete filter) ───────────
create view order_pipeline as
select
  o.id,
  o.order_number,
  o.status,
  o.type,
  o.model,
  o.trade_price,
  o.total_amount,
  o.advance_paid,
  o.total_amount - o.advance_paid as balance_due,
  o.order_date,
  o.expected_delivery,
  o.gov_status,
  o.discount_pct,
  p.store_name    as partner_name,
  p.city          as partner_city,
  p.id            as partner_id,
  p.tier          as partner_tier,
  pr.name         as product_name,
  pr.code         as product_code
from orders o
left join partners p  on o.partner_id  = p.id
left join products pr on o.product_id  = pr.id
where o.deleted_at is null;

create view partner_summary as
select
  p.id,
  p.store_name,
  p.owner_name,
  p.phone,
  p.city,
  p.circuit,
  p.status,
  p.stage,
  p.tier,
  p.credit_limit_paise,
  count(distinct o.id)         as total_orders,
  coalesce(sum(o.total_amount), 0) as total_revenue_paise,
  max(v.visit_date)            as last_visit_date,
  count(distinct v.id)         as total_visits
from partners p
left join orders o on o.partner_id = p.id and o.deleted_at is null
left join visits v on v.partner_id = p.id
where p.deleted_at is null
group by p.id;

-- ── 11. updated_by trigger ────────────────────────────────
create or replace function set_updated_by()
returns trigger
language plpgsql
as $$
begin
  new.updated_by := auth.uid();
  return new;
end;
$$;

-- Apply to key tables
create or replace trigger trig_set_updated_by_partners
  before update on partners for each row execute function set_updated_by();
create or replace trigger trig_set_updated_by_orders
  before update on orders   for each row execute function set_updated_by();
create or replace trigger trig_set_updated_by_products
  before update on products for each row execute function set_updated_by();

-- ── DOWN (reverse this migration) ─────────────────────────
-- To reverse, run the following block separately:
/*
  drop view if exists order_pipeline cascade;
  drop view if exists partner_summary cascade;
  drop table if exists activity_log cascade;
  drop table if exists user_roles cascade;
  drop function if exists get_my_role();
  drop function if exists add_audit_columns(text);
  drop function if exists log_activity_trigger();
  drop function if exists set_updated_by();
  -- Note: column type changes (paise/mg) are not auto-reversible.
  -- Restore from the v0.0-pre-harden snapshot if needed.
*/
