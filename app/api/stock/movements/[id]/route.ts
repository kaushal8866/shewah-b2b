import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

/**
 * Master-only edit + delete for individual stock_movements rows.
 *
 * Safety rails (the ledger MUST stay truthful):
 *   • Only 'purchase' / 'adjustment_in' / 'adjustment_out' rows may be edited
 *     or deleted here. 'issue' and 'return_in' rows are dual-written with the
 *     karigar's material_transactions ledger — editing them in isolation
 *     would silently desync the two ledgers, so the operator is sent to the
 *     karigar's float page to manage those instead.
 *   • Quantity changes (and full deletes) are blocked when the resulting
 *     on-hand balance for that (material_type, item_label) would go negative.
 *   • movement_type and material_type can never be changed — those are the
 *     identity of the row in the audit trail.
 */

const EDITABLE_TYPES = new Set(['purchase', 'adjustment_in', 'adjustment_out'])

const SIGN: Record<string, 1 | -1> = {
  purchase: 1, return_in: 1, adjustment_in: 1,
  issue: -1, adjustment_out: -1,
}

async function requireMaster() {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (role !== 'master') return null
  return session
}

/** Sum of signed quantities for the same (material_type, item_label) bucket. */
async function bucketBalance(material_type: string, item_label: string | null) {
  const { data, error } = await supabaseAdmin
    .from('stock_movements')
    .select('movement_type, quantity, item_label')
    .eq('material_type', material_type)
  if (error) throw new Error(error.message)
  const want = item_label || ''
  return (data || [])
    .filter(r => (r.item_label || '') === want)
    .reduce((sum, r) => sum + (SIGN[r.movement_type] || 0) * (Number(r.quantity) || 0), 0)
}

export async function PATCH(req: Request, ctx: { params: { id: string } }) {
  if (!(await requireMaster())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: row, error: fetchErr } = await supabaseAdmin
    .from('stock_movements')
    .select('*')
    .eq('id', ctx.params.id)
    .maybeSingle()
  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (!EDITABLE_TYPES.has(row.movement_type)) {
    return NextResponse.json({
      error: 'karigar_linked',
      message: `${row.movement_type} entries are linked to a karigar's float ledger and ` +
               `cannot be edited from here. Open the karigar's float page to manage them.`,
    }, { status: 409 })
  }

  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch {}

  const patch: Record<string, unknown> = {}
  // Numeric fields
  if (body.quantity != null) {
    const q = Number(body.quantity)
    if (!isFinite(q) || q <= 0) {
      return NextResponse.json({ error: 'Quantity must be greater than zero' }, { status: 400 })
    }
    patch.quantity = q
  }
  // Optional scalar fields — pass through nullable strings as null when blank
  for (const f of ['reference', 'notes'] as const) {
    if (f in body) patch[f] = body[f] ? String(body[f]) : null
  }
  if ('movement_date' in body && body.movement_date) {
    patch.movement_date = String(body.movement_date)
  }
  if ('vendor_id' in body) {
    // Purchases must keep their vendor (DB CHECK enforces this) — guard the
    // edit too so the operator gets a friendly message instead of a constraint
    // error if they accidentally clear it.
    if (row.movement_type === 'purchase' && !body.vendor_id) {
      return NextResponse.json({ error: 'Purchases must always have a vendor' }, { status: 400 })
    }
    patch.vendor_id = body.vendor_id ? String(body.vendor_id) : null
  }
  // Diamonds carry shape/size/pieces — only meaningful on diamond rows.
  if (row.material_type.startsWith('diamond')) {
    if ('diamond_shape_id' in body) patch.diamond_shape_id = body.diamond_shape_id ? String(body.diamond_shape_id) : null
    if ('diamond_size_id'  in body) patch.diamond_size_id  = body.diamond_size_id  ? String(body.diamond_size_id)  : null
    if ('pieces' in body) {
      const p = Number(body.pieces)
      if (!Number.isInteger(p) || p <= 0) {
        return NextResponse.json({ error: 'Pieces must be a positive whole number' }, { status: 400 })
      }
      patch.pieces = p
    }
  }
  // Findings carry their SKU name in item_label — let the operator rename.
  if (row.material_type === 'finding' && 'item_label' in body) {
    const label = body.item_label ? String(body.item_label).trim() : ''
    if (!label) return NextResponse.json({ error: 'Finding name is required' }, { status: 400 })
    patch.item_label = label
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  // Negative-balance pre-check when the quantity changes. Same idea as DELETE:
  // simulate removing this row's contribution, then see if the (would-be) new
  // bucket balance goes below zero.
  if (patch.quantity != null && Number(patch.quantity) !== Number(row.quantity)) {
    const sign = SIGN[row.movement_type] || 0
    const currentBalance = await bucketBalance(row.material_type, row.item_label)
    const projected = currentBalance - sign * Number(row.quantity) + sign * Number(patch.quantity)
    if (projected < 0) {
      return NextResponse.json({
        error: 'would_go_negative',
        message: `That change would push the on-hand balance to ${projected.toFixed(4)} ` +
                 `${row.unit}. Some of this material has already been issued or used. ` +
                 `Adjust the dependent movements first.`,
        current_balance: currentBalance,
        projected_balance: projected,
      }, { status: 409 })
    }
  }

  const { error: updErr } = await supabaseAdmin
    .from('stock_movements')
    .update(patch)
    .eq('id', ctx.params.id)
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: Request, ctx: { params: { id: string } }) {
  if (!(await requireMaster())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: row, error: fetchErr } = await supabaseAdmin
    .from('stock_movements')
    .select('*')
    .eq('id', ctx.params.id)
    .maybeSingle()
  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (!EDITABLE_TYPES.has(row.movement_type)) {
    return NextResponse.json({
      error: 'karigar_linked',
      message: `${row.movement_type} entries are linked to a karigar's float ledger and ` +
               `cannot be deleted from here. Open the karigar's float page to reverse them.`,
    }, { status: 409 })
  }

  const sign = SIGN[row.movement_type] || 0
  const currentBalance = await bucketBalance(row.material_type, row.item_label)
  const projected = currentBalance - sign * Number(row.quantity)
  if (projected < 0) {
    return NextResponse.json({
      error: 'would_go_negative',
      message: `Deleting this entry would push the on-hand balance to ${projected.toFixed(4)} ` +
               `${row.unit}. Some of this material has already been issued or used — ` +
               `delete or reverse those movements first, then come back.`,
      current_balance: currentBalance,
      projected_balance: projected,
    }, { status: 409 })
  }

  const { error: delErr } = await supabaseAdmin
    .from('stock_movements')
    .delete()
    .eq('id', ctx.params.id)
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
