-- ============================================================
-- Shewah B2B Admin — Supabase Schema
-- Run this in Supabase SQL Editor → New Query
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ── PARTNERS (Jeweler CRM) ────────────────────────────────
create table partners (
  id            uuid primary key default uuid_generate_v4(),
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),

  -- Identity
  store_name    text not null,
  owner_name    text not null,
  phone         text not null unique,
  email         text,

  -- Location
  city          text not null,
  state         text not null,
  circuit       text,                -- 'Gujarat', 'Maharashtra', 'MP'
  address       text,
  sarafa_bazaar text,

  -- Business profile
  store_type    text default 'independent',  -- 'independent','boutique','chain'
  annual_revenue text,               -- '50L-1Cr', '1Cr-5Cr' etc
  current_products text[],           -- ['plain_gold','silver','AD']
  model_preference text,             -- 'wholesale','design_make','white_label','all'

  -- CRM status
  status        text default 'cold',         -- 'hot','warm','cold'
  stage         text default 'prospect',     -- 'prospect','contacted','sample_sent','active','inactive'
  source        text default 'cold_visit',   -- 'cold_visit','referral','trade_fair','indiamart','whatsapp'

  -- Notes
  notes         text,
  tags          text[]
);

-- ── VISITS (Circuit visit log) ────────────────────────────
create table visits (
  id            uuid primary key default uuid_generate_v4(),
  created_at    timestamptz default now(),
  partner_id    uuid references partners(id) on delete cascade,

  visit_date    date not null,
  circuit       text,
  city          text,

  -- What happened
  outcome       text,                -- 'interested','not_interested','callback','sample_requested','order_placed'
  notes         text,
  sample_offered boolean default false,
  catalog_left  boolean default false,
  next_action   text,
  next_action_date date
);

-- ── PRODUCTS (Ring Catalog) ───────────────────────────────
create table products (
  id              uuid primary key default uuid_generate_v4(),
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),

  code            text not null unique,          -- 'SH-001'
  name            text not null,
  description     text,
  category        text default 'ring',           -- 'ring','pendant','earring','bracelet'

  -- Diamond specs
  diamond_weight  numeric,                       -- in carats
  diamond_shape   text,                          -- 'round','oval','pear','cushion','princess','marquise','emerald'
  diamond_quality text,                          -- 'VS1','VS2','VVS1','VVS2'
  diamond_color   text,                          -- 'D','E','F','G'
  diamond_type    text default 'lgd',            -- 'lgd','natural'

  -- Gold specs
  gold_karat      integer,                       -- 14, 18, 22
  gold_weight_g   numeric,                       -- estimated grams

  -- Pricing (base — recalculated with live gold rate)
  diamond_cost    numeric,                       -- ₹ fixed
  making_charges  numeric,                       -- ₹ fixed
  igi_cert_cost   numeric default 1500,

  -- Pricing overrides (manual)
  trade_price     numeric,
  mrp_suggested   numeric,

  -- Catalog
  photo_urls      text[],
  is_active       boolean default true,
  delivery_days   integer default 14,            -- min days
  models_available text[] default ARRAY['wholesale','design_make'],

  tags            text[]
);

-- ── ORDERS ────────────────────────────────────────────────
create table orders (
  id              uuid primary key default uuid_generate_v4(),
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),

  order_number    text not null unique,           -- 'SH-ORD-2025-001'
  partner_id      uuid references partners(id),
  product_id      uuid references products(id),   -- null for custom

  -- Order details
  type            text not null,                  -- 'catalog','custom'
  model           text not null,                  -- 'wholesale','design_make','white_label'
  quantity        integer default 1,
  ring_size       text,
  special_notes   text,

  -- Custom design (if type = 'custom')
  brief_text      text,
  brief_images    text[],
  cad_request_id  uuid,

  -- Pricing
  gold_rate_at_order numeric,                     -- gold rate per gram when order was placed
  trade_price     numeric not null,
  total_amount    numeric not null,
  advance_paid    numeric default 0,
  balance_due     numeric,

  -- Pipeline status
  status          text default 'brief_received',
  -- brief_received → cad_in_progress → cad_sent → design_approved
  -- → production → qc → dispatched → delivered

  -- Dates
  order_date      date default current_date,
  expected_delivery date,
  actual_delivery date,

  -- Logistics
  tracking_number text,
  courier         text,
  dispatch_date   date,

  -- Notes
  internal_notes  text
);

