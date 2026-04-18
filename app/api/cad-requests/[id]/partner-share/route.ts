import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { sendCadPartnerShareLink } from '@/lib/cadPartnerShareNotify'

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

async function requireStaff() {
  const session = await getServerSession(authOptions)
  const user: any = session?.user
  if (!user) return null
  if (user.role === 'retailer' || user.role === 'manufacturer') return null
  return user
}

export async function GET(_: Request, ctx: { params: { id: string } }) {
  const user = await requireStaff()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await supabaseAdmin
    .from('cad_partner_share_links')
    .select('token, partner_name, partner_phone, cad_partner_id, created_at, expires_at, revoked_at, last_opened_at')
    .eq('cad_request_id', ctx.params.id)
    .order('created_at', { ascending: false })
    .limit(10)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const links = (data || []).map((l: any) => ({
    ...l,
    status: l.revoked_at
      ? 'revoked'
      : (new Date(l.expires_at).getTime() < Date.now() ? 'expired' : 'active'),
  }))

  // Latest partner response (joined separately to keep the query simple).
  const { data: responses } = await supabaseAdmin
    .from('cad_partner_responses')
    .select('id, decision, comment, partner_name, responded_at')
    .eq('cad_request_id', ctx.params.id)
    .order('responded_at', { ascending: false })
    .limit(5)

  // Directory of CAD partners so the panel can show a dropdown.
  const { data: directory } = await supabaseAdmin
    .from('cad_partners')
    .select('id, name, phone, notes, default_ttl_days, is_active')
    .eq('is_active', true)
    .order('name', { ascending: true })

  return NextResponse.json({
    links,
    responses: responses || [],
    directory: directory || [],
  })
}

export async function POST(req: Request, ctx: { params: { id: string } }) {
  const user = await requireStaff()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: any = {}
  try { body = await req.json() } catch {}

  let partnerName = typeof body.partner_name === 'string' ? body.partner_name.trim().slice(0, 120) : ''
  let partnerPhone = typeof body.partner_phone === 'string' ? body.partner_phone.trim().slice(0, 32) : ''
  let ttlDays = Math.min(Math.max(parseInt(body.ttl_days) || 7, 1), 30)
  const sendWhatsapp = body.sendWhatsapp !== false
  const partnerId = typeof body.partner_id === 'string' && body.partner_id ? body.partner_id : null

  // If a directory partner was picked, hydrate name / phone / TTL from the
  // directory row (form values still win when explicitly provided so the team
  // can override on a per-link basis).
  let resolvedPartnerId: string | null = null
  if (partnerId) {
    const { data: dirPartner, error: dirErr } = await supabaseAdmin
      .from('cad_partners')
      .select('id, name, phone, default_ttl_days, is_active')
      .eq('id', partnerId)
      .maybeSingle()
    if (dirErr) return NextResponse.json({ error: dirErr.message }, { status: 500 })
    if (!dirPartner) return NextResponse.json({ error: 'CAD partner not found in directory' }, { status: 400 })
    if (!(dirPartner as any).is_active) {
      return NextResponse.json({ error: 'This CAD partner is archived. Reactivate them in the directory first.' }, { status: 400 })
    }
    resolvedPartnerId = (dirPartner as any).id
    if (!partnerName) partnerName = ((dirPartner as any).name || '').slice(0, 120)
    if (!partnerPhone) partnerPhone = ((dirPartner as any).phone || '').slice(0, 32)
    if (!body.ttl_days && (dirPartner as any).default_ttl_days) {
      ttlDays = Math.min(Math.max(parseInt((dirPartner as any).default_ttl_days) || 7, 1), 30)
    }
  }

  // Make sure the CAD request exists + has at least one reference image.
  const { data: cad, error: cadErr } = await supabaseAdmin
    .from('cad_requests')
    .select('id, reference_images')
    .eq('id', ctx.params.id)
    .maybeSingle()
  if (cadErr) return NextResponse.json({ error: cadErr.message }, { status: 500 })
  if (!cad) return NextResponse.json({ error: 'CAD request not found' }, { status: 404 })
  const refs: string[] = (cad as any).reference_images || []
  if (refs.length === 0) {
    return NextResponse.json(
      { error: 'Add at least one reference image before sharing with a CAD partner.' },
      { status: 400 },
    )
  }

  // Auto-revoke any prior active links for this request.
  await supabaseAdmin
    .from('cad_partner_share_links')
    .update({ revoked_at: new Date().toISOString() })
    .eq('cad_request_id', ctx.params.id)
    .is('revoked_at', null)

  const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000).toISOString()
  const insert = await supabaseAdmin
    .from('cad_partner_share_links')
    .insert([{
      cad_request_id: ctx.params.id,
      cad_partner_id: resolvedPartnerId,
      partner_name: partnerName || null,
      partner_phone: partnerPhone || null,
      created_by: user.id || null,
      expires_at: expiresAt,
    }])
    .select('token, partner_name, partner_phone, cad_partner_id, created_at, expires_at, revoked_at, last_opened_at')
    .single()
  if (insert.error) return NextResponse.json({ error: insert.error.message }, { status: 500 })

  let send: any = null
  if (sendWhatsapp && partnerPhone) {
    send = await sendCadPartnerShareLink({
      cadRequestId: ctx.params.id,
      token: (insert.data as any).token,
      partnerName,
      partnerPhone,
    })
  }

  return NextResponse.json({
    link: { ...(insert.data as any), status: 'active' },
    send,
  })
}

export async function DELETE(req: Request, ctx: { params: { id: string } }) {
  const user = await requireStaff()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const url = new URL(req.url)
  const token = url.searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 })

  const { error } = await supabaseAdmin
    .from('cad_partner_share_links')
    .update({ revoked_at: new Date().toISOString() })
    .eq('token', token)
    .eq('cad_request_id', ctx.params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// Unused but kept here as a stable knob.
export const TTL_MS_DEFAULT = SEVEN_DAYS_MS
