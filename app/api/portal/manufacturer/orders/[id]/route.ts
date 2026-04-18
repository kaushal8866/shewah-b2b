import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

const ALLOWED_STATUSES = new Set(['issued', 'in_progress', 'quality_check', 'completed'])

const DETAIL_COLS = `
  id, order_number, status, description, quantity, ring_size,
  gold_karat, gold_weight_required, gold_weight_actual, diamond_weight,
  issued_date, expected_date, completed_date,
  reference_images, special_notes, manufacturer_notes, manufacturer_updated_at,
  manufacturing_partner_id
`

async function getMfgUser() {
  const session = await getServerSession(authOptions)
  const user: any = session?.user
  if (!user || user.role !== 'manufacturer' || !user.manufacturingPartnerId) return null
  return user
}

export async function GET(_: Request, ctx: { params: { id: string } }) {
  const user = await getMfgUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await supabaseAdmin
    .from('manufacturing_orders')
    .select(DETAIL_COLS + ', manufacturing_partners(name, city)')
    .eq('id', ctx.params.id)
    .eq('manufacturing_partner_id', user.manufacturingPartnerId)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Strip the partner_id from the response — UI doesn't need it.
  const { manufacturing_partner_id, ...safe } = data as any
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

  if (typeof body.status === 'string') {
    if (!ALLOWED_STATUSES.has(body.status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }
    updates.status = body.status
    if (body.status === 'completed' && !body.completed_date) {
      updates.completed_date = new Date().toISOString().slice(0, 10)
    }
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
  const { data, error } = await supabaseAdmin
    .from('manufacturing_orders')
    .update(updates)
    .eq('id', ctx.params.id)
    .eq('manufacturing_partner_id', user.manufacturingPartnerId)
    .select(DETAIL_COLS)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { manufacturing_partner_id, ...safe } = data as any
  return NextResponse.json({ order: safe })
}
