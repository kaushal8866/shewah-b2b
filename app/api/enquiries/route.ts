/**
 * POST /api/enquiries
 *
 * Creates a customer enquiry and writes the initial `created` row to
 * customer_enquiry_activity in the same request so the timeline starts
 * with an audit-able anchor.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session || (role !== 'master' && role !== 'sub')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }
  const actorId = (session.user as any).id || null

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const customer_id = String(body.customer_id || '')
  const title       = String(body.title || '').trim()
  if (!customer_id) return NextResponse.json({ error: 'customer_id required' }, { status: 400 })
  if (!title)       return NextResponse.json({ error: 'title required' }, { status: 400 })

  const insert: any = {
    customer_id,
    title,
    product_type:           body.product_type || null,
    occasion:               body.occasion || null,
    target_date:            body.target_date || null,
    budget_min:             numberOrNull(body.budget_min),
    budget_max:             numberOrNull(body.budget_max),
    karat:                  numberOrNull(body.karat),
    gold_weight_estimate_g: numberOrNull(body.gold_weight_estimate_g),
    diamond_specs:          body.diamond_specs || null,
    reference_image_urls:   Array.isArray(body.reference_image_urls)
      ? body.reference_image_urls.filter((u: any) => typeof u === 'string')
      : [],
    description:            body.description ? String(body.description).trim() : null,
    assigned_to:            body.assigned_to || null,
    next_followup_at:       body.next_followup_at || null,
    internal_notes:         body.internal_notes ? String(body.internal_notes).trim() : null,
    created_by:             actorId,
    status:                 'new',
  }

  const { data, error } = await supabaseAdmin
    .from('customer_enquiries')
    .insert(insert)
    .select('*')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { error: activityErr } = await supabaseAdmin.from('customer_enquiry_activity').insert({
    enquiry_id: data.id,
    actor_id:   actorId,
    type:       'created',
    payload:    { enquiry_number: data.enquiry_number },
    body:       null,
  })
  if (activityErr) console.error('[enquiries.create] failed to write created activity', activityErr)

  return NextResponse.json({ enquiry: data })
}

function numberOrNull(v: any): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return isNaN(n) ? null : n
}
