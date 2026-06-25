import { NextResponse } from 'next/server'
import { getResellerSession } from '@/lib/resellerAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { safeDbError } from '@/lib/sanitizeDbError'

export async function GET() {
  const { reseller, error } = await getResellerSession()
  if (error || !reseller) {
    return NextResponse.json({ error: error || 'Forbidden' }, { status: 403 })
  }

  // Fetch reseller's customer registry
  const { data: customers, error: dbErr } = await supabaseAdmin
    .from('reseller_customers')
    .select('*')
    .eq('reseller_id', reseller.id)
    .order('last_order_date', { ascending: false })

  if (dbErr) {
    return NextResponse.json({ error: safeDbError(dbErr, 'reseller.customers.list', 'Could not load customers.') }, { status: 500 })
  }

  return NextResponse.json({ customers })
}
