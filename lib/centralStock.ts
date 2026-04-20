import { supabaseAdmin } from './supabaseAdmin'

/**
 * Central Stock ledger helpers (Task 70).
 *
 * One source of truth for everything physically held at HQ before it goes
 * out to a karigar. The on-hand quantity is *never* stored as a column —
 * it's always SUMmed from `stock_movements` so the ledger and the balance
 * can't drift.
 *
 * Gold + diamond movements that involve a karigar are dual-written: one
 * row in `stock_movements` (debits central stock) AND one row in
 * `material_transactions` (credits the karigar's float). The two rows are
 * linked via `stock_movements.material_transaction_id`.
 *
 * Findings stay central-only — karigars don't hold them on a tally.
 */

export type MaterialType =
  | 'gold_14k' | 'gold_18k' | 'gold_22k'
  | 'diamond_lgd' | 'diamond_natural'
  | 'finding'

export type MovementType =
  | 'purchase' | 'issue' | 'return_in' | 'adjustment_in' | 'adjustment_out'

export type StockBalance = {
  material_type: MaterialType
  item_label: string   // '' for gold/diamond
  unit: string
  balance: number
  last_movement_date: string | null
}

const KARIGAR_FLOAT_MATERIALS = new Set<MaterialType>([
  'gold_14k', 'gold_18k', 'gold_22k', 'diamond_lgd', 'diamond_natural',
])

/** Live balance for every (material, item_label, unit) tuple. */
export async function getStockBalances(): Promise<StockBalance[]> {
  const { data, error } = await supabaseAdmin
    .from('stock_balances')
    .select('*')
  if (error) throw error
  return ((data || []) as any[]).map(r => ({
    material_type: r.material_type,
    item_label: r.item_label || '',
    unit: r.unit,
    balance: Number(r.balance) || 0,
    last_movement_date: r.last_movement_date || null,
  }))
}

/** Single-material balance lookup (for pre-issue checks). */
export async function getStockBalance(
  material_type: MaterialType,
  item_label?: string | null,
): Promise<number> {
  const all = await getStockBalances()
  const hit = all.find(b =>
    b.material_type === material_type &&
    (b.item_label || '') === (item_label || ''),
  )
  return hit ? hit.balance : 0
}

/** Default unit for a given material. */
export function unitFor(material_type: MaterialType): 'grams' | 'carats' | 'pieces' {
  if (material_type.startsWith('gold')) return 'grams'
  if (material_type.startsWith('diamond')) return 'carats'
  return 'pieces'
}

/**
 * Find or create the karigar's `material_float` row for this material.
 * Returns the float id.
 */
async function ensureMaterialFloat(
  partner_id: string,
  material_type: string,
  unit: string,
): Promise<string> {
  const existing = await supabaseAdmin
    .from('material_float')
    .select('id')
    .eq('manufacturing_partner_id', partner_id)
    .eq('material_type', material_type)
    .maybeSingle()
  if (existing.data?.id) return existing.data.id as string

  // Match the float page's insert shape exactly so we don't poke unknown columns.
  const created = await supabaseAdmin
    .from('material_float')
    .insert([{
      manufacturing_partner_id: partner_id,
      material_type,
      unit,
      total_deposited: 0,
      total_consumed: 0,
    }])
    .select('id')
    .single()
  if (created.error) throw created.error
  return created.data.id as string
}

type CommonInput = {
  material_type: MaterialType
  item_label?: string | null
  quantity: number
  reference?: string | null
  notes?: string | null
  movement_date?: string | null
  created_by?: string | null
}

/** Record a purchase (vendor → central stock). */
export async function recordPurchase(input: CommonInput & { vendor_id: string }) {
  if (input.quantity <= 0) throw new Error('Quantity must be positive')
  const unit = unitFor(input.material_type)
  const r = await supabaseAdmin.from('stock_movements').insert([{
    movement_type: 'purchase',
    material_type: input.material_type,
    item_label: input.item_label || null,
    unit,
    quantity: input.quantity,
    vendor_id: input.vendor_id,
    reference: input.reference || null,
    notes: input.notes || null,
    movement_date: input.movement_date || new Date().toISOString().split('T')[0],
    created_by: input.created_by || null,
  }]).select('*').single()
  if (r.error) throw r.error
  return r.data
}

/**
 * Atomic-ish issue: central stock → karigar. For gold/diamond, also
 * writes the matching deposit into the karigar's float so the karigar
 * page reflects the new custody immediately.
 */
