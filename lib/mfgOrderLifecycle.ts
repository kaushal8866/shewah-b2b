import { supabase, computeOrderCogs, partnerLabourRate } from './supabase'
import { KARAT_FACTORS } from './karat'

// Task 78: float quantities are denominated in 24kt-net. Order/mfg-order rows
// keep gross-at-karat for gold_weight_*; we convert here at the boundary.
function grossToPure24k(gross: number | null | undefined, karat: number | null | undefined): number | null {
  if (gross == null || gross <= 0) return null
  const k = Number(karat) || 24
  const f = KARAT_FACTORS[k] ?? 1
  return Math.round(gross * f * 10000) / 10000
}

/**
 * Apply the float-side effects of a manufacturing-order status change.
 *
 * Three transitions matter when the order was issued from a karigar's float
 * (`material_from_float = true`):
 *
 *   • → completed → flip the pending consumption row to lifecycle='final'
 *                   (substituting `gold_weight_actual` if it was entered)
 *   • → cancelled → delete the consumption row outright; gold is treated as
 *                   never having left the float (it was a paper reservation)
 *   • → returned  → delete the consumption row AND insert a matching `return`
 *                   transaction so the karigar's float reflects the physical
 *                   gold coming back into custody (uses actual weight if known,
 *                   otherwise the originally-required weight)
 *   • completed → anything-not-cancelled-or-returned → revert the final row
 *                   back to lifecycle='pending' so it re-enters Reserved
 */
export async function applyMfgStatusChange(opts: {
  mfgOrderId: string
  prevStatus: string
  newStatus: string
  goldWeightRequired: number | null
  goldWeightActual: number | null
  materialFromFloat: boolean
  partnerId?: string | null
  goldKarat?: number | null
}): Promise<void> {
  const {
    mfgOrderId, prevStatus, newStatus,
    goldWeightRequired, goldWeightActual, materialFromFloat, partnerId, goldKarat,
  } = opts

  if (!materialFromFloat || prevStatus === newStatus) return

  // Task 78: convert gross-at-karat → 24kt-pure before writing any gold
  // quantity to material_transactions. Diamond floats (handled separately)
  // are unit-of-account already.
  const actualPure   = grossToPure24k(goldWeightActual,   goldKarat)
  const requiredPure = grossToPure24k(goldWeightRequired, goldKarat)

  if (newStatus === 'completed') {
    const upd: any = { lifecycle: 'final' }
    if (actualPure != null && actualPure > 0) upd.quantity = actualPure
    await supabase.from('material_transactions')
      .update(upd)
      .eq('manufacturing_order_id', mfgOrderId)
      .eq('transaction_type', 'consumption')
      .eq('lifecycle', 'pending')

    // Also trigger parent order COGS recalculation!
    try {
      const { data: mfg } = await supabase
        .from('manufacturing_orders')
        .select('order_id')
        .eq('id', mfgOrderId)
        .single()
      if (mfg && mfg.order_id && goldWeightActual && goldWeightActual > 0) {
        await recalculateParentOrderCogs(mfg.order_id, goldWeightActual)
      }
    } catch (err) {
      console.error('Error recalculating parent order cogs:', err)
    }
    return
  }

  if (newStatus === 'cancelled') {
    await supabase.from('material_transactions')
      .delete()
      .eq('manufacturing_order_id', mfgOrderId)
      .eq('transaction_type', 'consumption')
    return
  }

  if (newStatus === 'returned') {
    const { data: existing } = await supabase
      .from('material_transactions')
      .select('float_id, unit')
      .eq('manufacturing_order_id', mfgOrderId)
      .eq('transaction_type', 'consumption')
      .limit(1)
      .maybeSingle()

    await supabase.from('material_transactions')
      .delete()
      .eq('manufacturing_order_id', mfgOrderId)
      .eq('transaction_type', 'consumption')

    const returnQty = actualPure || requiredPure || 0
    if (existing && returnQty > 0 && partnerId) {
      await supabase.from('material_transactions').insert([{
        float_id: (existing as any).float_id,
        manufacturing_partner_id: partnerId,
        manufacturing_order_id: mfgOrderId,
        transaction_type: 'return',
        lifecycle: 'final',
        quantity: returnQty,
        unit: (existing as any).unit || 'grams',
        notes: 'Auto-return: order cancelled / returned post-handoff (24kt-net)',
      }])
    }
    return
  }

  if (prevStatus === 'completed') {
    const upd: any = { lifecycle: 'pending' }
    if (requiredPure != null && requiredPure > 0) upd.quantity = requiredPure
    await supabase.from('material_transactions')
      .update(upd)
      .eq('manufacturing_order_id', mfgOrderId)
      .eq('transaction_type', 'consumption')
      .eq('lifecycle', 'final')
  }
}

