-- ============================================================
-- Shewah B2B — Migration 0003: RLS Hardening for Partnerships
-- Doctrine: SOP v1.0 §2.2 (Role-Based Access)
-- ============================================================

-- ── 1. Partners Table RLS Refinement ───────────────────────

-- Drop existing generic "Owner: all" if it's too broad or causing check issues
-- (We'll keep it but ensure Reps have their own creation rights)

-- Allow reps to create partners
-- Note: We use WITH CHECK to ensure they can only insert if their role is 'rep'
create policy "Rep: create partners" on partners
  for insert with check (
    get_my_role() = 'rep'
  );

-- Allow reps to update partners they are assigned to
create policy "Rep: update assigned partners" on partners
  for update using (
    get_my_role() = 'rep' and assigned_rep_id = auth.uid()
  );

-- ── 2. Automatic Rep Assignment ────────────────────────────
-- When a rep creates a partner, we want to automatically set assigned_rep_id
-- to themselves so they don't "lose" the record due to the SELECT policy.

create or replace function auto_assign_rep()
returns trigger as $$
begin
  if (get_my_role() = 'rep' and NEW.assigned_rep_id is null) then
    NEW.assigned_rep_id := auth.uid();
  end if;
  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists trig_auto_assign_rep on partners;
create trigger trig_auto_assign_rep
before insert on partners
for each row execute function auto_assign_rep();

-- ── 3. Visits RLS ──────────────────────────────────────────
-- Reps need to be able to create visits for partners they are assigned to.

create policy "Rep: create visits for assigned partners" on visits
  for insert with check (
    get_my_role() = 'rep' 
    and partner_id in (select id from partners where assigned_rep_id = auth.uid())
  );

create policy "Rep: read/update own visits" on visits
  for all using (
    get_my_role() = 'rep' and created_by = auth.uid()
  );
