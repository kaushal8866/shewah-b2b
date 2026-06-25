import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { safeDbError } from '@/lib/sanitizeDbError'
import { notifyResellerEvent } from '@/lib/resellerNotify'
import bcrypt from 'bcryptjs'

// GET: Validate invitation token
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const token = searchParams.get('token')

  if (!token) {
    return NextResponse.json({ error: 'Token is required' }, { status: 400 })
  }

  const { data: invite, error } = await supabaseAdmin
    .from('reseller_invitations')
    .select('*')
    .eq('invitation_code', token)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: safeDbError(error, 'public.invite.get', 'Could not verify invitation.') }, { status: 500 })
  }

  if (!invite) {
    return NextResponse.json({ error: 'Invitation link is invalid or expired.' }, { status: 404 })
  }

  if (invite.status !== 'pending') {
    return NextResponse.json({ error: `Invitation has already been ${invite.status}.` }, { status: 400 })
  }

  if (new Date(invite.expiry_date) < new Date()) {
    // Update status to expired
    await supabaseAdmin
      .from('reseller_invitations')
      .update({ status: 'expired', updated_at: new Date().toISOString() })
      .eq('id', invite.id)
    return NextResponse.json({ error: 'Invitation has expired.' }, { status: 400 })
  }

  return NextResponse.json({ invite })
}

// POST: Accept invitation & Register Reseller
export async function POST(req: Request) {
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const {
    token,
    username,
    password,
    store_name,
    city,
    address,
    bank_name,
    account_number,
    ifsc_code,
    upi_id,
    kyc_document_type,
    kyc_document_number,
    kyc_document_url
  } = body

  if (!token || !username || !password || !store_name || !city || !address) {
    return NextResponse.json({ error: 'Missing required registration fields' }, { status: 400 })
  }

  // 1. Verify invitation again
  const { data: invite, error: inviteErr } = await supabaseAdmin
    .from('reseller_invitations')
    .select('*')
    .eq('invitation_code', token)
    .maybeSingle()

  if (inviteErr || !invite || invite.status !== 'pending' || new Date(invite.expiry_date) < new Date()) {
    return NextResponse.json({ error: 'Invitation is invalid, expired, or already accepted.' }, { status: 400 })
  }

  // 2. Check if username is already taken in app_users
  const { data: existingUser } = await supabaseAdmin
    .from('app_users')
    .select('id')
    .eq('username', username.toLowerCase().trim())
    .maybeSingle()

  if (existingUser) {
    return NextResponse.json({ error: 'Username is already taken. Please choose another.' }, { status: 400 })
  }

  // 3. Load default settings parameters
  const { data: settingsData } = await supabaseAdmin
    .from('settings')
    .select('key, value')
    .in('key', ['reseller_default_credit_limit', 'reseller_default_markup_percent'])

  const defaultLimit = Number(settingsData?.find((s: any) => s.key === 'reseller_default_credit_limit')?.value) || 5000000 // default 50k in paise
  const defaultMarkup = Number(settingsData?.find((s: any) => s.key === 'reseller_default_markup_percent')?.value) || 15.0

  // 4. Generate unique reseller code
  const codePrefix = store_name.replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase()
  const randomSuffix = Math.floor(100 + Math.random() * 900) // 3 random digits
  const resellerCode = `RSL-${codePrefix || 'SHW'}-${randomSuffix}`

  // 5. Create Reseller profile
  const { data: reseller, error: resellerErr } = await supabaseAdmin
    .from('resellers')
    .insert({
      reseller_code: resellerCode,
      store_name,
      owner_name: invite.recipient_name,
      phone: invite.recipient_phone,
      email: invite.recipient_email || null,
      city,
      address,
      bank_name: bank_name || null,
      account_number: account_number || null,
      ifsc_code: ifsc_code || null,
      upi_id: upi_id || null,
      kyc_document_type: kyc_document_type || null,
      kyc_document_number: kyc_document_number || null,
      kyc_document_url: kyc_document_url || null,
      status: 'onboarding', // requires admin approval
      invited_by: invite.created_by || null,
      credit_limit_paise: defaultLimit,
      default_markup_percent: defaultMarkup,
      performance_tier: 'bronze',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .select('*')
    .single()

  if (resellerErr) {
    return NextResponse.json({ error: safeDbError(resellerErr, 'public.invite.create_reseller', 'Onboarding registration failed.') }, { status: 500 })
  }

  // 6. Create Login User
  const passwordHash = await bcrypt.hash(password, 10)
  const { data: appUser, error: userErr } = await supabaseAdmin
    .from('app_users')
    .insert({
      username: username.toLowerCase().trim(),
      password_hash: passwordHash,
      display_name: invite.recipient_name,
      role: 'reseller',
      is_active: true,
      reseller_id: reseller.id,
      created_at: new Date().toISOString()
    })
    .select('*')
    .single()

  if (userErr) {
    // Rollback reseller
    await supabaseAdmin.from('resellers').delete().eq('id', reseller.id)
    return NextResponse.json({ error: safeDbError(userErr, 'public.invite.create_user', 'User account creation failed.') }, { status: 500 })
  }

  // 7. Link reseller back to user
  await supabaseAdmin
    .from('resellers')
    .update({ user_id: appUser.id })
    .eq('id', reseller.id)

  // 8. Mark invitation accepted
  await supabaseAdmin
    .from('reseller_invitations')
    .update({ status: 'accepted', updated_at: new Date().toISOString() })
    .eq('id', invite.id)

  // 9. Alert admin on WhatsApp
  await notifyResellerEvent('invite_accepted', {
    name: invite.recipient_name,
    phone: invite.recipient_phone
  }).catch(() => {})

  return NextResponse.json({ ok: true })
}
