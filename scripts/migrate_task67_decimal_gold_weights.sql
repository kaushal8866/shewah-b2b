-- Task #67 — ensure all gold/diamond weight columns accept decimals
-- Run in Supabase: Dashboard → SQL Editor → New query → paste → Run.
-- Safe to re-run.
--
-- Background: a retailer hit "invalid input syntax for type integer: 2.81"
-- when entering 2.81 g of gold weight on a catalog product. The schema.sql
-- in repo already declares these as `numeric` (which is unbounded-precision
-- decimal in Postgres), but the live production DB drifted at some point
-- and one or more of these columns is `integer`. This migration converts
-- every weight column we use anywhere in the app to `numeric` so jewellers
-- can record weights with full precision (4+ decimal places).

DO $$
DECLARE
  r record;
  -- (table, column) pairs that must be numeric. Add to this list whenever
  -- a new weight column is introduced. The DO block iterates and only
  -- ALTERs columns that are not already numeric, so this is idempotent
  -- and safe to re-run.
  weight_cols text[][] := ARRAY[
    ['products',             'gold_weight_g'],
    ['products',             'diamond_weight'],
    ['orders',               'gold_weight_estimated'],
    ['orders',               'gold_weight_actual'],
    ['orders',               'diamond_weight'],
    ['manufacturing_orders', 'gold_weight_required'],
    ['manufacturing_orders', 'gold_weight_actual'],
    ['manufacturing_orders', 'diamond_weight'],
    ['material_transactions','quantity'],
    ['material_float',       'current_quantity'],
    ['material_float',       'reserved_quantity']
  ];
  i int;
  tbl text; col text; cur_type text;
BEGIN
  FOR i IN 1 .. array_length(weight_cols, 1) LOOP
    tbl := weight_cols[i][1];
    col := weight_cols[i][2];

    -- Skip if the table or column doesn't exist on this environment.
    SELECT data_type INTO cur_type
      FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = tbl AND column_name = col;
    IF cur_type IS NULL THEN
      RAISE NOTICE 'skip %.% (column does not exist)', tbl, col;
      CONTINUE;
    END IF;

    -- Already numeric? No-op.
    IF cur_type = 'numeric' THEN
      CONTINUE;
    END IF;

    RAISE NOTICE 'altering %.% from % to numeric', tbl, col, cur_type;
    EXECUTE format(
      'ALTER TABLE %I ALTER COLUMN %I TYPE numeric USING %I::numeric',
      tbl, col, col
    );
  END LOOP;
END $$;
