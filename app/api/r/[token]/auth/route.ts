import { NextRequest, NextResponse } from 'next/server'
import { randomInt } from 'crypto'
import bcrypt from 'bcryptjs'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { signPayload, verifyPayload } from '@/lib/storefrontAuth'
import { sendWhatsApp, isWhatsAppConfigured } from '@/lib/resellerNotify'
import { cookies } from 'next/headers'

// A 6-digit code is only a 1e6 space, so it is safe *only* with a hard cap on
// verification attempts. Both limits below are load-bearing security controls,
// not UX tuning.
const OTP_TTL_MS = 5 * 60 * 1000
const OTP_MAX_ATTEMPTS = 5
const OTP_RESEND_COOLDOWN_MS = 60 * 1000

// GET: check active session
export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  const token = params.token
  const cookieStore = cookies()
  const sessionJwt = cookieStore.get('reseller_customer_jwt')?.value

  if (!sessionJwt) {
    return NextResponse.json({ authenticated: false, customer: null })
  }

  const customer = verifyPayload(sessionJwt)
  if (!customer || customer.reseller_token !== token) {
    return NextResponse.json({ authenticated: false, customer: null })
  }

  // Fetch fresh profile from database
  const { data: dbCustomer } = await supabaseAdmin
    .from('reseller_storefront_customers')
    .select('id, name, phone, email, saved_addresses, wishlist_product_ids')
    .eq('id', customer.id)
    .maybeSingle()

  if (!dbCustomer) {
    return NextResponse.json({ authenticated: false, customer: null })
  }

  return NextResponse.json({ authenticated: true, customer: dbCustomer })
}

