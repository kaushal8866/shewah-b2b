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

export async function PATCH(req: Request, ctx: { params: { id: string } }) {
  const user = await requireStaff()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: any = {}
  try { body = await req.json() } catch {}

  const update: Record<string, any> = { updated_at: new Date().toISOString() }
  if (typeof body.name === 'string') {
    const n = body.name.trim().slice(0, 120)
    if (!n) return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 })
    update.name = n
  }
  if (typeof body.phone === 'string') update.phone = body.phone.trim().slice(0, 32) || null
  if (typeof body.notes === 'string') update.notes = body.notes.trim().slice(0, 1000) || null
  if (body.default_ttl_days != null) {
    update.default_ttl_days = Math.min(Math.max(parseInt(body.default_ttl_days) || 7, 1), 30)
  }
  if (typeof body.is_active === 'boolean') update.is_active = body.is_active

  const { data, error } = await supabaseAdmin
    .from('cad_partners')
    .update(update)
    .eq('id', ctx.params.id)
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

export async function DELETE(_: Request, ctx: { params: { id: string } }) {
  const user = await requireStaff()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Block deletion if there are active (un-revoked, un-expired) links so the
  // team has to revoke them first — otherwise the live links would orphan.
  const { data: activeLinks } = await supabaseAdmin
    .from('cad_partner_share_links')
    .select('token, expires_at, revoked_at')
    .eq('cad_partner_id', ctx.params.id)
    .is('revoked_at', null)

  const stillActive = (activeLinks || []).filter(
    (l: any) => new Date(l.expires_at).getTime() >= Date.now()
  )
  if (stillActive.length > 0) {
    return NextResponse.json(
      { error: `Revoke ${stillActive.length} active link${stillActive.length === 1 ? '' : 's'} for this partner first.` },
      { status: 400 },
    )
  }

  const { error } = await supabaseAdmin
    .from('cad_partners')
    .delete()
    .eq('id', ctx.params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
