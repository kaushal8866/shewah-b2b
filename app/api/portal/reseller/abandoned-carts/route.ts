import { NextRequest, NextResponse } from 'next/server'
import { getResellerSession } from '@/lib/resellerAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { safeDbError } from '@/lib/sanitizeDbError'

export async function GET(req: NextRequest) {
  const { reseller, error } = await getResellerSession()
  if (error || !reseller) {
    return NextResponse.json({ error: error || 'Forbidden' }, { status: 403 })
  }

  const { data: carts, error: dbErr } = await supabaseAdmin
    .from('reseller_storefront_abandoned_carts')
    .select('*, customer:reseller_storefront_customers(name, phone)')
    .eq('reseller_id', reseller.id)
    .order('updated_at', { ascending: false })

  if (dbErr) {
    return NextResponse.json(
      { error: safeDbError(dbErr, 'reseller.abandoned_carts.list', 'Failed to retrieve abandoned carts.') },
      { status: 500 }
    )
  }

  return NextResponse.json({ abandonedCarts: carts || [] })
}
