import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { safeDbError } from '@/lib/sanitizeDbError'

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

  if (error) {
    return NextResponse.json(
      { error: safeDbError(error, 'retailer.orders.get', 'Could not load this order.') },
      { status: 500 },
    )
  }
  if (!data) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

  // Strip partner_id from the response — UI doesn't need it.
  const { partner_id, cad_request_id, ...safe } = data as any

  // If a CAD request is linked and has reached the retailer-visible stages,
  // surface a trimmed view. Internal SLAs (due_date), costs, revision_notes
  // (internal-only), the brief-side reference images on cad_requests, and
  // other partners' work are excluded. NOTE: per-revision reference images
  // attached by the design team to a render share (cad_revisions.reference_images,
  // Task 36) ARE intentionally exposed in the revisions history below.
  let cad_request: any = null
  let cad_revisions: any[] = []
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

      // Pull the full revisions history (renders + retailer feedback) so the
      // retailer can see how the design evolved across rounds.
      const { data: revs } = await supabaseAdmin
        .from('cad_revisions')
        .select('id, created_at, kind, author, note, render_images, reference_images, reference_captions, acknowledged_at')
        .eq('cad_request_id', cad.id)
        .in('kind', ['render', 'revision_request', 'approval'])
        .order('created_at', { ascending: true })
      cad_revisions = revs || []
    }
  }

  // Surface the retailer's own change requests on this order. We tolerate the
  // table being missing (Task #58 migration not applied yet) so the page
  // doesn't break in older environments.
  let change_requests: any[] = []
  const cr = await supabaseAdmin
    .from('order_change_requests')
    .select('id, created_at, changes, retailer_note, status, reviewed_at, review_note')
    .eq('order_id', ctx.params.id)
    .eq('partner_id', user.partnerId)
    .order('created_at', { ascending: false })
  if (!cr.error) change_requests = cr.data || []

  return NextResponse.json({ order: safe, cad_request, cad_revisions, change_requests })
}
