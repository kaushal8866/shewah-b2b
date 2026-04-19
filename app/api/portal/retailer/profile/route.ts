import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import bcrypt from 'bcryptjs'

async function getRetailerUser() {
  const session = await getServerSession(authOptions)
  const user: any = session?.user
  if (!user || user.role !== 'retailer' || !user.partnerId) return null
  return user
}

export async function GET() {
  const user = await getRetailerUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await supabaseAdmin
    .from('partners')
    .select('id, store_name, owner_name, phone, email, city, state, address, sarafa_bazaar, notify_whatsapp')
    .eq('id', user.partnerId)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  return NextResponse.json({
    profile: data,
    account: { username: user.username, displayName: user.displayName || null },
  })
}

export async function PATCH(req: Request) {
  const user = await getRetailerUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }

  // Password change is handled in this same endpoint to avoid an extra route.
  if (body.action === 'change_password') {
    const current = String(body.current_password || '')
    const next = String(body.new_password || '')
    if (!current || !next) {
      return NextResponse.json({ error: 'Both current and new passwords are required' }, { status: 400 })
    }
    if (next.length < 8) {
      return NextResponse.json({ error: 'New password must be at least 8 characters' }, { status: 400 })
    }

    const { data: u, error: ue } = await supabaseAdmin
      .from('app_users')
      .select('id, password_hash')
      .eq('username', user.username)
      .maybeSingle()
    if (ue) return NextResponse.json({ error: ue.message }, { status: 500 })
    if (!u) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const ok = await bcrypt.compare(current, u.password_hash)
    if (!ok) return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 })

    const newHash = await bcrypt.hash(next, 10)
    const upd = await supabaseAdmin
      .from('app_users')
      .update({ password_hash: newHash })
      .eq('id', u.id)
    if (upd.error) return NextResponse.json({ error: upd.error.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  }

  // Profile update — only safe, non-financial fields are accepted. Store name,
  // owner, GST, billing tier, status, etc. remain admin-only.
  const allowed: Record<string, any> = {}
  if (typeof body.phone === 'string' && body.phone.trim()) allowed.phone = body.phone.trim()
  if (typeof body.email === 'string') allowed.email = body.email.trim() || null
  if (typeof body.address === 'string') allowed.address = body.address.trim() || null
  if (typeof body.sarafa_bazaar === 'string') allowed.sarafa_bazaar = body.sarafa_bazaar.trim() || null
  if (typeof body.notify_whatsapp === 'boolean') allowed.notify_whatsapp = body.notify_whatsapp

  if (Object.keys(allowed).length === 0) {
    return NextResponse.json({ error: 'No editable fields supplied' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('partners')
    .update(allowed)
    .eq('id', user.partnerId)
    .select('id, store_name, owner_name, phone, email, city, state, address, sarafa_bazaar, notify_whatsapp')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ profile: data })
}
