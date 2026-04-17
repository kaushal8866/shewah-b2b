-- ============================================================
-- Shewah B2B — Migration 0004: RLS Resilience & Debugging
-- Doctrine: SOP v1.0 §2.2
-- ============================================================

-- ── 1. Make get_my_role more robust ────────────────────────
-- Changing to VOLATILE (re-evaluates on every call) ensures 
-- that auth.uid() is fresh and avoids potential caching issues
-- in complex RLS queries.

create or replace function get_my_role()
returns text
language sql
security definer
-- Removed 'stable' to ensure fresh execution
as $$
  select role from user_roles where user_id = auth.uid() and deleted_at is null;
$$;

-- ── 2. Add Bootstrap Owner ─────────────────────────────────
-- This ensures that if the system has NO owners, the first 
-- authenticated user who calls this gets promoted. 
-- Useful for initial setup or if the owner's role was lost.

create or replace function bootstrap_owner()
returns text 
language plpgsql
security definer
as $$
declare
  v_count integer;
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then return 'unauthenticated'; end if;

  select count(*) into v_count from user_roles where role = 'owner';
  
  if v_count = 0 then
    insert into user_roles (user_id, role)
    values (v_user_id, 'owner')
    on conflict (user_id) do update set role = 'owner';
    return 'promoted_to_owner';
  end if;
  
  return 'not_applicable';
end;
$$;

-- ── 3. Policy Explicit Check ───────────────────────────────
-- Ensuring 'partners' policies have explicit WITH CHECK for inserts.

drop policy if exists "Owner: all on partners" on partners;
create policy "Owner: all on partners" on partners 
  for all 
  using (get_my_role() = 'owner')
  with check (get_my_role() = 'owner');

-- Apply same for other key tables
drop policy if exists "Owner: all on orders" on orders;
create policy "Owner: all on orders" on orders 
  for all 
  using (get_my_role() = 'owner')
  with check (get_my_role() = 'owner');

drop policy if exists "Internal: all on mfg_orders" on manufacturing_orders;
create policy "Internal: all on mfg_orders" on manufacturing_orders 
  for all 
  using (get_my_role() in ('owner', 'rep'))
  with check (get_my_role() in ('owner', 'rep'));
