/**
 * PATCH /api/enquiries/[id]
 *
 * Updates an enquiry and writes meaningful changes (status, assignment,
 * follow-up, image additions) to customer_enquiry_activity. The body is
 * a partial enquiry; only known columns are written through.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

const WRITEABLE = new Set([
  'title', 'product_type', 'occasion', 'target_date',
  'budget_min', 'budget_max', 'karat', 'gold_weight_estimate_g',
  'diamond_specs', 'reference_image_urls', 'description',
  'status', 'assigned_to', 'internal_notes', 'next_followup_at',
])

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session || (role !== 'master' && role !== 'sub')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }
  const actorId = (session.user as any).id || null

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const patch: any = {}
  for (const k of Object.keys(body)) if (WRITEABLE.has(k)) patch[k] = body[k]
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'no writable fields' }, { status: 400 })
  patch.updated_at = new Date().toISOString()

  // Fetch the prior row to diff for activity logging.
  const { data: prior, error: priorErr } = await supabaseAdmin
    .from('customer_enquiries').select('*').eq('id', params.id).maybeSingle()
  if (priorErr) return NextResponse.json({ error: priorErr.message }, { status: 500 })
  if (!prior)  return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data, error } = await supabaseAdmin
    .from('customer_enquiries').update(patch).eq('id', params.id).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Log meaningful changes.
  const events: any[] = []
  if (patch.status && patch.status !== prior.status) {
    events.push({ type: 'status_change', payload: { from: prior.status, to: patch.status }, body: null })
  }
  if ('assigned_to' in patch && patch.assigned_to !== prior.assigned_to) {
    events.push({ type: 'assigned', payload: { from: prior.assigned_to, to: patch.assigned_to }, body: null })
  }
  if ('next_followup_at' in patch && patch.next_followup_at !== prior.next_followup_at) {
    // Symmetric: log unsets (cleared) as well as sets and reschedules.
    events.push({
      type: patch.next_followup_at ? 'followup_set' : 'followup_cleared',
      payload: { from: prior.next_followup_at, to: patch.next_followup_at },
      body: null,
    })
  }
  if (Array.isArray(patch.reference_image_urls)) {
    const added = patch.reference_image_urls.filter((u: string) => !(prior.reference_image_urls || []).includes(u))
    if (added.length > 0) events.push({ type: 'image_added', payload: { urls: added, count: added.length }, body: null })
  }
  // Generic "updated" if other fields changed and we didn't already log something specific.
  if (events.length === 0) {
    const changedKeys = Object.keys(patch).filter(k => k !== 'updated_at' && JSON.stringify(patch[k]) !== JSON.stringify((prior as any)[k]))
    if (changedKeys.length > 0) {
      events.push({ type: 'updated', payload: { fields: changedKeys }, body: null })
    }
  }

  if (events.length > 0) {
    await supabaseAdmin.from('customer_enquiry_activity').insert(
      events.map(e => ({ enquiry_id: params.id, actor_id: actorId, ...e }))
    )
  }

  return NextResponse.json({ enquiry: data })
}
