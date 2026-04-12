-- ============================================================
-- Shewah B2B — Business Logic V2 Migration
-- Run in Supabase SQL Editor
-- ============================================================

-- 1. Labour Rates table (global defaults per karat)
create table if not exists labour_rates (
  id            uuid primary key default uuid_generate_v4(),
  karat         integer not null unique,
  rate_per_gram numeric not null,
  updated_at    timestamptz default now()
);

-- Seed defaults if empty
insert into labour_rates (karat, rate_per_gram)
values (14, 900), (18, 1200), (22, 1500)
on conflict (karat) do nothing;

alter table labour_rates enable row level security;
create policy if not exists "Authenticated users can do everything" on labour_rates
  for all using (auth.role() = 'authenticated');

-- 2. Inventory Transactions (receipt/issue ledger)
create table if not exists inventory_transactions (
  id                        uuid primary key default uuid_generate_v4(),
  created_at                timestamptz default now(),
  inventory_id              uuid references inventory(id) on delete cascade,
  transaction_type          text not null,        -- 'receipt','issue','adjustment','return'
  manufacturing_partner_id  uuid references manufacturing_partners(id),
  manufacturing_order_id    uuid references manufacturing_orders(id),
  quantity                  numeric not null,
  rate_per_unit             numeric,
  total_value               numeric,
  reference                 text,                 -- invoice/voucher number
  vendor_id                 uuid references vendors(id),
  date                      date default current_date,
  notes                     text,

  -- Indian compliance fields
  invoice_number            text,
  invoice_date              date,
  hsn_code                  text,
  gst_percentage            numeric,
  cgst_amount               numeric,
  sgst_amount               numeric,
  igst_amount               numeric,
  total_with_gst            numeric
);

alter table inventory_transactions enable row level security;
create policy if not exists "Authenticated users can do everything" on inventory_transactions
  for all using (auth.role() = 'authenticated');

-- 3. Add SKU to inventory if missing
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name='inventory' and column_name='sku') then
    alter table inventory add column sku text;
  end if;
end $$;

-- 4. Add GST/compliance fields to vendors
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name='vendors' and column_name='gstin') then
    alter table vendors add column gstin text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='vendors' and column_name='pan') then
    alter table vendors add column pan text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='vendors' and column_name='state_code') then
    alter table vendors add column state_code text;
  end if;
end $$;

-- 5. Add CAD party field to cad_requests
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name='cad_requests' and column_name='cad_party_id') then
    alter table cad_requests add column cad_party_id uuid references vendors(id);
  end if;
end $$;

-- 6. Partner Shortlists
create table if not exists partner_shortlists (
  id          uuid primary key default uuid_generate_v4(),
  created_at  timestamptz default now(),
  partner_id  uuid references partners(id) on delete cascade,
  product_id  uuid references products(id) on delete cascade,
  status      text default 'shortlisted',  -- 'shortlisted','ordered','cad_requested'
  notes       text,
  unique(partner_id, product_id)
);

alter table partner_shortlists enable row level security;
create policy if not exists "Authenticated users can do everything" on partner_shortlists
  for all using (auth.role() = 'authenticated');

-- 7. Add additional fields to manufacturing_orders for 24kt tracking
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name='manufacturing_orders' and column_name='gold_weight_24k') then
    alter table manufacturing_orders add column gold_weight_24k numeric;  -- fine gold equivalent
  end if;
  if not exists (select 1 from information_schema.columns where table_name='manufacturing_orders' and column_name='gold_karat') then
    alter table manufacturing_orders add column gold_karat integer default 18;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='manufacturing_orders' and column_name='customer_order_id') then
    alter table manufacturing_orders add column customer_order_id uuid references orders(id);
  end if;
  if not exists (select 1 from information_schema.columns where table_name='manufacturing_orders' and column_name='ring_size') then
    alter table manufacturing_orders add column ring_size text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='manufacturing_orders' and column_name='special_notes') then
    alter table manufacturing_orders add column special_notes text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='manufacturing_orders' and column_name='reference_images') then
    alter table manufacturing_orders add column reference_images text[];
  end if;
  if not exists (select 1 from information_schema.columns where table_name='manufacturing_orders' and column_name='material_from_float') then
    alter table manufacturing_orders add column material_from_float boolean default false;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='manufacturing_orders' and column_name='gold_weight_required') then
    alter table manufacturing_orders add column gold_weight_required numeric;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='manufacturing_orders' and column_name='diamond_weight') then
    alter table manufacturing_orders add column diamond_weight numeric;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='manufacturing_orders' and column_name='material_notes') then
    alter table manufacturing_orders add column material_notes text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='manufacturing_orders' and column_name='labour_per_gram') then
    alter table manufacturing_orders add column labour_per_gram numeric;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='manufacturing_orders' and column_name='gold_weight_actual') then
    alter table manufacturing_orders add column gold_weight_actual numeric;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='manufacturing_orders' and column_name='labour_amount') then
    alter table manufacturing_orders add column labour_amount numeric;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='manufacturing_orders' and column_name='other_charges') then
    alter table manufacturing_orders add column other_charges numeric default 0;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='manufacturing_orders' and column_name='total_manufacturing_cost') then
    alter table manufacturing_orders add column total_manufacturing_cost numeric;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='manufacturing_orders' and column_name='issued_date') then
    alter table manufacturing_orders add column issued_date date;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='manufacturing_orders' and column_name='internal_notes') then
    alter table manufacturing_orders add column internal_notes text;
  end if;
end $$;

-- 8. Add labour rate columns to manufacturing_partners if missing
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name='manufacturing_partners' and column_name='labour_rate_14k') then
    alter table manufacturing_partners add column labour_rate_14k numeric;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='manufacturing_partners' and column_name='labour_rate_22k') then
    alter table manufacturing_partners add column labour_rate_22k numeric;
  end if;
end $$;

-- 9. Update material_float to use manufacturing_partner_id consistently
-- (schema already uses partner_id, but float page code uses manufacturing_partner_id)
-- We add manufacturing_partner_id as alias column if partner_id exists
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name='material_float' and column_name='manufacturing_partner_id') then
    alter table material_float add column manufacturing_partner_id uuid references manufacturing_partners(id);
    -- Copy existing data
    update material_float set manufacturing_partner_id = partner_id;
  end if;
  -- Add total_consumed and total_withdrawn if missing
  if not exists (select 1 from information_schema.columns where table_name='material_float' and column_name='total_consumed') then
    alter table material_float add column total_consumed numeric default 0;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='material_float' and column_name='total_withdrawn') then
    alter table material_float add column total_withdrawn numeric default 0;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='material_float' and column_name='unit') then
    alter table material_float add column unit text default 'grams';
  end if;
end $$;

-- 10. Material transactions table
create table if not exists material_transactions (
  id                        uuid primary key default uuid_generate_v4(),
  created_at                timestamptz default now(),
  float_id                  uuid references material_float(id) on delete cascade,
  manufacturing_partner_id  uuid references manufacturing_partners(id),
  transaction_type          text not null,   -- 'deposit','consumption','withdrawal','adjustment'
  quantity                  numeric not null,
  unit                      text default 'grams',
  rate_per_unit             numeric,
  total_value               numeric,
  reference                 text,
  notes                     text,
  date                      date default current_date
);

alter table material_transactions enable row level security;
create policy if not exists "Authenticated users can do everything" on material_transactions
  for all using (auth.role() = 'authenticated');
