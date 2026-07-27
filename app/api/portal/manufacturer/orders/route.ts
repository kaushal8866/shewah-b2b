import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { safeDbError } from '@/lib/sanitizeDbError'

// Fields the manufacturer is allowed to see. Costs/labour/material totals
// are intentionally excluded — the manufacturer should not see internal pricing.
const LIST_COLS_FULL = `
  id, order_number, status, description, quantity, ring_size,
  gold_karat, gold_weight_required, gold_weight_actual, diamond_weight,
  issued_date, expected_date, completed_date,
  reference_images, special_notes, manufacturer_notes, manufacturer_updated_at
`

// Fallback when the Task #58 migration (which adds `completed_date`) hasn't
// been applied to a particular environment yet. Same shape minus the missing
// column. Without this fallback the portal returns 500 with a raw
// "column ... does not exist" Postgres error.
const LIST_COLS_BASE = `
  id, order_number, status, description, quantity, ring_size,
  gold_karat, gold_weight_required, gold_weight_actual, diamond_weight,
  issued_date, expected_date,
  reference_images, special_notes, manufacturer_notes, manufacturer_updated_at
`

export async function GET() {
  const session = await getServerSession(authOptions)
  const user: any = session?.user
  if (!user || user.role !== 'manufacturer') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (!user.manufacturingPartnerId) {
    return NextResponse.json({ error: 'No manufacturing partner linked' }, { status: 400 })
  }

  // Widened deliberately: the fallback below re-queries with a narrower column
  // list, so the two responses have different row shapes.
  let resp: { data: any[] | null; error: any } = await supabaseAdmin
    .from('manufacturing_orders')
    .select(LIST_COLS_FULL)
    .eq('manufacturing_partner_id', user.manufacturingPartnerId)
    .order('issued_date', { ascending: false })

  // Graceful fallback if the new column is missing on this environment.
  if (resp.error && (resp.error.code === '42703' || /completed_date/.test(resp.error.message || ''))) {
    resp = await supabaseAdmin
      .from('manufacturing_orders')
      .select(LIST_COLS_BASE)
      .eq('manufacturing_partner_id', user.manufacturingPartnerId)
      .order('issued_date', { ascending: false })
  }

  if (resp.error) {
    return NextResponse.json(
      { error: safeDbError(resp.error, 'manufacturer.orders.list', 'Could not load orders.') },
      { status: 500 },
    )
  }
  return NextResponse.json({ orders: resp.data || [] })
}
