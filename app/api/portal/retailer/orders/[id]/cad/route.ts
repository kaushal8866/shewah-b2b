import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { notifyInternalCadAction } from '@/lib/whatsappNotify'

// Retailer-facing CAD action endpoint. Lets the retailer approve the CAD that
// was sent to them, or request a revision with a short note. We deliberately
// re-verify ownership on both the order and the CAD request, and only allow
// transitions out of the `sent` state — anything else is the internal team's
// job.
export async function POST(req: Request, ctx: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const user: any = session?.user
  if (!user || user.role !== 'retailer' || !user.partnerId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: any
  try { body = await req.json() } catch { body = {} }
  const action = body?.action as 'approve' | 'revise' | undefined
  const feedback = typeof body?.feedback === 'string' ? body.feedback.trim() : ''

  if (action !== 'approve' && action !== 'revise') {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }
  if (action === 'revise' && !feedback) {
    return NextResponse.json({ error: 'Please describe what you would like changed.' }, { status: 400 })
  }
  if (feedback.length > 2000) {
    return NextResponse.json({ error: 'Feedback is too long.' }, { status: 400 })
  }

  // Verify the order belongs to this retailer and grab the linked CAD request id.
  const { data: order, error: orderErr } = await supabaseAdmin
    .from('orders')
    .select('id, partner_id, cad_request_id, status')
    .eq('id', ctx.params.id)
    .eq('partner_id', user.partnerId)
    .maybeSingle()

  if (orderErr) return NextResponse.json({ error: orderErr.message }, { status: 500 })
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  if (!order.cad_request_id) {
    return NextResponse.json({ error: 'No CAD design has been shared on this order yet.' }, { status: 400 })
  }

  // Re-verify the CAD request belongs to the same partner and is in the
  // `sent` state. Anything else (already approved, in_progress, etc.) is
  // ignored to avoid races / replays.
  const { data: cad, error: cadErr } = await supabaseAdmin
    .from('cad_requests')
    .select('id, partner_id, status')
    .eq('id', order.cad_request_id)
    .eq('partner_id', user.partnerId)
    .maybeSingle()

  if (cadErr) return NextResponse.json({ error: cadErr.message }, { status: 500 })
  if (!cad) return NextResponse.json({ error: 'CAD design not found.' }, { status: 404 })
  if (cad.status !== 'sent') {
    return NextResponse.json({ error: 'This CAD design is no longer awaiting your decision.' }, { status: 409 })
  }

  const today = new Date().toISOString().split('T')[0]

  if (action === 'approve') {
    const { error: e1 } = await supabaseAdmin
      .from('cad_requests')
      .update({
        status: 'approved',
        approved_date: today,
        partner_feedback: feedback || null,
      })
      .eq('id', cad.id)
    if (e1) return NextResponse.json({ error: e1.message }, { status: 500 })

    const { error: e2 } = await supabaseAdmin
      .from('orders')
      .update({ status: 'design_approved' })
      .eq('id', order.id)
    if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })

    // Append to the revisions log so both sides keep a record of approval.
    await supabaseAdmin.from('cad_revisions').insert({
      cad_request_id: cad.id,
      kind: 'approval',
      author: 'retailer',
      note: feedback || null,
    })

    // Fire-and-forget internal ping to the design team. Errors are swallowed
    // inside the helper — never block the retailer's success response.
    notifyInternalCadAction({
      orderId: order.id,
      action: 'approve',
      feedback: feedback || null,
    }).catch(err => {
      console.error('[whatsappNotify:internal] dispatch error', err?.message || err)
    })

    return NextResponse.json({ ok: true, status: 'approved' })
  }

  // action === 'revise'
  const { error: e1 } = await supabaseAdmin
    .from('cad_requests')
    .update({
      status: 'revision_requested',
      partner_feedback: feedback,
    })
    .eq('id', cad.id)
  if (e1) return NextResponse.json({ error: e1.message }, { status: 500 })

  // Order moves back into CAD work so the internal team knows to iterate.
  const { error: e2 } = await supabaseAdmin
    .from('orders')
    .update({ status: 'cad_in_progress' })
    .eq('id', order.id)
  if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })

  // Persist this round of feedback as its own revision row so future rounds
  // don't overwrite it.
  await supabaseAdmin.from('cad_revisions').insert({
    cad_request_id: cad.id,
    kind: 'revision_request',
    author: 'retailer',
    note: feedback,
  })

  // Fire-and-forget internal ping to the design team so they can jump on the
  // revision immediately rather than waiting for a screen refresh.
  notifyInternalCadAction({
    orderId: order.id,
    action: 'revise',
    feedback,
  }).catch(err => {
    console.error('[whatsappNotify:internal] dispatch error', err?.message || err)
  })

  return NextResponse.json({ ok: true, status: 'revision_requested' })
}