export async function issueToPartner(input: CommonInput & {
  manufacturing_partner_id: string
  rate_per_unit?: number | null
  allow_negative_central?: boolean
}) {
  if (input.quantity <= 0) throw new Error('Quantity must be positive')
  const unit = unitFor(input.material_type)

  // Pre-flight central-stock check (best effort — race-prone under heavy
  // concurrency; the page surfaces it, but admins can override).
  if (!input.allow_negative_central) {
    const onHand = await getStockBalance(input.material_type, input.item_label)
    if (onHand < input.quantity) {
      throw new Error(
        `Not enough central stock — only ${onHand} ${unit} on hand, ${input.quantity} requested. ` +
        `Record a purchase first or pass allow_negative_central=true to override.`,
      )
    }
  }

  // Step 1: write the karigar float deposit (gold/diamond only).
  let mt_id: string | null = null
  if (KARIGAR_FLOAT_MATERIALS.has(input.material_type)) {
    const float_id = await ensureMaterialFloat(
      input.manufacturing_partner_id,
      input.material_type,
      unit,
    )
    const ins = await supabaseAdmin.from('material_transactions').insert([{
      float_id,
      manufacturing_partner_id: input.manufacturing_partner_id,
      transaction_type: 'deposit',
      quantity: input.quantity,
      unit,
      rate_per_unit: input.rate_per_unit || null,
      reference: input.reference || null,
      notes: input.notes || `Issued from central stock`,
      date: input.movement_date || new Date().toISOString().split('T')[0],
      lifecycle: 'final',
    }]).select('id').single()
    if (ins.error) throw ins.error
    mt_id = ins.data.id as string
  }

  // Step 2: write the central-stock issue (with link to the karigar row).
  const sm = await supabaseAdmin.from('stock_movements').insert([{
    movement_type: 'issue',
    material_type: input.material_type,
    item_label: input.item_label || null,
    unit,
    quantity: input.quantity,
    manufacturing_partner_id: input.manufacturing_partner_id,
    material_transaction_id: mt_id,
    reference: input.reference || null,
    notes: input.notes || null,
    movement_date: input.movement_date || new Date().toISOString().split('T')[0],
    created_by: input.created_by || null,
  }]).select('*').single()
  if (sm.error) {
    // Best-effort rollback of the karigar deposit so the two ledgers
    // don't diverge if the second write fails.
    if (mt_id) {
      await supabaseAdmin.from('material_transactions').delete().eq('id', mt_id)
    }
    throw sm.error
  }
  return sm.data
}

/** Receive material back from a karigar (returns or rework left-overs). */
export async function receiveFromPartner(input: CommonInput & {
  manufacturing_partner_id: string
}) {
  if (input.quantity <= 0) throw new Error('Quantity must be positive')
  const unit = unitFor(input.material_type)

  let mt_id: string | null = null
  if (KARIGAR_FLOAT_MATERIALS.has(input.material_type)) {
    const float_id = await ensureMaterialFloat(
      input.manufacturing_partner_id,
      input.material_type,
      unit,
    )
    const ins = await supabaseAdmin.from('material_transactions').insert([{
      float_id,
      manufacturing_partner_id: input.manufacturing_partner_id,
      transaction_type: 'return',
      quantity: input.quantity,
      unit,
      reference: input.reference || null,
      notes: input.notes || `Returned to central stock`,
      date: input.movement_date || new Date().toISOString().split('T')[0],
      lifecycle: 'final',
    }]).select('id').single()
    if (ins.error) throw ins.error
    mt_id = ins.data.id as string
  }

  const sm = await supabaseAdmin.from('stock_movements').insert([{
    movement_type: 'return_in',
    material_type: input.material_type,
    item_label: input.item_label || null,
    unit,
    quantity: input.quantity,
    manufacturing_partner_id: input.manufacturing_partner_id,
    material_transaction_id: mt_id,
    reference: input.reference || null,
    notes: input.notes || null,
    movement_date: input.movement_date || new Date().toISOString().split('T')[0],
    created_by: input.created_by || null,
  }]).select('*').single()
  if (sm.error) {
    if (mt_id) {
      await supabaseAdmin.from('material_transactions').delete().eq('id', mt_id)
    }
    throw sm.error
  }
  return sm.data
}

/** Manual stock adjustment (re-weigh, found/lost). Direction is explicit. */
export async function recordAdjustment(input: CommonInput & {
  direction: 'in' | 'out'
}) {
  if (input.quantity <= 0) throw new Error('Quantity must be positive')
  const unit = unitFor(input.material_type)
  const r = await supabaseAdmin.from('stock_movements').insert([{
    movement_type: input.direction === 'in' ? 'adjustment_in' : 'adjustment_out',
    material_type: input.material_type,
    item_label: input.item_label || null,
    unit,
    quantity: input.quantity,
    reference: input.reference || null,
    notes: input.notes || null,
    movement_date: input.movement_date || new Date().toISOString().split('T')[0],
    created_by: input.created_by || null,
  }]).select('*').single()
  if (r.error) throw r.error
  return r.data
}
