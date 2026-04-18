import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// Fields the manufacturer is allowed to see. Costs/labour/material totals
// are intentionally excluded — the manufacturer should not see internal pricing.
const LIST_COLS = `
  id, order_number, status, description, quantity, ring_size,
  gold_karat, gold_weight_required, gold_weight_actual, diamond_weight,
  issued_date, expected_date, completed_date,
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

  const { data, error } = await supabaseAdmin
    .from('manufacturing_orders')
    .select(LIST_COLS)
    .eq('manufacturing_partner_id', user.manufacturingPartnerId)
    .order('issued_date', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ orders: data || [] })
}
