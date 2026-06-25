import { supabaseAdmin } from './supabaseAdmin'
import { KARAT_FACTORS, normalizeGoldMaterialType } from './karat'

/**
 * Task 78 read-layer safety net: gold MUST live as `gold_24k` only across
 * inventory. If a karigar still has a legacy `gold_18k` / `gold_22k` /
 * `gold_14k` row from before the migration ran (or from any older data
 * import), every read goes through this helper so the screens still show
 * one unified `gold_24k` bucket — quantities are converted via the same
 * KARAT_FACTORS the migration script uses. The DB row is left alone (no
 * data loss); only the read view is normalized.
 */


export type Bucket = {
  material_type: string
  unit: string
  available: number
  reserved: number
  used: number
  in_custody: number // available + reserved
}

type Row = {
  transaction_type: string
  quantity: number | null
  unit: string | null
  lifecycle: string | null
  material_float: { material_type: string } | null
}

/**
 * Compute live float buckets for a karigar from material_transactions.
 *
 * Three buckets per material_type:
 *   • available — gold in custody, not yet allocated to any in-flight order
 *   • reserved  — allocated to a pending manufacturing order (lifecycle='pending')
 *   • used      — finalised by a completed order (transaction_type='consumption' & lifecycle='final')
 *
 * in_custody = available + reserved (what's physically with the karigar today).
 *
 * Pending reservations sit on top of physical custody; they don't reduce it.
 */
export async function getPartnerBuckets(partnerId: string): Promise<Bucket[]> {
  const { data, error } = await supabaseAdmin
    .from('material_transactions')
    .select('transaction_type, quantity, unit, lifecycle, material_float(material_type)')
    .eq('manufacturing_partner_id', partnerId)

  if (error) throw error

  const groups = new Map<string, Bucket>()
  const get = (mt: string, unit: string) => {
    let b = groups.get(mt)
    if (!b) {
      b = { material_type: mt, unit, available: 0, reserved: 0, used: 0, in_custody: 0 }
      groups.set(mt, b)
    }
    return b
  }

  for (const r of (data || []) as unknown as Row[]) {
    const rawMt = r.material_float?.material_type
    if (!rawMt) continue
    // Task 78: collapse any legacy gold_<N>k row into the canonical gold_24k
    // bucket using KARAT_FACTORS — same conversion as the migration script,
    // so the operator always sees one unified gold bucket on every screen.
    const norm = normalizeGoldMaterialType(rawMt)
    const qty = (Number(r.quantity) || 0) * norm.factor
    const b = get(norm.material_type, r.unit || 'grams')
    const lifecycle = r.lifecycle || 'final'

    if (r.transaction_type === 'consumption') {
      if (lifecycle === 'pending') {
        b.reserved += qty
      } else {
        b.used += qty
      }
    } else if (r.transaction_type === 'deposit') {
      b.in_custody += qty
    } else if (r.transaction_type === 'return') {
      b.in_custody -= qty
    } else if (r.transaction_type === 'adjustment') {
      b.in_custody += qty // signed by caller
    }
  }

  for (const b of Array.from(groups.values())) {
    // Final consumptions removed gold from custody too.
    b.in_custody -= b.used
    b.available = b.in_custody - b.reserved
  }

  return Array.from(groups.values())
}

/**
 * Available qty for a single material type — the number we validate against
 * when issuing an order from float.
 */
export async function getAvailableForMaterial(
  partnerId: string,
  materialType: string,
): Promise<number> {
  const buckets = await getPartnerBuckets(partnerId)
  const b = buckets.find(x => x.material_type === materialType)
  return b ? b.available : 0
}

/**
 * Task 78: gold lives only as 24kt-net inside floats and central stock. The
 * karat carried on an order/manufacturing row is a labour-rate input only —
 * the float reservation is always against the gold_24k bucket, with the
 * quantity converted via KARAT_FACTORS at the call site.
 */
export function materialTypeForKarat(karat: number | string | null | undefined): string {
  if (String(karat).toLowerCase() === 'silver') return 'silver'
  return 'gold_24k'
}
