-- ============================================================
-- Shewah B2B — Migration 0005: Emergency Recovery & Transition
-- Doctrine: SOP v1.0 — Safety First
-- ============================================================

-- ── 1. Graceful Transition Policy ──────────────────────────
-- If the user_roles table is uninitialized (0 records), we 
-- fallback to 'authenticated' access to prevent a total lockout 
-- during the migration phase.

create or replace function is_system_uninitialized()
returns boolean
language sql
stable
as $$
  select count(*) = 0 from user_roles;
$$;

-- Apply transition policies to key tables
drop policy if exists "Transition: all on partners" on partners;
create policy "Transition: all on partners" on partners 
  for all using (is_system_uninitialized() and auth.role() = 'authenticated');

drop policy if exists "Transition: all on orders" on orders;
create policy "Transition: all on orders" on orders 
  for all using (is_system_uninitialized() and auth.role() = 'authenticated');

drop policy if exists "Transition: all on manufacturing" on manufacturing_orders;
create policy "Transition: all on manufacturing" on manufacturing_orders 
  for all using (is_system_uninitialized() and auth.role() = 'authenticated');

-- ── 2. Add Self-Promotion Logic ────────────────────────────
-- A function that any authenticated user can run to make 
-- themselves the first owner if the table is empty.

create or replace function claim_ownership()
returns text
language plpgsql
security definer
as $$
begin
  if (is_system_uninitialized()) then
    insert into user_roles (user_id, role)
    values (auth.uid(), 'owner');
    return 'Owner claimed successfully. Hardening activated.';
  end if;
  return 'System already has users. Please ask an administrator for access.';
end;
$$;

-- ── 3. Fix Missing Write Permissions for Owners ───────────
-- Ensure Owner policy has WITH CHECK to allow INSERT/UPDATE.

drop policy if exists "Owner: all on partners" on partners;
create policy "Owner: all on partners" on partners 
  for all using (get_my_role() = 'owner') with check (get_my_role() = 'owner');

drop policy if exists "Owner: all on visits" on visits;
create policy "Owner: all on visits" on visits 
  for all using (get_my_role() = 'owner') with check (get_my_role() = 'owner');

drop policy if exists "Owner: all on products" on products;
create policy "Owner: all on products" on products 
  for all using (get_my_role() = 'owner') with check (get_my_role() = 'owner');

drop policy if exists "Owner: all on orders" on orders;
create policy "Owner: all on orders" on orders 
  for all using (get_my_role() = 'owner') with check (get_my_role() = 'owner');

drop policy if exists "Owner: all on circuits" on circuits;
create policy "Owner: all on circuits" on circuits 
  for all using (get_my_role() = 'owner') with check (get_my_role() = 'owner');

drop policy if exists "Owner: all on manufacturing_partners" on manufacturing_partners;
create policy "Owner: all on manufacturing_partners" on manufacturing_partners 
  for all using (get_my_role() = 'owner') with check (get_my_role() = 'owner');

drop policy if exists "Owner: all on manufacturing_orders" on manufacturing_orders;
create policy "Owner: all on manufacturing_orders" on manufacturing_orders 
  for all using (get_my_role() = 'owner') with check (get_my_role() = 'owner');
