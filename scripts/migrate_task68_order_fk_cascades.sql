-- Task #68 — make order deletion safe by fixing referencing FK actions.
-- Run in Supabase: Dashboard → SQL Editor → New query → paste → Run.
-- Safe to re-run.
--
-- Background: deleting (or, in some flows, updating) an order failed with
--   "update or delete on table "orders" violates foreign key constraint
--    "material_transactions_order_id_fkey" on table "material_transactions"
-- The repo schema (`supabase/schema.sql`) already declares this FK as
-- `on delete set null`, but production drifted — the live constraint is
-- the default NO ACTION, which blocks the delete.
--
-- We also rebuild `cad_requests.order_id`, which the repo schema never
-- gave an explicit ON DELETE action, so it likewise blocks deletion in
-- production. Both are non-essential references (history rows that should
-- survive even if their parent order is removed), so SET NULL is correct.
--
-- For each FK we (1) discover the existing constraint name, (2) drop it,
-- (3) recreate it with ON DELETE SET NULL. The DO block tolerates already-
-- correct constraints (it just rewrites them), missing tables (skipped),
-- and missing columns (skipped). Re-running is a no-op in effect.

DO $$
DECLARE
  fixes text[][] := ARRAY[
    -- table,                     column,         referenced_table
    ['material_transactions',     'order_id',     'orders'],
    ['cad_requests',              'order_id',     'orders']
  ];
  i int;
  tbl text; col text; ref_tbl text;
  con_name text;
BEGIN
  FOR i IN 1 .. array_length(fixes, 1) LOOP
    tbl     := fixes[i][1];
    col     := fixes[i][2];
    ref_tbl := fixes[i][3];

    -- Skip if the table or column doesn't exist on this environment.
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = tbl AND column_name = col
    ) THEN
      RAISE NOTICE 'skip %.% (column does not exist)', tbl, col;
      CONTINUE;
    END IF;

    -- Find the existing FK constraint name (if any) on (tbl.col → ref_tbl).
    SELECT tc.constraint_name INTO con_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON kcu.constraint_name = tc.constraint_name
       AND kcu.table_schema    = tc.table_schema
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name
       AND ccu.table_schema    = tc.table_schema
     WHERE tc.constraint_type = 'FOREIGN KEY'
       AND tc.table_schema    = 'public'
       AND tc.table_name      = tbl
       AND kcu.column_name    = col
       AND ccu.table_name     = ref_tbl
     LIMIT 1;

    IF con_name IS NOT NULL THEN
      RAISE NOTICE 'dropping existing FK % on %.%', con_name, tbl, col;
      EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', tbl, con_name);
    END IF;

    RAISE NOTICE 'recreating FK on %.% → %(id) ON DELETE SET NULL', tbl, col, ref_tbl;
    EXECUTE format(
      'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES %I(id) ON DELETE SET NULL',
      tbl, tbl || '_' || col || '_fkey', col, ref_tbl
    );
  END LOOP;
END $$;
