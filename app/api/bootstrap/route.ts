import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

/**
 * EMERGENCY BOOTSTRAP ROUTE
 * Use this to apply RLS fixes and promote the first owner.
 * 
 * SECURITY: This should be deleted or protected after use.
 */
export async function GET() {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'supabaseAdmin not initialized' }, { status: 500 })
  }

  const sql = `
    -- 1. Resilience Fix
    CREATE OR REPLACE FUNCTION get_my_role() RETURNS text AS $$
      SELECT role FROM user_roles WHERE user_id = auth.uid() AND deleted_at IS NULL;
    $$ LANGUAGE sql SECURITY DEFINER;

    -- 2. Bootstrap Function
    CREATE OR REPLACE FUNCTION bootstrap_self() RETURNS text AS $$
    DECLARE
      v_count integer;
    BEGIN
      SELECT count(*) INTO v_count FROM user_roles WHERE role = 'owner';
      IF v_count = 0 THEN
        INSERT INTO user_roles (user_id, role) VALUES (auth.uid(), 'owner');
        RETURN 'promoted';
      END IF;
      RETURN 'skipped';
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;

    -- 3. Policy Fixes
    DROP POLICY IF EXISTS "Owner: all on partners" ON partners;
    CREATE POLICY "Owner: all on partners" ON partners FOR ALL USING (get_my_role() = 'owner') WITH CHECK (get_my_role() = 'owner');
    
    DROP POLICY IF EXISTS "Owner: all on orders" ON orders;
    CREATE POLICY "Owner: all on orders" ON orders FOR ALL USING (get_my_role() = 'owner') WITH CHECK (get_my_role() = 'owner');
  `

  // Supabase doesn't support direct SQL via JS client for security.
  // We must use the 'rpc' or just apply the migration via the terminal if we had it.
  
  // WAIT: If I can't run SQL via the client, I can't really automate it this way.
  
  return NextResponse.json({ 
    message: 'Automation script generated. Apply via Supabase SQL Editor.',
    sql: sql
  })
}
