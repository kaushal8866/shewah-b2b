import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { notifyInternalCadPartnerResponse } from '@/lib/cadPartnerShareNotify'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: Request, ctx: { params: { token: string } }) {
  const token = ctx.params.token

  let body: any = {}
  try { body = await req.json() } catch {}

  const decisionRaw = String(body.decision || '').toLowerCase()
  const decision: 'approved' | 'revision' | null =
    decisionRaw === 'approved' || decisionRaw === 'approve'
      ? 'approved'
      : decisionRaw === 'revision' || decisionRaw === 'request_revision' || decisionRaw === 'revise'
        ? 'revision'
        : null
  if (!decision) return NextResponse.json({ error: 'Invalid decision' }, { status: 400 })

  const comment = typeof body.comment === 'string' ? body.comment.trim().slice(0, 4000) : ''
  if (decision === 'revision' && !comment) {
    return NextResponse.json({ error: 'Please add a comment describing the revision needed.' }, { status: 400 })
  }

  // -- Validate token + load context ---------------------------------------
  const { data: link } = await supabaseAdmin
    .from('cad_partner_share_links')
    .select('token, cad_request_id, expires_at, revoked_at, partner_name')
    .eq('token', token)
    .maybeSingle()
  if (!link) return NextResponse.json({ error: 'Link not found' }, { status: 404 })
  if ((link as any).revoked_at) return NextResponse.json({ error: 'Link revoked' }, { status: 410 })
  if (new Date((link as any).expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: 'Link expired' }, { status: 410 })
  }

  const { data: cad } = await supabaseAdmin
    .from('cad_requests')
    .select('id, status')
    .eq('id', (link as any).cad_request_id)
    .maybeSingle()
  if (!cad) return NextResponse.json({ error: 'CAD request not found' }, { status: 404 })

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || ''
  const ua = (req.headers.get('user-agent') || '').slice(0, 500)
  const partnerName = (link as any).partner_name || ''

  // -- Record the partner response (audit row) -----------------------------
  const insertResp = await supabaseAdmin
    .from('cad_partner_responses')
    .insert([{
      link_id: token,
      cad_request_id: (cad as any).id,
      decision,
      comment: comment || null,
      partner_name: partnerName || null,
      ip: ip || null,
      user_agent: ua || null,
    }])
    .select('id, responded_at')
    .single()
  if (insertResp.error) {
    return NextResponse.json({ error: insertResp.error.message }, { status: 500 })
  }

  // -- Append to CAD revision history --------------------------------------
  // We re-use the existing `cad_revisions` table so the entry shows up inline
  // with retailer/admin entries on the CAD detail screen. Author is stored as
  // 'admin' (external partner attributed via the note prefix), since the
  // existing schema only allows 'admin' | 'retailer'.
  const noteAuthor = `CAD partner${partnerName ? ` — ${partnerName}` : ''}`
  const noteBody = decision === 'approved'
    ? `${noteAuthor} approved the design.${comment ? `\n\n${comment}` : ''}`
    : `${noteAuthor} requested a revision.${comment ? `\n\n${comment}` : ''}`
  await supabaseAdmin.from('cad_revisions').insert({
    cad_request_id: (cad as any).id,
    kind: decision === 'approved' ? 'approval' : 'revision_request',
    author: 'admin',
    note: noteBody,
  })

  // -- Mirror the decision onto the CAD request itself so the in-app realtime
  // banner / status badges update for the design team.
  const cadUpdate: any = {}
  if (decision === 'approved') {
    cadUpdate.status = 'approved'
    cadUpdate.approved_date = new Date().toISOString().slice(0, 10)
  } else {
    cadUpdate.status = 'revision_requested'
    cadUpdate.partner_feedback = comment || null
  }
  await supabaseAdmin.from('cad_requests').update(cadUpdate).eq('id', (cad as any).id)

  // -- Stamp last_opened_at as a side-effect of submission too -------------
  await supabaseAdmin.rpc('cad_partner_share_record_visit', { p_token: token })

  // -- Fire-and-forget WhatsApp ping to the design team --------------------
  notifyInternalCadPartnerResponse({
    cadRequestId: (cad as any).id,
    decision,
    comment: comment || null,
    partnerName: partnerName || null,
  }).catch(() => { /* swallowed inside */ })

  return NextResponse.json({
    ok: true,
    decision,
    responded_at: (insertResp.data as any).responded_at,
  })
}
