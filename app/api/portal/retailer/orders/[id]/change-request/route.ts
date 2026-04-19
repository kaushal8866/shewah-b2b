import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { safeDbError } from '@/lib/sanitizeDbError'
import { notifyInternalChangeRequestCreated } from '@/lib/whatsappNotify'

// Statuses past which a retailer can no longer file a change request — once
// the piece is in production / dispatch / delivery, the master needs to take
// the call directly (often involves rework, scrap, courier intercept).
const LOCKED_STATUSES = new Set(['in_production', 'qc', 'dispatched', 'delivered', 'cancelled'])

const ALLOWED_FIELDS = ['quantity', 'ring_size', 'special_notes', 'brief_text'] as const
type AllowedField = (typeof ALLOWED_FIELDS)[number]

async function getRetailer() {
  const session = await getServerSession(authOptions)
  const u: any = session?.user
  if (!u || u.role !== 'retailer' || !u.partnerId) return null
  return u
}

// GET — return any change requests the retailer has filed on this order so
// the UI can show their status (pending / approved / rejected).
export async function GET(_: Request, ctx: { params: { id: string } }) {
  const user = await getRetailer()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Ownership guard.
  const { data: own } = await supabaseAdmin
    .from('orders').select('id').eq('id', ctx.params.id).eq('partner_id', user.partnerId).maybeSingle()
  if (!own) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

  const { data, error } = await supabaseAdmin
    .from('order_change_requests')
    .select('id, created_at, changes, retailer_note, status, reviewed_at, review_note')
    .eq('order_id', ctx.params.id)
    .eq('partner_id', user.partnerId)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json(
      { error: safeDbError(error, 'retailer.change_request.list', 'Could not load change requests.') },
      { status: 500 },
    )
  }
  return NextResponse.json({ requests: data || [] })
}

export async function POST(req: Request, ctx: { params: { id: string } }) {
  const user = await getRetailer()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }) }

  // Pull the order to verify ownership + check status.
  const { data: order, error: oe } = await supabaseAdmin
    .from('orders')
    .select('id, status, partner_id, quantity, ring_size, special_notes, brief_text')
    .eq('id', ctx.params.id)
    .eq('partner_id', user.partnerId)
    .maybeSingle()
  if (oe) {
    return NextResponse.json(
      { error: safeDbError(oe, 'retailer.change_request.lookup', 'Could not load order.') },
      { status: 500 },
    )
  }
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  if (LOCKED_STATUSES.has(order.status)) {
    return NextResponse.json({
      error: 'This order has progressed too far for self-service edits. Please contact Shewah directly.',
    }, { status: 400 })
  }

  // Block if there is already a pending request on this order.
  const { data: existing } = await supabaseAdmin
    .from('order_change_requests')
    .select('id')
    .eq('order_id', order.id)
    .eq('status', 'pending')
    .limit(1)
  if (existing && existing.length > 0) {
    return NextResponse.json({
      error: 'You already have a pending change request on this order. Please wait for Shewah to review it.',
    }, { status: 400 })
  }

  // Whitelist + normalise the proposed changes; ignore anything not in the
  // allowed set, ignore values equal to the current value (no-op).
  const proposed: Record<string, any> = {}
  for (const f of ALLOWED_FIELDS as readonly AllowedField[]) {
    if (!(f in (body.changes || {}))) continue
    let v = (body.changes as any)[f]
    if (f === 'quantity') {
      const n = parseInt(v)
      if (!Number.isFinite(n) || n < 1 || n > 999) continue
      v = n
    } else {
      if (typeof v !== 'string') continue
      v = v.trim()
      if (v.length === 0) v = null
    }
    if (v !== (order as any)[f]) proposed[f] = v
  }
  const note = typeof body.retailer_note === 'string' ? body.retailer_note.trim().slice(0, 1000) : ''

  if (Object.keys(proposed).length === 0 && !note) {
    return NextResponse.json({
      error: 'Please describe what you would like to change.',
    }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('order_change_requests')
    .insert([{
      order_id: order.id,
      partner_id: user.partnerId,
      requested_by: user.id,
      changes: proposed,
      retailer_note: note || null,
      status: 'pending',
    }])
    .select('id, created_at, changes, retailer_note, status')
    .single<{ id: string; created_at: string; changes: Record<string, any>; retailer_note: string | null; status: string }>()
  if (error) {
    return NextResponse.json(
      { error: safeDbError(error, 'retailer.change_request.insert', 'Could not submit your request.') },
      { status: 500 },
    )
  }

  // Fire-and-forget WhatsApp ping to the master / sub-admin number so they
  // see the request immediately rather than the next time they open the
  // order. Errors are swallowed inside the helper — never block the response.
  notifyInternalChangeRequestCreated({
    orderId: order.id,
    changeRequestId: data.id,
    changes: proposed,
    retailerNote: note || null,
  }).catch(err => {
    console.error('[whatsappNotify:internal:cr] dispatch error', err?.message || err)
  })

  return NextResponse.json({ request: data })
}

// DELETE — retailer cancels their own pending request before review.
export async function DELETE(req: Request, ctx: { params: { id: string } }) {
  const user = await getRetailer()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: any
  try { body = await req.json() } catch { body = {} }
  const reqId = body?.request_id
  if (!reqId) return NextResponse.json({ error: 'request_id required' }, { status: 400 })

  const { error } = await supabaseAdmin
    .from('order_change_requests')
    .update({ status: 'cancelled' })
    .eq('id', reqId)
    .eq('order_id', ctx.params.id)
    .eq('partner_id', user.partnerId)
    .eq('status', 'pending')
  if (error) {
    return NextResponse.json(
      { error: safeDbError(error, 'retailer.change_request.cancel', 'Could not cancel.') },
      { status: 500 },
    )
  }
  return NextResponse.json({ ok: true })
}
