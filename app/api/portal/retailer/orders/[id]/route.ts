import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// Fields the retailer is allowed to see on their own order detail. Internal
// financials beyond what the retailer needs (gold_rate_at_order, internal_notes,
// COGS) and any manufacturer-only data are intentionally excluded.
const DETAIL_COLS = `
  id, order_number, status, type, model, quantity, ring_size, special_notes, brief_text,
  trade_price, total_amount, advance_paid, balance_due,
  order_date, expected_delivery, dispatch_date, actual_delivery,
  courier, tracking_number, brief_images, product_id, partner_id, cad_request_id,
  product:products ( id, code, name, category, photo_urls, gold_karat,
    diamond_weight, diamond_shape, diamond_quality, diamond_color, delivery_days )
`

export async function GET(_: Request, ctx: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const user: any = session?.user
  if (!user || user.role !== 'retailer' || !user.partnerId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data, error } = await supabaseAdmin
    .from('orders')
    .select(DETAIL_COLS)
    .eq('id', ctx.params.id)
    .eq('partner_id', user.partnerId)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

  // Strip partner_id from the response — UI doesn't need it.
  const { partner_id, cad_request_id, ...safe } = data as any

  // If a CAD request is linked and has reached the retailer-visible stages,
  // surface a trimmed view. Internal SLAs (due_date), costs, revision_notes
  // (internal-only), reference images, and other partners' work are excluded.
  let cad_request: any = null
  if (cad_request_id) {
    const { data: cad } = await supabaseAdmin
      .from('cad_requests')
      .select('id, status, render_images, partner_feedback, sent_date, approved_date, partner_id')
      .eq('id', cad_request_id)
      .eq('partner_id', user.partnerId)
      .maybeSingle()
    if (cad && ['sent', 'revision_requested', 'approved'].includes(cad.status)) {
      const { partner_id: _p, ...cadSafe } = cad as any
      cad_request = cadSafe
    }
  }

  return NextResponse.json({ order: safe, cad_request })
}