-- ── CAD REQUESTS ─────────────────────────────────────────
create table cad_requests (
  id              uuid primary key default uuid_generate_v4(),
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),

  request_number  text not null unique,           -- 'SH-CAD-2025-001'
  partner_id      uuid references partners(id),
  order_id        uuid references orders(id),

  -- Brief
  brief_text      text,
  reference_images text[],
  diamond_shape   text,
  diamond_weight  text,
  gold_karat      integer,
  setting_type    text,
  special_requests text,

  -- Status
  status          text default 'pending',         -- 'pending','in_progress','sent','revision_requested','approved','rejected'
  priority        text default 'normal',          -- 'normal','urgent'

  -- CAD files
  cad_files       text[],
  render_images   text[],

  -- Dates
  received_date   date default current_date,
  due_date        date,
  sent_date       date,
  approved_date   date,

  -- Feedback
  revision_notes  text,
  partner_feedback text
);

-- ── GOLD RATES ───────────────────────────────────────────
create table gold_rates (
  id              uuid primary key default uuid_generate_v4(),
  recorded_at     timestamptz default now(),
  source          text default 'manual',          -- 'manual','api'

  -- Rate per gram in INR
  rate_24k        numeric not null,               -- 24K base rate
  rate_22k        numeric,                        -- auto-computed
  rate_18k        numeric,                        -- auto-computed
  rate_14k        numeric,                        -- auto-computed

  notes           text
);

-- ── CIRCUITS (Visit trip planning) ───────────────────────
create table circuits (
  id              uuid primary key default uuid_generate_v4(),
  created_at      timestamptz default now(),

  name            text not null,                  -- 'Gujarat Circuit - Apr 2025'
  region          text,                           -- 'Gujarat','Maharashtra','MP'
  cities          text[],
  start_date      date,
  end_date        date,
  status          text default 'planned',         -- 'planned','in_progress','completed'

  -- Targets
  target_visits   integer,
  target_samples  integer,
  target_partners integer,

  -- Actuals
  actual_visits   integer default 0,
  actual_samples  integer default 0,
  actual_partners integer default 0,

  budget_inr      numeric,
  spent_inr       numeric default 0,
  notes           text
);

-- ── SETTINGS (Admin config) ───────────────────────────────
create table settings (
  key     text primary key,
  value   text,
  updated_at timestamptz default now()
);

-- Default settings
insert into settings (key, value) values
  ('business_name', 'Shewah'),
  ('owner_name', 'Kaushal'),
  ('whatsapp_number', ''),
  ('surat_address', 'Surat, Gujarat'),
  ('default_igi_cost', '1500'),
  ('default_making_charges', '2500'),
  ('gold_markup_14k', '0.585'),
  ('gold_markup_18k', '0.750'),
  ('gold_markup_22k', '0.916'),
  ('trade_margin_target', '0.28'),
  ('mrp_markup_target', '0.40');

-- ── AUTO-UPDATE updated_at ────────────────────────────────
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger partners_updated_at before update on partners
  for each row execute function update_updated_at();

create trigger products_updated_at before update on products
  for each row execute function update_updated_at();

create trigger orders_updated_at before update on orders
  for each row execute function update_updated_at();

create trigger cad_requests_updated_at before update on cad_requests
  for each row execute function update_updated_at();

-- ── ROW LEVEL SECURITY ────────────────────────────────────
-- Simple: all authenticated users can read/write
alter table partners enable row level security;
alter table visits enable row level security;
alter table products enable row level security;
alter table orders enable row level security;
alter table cad_requests enable row level security;
alter table gold_rates enable row level security;
alter table circuits enable row level security;
alter table settings enable row level security;

-- Policy: allow all for authenticated users (single-user admin panel)
create policy "Authenticated users can do everything" on partners
  for all using (auth.role() = 'authenticated');
create policy "Authenticated users can do everything" on visits
  for all using (auth.role() = 'authenticated');
create policy "Authenticated users can do everything" on products
  for all using (auth.role() = 'authenticated');
create policy "Authenticated users can do everything" on orders
  for all using (auth.role() = 'authenticated');
create policy "Authenticated users can do everything" on cad_requests
  for all using (auth.role() = 'authenticated');
create policy "Authenticated users can do everything" on gold_rates
  for all using (auth.role() = 'authenticated');
create policy "Authenticated users can do everything" on circuits
  for all using (auth.role() = 'authenticated');
create policy "Authenticated users can do everything" on settings
  for all using (auth.role() = 'authenticated');

-- ── USEFUL VIEWS ──────────────────────────────────────────
create view order_pipeline as
select
  o.id, o.order_number, o.status, o.type, o.model,
  o.trade_price, o.total_amount, o.advance_paid,
  o.total_amount - o.advance_paid as balance_due,
  o.order_date, o.expected_delivery,
  p.store_name as partner_name, p.city as partner_city,
  pr.name as product_name, pr.code as product_code
