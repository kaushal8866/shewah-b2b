import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { notifyNewD2cConsultation } from '@/lib/leadNotify'
import { sendCapiEvent, fbcFromFbclid } from '@/lib/metaCapi'

export const runtime = 'nodejs'

// ── In-memory rate limiter ──────────────────────────────────────────────
type Bucket = { minWindowStart: number; minCount: number; hourWindowStart: number; hourCount: number }
const buckets = new Map<string, Bucket>()
const MIN_LIMIT = 5
const HOUR_LIMIT = 30

function rateLimit(ip: string): { ok: boolean; reason?: string } {
  const now = Date.now()
  const b = buckets.get(ip) || {
    minWindowStart: now, minCount: 0,
    hourWindowStart: now, hourCount: 0,
  }
  if (now - b.minWindowStart  > 60 * 1000)        { b.minWindowStart  = now; b.minCount  = 0 }
  if (now - b.hourWindowStart > 60 * 60 * 1000)   { b.hourWindowStart = now; b.hourCount = 0 }
  b.minCount  += 1
  b.hourCount += 1
  buckets.set(ip, b)
  if (b.minCount  > MIN_LIMIT)  return { ok: false, reason: 'minute' }
  if (b.hourCount > HOUR_LIMIT) return { ok: false, reason: 'hour' }
  return { ok: true }
}

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for') || ''
  const first = fwd.split(',')[0].trim()
  return first || req.headers.get('x-real-ip') || 'unknown'
}

function clean(v: any, max = 500): string | null {
  if (v === undefined || v === null) return null
  const s = String(v).trim()
  if (!s) return null
  return s.slice(0, max)
}

// Map frontend dropdown budgets to min/max numbers
function mapBudget(range: string | null): { min: number | null; max: number | null } {
  if (!range) return { min: null, max: null }
  const cleanRange = range.replace(/₹|,/g, '').trim() // e.g. "50000 - 100000" or "500000+"
  if (cleanRange.includes('+')) {
    const val = Number(cleanRange.replace('+', '').trim())
    return { min: isNaN(val) ? null : val, max: null }
  }
  const parts = cleanRange.split('-').map(x => Number(x.trim()))
  if (parts.length === 2) {
    return {
      min: isNaN(parts[0]) ? null : parts[0],
      max: isNaN(parts[1]) ? null : parts[1]
    }
  }
  return { min: null, max: null }
}

// Normalize dropdown keys to match check constraints
// product_type: 'ring' | 'necklace' | 'earring' | 'pendant' | 'bracelet' | 'bangle' | 'other'
function mapProductType(type: string | null): string {
  if (!type) return 'other'
  const t = type.toLowerCase().trim()
  if (['ring', 'necklace', 'earring', 'pendant', 'bracelet', 'bangle'].includes(t)) return t
  if (t === 'earrings') return 'earring'
  return 'other'
}

