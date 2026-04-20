-- Task 78: Unify all gold inventory to 24kt-net.
-- After this migration, the central stock ledger and karigar float ledgers
-- only ever store gold as 'gold_24k'. Karat-specific gold types (14k/18k/22k)
-- exist solely as labour-rate inputs at the catalog/order edges; they never
-- touch inventory. Existing rows are converted to 24kt-pure equivalents using
-- the same KARAT_FACTORS as lib/karat.ts (22→0.916, 18→0.75, 14→0.60).
--
-- IDEMPOTENCY: this script is wrapped in a single transaction and uses an
-- audit-marker table (`task78_migration_log`) so a partial / interrupted run
-- followed by a re-run cannot double-convert quantities. Re-running this
-- script after a successful application is a no-op.

begin;

create table if not exists task78_migration_log (
  step text primary key,
  applied_at timestamptz not null default now()
);

-- 1. Allow 'gold_24k' in the stock_movements check constraint. We KEEP the
--    legacy karat values in the allow-list so the migration UPDATEs below can
--    rewrite them in place without tripping the constraint mid-statement. The
--    final ALTER at the bottom drops the legacy values once data is converted.
alter table stock_movements drop constraint if exists stock_movements_material_type_check;
alter table stock_movements add constraint stock_movements_material_type_check
  check (material_type in (
    'gold_24k',
    'gold_14k','gold_18k','gold_22k',
    'diamond_lgd','diamond_natural',
    'finding'
  ));

-- 2. Convert each existing karat-specific gold movement to its 24kt-pure
--    equivalent. The original karat is recorded in the audit notes.
do $$
begin
  if not exists (select 1 from task78_migration_log where step = 'stock_movements_converted') then
    update stock_movements
       set quantity      = round((quantity * 0.916)::numeric, 4),
           material_type = 'gold_24k',
           notes         = trim(both ' | ' from coalesce(notes,'') || ' | task78: migrated from gold_22k → gold_24k @ 0.916')
     where material_type = 'gold_22k';

    update stock_movements
       set quantity      = round((quantity * 0.75)::numeric, 4),
           material_type = 'gold_24k',
           notes         = trim(both ' | ' from coalesce(notes,'') || ' | task78: migrated from gold_18k → gold_24k @ 0.75')
     where material_type = 'gold_18k';

    update stock_movements
       set quantity      = round((quantity * 0.60)::numeric, 4),
           material_type = 'gold_24k',
           notes         = trim(both ' | ' from coalesce(notes,'') || ' | task78: migrated from gold_14k → gold_24k @ 0.60')
     where material_type = 'gold_14k';

    insert into task78_migration_log(step) values ('stock_movements_converted');
  end if;
end $$;

-- 3. Convert material_transactions quantities by joining through the parent
--    float row to look up the original karat. Guarded by the same marker.
do $$
begin
  if not exists (select 1 from task78_migration_log where step = 'material_transactions_converted') then
    update material_transactions mt
       set quantity = round((mt.quantity * case mf.material_type
                            when 'gold_22k' then 0.916
                            when 'gold_18k' then 0.75
                            when 'gold_14k' then 0.60
                            else 1 end)::numeric, 4)
      from material_float mf
     where mt.float_id = mf.id
       and mf.material_type in ('gold_14k','gold_18k','gold_22k');

    insert into task78_migration_log(step) values ('material_transactions_converted');
  end if;
end $$;

-- 4. material_float: a karigar might already have BOTH a gold_24k float and a
--    legacy gold_18k float — in that case we merge totals into the existing
--    gold_24k row and drop the legacy one. Otherwise we rename the legacy row
--    in place. All aggregate math uses coalesce so a NULL in the source row
--    can never null out the destination total.
do $$
declare
  r record;
  v_existing_24k uuid;
begin
  if exists (select 1 from task78_migration_log where step = 'material_float_converted') then
    return;
  end if;

  for r in
    select id, manufacturing_partner_id, material_type,
           coalesce(total_deposited, 0) as total_deposited,
           coalesce(total_returned,  0) as total_returned,
           coalesce(total_consumed,  0) as total_consumed,
           coalesce(balance,         0) as balance
      from material_float
     where material_type in ('gold_14k','gold_18k','gold_22k')
  loop
    declare
      f numeric := case r.material_type
                     when 'gold_22k' then 0.916
                     when 'gold_18k' then 0.75
                     when 'gold_14k' then 0.60
                   end;
    begin
      select id into v_existing_24k
        from material_float
       where manufacturing_partner_id = r.manufacturing_partner_id
         and material_type = 'gold_24k'
       limit 1;

      if v_existing_24k is null then
        update material_float
           set material_type   = 'gold_24k',
               total_deposited = round((r.total_deposited * f)::numeric, 4),
               total_returned  = round((r.total_returned  * f)::numeric, 4),
               total_consumed  = round((r.total_consumed  * f)::numeric, 4),
               balance         = round((r.balance         * f)::numeric, 4)
         where id = r.id;
      else
        update material_transactions
           set float_id = v_existing_24k
         where float_id = r.id;

        update material_float
           set total_deposited = round((coalesce(total_deposited,0) + r.total_deposited * f)::numeric, 4),
               total_returned  = round((coalesce(total_returned, 0) + r.total_returned  * f)::numeric, 4),
               total_consumed  = round((coalesce(total_consumed, 0) + r.total_consumed  * f)::numeric, 4),
               balance         = round((coalesce(balance,        0) + r.balance         * f)::numeric, 4)
         where id = v_existing_24k;

        delete from material_float where id = r.id;
      end if;
    end;
  end loop;

  insert into task78_migration_log(step) values ('material_float_converted');