// POST: Handles login, registration, verify-otp, send-otp and logout
export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const token = params.token
  
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { action, phone, code, name, email } = body

  // 1. Resolve reseller from storefront share link token
  const { data: shareLink } = await supabaseAdmin
    .from('reseller_share_links')
    .select('id, reseller_id')
    .eq('link_token', token)
    .eq('is_active', true)
    .maybeSingle()

  if (!shareLink) {
    return NextResponse.json({ error: 'Storefront not found or inactive' }, { status: 404 })
  }

  const resellerId = shareLink.reseller_id

  // 2. Action: send-otp
  if (action === 'send-otp') {
    if (!phone) {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 })
    }

    const cleanPhone = phone.replace(/\s+/g, '')
    if (!/^\+?\d{8,15}$/.test(cleanPhone)) {
      return NextResponse.json({ error: 'Enter a valid phone number' }, { status: 400 })
    }

    // A real code can only be delivered over WhatsApp. Rather than fall back to
    // a guessable constant, refuse in production when the transport is absent.
    if (!isWhatsAppConfigured() && process.env.NODE_ENV === 'production') {
      console.error('[Storefront Auth] WhatsApp transport not configured — cannot deliver OTP')
      return NextResponse.json(
        { error: 'Sign-in is temporarily unavailable. Please contact the store.' },
        { status: 503 },
      )
    }

    // Re-send cooldown, so this endpoint cannot be used to spam a phone number.
    const { data: existing } = await supabaseAdmin
      .from('reseller_storefront_otps')
      .select('id, last_sent_at')
      .eq('reseller_id', resellerId)
      .eq('phone', cleanPhone)
      .maybeSingle()

    if (existing?.last_sent_at) {
      const since = Date.now() - new Date(existing.last_sent_at).getTime()
      if (since < OTP_RESEND_COOLDOWN_MS) {
        return NextResponse.json(
          { error: 'A code was just sent. Please wait a moment before requesting another.' },
          { status: 429 },
        )
      }
    }

    // Cryptographically random, never returned to the caller, stored hashed.
    const otpCode = String(randomInt(0, 1_000_000)).padStart(6, '0')
    const otpHash = await bcrypt.hash(otpCode, 10)
    const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString()

    await supabaseAdmin
      .from('reseller_storefront_otps')
      .delete()
      .eq('reseller_id', resellerId)
      .eq('phone', cleanPhone)

    const { error: otpErr } = await supabaseAdmin
      .from('reseller_storefront_otps')
      .insert({
        reseller_id: resellerId,
        phone: cleanPhone,
        otp_code: otpHash,
        expires_at: expiresAt,
        attempts: 0,
        last_sent_at: new Date().toISOString(),
      })

    if (otpErr) {
      console.error('[Storefront Auth] Could not persist OTP:', otpErr.message)
      return NextResponse.json({ error: 'Could not send verification code' }, { status: 500 })
    }

    // Awaited on purpose — the shopper is blocked on this message arriving.
    const delivered = await sendWhatsApp({
      toPhone: cleanPhone,
      message: `Your verification code is ${otpCode}\n\nIt expires in 5 minutes. Do not share this code with anyone.`,
    })

    if (!delivered) {
      return NextResponse.json(
        { error: 'Could not send the verification code. Please try again.' },
        { status: 502 },
      )
    }

    // The response never carries the code. Outside production, with no
    // WhatsApp transport, the server log is the only place to read it.
    return NextResponse.json({ success: true, message: 'OTP verification code sent' })
  }

  // 3. Action: verify-otp
  if (action === 'verify-otp') {
    if (!phone || !code) {
      return NextResponse.json({ error: 'Phone and code are required' }, { status: 400 })
    }

    const cleanPhone = phone.replace(/\s+/g, '')

    // Only the hash is stored, so the row is located by (reseller, phone) and
    // the code is then compared — never matched on directly.
    const { data: otpRow, error: verifyErr } = await supabaseAdmin
      .from('reseller_storefront_otps')
      .select('id, otp_code, expires_at, attempts')
      .eq('reseller_id', resellerId)
      .eq('phone', cleanPhone)
      .maybeSingle()

    // One generic message for every failure mode below, so this endpoint does
    // not reveal whether a phone number has a code pending.
    const invalid = () =>
      NextResponse.json({ error: 'Invalid or expired verification code' }, { status: 400 })

    if (verifyErr || !otpRow) return invalid()

    if (new Date(otpRow.expires_at) < new Date()) {
      await supabaseAdmin.from('reseller_storefront_otps').delete().eq('id', otpRow.id)
      return invalid()
    }

    // Burn the code once the attempt cap is hit — this is what keeps a 6-digit
    // secret out of brute-force range.
    if ((otpRow.attempts ?? 0) >= OTP_MAX_ATTEMPTS) {
      await supabaseAdmin.from('reseller_storefront_otps').delete().eq('id', otpRow.id)
      return invalid()
    }

    const matches = await bcrypt.compare(String(code), otpRow.otp_code)
    if (!matches) {
      await supabaseAdmin
        .from('reseller_storefront_otps')
        .update({ attempts: (otpRow.attempts ?? 0) + 1 })
        .eq('id', otpRow.id)
      return invalid()
    }

    // Delete used OTP
    await supabaseAdmin
      .from('reseller_storefront_otps')
      .delete()
      .eq('id', otpRow.id)

    // Check if customer profile exists for this reseller storefront
    let { data: customer } = await supabaseAdmin
      .from('reseller_storefront_customers')
      .select('*')
      .eq('reseller_id', resellerId)
      .eq('phone', cleanPhone)
      .maybeSingle()

    // If it is a new user registration, create the account
    if (!customer) {
      const { data: newCustomer, error: insertErr } = await supabaseAdmin
        .from('reseller_storefront_customers')
        .insert({
          reseller_id: resellerId,
          phone: cleanPhone,
          name: name || 'Valued Customer',
          email: email || ''
        })
        .select('*')
        .single()

      if (insertErr) {
        return NextResponse.json({ error: 'Failed to register customer account' }, { status: 500 })
      }
      customer = newCustomer
    }

    // Issue Stateless JWT cookie
    const payload = {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      reseller_id: resellerId,
      reseller_token: token
    }

    const sessionJwt = signPayload(payload)
    const cookieStore = cookies()
    cookieStore.set('reseller_customer_jwt', sessionJwt, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 30 * 24 * 60 * 60, // 30 days
      path: '/'
    })

    return NextResponse.json({ success: true, customer })
  }

  // 4. Action: logout
  if (action === 'logout') {
    const cookieStore = cookies()
    cookieStore.delete('reseller_customer_jwt')
    return NextResponse.json({ success: true, message: 'Logged out successfully' })
  }

  return NextResponse.json({ error: 'Unsupported action' }, { status: 400 })
}
