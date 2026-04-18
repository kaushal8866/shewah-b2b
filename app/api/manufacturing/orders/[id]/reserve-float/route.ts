import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getAvailableForMaterial } from '@/lib/floatBuckets'

/**
 * Atomically reserves gold from a karigar's float for a freshly-issued
 * manufacturing order. Re-checks the available bucket on the server (closes
 * the race window between two admins issuing orders simultaneously) and
 * inserts the `consumption / lifecycle='pending'` row in one round-trip.
 *
 * Body:
 *   { material_type: string, quantity: number, partner_id: string,
 *     order_id?: string, notes?: string }
 *
 * Returns:
 *   200 { ok: true, transaction_id }
 *   409 { error, available, required, shortfall } — over-issue, caller must abort
 *   400 { error }
 */
export async function POST(req: Request, ctx: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const user: any = session?.user
  if (!user || (user.role !== 'master' && user.role !== 'admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: any = {}
  try { body = await req.json() } catch {}
  const partnerId = String(body.partner_id || '')
  const materialType = String(body.material_type || '')
  const required = Number(body.quantity)
  const customerOrderId = body.order_id ? String(body.order_id) : null
  const notes = body.notes ? String(body.notes) : null

  if (!partnerId || !materialType || !required || required <= 0) {
    return NextResponse.json({ error: 'partner_id, material_type, quantity required' }, { status: 400 })
  }

  const available = await getAvailableForMaterial(partnerId, materialType)
  if (available + 1e-9 < required) {
    return NextResponse.json({
      error: 'over_issue',
      available,
      required,
      shortfall: required - available,
    }, { status: 409 })
  }

  // Find or create the float row.
  let { data: floatRow } = await supabaseAdmin
    .from('material_float')
    .select('id, unit')
    .eq('manufacturing_partner_id', partnerId)
    .eq('material_type', materialType)
    .maybeSingle()

  if (!floatRow) {
    const { data: created } = await supabaseAdmin
      .from('material_float')
      .insert([{
        manufacturing_partner_id: partnerId,
        material_type: materialType,
        unit: materialType.startsWith('diamond') ? 'carats' : 'grams',
        total_deposited: 0,
        total_consumed: 0,
      }])
      .select('id, unit')
      .single()
    floatRow = created || null
  }
  if (!floatRow) return NextResponse.json({ error: 'float row create failed' }, { status: 500 })

  const { data, error } = await supabaseAdmin
    .from('material_transactions')
    .insert([{
      float_id: floatRow.id,
      manufacturing_partner_id: partnerId,
      manufacturing_order_id: ctx.params.id,
      order_id: customerOrderId,
      transaction_type: 'consumption',
      lifecycle: 'pending',
      quantity: required,
      unit: floatRow.unit || 'grams',
      notes,
    }])
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, transaction_id: (data as any).id })
}
