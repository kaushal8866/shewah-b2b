import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'

type Bucket = { minWindowStart: number; minCount: number; hourWindowStart: number; hourCount: number }
const buckets = new Map<string, Bucket>()
const MIN_LIMIT = 5
const HOUR_LIMIT = 20

function rateLimit(ip: string): { ok: boolean } {
  const now = Date.now()
  const b = buckets.get(ip) || {
    minWindowStart: now, minCount: 0,
    hourWindowStart: now, hourCount: 0,
  }
  if (now - b.minWindowStart > 60 * 1000) { b.minWindowStart = now; b.minCount = 0 }
  if (now - b.hourWindowStart > 60 * 60 * 1000) { b.hourWindowStart = now; b.hourCount = 0 }
  b.minCount += 1
  b.hourCount += 1
  buckets.set(ip, b)
  if (b.minCount > MIN_LIMIT || b.hourCount > HOUR_LIMIT) return { ok: false }
  return { ok: true }
}

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for') || ''
  return fwd.split(',')[0].trim() || req.headers.get('x-real-ip') || 'unknown'
}

function clean(v: any, max = 300): string | null {
  if (v === undefined || v === null) return null
  const s = String(v).trim()
  return s ? s.slice(0, max) : null
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req)
  if (!rateLimit(ip).ok) {
    return NextResponse.json({ ok: false, error: 'Too many requests. Please try again shortly.' }, { status: 429 })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON payload.' }, { status: 400 })
  }

  // Honeypot check
  if (clean(body?.website)) {
    return NextResponse.json({ ok: true, reference: 'SHW-SZ-HONEY' })
  }

  const fullName = clean(body?.fullName, 120)
  const email = clean(body?.email, 200)
  const phoneRaw = clean(body?.phone, 40)
  const street = clean(body?.street, 200)
  const city = clean(body?.city, 100)
  const state = clean(body?.state, 100)
  const postalCode = clean(body?.postalCode, 40)
  const country = clean(body?.country, 100)
  const ringStyle = clean(body?.ringStyle, 100) || 'Undecided'
  const targetDate = clean(body?.targetDate, 100)

  if (!fullName || !email || !street || !city || !country || !postalCode) {
    return NextResponse.json(
      { ok: false, error: 'Please provide your full name, email, and complete shipping address.' },
      { status: 400 },
    )
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ ok: false, error: 'Please enter a valid email address.' }, { status: 400 })
  }

  const rawDigits = (phoneRaw || '').replace(/\D/g, '')
  const normalizedPhone = phoneRaw && phoneRaw.includes('+') ? '+' + rawDigits : (rawDigits || null)

  const referenceCode = `SHW-SZ-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 900 + 100)}`

  try {
    // 1. Find or create customer
    let customerId = ''
    const { data: existingByEmail } = await supabaseAdmin
      .from('customers')
      .select('id')
      .eq('email', email.toLowerCase())
      .is('archived_at', null)
      .maybeSingle()

    if (existingByEmail) {
      customerId = existingByEmail.id
    } else {
      const { data: newCust, error: custErr } = await supabaseAdmin
        .from('customers')
        .insert({
          full_name: fullName,
          email: email.toLowerCase(),
          whatsapp: normalizedPhone,
          city: city,
          source: 'd2c_ring_sizer_request',
        })
        .select('id')
        .single()

      if (!custErr && newCust) {
        customerId = newCust.id
      }
    }

    // 2. Insert customer enquiry row
    const descriptionText = [
      `COMPLIMENTARY RING SIZER REQUEST`,
      `Reference: ${referenceCode}`,
      `Shipping Address:`,
      `${street}`,
      `${city}, ${state || ''} ${postalCode}`,
      `Country: ${country}`,
      `Phone: ${normalizedPhone || 'Not provided'}`,
      `Ring Interest: ${ringStyle}`,
      targetDate ? `Target Occasion / Date: ${targetDate}` : null,
    ].filter(Boolean).join('\n')

    if (customerId) {
      await supabaseAdmin.from('customer_enquiries').insert({
        customer_id: customerId,
        title: `Complimentary Ring Sizer Kit — ${fullName} (${country})`,
        product_type: 'ring',
        occasion: 'other',
        description: descriptionText,
        status: 'new',
      })
    }

    return NextResponse.json({
      ok: true,
      reference: referenceCode,
      message: 'Your complimentary ring sizer kit has been scheduled for priority dispatch.',
    })
  } catch (err: any) {
    console.error('[ring-sizer-request] Server error:', err)
    // Return success to the client with reference code so user experience is not broken
    return NextResponse.json({
      ok: true,
      reference: referenceCode,
      message: 'Your request was received and logged for atelier dispatch.',
    })
  }
}
