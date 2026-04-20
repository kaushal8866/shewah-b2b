import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { applyMfgStatusChange } from '@/lib/mfgOrderLifecycle'
import { KARAT_FACTORS } from '@/lib/karat'

/**
 * Guided cancellation for a manufacturing order. Three branches, posted with
 * different `action` values for an unambiguous audit trail.
 *
 *  • action=not_started — original behaviour: flip the mfg order to
 *    'cancelled' and let `applyMfgStatusChange` release the float.
 *
 *  • action=reassign    — karigar refused to take on the work. Atomic RPC
 *    `reassign_mfg_order_for_cancel` moves every pending consumption row to
 *    a matching float on the new partner (creating the bucket lazily) and
 *    flips the order's `manufacturing_partner_id` in the same transaction.
 *
 *  • action=receive     — karigar finished it but it never reached the
 *    customer. Atomic RPC `receive_mfg_order_after_cancel` settles the
 *    pending float to the actual gross weight (derived from the actual
 *    pure-24kt input via the karat factor), closes the mfg order with
 *    status `received_after_cancel`, and inserts the `ready_to_ship_items`
 *    row in the same transaction.
 */
type Body = {
  action: 'not_started' | 'reassign' | 'receive'
  reason?: string | null

  // reassign-only
  new_partner_id?: string

  // receive-only
  actual_pure_24kt_g?: number
  actual_diamond_ct?: number
  diamond_specs?: Record<string, unknown>
  photos?: string[]
  list_price?: number
  receive_notes?: string | null
}

type MfgOrderRow = {
  id: string
  status: string
  manufacturing_partner_id: string | null
  customer_order_id: string | null
  gold_karat: number | null
  gold_weight_required: number | null
  gold_weight_actual: number | null
  material_from_float: boolean
}

export async function POST(req: Request, ctx: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const user = session?.user as { role?: string; id?: string } | undefined
  if (!user || (user.role !== 'master' && user.role !== 'admin' && user.role !== 'sub')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: Body
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }

  const { data: order, error: oerr } = await supabaseAdmin
    .from('manufacturing_orders')
    .select('id, status, manufacturing_partner_id, customer_order_id, gold_karat, gold_weight_required, gold_weight_actual, material_from_float')
    .eq('id', ctx.params.id)
    .maybeSingle<MfgOrderRow>()
  if (oerr || !order) return NextResponse.json({ error: oerr?.message || 'Order not found' }, { status: 404 })

  const prevStatus = order.status

  if (body.action === 'not_started') {
    const { error: uerr } = await supabaseAdmin
      .from('manufacturing_orders')
      .update({ status: 'cancelled' })
      .eq('id', order.id)
    if (uerr) return NextResponse.json({ error: uerr.message }, { status: 500 })

    await applyMfgStatusChange({
      mfgOrderId: order.id,
      prevStatus,
      newStatus: 'cancelled',
      goldWeightRequired: order.gold_weight_required,
      goldWeightActual: order.gold_weight_actual,
      materialFromFloat: !!order.material_from_float,
      partnerId: order.manufacturing_partner_id,
    })
    return NextResponse.json({ ok: true, action: 'not_started' })
  }

  if (body.action === 'reassign') {
    const newPartnerId = String(body.new_partner_id || '')
    if (!newPartnerId) return NextResponse.json({ error: 'new_partner_id required' }, { status: 400 })
    if (newPartnerId === order.manufacturing_partner_id) {
      return NextResponse.json({ error: 'Pick a different partner' }, { status: 400 })
    }

    const { error: rpcErr } = await supabaseAdmin.rpc('reassign_mfg_order_for_cancel', {
      p_order_id: order.id,
      p_new_partner_id: newPartnerId,
      p_reason: body.reason || null,
    })
    if (rpcErr) return NextResponse.json({ error: rpcErr.message }, { status: 500 })
    return NextResponse.json({ ok: true, action: 'reassign', new_partner_id: newPartnerId })
  }

  if (body.action === 'receive') {
    const karat = order.gold_karat || 22
    const factor = KARAT_FACTORS[karat] || KARAT_FACTORS[22]
    const actualPure = Number(body.actual_pure_24kt_g) || 0
    if (actualPure <= 0) return NextResponse.json({ error: 'actual_pure_24kt_g required' }, { status: 400 })
    const listPrice = Number(body.list_price) || 0
    if (listPrice <= 0) return NextResponse.json({ error: 'list_price required' }, { status: 400 })
    const actualDiamond = Number(body.actual_diamond_ct) || 0
    const photos = Array.isArray(body.photos)
      ? body.photos.filter((p): p is string => typeof p === 'string').slice(0, 12)
      : []

    // Resolve the catalog product via the linked customer order (if any).
    let productId: string | null = null
    if (order.customer_order_id) {
      const { data: srcOrd } = await supabaseAdmin
        .from('orders')
        .select('product_id')
        .eq('id', order.customer_order_id)
        .maybeSingle<{ product_id: string | null }>()
      productId = srcOrd?.product_id || null
    }

    const diamondSpecs = body.diamond_specs && Object.keys(body.diamond_specs).length > 0
      ? body.diamond_specs
      : (actualDiamond > 0 ? { total_carats: actualDiamond } : {})

    const { data: rtsId, error: rpcErr } = await supabaseAdmin.rpc('receive_mfg_order_after_cancel', {
      p_order_id: order.id,
      p_actual_pure: actualPure,
      p_karat_factor: factor,
      p_actual_diamond: actualDiamond,
      p_diamond_specs: diamondSpecs,
      p_photos: photos,
      p_list_price: listPrice,
      p_receive_notes: body.receive_notes || body.reason || null,
      p_product_id: productId,
    })
    if (rpcErr) return NextResponse.json({ error: rpcErr.message }, { status: 500 })
    return NextResponse.json({ ok: true, action: 'receive', ready_to_ship_id: rtsId })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
