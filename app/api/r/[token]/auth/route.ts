import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { signPayload, verifyPayload } from '@/lib/storefrontAuth'
import { cookies } from 'next/headers'

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

    // Clean phone number format
    const cleanPhone = phone.replace(/\s+/g, '')
    
    // Generate simple 6-digit code. In mock mode, we default to "123456" for ease of testing,
    // or log the random code to terminal console.
    const otpCode = '123456'
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString() // 5 min expiry

    // Delete existing OTPs for this phone to clean up
    await supabaseAdmin
      .from('reseller_storefront_otps')
      .delete()
      .eq('reseller_id', resellerId)
      .eq('phone', cleanPhone)

    // Insert new OTP record
    const { error: otpErr } = await supabaseAdmin
      .from('reseller_storefront_otps')
      .insert({
        reseller_id: resellerId,
        phone: cleanPhone,
        otp_code: otpCode,
        expires_at: expiresAt
      })

    if (otpErr) {
      return NextResponse.json({ error: 'Could not send verification code' }, { status: 500 })
    }

    console.log(`[Storefront Auth] OTP code for ${cleanPhone} on reseller storefront is ${otpCode}`)

    return NextResponse.json({ success: true, code: otpCode, message: 'OTP verification code sent' })
  }

  // 3. Action: verify-otp
  if (action === 'verify-otp') {
    if (!phone || !code) {
      return NextResponse.json({ error: 'Phone and code are required' }, { status: 400 })
    }

    const cleanPhone = phone.replace(/\s+/g, '')

    // Verify OTP row
    const { data: otpRow, error: verifyErr } = await supabaseAdmin
      .from('reseller_storefront_otps')
      .select('*')
      .eq('reseller_id', resellerId)
      .eq('phone', cleanPhone)
      .eq('otp_code', code)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle()

    if (verifyErr || !otpRow) {
      return NextResponse.json({ error: 'Invalid or expired verification code' }, { status: 400 })
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