from orders o
left join partners p on o.partner_id = p.id
left join products pr on o.product_id = pr.id;

create view partner_summary as
select
  p.id, p.store_name, p.owner_name, p.phone,
  p.city, p.circuit, p.status, p.stage,
  count(distinct o.id) as total_orders,
  coalesce(sum(o.total_amount), 0) as total_revenue,
  max(v.visit_date) as last_visit_date,
  count(distinct v.id) as total_visits
from partners p
left join orders o on o.partner_id = p.id
left join visits v on v.partner_id = p.id
group by p.id;

-- ============================================================
-- Additional tables (V2) — Manufacturing, Vendors, Inventory
-- ============================================================

-- ── MANUFACTURING PARTNERS ───────────────────────────────
create table manufacturing_partners (
  id              uuid primary key default uuid_generate_v4(),
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),

  name            text not null,
  owner_name      text,
  phone           text,
  city            text,
  speciality      text[],
  material_policy text default 'provided',   -- 'provided','own_stock'
  labour_rate_18k numeric,
  status          text default 'active',     -- 'active','on_hold','inactive'
  notes           text
);

-- ── MANUFACTURING ORDERS ─────────────────────────────────
create table manufacturing_orders (
  id                        uuid primary key default uuid_generate_v4(),
  created_at                timestamptz default now(),
  updated_at                timestamptz default now(),

  order_number              text not null unique,
  manufacturing_partner_id  uuid references manufacturing_partners(id),
  order_id                  uuid references orders(id),
  description               text,
  quantity                  integer default 1,
  gold_weight_issue         numeric,
  diamond_weight_issue      numeric,
  labour_charges            numeric,
  status                    text default 'issued',
  -- issued → material_sent → in_production → qc → ready → delivered
  expected_delivery         date,
  actual_delivery           date,
  notes                     text
);

-- ── MATERIAL FLOAT (balance per partner per material) ────
create table material_float (
  id              uuid primary key default uuid_generate_v4(),
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),

  partner_id      uuid references manufacturing_partners(id) on delete cascade,
  material_type   text not null,              -- 'gold_18k','gold_14k','diamond_lgd','diamond_natural'
  balance         numeric not null default 0,
  total_deposited numeric not null default 0,
  notes           text,

  unique(partner_id, material_type)
);

-- ── VENDORS ──────────────────────────────────────────────
create table vendors (
  id              uuid primary key default uuid_generate_v4(),
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),

  name            text not null,
  owner_name      text,
  phone           text,
  email           text,
  city            text,
  state           text,
  category        text[],                     -- ['gold','diamonds','packaging','findings']
  payment_terms   text,
  outstanding     numeric default 0,
  notes           text
);

-- ── INVENTORY ────────────────────────────────────────────
create table inventory (
  id                  uuid primary key default uuid_generate_v4(),
  created_at          timestamptz default now(),
  updated_at          timestamptz default now(),

  name                text not null,
  category            text not null,            -- 'gold','diamond_lgd','diamond_natural','packaging','finding','other'
  vendor_id           uuid references vendors(id),
  quantity_in_stock   numeric default 0,
  unit                text default 'pieces',    -- 'grams','carats','pieces'
  avg_purchase_price  numeric,
  low_stock_alert     numeric,
  diamond_shape       text,
  diamond_quality     text,
  diamond_color       text,
  notes               text
);

-- Triggers for updated_at on new tables
create trigger mfg_partners_updated_at before update on manufacturing_partners
  for each row execute function update_updated_at();

create trigger mfg_orders_updated_at before update on manufacturing_orders
  for each row execute function update_updated_at();

create trigger material_float_updated_at before update on material_float
  for each row execute function update_updated_at();

create trigger vendors_updated_at before update on vendors
  for each row execute function update_updated_at();

create trigger inventory_updated_at before update on inventory
  for each row execute function update_updated_at();

-- RLS for new tables
alter table manufacturing_partners enable row level security;
alter table manufacturing_orders enable row level security;
alter table material_float enable row level security;
alter table vendors enable row level security;
alter table inventory enable row level security;

create policy "Authenticated users can do everything" on manufacturing_partners
  for all using (auth.role() = 'authenticated');
create policy "Authenticated users can do everything" on manufacturing_orders
  for all using (auth.role() = 'authenticated');
create policy "Authenticated users can do everything" on material_float
  for all using (auth.role() = 'authenticated');
create policy "Authenticated users can do everything" on vendors
  for all using (auth.role() = 'authenticated');
create policy "Authenticated users can do everything" on inventory
  for all using (auth.role() = 'authenticated');

