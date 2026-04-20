import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { safeDbError } from '@/lib/sanitizeDbError'

const ALLOWED_STATUSES = new Set(['issued', 'in_progress', 'quality_check', 'completed'])

const DETAIL_COLS = `
  id, order_number, status, description, quantity, ring_size,
  gold_karat, gold_weight_required, gold_weight_actual, diamond_weight,
  issued_date, expected_date, completed_date,
  reference_images, cad_files, cad_file_names,
  special_notes, manufacturer_notes, manufacturer_updated_at,
  manufacturing_partner_id
`

// Fallback shape used when the `completed_date` column is missing on a
// particular environment (Task #58 migration not yet applied).
const DETAIL_COLS_BASE = DETAIL_COLS.replace(/,\s*completed_date/g, '')

async function getMfgUser() {
  const session = await getServerSession(authOptions)
  const user: any = session?.user
  if (!user || user.role !== 'manufacturer' || !user.manufacturingPartnerId) return null
  return user
}

export async function GET(_: Request, ctx: { params: { id: string } }) {
  const user = await getMfgUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let resp = await supabaseAdmin
    .from('manufacturing_orders')
    .select(DETAIL_COLS + ', manufacturing_partners(name, city)')
    .eq('id', ctx.params.id)
    .eq('manufacturing_partner_id', user.manufacturingPartnerId)
    .maybeSingle()

  if (resp.error && (resp.error.code === '42703' || /completed_date/.test(resp.error.message || ''))) {
    resp = await supabaseAdmin
      .from('manufacturing_orders')
      .select(DETAIL_COLS_BASE + ', manufacturing_partners(name, city)')
      .eq('id', ctx.params.id)
      .eq('manufacturing_partner_id', user.manufacturingPartnerId)
      .maybeSingle()
  }

  if (resp.error) {
    return NextResponse.json(
      { error: safeDbError(resp.error, 'manufacturer.orders.get', 'Could not load order.') },
      { status: 500 },
    )
  }
  if (!resp.data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { manufacturing_partner_id, ...safe } = resp.data as any
  return NextResponse.json({ order: safe })
}

export async function PATCH(req: Request, ctx: { params: { id: string } }) {
  const user = await getMfgUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }

  const updates: any = {
    manufacturer_updated_at: new Date().toISOString(),
    manufacturer_updated_by: user.id,
  }

  let willFinalizeReservation = false
  if (typeof body.status === 'string') {
    if (!ALLOWED_STATUSES.has(body.status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }
    updates.status = body.status
    if (body.status === 'completed' && !body.completed_date) {
      updates.completed_date = new Date().toISOString().slice(0, 10)
    }
    willFinalizeReservation = body.status === 'completed'
  }
  if (typeof body.manufacturer_notes === 'string') {
    updates.manufacturer_notes = body.manufacturer_notes
  }
  if (Array.isArray(body.reference_images)) {
    // Manufacturers may add progress/QC photos. We store them in the same
    // reference_images array the admin already uses.
    const safe = body.reference_images.filter((u: any) => typeof u === 'string').slice(0, 30)
    updates.reference_images = safe
  }
  // Note: gold weights, labour, and other material/cost fields are admin-only
  // (per spec — manufacturer gold consumption entry is out of scope).

  // Server-side scope guard: only update rows belonging to this manufacturer.
  let upd = await supabaseAdmin
    .from('manufacturing_orders')
    .update(updates)
    .eq('id', ctx.params.id)
    .eq('manufacturing_partner_id', user.manufacturingPartnerId)
    .select(DETAIL_COLS)
    .maybeSingle()

  if (upd.error && (upd.error.code === '42703' || /completed_date/.test(upd.error.message || ''))) {
    // The DB doesn't have completed_date yet — drop it from the update payload
    // and the returning select, retry once. The status change still goes
    // through; the date is just not recorded.
    const { completed_date, ...withoutDate } = updates
    upd = await supabaseAdmin
      .from('manufacturing_orders')
      .update(withoutDate)
      .eq('id', ctx.params.id)
      .eq('manufacturing_partner_id', user.manufacturingPartnerId)
      .select(DETAIL_COLS_BASE)
      .maybeSingle()
  }

  const { data, error } = upd
  if (error) {
    return NextResponse.json(
      { error: safeDbError(error, 'manufacturer.orders.patch', 'Could not save changes.') },
      { status: 500 },
    )
  }
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // When the karigar marks this order completed, finalise any pending
  // float reservation we created on issue. The reservation is matched by
  // (manufacturing_order_id, lifecycle='pending', transaction_type='consumption').
  // Task 78: floats now hold 24kt-net only — convert the order's gross-at-karat
  // gold_weight_actual via KARAT_FACTORS before writing.
  if (willFinalizeReservation) {
    const { KARAT_FACTORS } = await import('@/lib/karat')
    const actualGross = (data as any).gold_weight_actual
    const karat = Number((data as any).gold_karat) || 24
    const factor = KARAT_FACTORS[karat] ?? 1
    const finalQty = actualGross != null && Number(actualGross) > 0
      ? Math.round(Number(actualGross) * factor * 10000) / 10000
      : null
    const updatePayload: any = { lifecycle: 'final' }
    if (finalQty != null && finalQty > 0) updatePayload.quantity = finalQty
    await supabaseAdmin
      .from('material_transactions')
      .update(updatePayload)
      .eq('manufacturing_order_id', ctx.params.id)
      .eq('transaction_type', 'consumption')
      .eq('lifecycle', 'pending')
  }

  const { manufacturing_partner_id, ...safe } = data as any
  return NextResponse.json({ order: safe })
}
