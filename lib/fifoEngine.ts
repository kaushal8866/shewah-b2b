import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { KARAT_FACTORS } from '@/lib/karat'

export interface FifoReservation {
  lot_id: string
  lot_number: string
  issued_qty: number
  unit_cost: number
  total_cost: number
  issuance_type: 'reserved' | 'final'
}

export interface FifoResult {
  reservations: FifoReservation[]
  weighted_avg_cost: number     // total_cost / total_qty
  total_cost: number
  fulfilled: boolean            // true if full qty could be sourced from lots
  shortfall_qty: number         // > 0 if insufficient stock in lots
}

// ── DIAMOND SIZE BANDS ─────────────────────────────────────────────────────

export function getDiamondSizeBand(carats: number): string {
  if (carats <  0.10) return '0.01-0.09'
  if (carats <  0.20) return '0.10-0.19'
  if (carats <  0.30) return '0.20-0.29'
  if (carats <  0.40) return '0.30-0.39'
  if (carats <  0.50) return '0.40-0.49'
  if (carats <  0.70) return '0.50-0.69'
  if (carats <  0.90) return '0.70-0.89'
  if (carats <  1.00) return '0.90-0.99'
  if (carats <  1.25) return '1.00-1.24'
  if (carats <  1.50) return '1.25-1.49'
  if (carats <  2.00) return '1.50-1.99'
  if (carats <  3.00) return '2.00-2.99'
  return '3.00+'
}

// ── CORE FIFO ISSUE FUNCTION ───────────────────────────────────────────────

/**
 * Computes FIFO picks for a given material requirement.
 * Does NOT write to DB. Returns the plan only.
 * Caller is responsible for writing lot_issuances and decrementing remaining_qty.
 */
export async function computeFifoPlan(params: {
  materialType: 'gold_24k' | 'silver_925' | 'silver_999'
             | 'diamond_lgd' | 'diamond_natural' | 'finding'
  requiredQty: number

  // Gold/silver only
  goldKarat?: string

  // Diamond only
  diamondShape?: string
  diamondColor?: string
  diamondClarity?: string
  diamondSizeBand?: string
  certNumber?: string       // overrides FIFO for certified diamonds

  // For actual-weight finalisation — same lot override
  existingLotId?: string    // if set, exhaust this lot first before FIFO
}): Promise<FifoResult> {
  const supabase = supabaseAdmin
  let lotsQuery = supabase
    .from('purchase_lots')
    .select('id, lot_number, material_type, remaining_qty, unit_cost, purchase_date')
    .eq('material_type', params.materialType)
    .eq('status', 'active')
    .gt('remaining_qty', 0)

  // For certified diamond: specific identification
  if (params.certNumber) {
    lotsQuery = lotsQuery.eq('diamond_cert_number', params.certNumber)
  }
  // For uncertified diamond: match on shape + color + clarity + size_band
  else if (['diamond_lgd', 'diamond_natural'].includes(params.materialType)) {
    if (params.diamondShape)    lotsQuery = lotsQuery.eq('diamond_shape',    params.diamondShape)
    if (params.diamondColor)    lotsQuery = lotsQuery.eq('diamond_color',    params.diamondColor)
    if (params.diamondClarity)  lotsQuery = lotsQuery.eq('diamond_clarity',  params.diamondClarity)
    if (params.diamondSizeBand) lotsQuery = lotsQuery.eq('diamond_size_band', params.diamondSizeBand)
  }

  // FIFO order: oldest purchase_date first
  lotsQuery = lotsQuery.order('purchase_date', { ascending: true })
  const { data: lots, error } = await lotsQuery
  if (error || !lots) {
    return {
      reservations: [],
      weighted_avg_cost: 0,
      total_cost: 0,
      fulfilled: false,
      shortfall_qty: params.requiredQty
    }
  }

  // Move existingLotId to front if present (same-lot-first rule for overrun)
  const sorted = params.existingLotId
    ? [
        ...lots.filter(l => l.id === params.existingLotId),
        ...lots.filter(l => l.id !== params.existingLotId),
      ]
    : lots

  let remaining = params.requiredQty
  const reservations: FifoReservation[] = []

  for (const lot of sorted) {
    if (remaining <= 0) break
    const take = Math.min(remaining, lot.remaining_qty)
    reservations.push({
      lot_id:   lot.id,
      lot_number: lot.lot_number,
      issued_qty: parseFloat(take.toFixed(4)),
      unit_cost:  lot.unit_cost,
      total_cost: parseFloat((take * lot.unit_cost).toFixed(2)),
      issuance_type: 'reserved',
    })
    remaining = parseFloat((remaining - take).toFixed(4))
  }

  const totalCost = reservations.reduce((sum, r) => sum + r.total_cost, 0)
  const totalQty  = reservations.reduce((sum, r) => sum + r.issued_qty, 0)
  const weightedAvg = totalQty > 0 ? parseFloat((totalCost / totalQty).toFixed(4)) : 0

  return {
    reservations,
    weighted_avg_cost: weightedAvg,
    total_cost: parseFloat(totalCost.toFixed(2)),
    fulfilled: remaining <= 0,
    shortfall_qty: parseFloat(remaining.toFixed(4)),
  }
}

// ── WRITE FIFO ISSUANCES TO DB ─────────────────────────────────────────────

/**
 * Executes a FIFO plan:
 * 1. Creates lot_issuances rows
 * 2. Decrements purchase_lots.remaining_qty
 * 3. Returns final cost data
 *
 * Call this AFTER computeFifoPlan when admin confirms the mfg order.
 * issuanceType = 'reserved' at mfg start, 'final' at mfg completion.
 */
export async function executeFifoPlan(
  plan: FifoResult,
  manufacturingOrderId: string,
  issuanceType: 'reserved' | 'final',
  createdBy: string,
): Promise<{ success: boolean; total_cost: number }> {
  if (plan.reservations.length === 0) return { success: true, total_cost: 0 }

  // One transaction in Postgres. This used to loop in Node — insert a
  // lot_issuance, then decrement the lot, per reservation — so a failure
  // partway through left lots consumed with no matching issuance and no way to
  // roll back. The RPC also re-reads each lot under FOR UPDATE, because the
  // plan from computeFifoPlan is a snapshot: without that re-check two
  // concurrent orders could both reserve the same stock.
  const { data, error } = await supabaseAdmin.rpc('execute_fifo_plan', {
    p_reservations: plan.reservations.map(r => ({
      lot_id:     r.lot_id,
      issued_qty: r.issued_qty,
      unit_cost:  r.unit_cost,
      total_cost: r.total_cost,
    })),
    p_mfg_order_id:  manufacturingOrderId,
    p_issuance_type: issuanceType,
    p_created_by:    createdBy,
  })

  if (error) throw new Error(`FIFO issuance failed: ${error.message}`)

  const totalCost = Array.isArray(data) ? Number(data[0]?.total_cost ?? 0) : Number((data as any)?.total_cost ?? 0)
  return { success: true, total_cost: totalCost }
}
