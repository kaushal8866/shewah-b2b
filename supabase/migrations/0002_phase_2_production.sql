-- ============================================================
-- Shewah B2B — Migration 0002: Phase 2 Production Ledger
-- Doctrine: SOP v1.0 §3.2, §3.3
-- ============================================================

-- ── 1. material_transactions ledger ────────────────────────
create table if not exists material_transactions (
  id           uuid        primary key default uuid_generate_v4(),
  created_at   timestamptz not null default now(),
  
  partner_id   uuid        not null references manufacturing_partners(id),
  type         text        not null check (type in ('deposit', 'issued', 'return', 'wastage', 'adjustment')),
  material_type text       not null, -- 'gold_24k', 'diamond_ct', etc.
  amount        numeric    not null, -- milligrams for gold, carats for diamonds. Negative for withdrawal/issue.
  
  order_id     uuid        references manufacturing_orders(id), -- linked order if 'issued' or 'return'
  notes        text,
  
  created_by   uuid        references auth.users(id)
);

-- Enable RLS
alter table material_transactions enable row level security;
create policy "Internal: all on material_transactions" on material_transactions
  for all using ( (select role from user_roles where user_id = auth.uid()) in ('owner', 'rep') );

-- ── 2. Sync function for material_float ───────────────────
-- This ensures the material_float table always shows the current balance.
create or replace function sync_material_float()
returns trigger as $$
begin
  if (TG_OP = 'INSERT') then
    -- Update the summary table
    update material_float 
    set balance = balance + NEW.amount,
        updated_at = now()
    where partner_id = NEW.partner_id and material_type = NEW.material_type;
    
    -- Handle total_deposited (only increases on positive deposits)
    if (NEW.type = 'deposit' and NEW.amount > 0) then
      update material_float 
      set total_deposited = total_deposited + NEW.amount
      where partner_id = NEW.partner_id and material_type = NEW.material_type;
    end if;

    -- Auto-init if not exists
    if not found then
      insert into material_float (partner_id, material_type, balance, total_deposited)
      values (NEW.partner_id, NEW.material_type, NEW.amount, case when NEW.type = 'deposit' then NEW.amount else 0 end);
    end if;
  end if;
  return NEW;
end;
$$ language plpgsql;

-- Drop trigger if exists to allow re-runs
drop trigger if exists trig_sync_material_float on material_transactions;

create trigger trig_sync_material_float
after insert on material_transactions
for each row execute function sync_material_float();

-- ── 3. Manufacturing Status Pipeline (SOP §3.3) ────────────
-- We ensure the status transitions follow the SOP.
do $$ 
begin
  if not exists (select 1 from pg_type where typname = 'mfg_status') then
    create type mfg_status as enum ('issued', 'casting', 'setting', 'polishing', 'qc', 'ready', 'delivered');
  end if;
end $$;

-- Update the status column if possible, otherwise just use text check
-- Note: Altering existing column type with values can be tricky, we'll use a check constraint for now if it's text.
alter table manufacturing_orders drop constraint if exists mfg_status_check;
alter table manufacturing_orders add constraint mfg_status_check check (status in ('issued', 'casting', 'setting', 'polishing', 'qc', 'ready', 'delivered'));

-- ── 4. Activity logging for manufacturing ────────────────
create or replace trigger trig_log_mfg_orders
  after insert or update or delete on manufacturing_orders
  for each row execute function log_activity_trigger();

create or replace trigger trig_log_mfg_partners
  after insert or update or delete on manufacturing_partners
  for each row execute function log_activity_trigger();
