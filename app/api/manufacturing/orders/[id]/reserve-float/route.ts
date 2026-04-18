import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getAvailableForMaterial } from '@/lib/floatBuckets'

/**
 * Atomically reserves gold from a karigar's float for a freshly-issued
 * manufacturing order. Calls the `mfg_reserve_float` Postgres function which
 * takes a row-level lock on the float, re-checks Available inside the same
 * transaction, and inserts the `consumption / lifecycle='pending'` row —
 * closing the race where two admins issue overlapping orders.
 *
 * Body: { material_type, quantity, partner_id, order_id?, notes? }
 * Returns:
 *   200 { ok: true, transaction_id }
 *   409 { error:'over_issue', available, required, shortfall }
 *   400 { error }
 */
export async function POST(req: Request, ctx: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const user = session?.user as { role?: string } | undefined
  if (!user || (user.role !== 'master' && user.role !== 'admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch {}
  const partnerId = String(body.partner_id || '')
  const materialType = String(body.material_type || '')
  const required = Number(body.quantity)
  const customerOrderId = body.order_id ? String(body.order_id) : null
  const notes = body.notes ? String(body.notes) : null

  if (!partnerId || !materialType || !required || required <= 0) {
    return NextResponse.json({ error: 'partner_id, material_type, quantity required' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin.rpc('mfg_reserve_float', {
    p_partner_id: partnerId,
    p_material_type: materialType,
    p_quantity: required,
    p_mfg_order_id: ctx.params.id,
    p_customer_order_id: customerOrderId,
    p_notes: notes,
  })

  if (error) {
    if (error.message?.includes('over_issue')) {
      const available = await getAvailableForMaterial(partnerId, materialType)
      return NextResponse.json({
        error: 'over_issue',
        available,
        required,
        shortfall: Math.max(0, required - available),
      }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, transaction_id: data })
}