/**
 * Cascade a customer-order cancellation / return to every linked manufacturing
 * order. Each linked mfg order is moved to the matching status (`cancelled` or
 * `returned`) and its float side-effects applied.
 *
 * Mfg orders that are already in a terminal non-target state are left alone so
 * we don't, for example, "re-cancel" something already returned.
 */
export async function cascadeOrderStatusToMfg(opts: {
  orderId: string
  newStatus: 'cancelled' | 'returned'
}): Promise<{ affected: number }> {
  const { orderId, newStatus } = opts
  const { data: mfgs } = await supabase
    .from('manufacturing_orders')
    .select('id, status, gold_weight_required, gold_weight_actual, gold_karat, material_from_float, manufacturing_partner_id')
    .eq('order_id', orderId)

  let affected = 0
  for (const m of mfgs || []) {
    const prev = (m as any).status as string
    if (prev === newStatus) continue
    if (prev === 'cancelled' && newStatus !== 'returned') continue

    const { error } = await supabase.from('manufacturing_orders')
      .update({ status: newStatus })
      .eq('id', (m as any).id)
    if (error) continue

    await applyMfgStatusChange({
      mfgOrderId: (m as any).id,
      prevStatus: prev,
      newStatus,
      goldWeightRequired: (m as any).gold_weight_required,
      goldWeightActual: (m as any).gold_weight_actual,
      goldKarat: (m as any).gold_karat,
      materialFromFloat: (m as any).material_from_float,
      partnerId: (m as any).manufacturing_partner_id,
    })
    affected += 1
  }
  return { affected }
}

async function recalculateParentOrderCogs(orderId: string, actualWeight: number): Promise<void> {
  const { data: order } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .single()

  if (!order) return

  let saveLabourPerG = 0
  let minLabourGrams = 1

  if (order.assigned_manufacturer_id) {
    const { data: partner } = await supabase
      .from('manufacturing_partners')
      .select('*')
      .eq('id', order.assigned_manufacturer_id)
      .single()
    if (partner) {
      minLabourGrams = Number(partner.min_labour_grams) || 1
      const goldKarat = order.gold_karat
      if (goldKarat) {
        saveLabourPerG = partnerLabourRate(partner, Number(goldKarat))
      }
    }
  }

  const cogs = computeOrderCogs({
    gold_weight_actual: actualWeight,
    gold_rate_at_order: order.gold_rate_at_order,
    gold_karat: order.gold_karat,
    metal_type: order.metal_type,
    labour_per_gram: saveLabourPerG,
    gross_weight: actualWeight,
    min_labour_grams: minLabourGrams,
    making_charges: order.making_charges,
    cad_cost: order.cad_cost,
    stone_cost: order.stone_cost,
    total_amount: order.total_amount,
  })

  await supabase
    .from('orders')
    .update({
      gold_weight_actual: actualWeight,
      total_cogs: Math.round(cogs.total_cogs) || null,
      margin: Math.round(cogs.margin) || null,
    })
    .eq('id', orderId)
}
