import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { safeDbError } from '@/lib/sanitizeDbError'

export const dynamic = 'force-dynamic'

const LIST_COLS = `
  id, order_number, status, type, model, quantity, special_notes, brief_text,
  trade_price, total_amount, advance_paid, balance_due,
  order_date, expected_delivery, dispatch_date, actual_delivery,
  courier, tracking_number
`

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    const user: any = session?.user
    if (!user || user.role !== 'retailer' || !user.partnerId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data, error } = await supabaseAdmin
      .from('orders')
      .select(LIST_COLS)
      .eq('partner_id', user.partnerId)
      .eq('type', 'loose_diamond')
      .order('order_date', { ascending: false })

    if (error) {
      return NextResponse.json(
        { error: safeDbError(error, 'retailer.diamond_orders.list', 'Could not load your diamond orders.') },
        { status: 500 },
      )
    }

    return NextResponse.json({ orders: data || [] })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
