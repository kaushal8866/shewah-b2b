import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

async function requireStaff() {
  const session = await getServerSession(authOptions)
  const user: any = session?.user
  if (!user) return null
  if (user.role === 'retailer' || user.role === 'manufacturer') return null
  return user
}

export async function GET(req: Request) {
  const user = await requireStaff()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const url = new URL(req.url)
  const includeStats = url.searchParams.get('stats') === '1'

  const { data: partners, error } = await supabaseAdmin
    .from('cad_partners')
    .select('id, name, phone, notes, default_ttl_days, is_active, created_at')
    .order('is_active', { ascending: false })
    .order('name', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (!includeStats) {
    return NextResponse.json({ partners: partners || [] })
  }

  // Pull all share links + responses bound to a directory partner so we can
  // attach an activity summary to each partner row.
  const partnerIds = (partners || []).map((p: any) => p.id)
  if (partnerIds.length === 0) {
    return NextResponse.json({ partners: [] })
  }

  const { data: links } = await supabaseAdmin
    .from('cad_partner_share_links')
    .select('token, cad_partner_id, cad_request_id, created_at, expires_at, revoked_at, last_opened_at')
    .in('cad_partner_id', partnerIds)
    .order('created_at', { ascending: false })

  // Fetch responses scoped to *these* links only (no global cap), so per-partner
  // "recent decisions" stays accurate even at scale.
  const linkTokens = (links || []).map((l: any) => l.token)
  let responses: any[] = []
  if (linkTokens.length > 0) {
    const { data: respData } = await supabaseAdmin
      .from('cad_partner_responses')
      .select('id, link_id, decision, comment, partner_name, responded_at, cad_request_id')
      .in('link_id', linkTokens)
      .order('responded_at', { ascending: false })
    responses = respData || []
  }

  // Map link_id -> partner_id so we can credit responses to a directory entry.
  const linkToPartner = new Map<string, string>()
  for (const l of links || []) {
    if ((l as any).cad_partner_id) linkToPartner.set((l as any).token, (l as any).cad_partner_id)
  }

  const now = Date.now()
  const enriched = (partners || []).map((p: any) => {
    const ownLinks = (links || []).filter((l: any) => l.cad_partner_id === p.id)
    const active = ownLinks.filter((l: any) =>
      !l.revoked_at && new Date(l.expires_at).getTime() >= now
    )
    const partnerResponses = (responses || []).filter(
      (r: any) => linkToPartner.get(r.link_id) === p.id
    ).slice(0, 5)
    const lastShare = ownLinks[0] || null
    return {
      ...p,
      stats: {
        total_links: ownLinks.length,
        active_links: active.length,
        last_share_at: lastShare?.created_at || null,
        last_opened_at: ownLinks
          .map((l: any) => l.last_opened_at)
          .filter(Boolean)
          .sort()
          .reverse()[0] || null,
      },
      active_links: active.map((l: any) => ({
        token: l.token,
        cad_request_id: l.cad_request_id,
        created_at: l.created_at,
        expires_at: l.expires_at,
        last_opened_at: l.last_opened_at,
      })),
      recent_responses: partnerResponses,
    }
  })

  return NextResponse.json({ partners: enriched })
}

export async function POST(req: Request) {
  const user = await requireStaff()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: any = {}
  try { body = await req.json() } catch {}

  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 120) : ''
  if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

  const phone = typeof body.phone === 'string' ? body.phone.trim().slice(0, 32) : ''
  const notes = typeof body.notes === 'string' ? body.notes.trim().slice(0, 1000) : ''
  const ttl = Math.min(Math.max(parseInt(body.default_ttl_days) || 7, 1), 30)

  const { data, error } = await supabaseAdmin
    .from('cad_partners')
    .insert([{
      name,
      phone: phone || null,
      notes: notes || null,
      default_ttl_days: ttl,
    }])
    .select('id, name, phone, notes, default_ttl_days, is_active, created_at')
    .single()

  if (error) {
    const msg = /duplicate|unique/i.test(error.message)
      ? 'A partner with this name already exists.'
      : error.message
    return NextResponse.json({ error: msg }, { status: 400 })
  }
  return NextResponse.json({ partner: data })
}