end $$;

-- 4. Recreate receive_mfg_order_after_cancel so the consumption row written to
--    material_transactions stores the 24kt-pure value directly, matching the
--    new float currency. The order row keeps gross-at-karat as before.
DROP FUNCTION IF EXISTS receive_mfg_order_after_cancel(
  uuid, numeric, numeric, numeric, jsonb, text[], numeric, text, uuid
);
CREATE FUNCTION receive_mfg_order_after_cancel(
  p_order_id         uuid,
  p_actual_pure      numeric,
  p_karat_factor     numeric,
  p_actual_diamond   numeric,
  p_diamond_specs    jsonb,
  p_photos           text[],
  p_list_price       numeric,
  p_receive_notes    text,
  p_product_id       uuid
) RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_actual_gross  numeric;
  v_status        text;
  v_karat         int;
  v_total_cost    numeric;
  v_customer_ord  uuid;
  v_existing_rts  uuid;
  v_rts_id        uuid;
BEGIN
  IF p_actual_pure IS NULL OR p_actual_pure <= 0 THEN
    RAISE EXCEPTION 'actual_pure_24kt_g must be > 0';
  END IF;
  IF p_karat_factor IS NULL OR p_karat_factor <= 0 THEN
    RAISE EXCEPTION 'karat_factor must be > 0';
  END IF;
  IF p_list_price IS NULL OR p_list_price <= 0 THEN
    RAISE EXCEPTION 'list_price must be > 0';
  END IF;

  SELECT status, gold_karat, total_manufacturing_cost, customer_order_id
    INTO v_status, v_karat, v_total_cost, v_customer_ord
    FROM manufacturing_orders
   WHERE id = p_order_id
   FOR UPDATE;
  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Manufacturing order not found';
  END IF;
  IF v_status IN ('cancelled', 'returned', 'received_after_cancel') THEN
    RAISE EXCEPTION 'Cannot receive an order in status %', v_status;
  END IF;

  SELECT id INTO v_existing_rts
    FROM ready_to_ship_items
   WHERE source_mfg_order_id = p_order_id
   LIMIT 1;
  IF v_existing_rts IS NOT NULL THEN
    RAISE EXCEPTION 'A Ready-to-Ship listing already exists for this order (%)', v_existing_rts;
  END IF;

  IF v_karat IS NULL THEN v_karat := 22; END IF;
  v_actual_gross := p_actual_pure / p_karat_factor;

  -- Task 78: float now stores 24kt-pure, so the consumption row's quantity is
  -- p_actual_pure (NOT v_actual_gross). The settlement note still records both
  -- numbers for human reference.
  UPDATE material_transactions
     SET quantity  = p_actual_pure,
         lifecycle = 'final',
         notes = 'Settled on receive-after-cancel: actual ' ||
                 to_char(v_actual_gross, 'FM999990.0000') || 'g gross @ ' ||
                 v_karat || 'K (= ' ||
                 to_char(p_actual_pure,  'FM999990.0000') || 'g 24kt-pure)'
   WHERE manufacturing_order_id = p_order_id
     AND transaction_type       = 'consumption'
     AND lifecycle IN ('pending', 'final');

  UPDATE manufacturing_orders
     SET status              = 'received_after_cancel',
         gold_weight_actual  = v_actual_gross,
         diamond_weight      = COALESCE(NULLIF(p_actual_diamond, 0), diamond_weight),
         completed_date      = CURRENT_DATE
   WHERE id = p_order_id;

  INSERT INTO ready_to_ship_items (
    product_id, source_mfg_order_id, source_order_id,
    karat, gross_weight, pure_24kt_weight,
    diamond_specs, photos, list_price, original_cogs,
    status, internal_notes
  ) VALUES (
    p_product_id, p_order_id, v_customer_ord,
    v_karat, v_actual_gross, p_actual_pure,
    COALESCE(p_diamond_specs, '{}'::jsonb),
    COALESCE(p_photos, ARRAY[]::text[]),
    p_list_price, v_total_cost,
    'available', NULLIF(p_receive_notes, '')
  ) RETURNING id INTO v_rts_id;

  RETURN v_rts_id;
END;
$$;

-- 5. Tighten the stock_movements check constraint now that legacy rows are
--    converted. Run this AFTER you've confirmed the data update above worked.
--    (Kept as a separate statement so it's easy to comment out during dry-runs.)
ALTER TABLE stock_movements DROP CONSTRAINT IF EXISTS stock_movements_material_type_check;
ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_material_type_check
  CHECK (material_type IN (
    'gold_24k',
    'diamond_lgd','diamond_natural',
    'finding'
  ));

commit;
