import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { safeDbError } from '@/lib/sanitizeDbError'
import { notifyRetailerChangeRequestReviewed } from '@/lib/whatsappNotify'
import { runInBackground } from '@/lib/backgroundTask'

const ALLOWED_FIELDS = new Set(['quantity', 'ring_size', 'special_notes', 'brief_text'])

async function requireAdmin() {
  const s = await getServerSession(authOptions)
  const u: any = s?.user
  if (!u || (u.role !== 'master' && u.role !== 'sub')) return null
  return u
}

// Master / sub approves or rejects a retailer change request.
// On approve, the whitelisted field changes are applied to the orders row
// in the same transaction-shaped block (best-effort — supabase-js doesn't
// give us real txns, so we apply the order update first and then mark the
// request approved; if the order update fails we leave the request pending).
export async function PATCH(req: Request, ctx: { params: { id: string } }) {
  const u = await requireAdmin()
  if (!u) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }) }
  const action = body?.action
  const reviewNote = typeof body?.review_note === 'string' ? body.review_note.trim().slice(0, 1000) : null
  if (action !== 'approve' && action !== 'reject') {
    return NextResponse.json({ error: 'action must be approve or reject' }, { status: 400 })
  }

  // Load the request — must be pending.
  const { data: cr, error: cre } = await supabaseAdmin
    .from('order_change_requests')
    .select('id, status, order_id, changes')
    .eq('id', ctx.params.id)
    .maybeSingle()
  if (cre) return NextResponse.json({ error: safeDbError(cre, 'admin.cr.get') }, { status: 500 })
  if (!cr) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (cr.status !== 'pending') {
    return NextResponse.json({ error: `This request has already been ${cr.status}.` }, { status: 400 })
  }

  if (action === 'approve') {
    // Re-whitelist the changes payload as a defence-in-depth — even if a
    // disallowed field made it into the row somehow, we never apply it.
    const upd: Record<string, any> = {}
    for (const [k, v] of Object.entries(cr.changes || {})) {
      if (ALLOWED_FIELDS.has(k)) upd[k] = v
    }
    if (Object.keys(upd).length > 0) {
      const { error: oe } = await supabaseAdmin
        .from('orders')
        .update(upd)
        .eq('id', cr.order_id)
      if (oe) {
        return NextResponse.json(
          { error: safeDbError(oe, 'admin.cr.apply', 'Could not apply the changes to the order.') },
          { status: 500 },
        )
      }
    }
  }

  const { data, error } = await supabaseAdmin
    .from('order_change_requests')
    .update({
      status: action === 'approve' ? 'approved' : 'rejected',
      reviewed_by: u.id,
      reviewed_at: new Date().toISOString(),
      review_note: reviewNote,
    })
    .eq('id', ctx.params.id)
    .eq('status', 'pending')
    .select('id, status, reviewed_at, review_note')
    .single()
  if (error) {
    return NextResponse.json(
      { error: safeDbError(error, 'admin.cr.update', 'Could not update the request.') },
      { status: 500 },
    )
  }

  // Fire-and-forget WhatsApp confirmation back to the retailer so they know
  // the moment their request was approved or rejected, including the master's
  // review note. Errors are swallowed inside the helper.
  runInBackground('notify.changeRequest.reviewed', () => notifyRetailerChangeRequestReviewed({
    orderId: cr.order_id,
    changeRequestId: cr.id,
    decision: action === 'approve' ? 'approved' : 'rejected',
    reviewNote,
  }))

  return NextResponse.json({ request: data })
}
