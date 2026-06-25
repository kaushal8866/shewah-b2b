import { NextResponse } from 'next/server'
import { getResellerSession } from '@/lib/resellerAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { safeDbError } from '@/lib/sanitizeDbError'
import bcrypt from 'bcryptjs'

export async function GET() {
  const { reseller, error } = await getResellerSession()
  if (error || !reseller) {
    return NextResponse.json({ error: error || 'Forbidden' }, { status: 403 })
  }

  // Get user details
  const { data: u } = await supabaseAdmin
    .from('app_users')
    .select('username, display_name')
    .eq('reseller_id', reseller.id)
    .maybeSingle()

  return NextResponse.json({
    profile: reseller,
    account: u ? { username: u.username, displayName: u.display_name || null } : null,
  })
}

export async function PATCH(req: Request) {
  const { reseller, error } = await getResellerSession()
  if (error || !reseller) {
    return NextResponse.json({ error: error || 'Forbidden' }, { status: 403 })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  // Handle password change
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
      .eq('reseller_id', reseller.id)
      .maybeSingle()

    if (ue) {
      return NextResponse.json({ error: safeDbError(ue, 'reseller.profile.pwd_lookup', 'Verification failed.') }, { status: 500 })
    }
    if (!u) {
      return NextResponse.json({ error: 'User account not found' }, { status: 404 })
    }

    const ok = await bcrypt.compare(current, u.password_hash)
    if (!ok) {
      return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 })
    }

    const newHash = await bcrypt.hash(next, 10)
    const upd = await supabaseAdmin
      .from('app_users')
      .update({ password_hash: newHash })
      .eq('id', u.id)

    if (upd.error) {
      return NextResponse.json({ error: safeDbError(upd.error, 'reseller.profile.pwd_update', 'Could not update password.') }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  }

  // Update reseller profile (only allow editing contact, bank, and UPI details)
  const allowed: Record<string, any> = {}
  if (typeof body.phone === 'string' && body.phone.trim()) allowed.phone = body.phone.trim()
  if (typeof body.email === 'string') allowed.email = body.email.trim() || null
  if (typeof body.address === 'string') allowed.address = body.address.trim() || null
  if (typeof body.bank_name === 'string') allowed.bank_name = body.bank_name.trim() || null
  if (typeof body.account_number === 'string') allowed.account_number = body.account_number.trim() || null
  if (typeof body.ifsc_code === 'string') allowed.ifsc_code = body.ifsc_code.trim() || null
  if (typeof body.upi_id === 'string') allowed.upi_id = body.upi_id.trim() || null
  if (typeof body.profile_photo_url === 'string') allowed.profile_photo_url = body.profile_photo_url.trim() || null

  if (Object.keys(allowed).length === 0) {
    return NextResponse.json({ error: 'No editable fields supplied' }, { status: 400 })
  }

  const { data, error: updateErr } = await supabaseAdmin
    .from('resellers')
    .update(allowed)
    .eq('id', reseller.id)
    .select('*')
    .single()

  if (updateErr) {
    return NextResponse.json({ error: safeDbError(updateErr, 'reseller.profile.update', 'Could not save profile details.') }, { status: 500 })
  }

  return NextResponse.json({ profile: data })
}