// occasion: 'engagement' | 'wedding' | 'birthday' | 'anniversary' | 'gift' | 'self' | 'other'
function mapOccasion(occ: string | null): string {
  if (!occ) return 'other'
  const o = occ.toLowerCase().trim()
  if (['engagement', 'wedding', 'birthday', 'anniversary', 'gift', 'other'].includes(o)) return o
  if (o === 'self-reward') return 'self'
  if (o === 'self') return 'self'
  return 'other'
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req)
  const rl = rateLimit(ip)
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: 'Too many requests. Please try again in a few minutes.' },
      { status: 429 },
    )
  }

  let body: any
  try { body = await req.json() }
  catch { return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 }) }

  // Honeypot
  if (clean(body?.website)) {
    return NextResponse.json({ ok: true })
  }

  const first_name = clean(body?.first_name, 120)
  const city = clean(body?.city, 100)
  const whatsappRaw = clean(body?.whatsapp, 40)
  const email = clean(body?.email, 200)

  if (!first_name || !city || !whatsappRaw) {
    return NextResponse.json(
      { ok: false, error: 'Please fill your name, WhatsApp number, and city.' },
      { status: 400 },
    )
  }

  // Flexible International Phone Check (7 to 15 digits)
  const rawDigits = whatsappRaw.replace(/\D/g, '')
  if (rawDigits.length < 7 || rawDigits.length > 15) {
    return NextResponse.json(
      { ok: false, error: 'Please enter a valid mobile / WhatsApp number (7 to 15 digits).' },
      { status: 400 },
    )
  }

  // Preserve full E.164 / formatted international number
  const normalizedWhatsapp = whatsappRaw.includes('+') ? '+' + rawDigits : rawDigits

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json(
      { ok: false, error: 'That email address doesn\'t look right.' },
      { status: 400 },
    )
  }


  const preferred_contact = clean(body?.preferred_contact, 20) || 'whatsapp'
  const occasionText = clean(body?.occasion, 50)
  const budgetText = clean(body?.budget, 50)
  const typeText = clean(body?.jewellery_type, 50)

  // Step 1: Find or Create Customer
  let customerId = ''
  try {
    // Look up by normalized whatsapp
    const { data: existingByWa } = await supabaseAdmin
      .from('customers')
      .select('id')
      .eq('whatsapp', normalizedWhatsapp)
      .is('archived_at', null)
      .maybeSingle()

    if (existingByWa) {
      customerId = existingByWa.id
    } else if (email) {
      // Look up by email
      const { data: existingByEmail } = await supabaseAdmin
        .from('customers')
        .select('id')
        .eq('email', email.toLowerCase())
        .is('archived_at', null)
        .maybeSingle()
      if (existingByEmail) {
        customerId = existingByEmail.id
      }
    }

    if (!customerId) {
      // Create new customer
      const { data: newCust, error: custErr } = await supabaseAdmin
        .from('customers')
        .insert({
          full_name: first_name,
          whatsapp: normalizedWhatsapp,
          email: email ? email.toLowerCase() : null,
          city: city,
          preferred_contact: ['whatsapp', 'phone', 'email'].includes(preferred_contact) ? preferred_contact : 'whatsapp',
          source: 'website'
        })
        .select('id')
        .single()

      if (custErr || !newCust) {
        console.error('[consultation] Customer creation error:', custErr)
        return NextResponse.json({ ok: false, error: 'Failed to record customer info.' }, { status: 500 })
      }
      customerId = newCust.id
    }
  } catch (err) {
    console.error('[consultation] Customer query exception:', err)
    return NextResponse.json({ ok: false, error: 'Database error during customer processing.' }, { status: 500 })
  }

  // Step 2: Create Customer Enquiry
  const mappedBudgets = mapBudget(budgetText)
  const mappedProduct = mapProductType(typeText)
  const mappedOccasion = mapOccasion(occasionText)

  const enquiryTitle = `Bespoke Consultation — ${typeText || 'Custom'}`
  const descriptionText = `Occasion: ${occasionText || 'N/A'}\nBudget: ${budgetText || 'N/A'}\nPreferred consultation method: ${preferred_contact}`

  const { data: enquiry, error: enqErr } = await supabaseAdmin
    .from('customer_enquiries')
    .insert({
      customer_id: customerId,
      title: enquiryTitle,
      product_type: mappedProduct,
      occasion: mappedOccasion,
      budget_min: mappedBudgets.min,
      budget_max: mappedBudgets.max,
      description: descriptionText,
      status: 'new'
    })
    .select('id, enquiry_number')
    .single()

  if (enqErr || !enquiry) {
    console.error('[consultation] Enquiry creation error:', enqErr)
    return NextResponse.json({ ok: false, error: 'Failed to record your consultation request.' }, { status: 500 })
  }

  const gclid = clean(body?.gclid, 150)

  // Step 3: Write created activity timeline row
  const { error: activityErr } = await supabaseAdmin
    .from('customer_enquiry_activity')
    .insert({
      enquiry_id: enquiry.id,
      actor_id: null,
      type: 'created',
      payload: { 
        enquiry_number: enquiry.enquiry_number, 
        source: 'D2C Consultation Landing Page',
        gclid: gclid || undefined,
      }
    })

  if (activityErr) {
    console.error('[consultation] activity log failure:', activityErr)
  }

  // Step 4: Dispatch internal notifications (email/WhatsApp)
  try {
    await notifyNewD2cConsultation({
      id: enquiry.id,
      full_name: first_name,
      whatsapp: normalizedWhatsapp,
      email: email || null,
      city: city,
      occasion: occasionText || 'N/A',
      budget: budgetText || 'N/A',
      jewellery_type: typeText || 'N/A',
      preferred_contact: preferred_contact
    })
  } catch (notifyErr) {
    console.error('[consultation] Notification failure:', notifyErr)
  }

  // Step 5: Meta Conversions API.
  //
  // The event id is derived from the enquiry id so the browser pixel on
  // /consultation/thank-you can fire the same id and Meta deduplicates the
  // pair. Without that, every lead counts twice and reported cost-per-lead is
  // half the truth.
  //
  // `_fbp` / `_fbc` are read from the request cookies rather than the body:
  // the pixel sets them client-side, and passing them server-side is what
  // makes a server event match as well as a browser one. Awaited, but the
  // sender never throws and times out at 4s.
  const eventId = `lead_${enquiry.id}`
  const capiResult = await sendCapiEvent({
    eventName: 'Lead',
    eventId,
    eventSourceUrl: clean(body?.landing_path, 300) || req.headers.get('referer'),
    user: {
      phone: normalizedWhatsapp,
      email: email || null,
      firstName: first_name,
      city,
      fbp: req.cookies.get('_fbp')?.value || null,
      fbc: req.cookies.get('_fbc')?.value || fbcFromFbclid(clean(body?.fbclid, 200)) || null,
      clientIp: ip,
      userAgent: req.headers.get('user-agent'),
    },
    customData: {
      content_name: typeText || 'Bespoke consultation',
      currency: 'INR',
      // Budget band floor, so Meta can learn which enquiries are worth more.
      value: mappedBudgets.min ?? undefined,
    },
  })
  if (!capiResult.sent && capiResult.error !== 'not-configured') {
    console.error('[consultation] CAPI not delivered:', capiResult.error)
  }

  return NextResponse.json({
    ok: true,
    id: enquiry.id,
    enquiry_number: enquiry.enquiry_number,
    // Returned so the thank-you page fires the browser Lead with the same id.
    event_id: eventId,
  })
}
