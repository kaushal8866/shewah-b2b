import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { sendKarigarPackLink } from '@/lib/karigarShareNotify'

const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000

async function requireAdmin() {
  const session = await getServerSession(authOptions)
  const user: any = session?.user
  if (!user || (user.role !== 'master' && user.role !== 'admin')) return null
  return user
}

export async function GET(_: Request, ctx: { params: { id: string } }) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await supabaseAdmin
    .from('mfg_share_links')
    .select('token, created_at, expires_at, revoked, last_accessed_at, download_count')
    .eq('manufacturing_order_id', ctx.params.id)
    .order('created_at', { ascending: false })
    .limit(5)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ links: data || [] })
}

export async function POST(req: Request, ctx: { params: { id: string } }) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: any = {}
  try { body = await req.json() } catch {}
  const sendWhatsapp = body?.sendWhatsapp !== false // defaults true
  const reuseActive = body?.reuseActive === true

  let data: any = null

  if (reuseActive) {
    // Re-use the currently-active link if there is one (so a karigar mid-
    // download isn't booted off when the admin clicks "Re-send").
    const { data: existing } = await supabaseAdmin
      .from('mfg_share_links')
      .select('token, created_at, expires_at, revoked, last_accessed_at, download_count')
      .eq('manufacturing_order_id', ctx.params.id)
      .eq('revoked', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (existing) data = existing
  }

  if (!data) {
    // Revoke any other still-active links for this order so there's only ever one.
    await supabaseAdmin
      .from('mfg_share_links')
      .update({ revoked: true })
      .eq('manufacturing_order_id', ctx.params.id)
      .eq('revoked', false)

    const expiresAt = new Date(Date.now() + FORTY_EIGHT_HOURS_MS).toISOString()
    const inserted = await supabaseAdmin
      .from('mfg_share_links')
      .insert([{
        manufacturing_order_id: ctx.params.id,
        created_by: user.id,
        expires_at: expiresAt,
      }])
      .select('token, created_at, expires_at, revoked, last_accessed_at, download_count')
      .single()
    if (inserted.error) return NextResponse.json({ error: inserted.error.message }, { status: 500 })
    data = inserted.data
  }

  let send: any = null
  if (sendWhatsapp) {
    send = await sendKarigarPackLink({
      manufacturingOrderId: ctx.params.id,
      token: (data as any).token,
    })
  }

  return NextResponse.json({ link: data, send })
}

export async function DELETE(req: Request, ctx: { params: { id: string } }) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const url = new URL(req.url)
  const token = url.searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 })

  const { error } = await supabaseAdmin
    .from('mfg_share_links')
    .update({ revoked: true })
    .eq('token', token)
    .eq('manufacturing_order_id', ctx.params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
