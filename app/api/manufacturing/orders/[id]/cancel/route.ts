import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { applyMfgStatusChange } from '@/lib/mfgOrderLifecycle'
import { KARAT_FACTORS } from '@/lib/karat'

/**
 * Guided cancellation for a manufacturing order. Three branches, each posted
 * with a different `action` so the audit trail is unambiguous.
 *
 *  • action=not_started — original behaviour: flip the mfg order to
 *    'cancelled', let `applyMfgStatusChange` release the float reservation.
 *
 *  • action=reassign    — karigar refused to take on the work. Reassign the
 *    pending consumption row(s) to a new partner's float of the same material
 *    type, and update the mfg order's partner. Status stays `issued`.
 *
 *  • action=receive     — karigar finished it but it never reached the
 *    customer. Capture actual pure-gold consumed + diamond + photos, settle
 *    the float (final, with the actual gross weight), close the mfg order
 *    with status `received_after_cancel`, create a `ready_to_ship_items`
 *    row owned by HQ.
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
  order_number: string | null
  status: string
  manufacturing_partner_id: string | null
  customer_order_id: string | null
  description: string | null
  gold_karat: number | null
  gold_weight_required: number | null
  gold_weight_actual: number | null
  diamond_weight: number | null
  material_from_float: boolean
  total_manufacturing_cost: number | null
  reference_images: string[] | null
}

type PendingTxRow = { id: string; float_id: string | null; quantity: number; unit: string | null }

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
    .select('id, order_number, status, manufacturing_partner_id, customer_order_id, description, gold_karat, gold_weight_required, gold_weight_actual, diamond_weight, material_from_float, total_manufacturing_cost, reference_images')
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

    // Move every pending consumption row owned by the source partner to a
    // matching float on the target partner. We re-create the target's float
    // bucket lazily so this works even if the new partner has never held this
    // material before.
    if (order.material_from_float) {
      const { data: pending } = await supabaseAdmin
        .from('material_transactions')
        .select('id, float_id, quantity, unit, manufacturing_partner_id')
        .eq('manufacturing_order_id', order.id)
        .eq('transaction_type', 'consumption')
        .eq('lifecycle', 'pending')
        .returns<(PendingTxRow & { manufacturing_partner_id: string | null })[]>()

      for (const tx of pending || []) {
        // Find the source float so we can copy its material_type onto the new partner.
        if (!tx.float_id) continue
        const { data: srcFloat } = await supabaseAdmin
          .from('material_float')
          .select('material_type, unit')
          .eq('id', tx.float_id)
          .maybeSingle<{ material_type: string; unit: string | null }>()
        if (!srcFloat) continue

        let targetFloatId: string | null = null
        const existing = await supabaseAdmin
          .from('material_float')
          .select('id')
          .eq('manufacturing_partner_id', newPartnerId)
          .eq('material_type', srcFloat.material_type)
          .maybeSingle<{ id: string }>()
        if (existing.data?.id) {
          targetFloatId = existing.data.id
        } else {
          const created = await supabaseAdmin
            .from('material_float')
            .insert([{
              manufacturing_partner_id: newPartnerId,
              material_type: srcFloat.material_type,
              unit: srcFloat.unit || 'grams',
              total_deposited: 0,
              total_consumed: 0,
            }])
            .select('id').single()
          if (created.error) return NextResponse.json({ error: created.error.message }, { status: 500 })
          targetFloatId = (created.data as { id: string }).id
        }

        const { error: mvErr } = await supabaseAdmin
          .from('material_transactions')
          .update({
            float_id: targetFloatId,
            manufacturing_partner_id: newPartnerId,
            notes: `Reassigned from prior karigar — ${body.reason || 'no reason given'}`,
          })
          .eq('id', tx.id)
        if (mvErr) return NextResponse.json({ error: mvErr.message }, { status: 500 })
      }
    }

    const { error: uerr } = await supabaseAdmin
      .from('manufacturing_orders')
      .update({ manufacturing_partner_id: newPartnerId })
      .eq('id', order.id)
    if (uerr) return NextResponse.json({ error: uerr.message }, { status: 500 })

    return NextResponse.json({ ok: true, action: 'reassign', new_partner_id: newPartnerId })
  }

  if (body.action === 'receive') {
    const karat = order.gold_karat || 22
    const factor = KARAT_FACTORS[karat] || KARAT_FACTORS[22]
    const actualPure = Number(body.actual_pure_24kt_g) || 0
    if (actualPure <= 0) return NextResponse.json({ error: 'actual_pure_24kt_g required' }, { status: 400 })
    const actualGrossAtKarat = factor > 0 ? actualPure / factor : actualPure
    const actualDiamond = Number(body.actual_diamond_ct) || 0
    const photos = Array.isArray(body.photos) ? body.photos.filter((p): p is string => typeof p === 'string').slice(0, 12) : []
    const listPrice = Number(body.list_price) || 0
    if (listPrice <= 0) return NextResponse.json({ error: 'list_price required' }, { status: 400 })

    // 1) Settle the float: lock the pending consumption row to actual gross weight,
    //    flip lifecycle='final'. Anything required-minus-actual stays in float as
    //    available material — no extra refund row needed.
    if (order.material_from_float) {
      const { data: pending } = await supabaseAdmin
        .from('material_transactions')
        .select('id, float_id, quantity, unit')
        .eq('manufacturing_order_id', order.id)
        .eq('transaction_type', 'consumption')
        .eq('lifecycle', 'pending')
        .returns<PendingTxRow[]>()
      // There's normally exactly one row; settle them all defensively.
      for (const tx of pending || []) {
        const { error: uerr } = await supabaseAdmin
          .from('material_transactions')
          .update({
            quantity: actualGrossAtKarat,
            lifecycle: 'final',
            notes: `Settled on receive-after-cancel: actual ${actualGrossAtKarat.toFixed(4)}g (${actualPure.toFixed(4)}g 24kt-pure)`,
          })
          .eq('id', tx.id)
        if (uerr) return NextResponse.json({ error: uerr.message }, { status: 500 })
      }
    }

    // 2) Close the mfg order with the dedicated terminal status.
    const { error: closeErr } = await supabaseAdmin
      .from('manufacturing_orders')
      .update({
        status: 'received_after_cancel',
        gold_weight_actual: actualGrossAtKarat,
        diamond_weight: actualDiamond || order.diamond_weight,
        completed_date: new Date().toISOString().slice(0, 10),
      })
      .eq('id', order.id)
    if (closeErr) return NextResponse.json({ error: closeErr.message }, { status: 500 })

    // 3) Create the Ready-to-Ship record. We resolve the catalog product via
    //    the linked customer order (if any) so retailers see a real SKU card.
    let productId: string | null = null
    if (order.customer_order_id) {
      const { data: srcOrd } = await supabaseAdmin
        .from('orders')
        .select('product_id')
        .eq('id', order.customer_order_id)
        .maybeSingle<{ product_id: string | null }>()
      productId = srcOrd?.product_id || null
    }

    const { data: rts, error: rtsErr } = await supabaseAdmin
      .from('ready_to_ship_items')
      .insert([{
        product_id: productId,
        source_mfg_order_id: order.id,
        source_order_id: order.customer_order_id,
        karat,
        gross_weight: actualGrossAtKarat,
        pure_24kt_weight: actualPure,
        diamond_specs: body.diamond_specs || (actualDiamond > 0 ? { total_carats: actualDiamond } : {}),
        photos,
        list_price: listPrice,
        original_cogs: order.total_manufacturing_cost,
        status: 'available',
        internal_notes: body.receive_notes || body.reason || null,
      }])
      .select('id').single()
    if (rtsErr) return NextResponse.json({ error: rtsErr.message }, { status: 500 })

    return NextResponse.json({ ok: true, action: 'receive', ready_to_ship_id: (rts as { id: string }).id })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
