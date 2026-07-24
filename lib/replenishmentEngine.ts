import { supabaseAdmin } from '@/lib/supabaseAdmin'

// ── CREATE OBLIGATION (called at mfg completion) ────────────────────────────

/**
 * Called when a manufacturing order status changes to 'completed'.
 * Creates a replenishment obligation for the gold/silver used.
 * Material type: only gold and silver trigger replenishment.
 */
export async function createReplenishmentObligation(params: {
  manufacturingOrderId: string
  materialType: 'gold_24k' | 'silver_925' | 'silver_999'
  actualQtyUsed: number          // grams of pure metal (24K-equivalent for gold)
}): Promise<{ obligation_id: string; obligation_value: number }> {
  const supabase = supabaseAdmin

  // Get today's rate
  const { data: rateRow } = await supabase
    .from('gold_rates')
    .select('rate_24k')
    .order('recorded_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // No silent fallback. This previously defaulted to ₹6000/g when no rate was
  // recorded, which booked a real gold obligation — a liability settled in
  // physical metal — against an invented price. Failing here is recoverable;
  // a wrong obligation value is not, because the offset delta it later
  // produces flows straight into the P&L.
  if (!rateRow?.rate_24k) {
    throw new Error(
      'Cannot create a replenishment obligation: no 24K gold rate has been recorded. ' +
      'Add today\'s rate on the Gold Rates screen first.',
    )
  }
  const rate = Number(rateRow.rate_24k)
  const value = parseFloat((params.actualQtyUsed * rate).toFixed(2))

  const { data, error } = await supabase
    .from('replenishment_obligations')
    .insert({
      manufacturing_order_id: params.manufacturingOrderId,
      material_type:          params.materialType,
      gold_qty_g:             params.actualQtyUsed,
      rate_at_completion:     rate,
      obligation_value:       value,
      remaining_qty_g:        params.actualQtyUsed,
      status:                 'pending',
    })
    .select('id, obligation_value')
    .single()

  if (error || !data) throw new Error(`Obligation creation failed: ${error?.message}`)
  return { obligation_id: data.id, obligation_value: data.obligation_value }
}

// ── PREVIEW OFFSET (called before confirming new gold purchase) ─────────────

/**
 * Given a new gold purchase of qty_g grams at purchase_rate,
 * returns a preview of how pending obligations will be offset (FIFO).
 * Does NOT write anything. Used for the UI confirmation prompt.
 */
export async function previewReplenishmentOffset(params: {
  materialType: 'gold_24k' | 'silver_925' | 'silver_999'
  purchaseQtyG: number
  purchaseRate: number
}): Promise<{
  offsets: Array<{
    obligation_id:   string
    obligation_number: string
    qty_offset:      number
    obligation_rate: number
    purchase_rate:   number
    delta:           number
  }>
  total_delta:        number
  remaining_purchase: number    // qty left in this purchase after all offsets
  total_obligations:  number    // total pending obligation qty
}> {
  const supabase = supabaseAdmin

  const { data: obligations } = await supabase
    .from('replenishment_obligations')
    .select('id, obligation_number, remaining_qty_g, rate_at_completion')
    .eq('material_type', params.materialType)
    .in('status', ['pending', 'partially_offset'])
    .order('created_at', { ascending: true })   // FIFO: oldest first

  if (!obligations || obligations.length === 0) {
    return {
      offsets: [],
      total_delta: 0,
      remaining_purchase: params.purchaseQtyG,
      total_obligations: 0
    }
  }

  let remaining = params.purchaseQtyG
  const offsets = []

  for (const ob of obligations) {
    if (remaining <= 0) break
    const obRemaining = Number(ob.remaining_qty_g)
    const take = Math.min(remaining, obRemaining)
    const delta = parseFloat((take * (params.purchaseRate - Number(ob.rate_at_completion))).toFixed(2))
    offsets.push({
      obligation_id:    ob.id,
      obligation_number: ob.obligation_number,
      qty_offset:       parseFloat(take.toFixed(4)),
      obligation_rate:  Number(ob.rate_at_completion),
      purchase_rate:    params.purchaseRate,
      delta,
    })
    remaining = parseFloat((remaining - take).toFixed(4))
  }

  const totalObligations = obligations.reduce((sum, o) => sum + Number(o.remaining_qty_g), 0)
  const totalDelta = parseFloat(offsets.reduce((sum, o) => sum + o.delta, 0).toFixed(2))

  return {
    offsets,
    total_delta: totalDelta,
    remaining_purchase: parseFloat(remaining.toFixed(4)),
    total_obligations: parseFloat(totalObligations.toFixed(4)),
  }
}

// ── EXECUTE OFFSET (called after admin confirms new gold purchase) ───────────

/**
 * Writes replenishment_offsets rows and updates obligation statuses.
 * Called atomically with purchase lot creation.
 */
export async function executeReplenishmentOffset(
  preview: {
    offsets: Array<{
      obligation_id:   string
      qty_offset:      number
      obligation_rate: number
      purchase_rate:   number
      delta:           number
    }>
    total_delta:        number
  },
  purchaseLotId: string,
): Promise<{ total_delta: number }> {
  if (preview.offsets.length === 0) return { total_delta: 0 }

  // One transaction in Postgres. This used to run insert → select → update per
  // obligation from Node with no transaction and no row lock, so two gold
  // purchases confirmed at the same time could both read the same
  // remaining_qty_g and offset the same obligation twice. The RPC locks each
  // obligation FOR UPDATE and clamps to whatever is actually left, since the
  // preview is only a snapshot.
  const { data, error } = await supabaseAdmin.rpc('execute_replenishment_offset', {
    p_offsets: preview.offsets.map(o => ({
      obligation_id:   o.obligation_id,
      qty_offset:      o.qty_offset,
      obligation_rate: o.obligation_rate,
      purchase_rate:   o.purchase_rate,
      delta:           o.delta,
    })),
    p_purchase_lot_id: purchaseLotId,
  })

  if (error) throw new Error(`Replenishment offset failed: ${error.message}`)

  // Return the delta the DB actually applied, not the previewed one — they
  // differ whenever a concurrent purchase consumed part of an obligation.
  const totalDelta = Array.isArray(data) ? Number(data[0]?.total_delta ?? 0) : Number((data as any)?.total_delta ?? 0)
  return { total_delta: totalDelta }
}
