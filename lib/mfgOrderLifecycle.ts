import { computeOrderCogs, partnerLabourRate } from './supabase'
import { supabaseAdmin as supabase } from './supabaseAdmin'
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
import { computeFifoPlan, executeFifoPlan } from './fifoEngine'
import { createReplenishmentObligation } from './replenishmentEngine'

export async function applyMfgStatusChange(opts: {
  mfgOrderId: string
  prevStatus: string
  newStatus: string
  goldWeightRequired: number | null
  goldWeightActual: number | null
  materialFromFloat: boolean
  partnerId?: string | null
  goldKarat?: number | null
  userId?: string | null
}): Promise<void> {
  const {
    mfgOrderId, prevStatus, newStatus,
    goldWeightRequired, goldWeightActual, materialFromFloat, partnerId, goldKarat, userId
  } = opts

  if (prevStatus === newStatus) return

  // Run the float transactions logic only if materialFromFloat is true
  if (materialFromFloat) {
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
    } else if (newStatus === 'cancelled') {
      await supabase.from('material_transactions')
        .delete()
        .eq('manufacturing_order_id', mfgOrderId)
        .eq('transaction_type', 'consumption')
    } else if (newStatus === 'returned') {
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
    } else if (prevStatus === 'completed') {
      const upd: any = { lifecycle: 'pending' }
      if (requiredPure != null && requiredPure > 0) upd.quantity = requiredPure
      await supabase.from('material_transactions')
        .update(upd)
        .eq('manufacturing_order_id', mfgOrderId)
        .eq('transaction_type', 'consumption')
        .eq('lifecycle', 'final')
    }
  }

  // --- FIFO & Replenishment Logic (runs for ALL mfg orders) ---
  if (newStatus === 'completed') {
    try {
      // 1. Get manufacturing order details
      const { data: mfgOrder } = await supabase
        .from('manufacturing_orders')
        .select('*')
        .eq('id', mfgOrderId)
        .single()

      if (mfgOrder) {
        const createdBy = userId || mfgOrder.created_by || '00000000-0000-0000-0000-000000000000'

        // Step 1: Get existing reserved lot_issuances for this mfg order
        const { data: existingIssuances } = await supabase
          .from('lot_issuances')
          .select('lot_id, issued_qty, unit_cost')
          .eq('manufacturing_order_id', mfgOrderId)
          .eq('issuance_type', 'reserved')

        // Step 2: Compare reserved vs actual weight
        const estimatedQty = Number(goldWeightRequired || mfgOrder.gold_weight_required || 0)
        const actualQty    = Number(goldWeightActual || mfgOrder.gold_weight_actual || 0)
        const existingLotId = existingIssuances?.[0]?.lot_id

        if (actualQty !== estimatedQty && actualQty > 0 && estimatedQty > 0) {
          const adjustQty = actualQty - estimatedQty
          if (adjustQty > 0) {
            // Overrun: issue more from same lot first
            const plan = await computeFifoPlan({
              materialType: 'gold_24k',
              requiredQty: adjustQty,
              goldKarat: String(goldKarat || mfgOrder.gold_karat || '24K'),
              existingLotId,
            })
            await executeFifoPlan(plan, mfgOrderId, 'final', createdBy)
          } else if (adjustQty < 0 && existingLotId) {
            // Underrun: return qty to the lot
            await supabase.rpc('increment_lot_qty', {
              p_lot_id: existingLotId,
              p_qty: Math.abs(adjustQty),
            })
          }
        }

        // Mark all reserved issuances as final
        await supabase
          .from('lot_issuances')
          .update({
            issuance_type: 'final',
            finalised_at: new Date().toISOString()
          })
          .eq('manufacturing_order_id', mfgOrderId)
          .eq('issuance_type', 'reserved')

        // Step 3: Compute lot-based COGS from all final issuances
        const { data: finalIssuances } = await supabase
          .from('lot_issuances')
          .select('unit_cost, issued_qty, total_cost')
          .eq('manufacturing_order_id', mfgOrderId)
          .eq('issuance_type', 'final')

        const lotGoldCost = finalIssuances?.reduce((sum: number, i: any) => sum + Number(i.total_cost), 0) ?? 0
        const lotTotalCost = finalIssuances?.reduce((sum: number, i: any) => sum + Number(i.total_cost), 0) ?? 0

        const labourCost = Number(mfgOrder.labour_amount || 0)
        const otherCharges = Number(mfgOrder.other_charges || 0)
        const lotTotalCogs = lotTotalCost + labourCost + otherCharges

        // Step 4: Update manufacturing order with lot-based COGS
        await supabase
          .from('manufacturing_orders')
          .update({
            lot_based_gold_cost:  parseFloat(lotGoldCost.toFixed(2)),
            lot_based_total_cogs: parseFloat(lotTotalCogs.toFixed(2)),
            fifo_costed: true,
          })
          .eq('id', mfgOrderId)

        // Step 5: Update parent order's lot-based COGS
        const parentOrderId = mfgOrder.order_id || mfgOrder.customer_order_id
        if (parentOrderId) {
          const { data: parentOrder } = await supabase
            .from('orders')
            .select('total_amount')
            .eq('id', parentOrderId)
            .single()

          if (parentOrder) {
            const lotBasedMargin = Number(parentOrder.total_amount || 0) - lotTotalCogs
            await supabase
              .from('orders')
              .update({
                lot_based_cogs:   parseFloat(lotTotalCogs.toFixed(2)),
                lot_based_margin: parseFloat(lotBasedMargin.toFixed(2)),
              })
              .eq('id', parentOrderId)
          }
        }

        // Step 6: Create replenishment obligation for gold used
        const karatNum = Number(goldKarat || mfgOrder.gold_karat || 24)
        const purityFactor = KARAT_FACTORS[karatNum] ?? 1
        const pureGoldUsed = parseFloat((actualQty * purityFactor).toFixed(4))

        if (pureGoldUsed > 0) {
          await createReplenishmentObligation({
            manufacturingOrderId: mfgOrderId,
            materialType: 'gold_24k',
            actualQtyUsed: pureGoldUsed,
          })
        }
      }
    } catch (err) {
      console.error('Error executing FIFO / replenishment lifecycle completed:', err)
    }

    // Also trigger parent order COGS recalculation (traditional rate-based COGS)
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
