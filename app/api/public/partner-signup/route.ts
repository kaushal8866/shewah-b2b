import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { notifyNewPartnerLead } from '@/lib/leadNotify'
import { LANDING_VARIANT_COOKIE, isLandingVariant } from '@/lib/landingVariant'

export const runtime = 'nodejs'

// ── In-memory rate limiter ──────────────────────────────────────────────
// Per-IP token bucket. Good enough first-pass guard for a low-volume
// public form — the table-level uniqueness check below is the real
// backstop against duplicate spam.
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

function hashIp(ip: string): string {
  // No literal fallback: a salt published in the source would let anyone
  // recompute the hash for a given IP and de-anonymise stored lead records.
  const salt = process.env.NEXTAUTH_SECRET
  if (!salt) throw new Error('NEXTAUTH_SECRET is not set — cannot hash lead IPs.')
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex').slice(0, 32)
}

function clean(v: any, max = 500): string | null {
  if (v === undefined || v === null) return null
  const s = String(v).trim()
  if (!s) return null
  return s.slice(0, max)
}

const ALLOWED_VOLUMES = new Set(['', '<5', '5-20', '20-50', '50+'])

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

  // Honeypot — bots fill this; humans never see it.
  if (clean(body?.website)) {
    // Pretend success so the bot doesn't retry.
    return NextResponse.json({ ok: true })
  }

  const full_name      = clean(body?.full_name,  120)
  const city           = clean(body?.city,       100)
  const whatsapp       = clean(body?.whatsapp,   40)
  // Step-2 / optional fields
  const store_name     = clean(body?.store_name, 200)
  const monthly_volume = clean(body?.monthly_volume, 40) || ''
  if (!full_name || !city || !whatsapp) {
    return NextResponse.json(
      { ok: false, error: 'Please fill your name, WhatsApp number and city.' },
      { status: 400 },
    )
  }
  // Strict India 10-digit phone (allow optional +91 / 91 / 0 prefix).
  const validIndian = (raw: string): boolean => {
    const d10 = raw.replace(/\D/g, '').replace(/^(0|91)/, '')
    return d10.length === 10 && /^[6-9]/.test(d10)
  }
  if (!validIndian(whatsapp)) {
    return NextResponse.json(
      { ok: false, error: 'Please enter a valid 10-digit Indian WhatsApp number.' },
      { status: 400 },
    )
  }
  // Phone is now optional; default to the WhatsApp number when omitted.
  const phoneRaw = clean(body?.phone, 40)
  if (phoneRaw && !validIndian(phoneRaw)) {
    return NextResponse.json(
      { ok: false, error: 'Please enter a valid 10-digit phone number, or leave it blank.' },
      { status: 400 },
    )
  }
  const phone = phoneRaw || whatsapp

  if (monthly_volume && !ALLOWED_VOLUMES.has(monthly_volume)) {
    return NextResponse.json({ ok: false, error: 'Invalid volume choice.' }, { status: 400 })
  }
  const email = clean(body?.email, 200)
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json(
      { ok: false, error: 'That email address doesn\'t look right.' },
      { status: 400 },
    )
  }

  // Task 102 — record the A/B variant the visitor saw. Trust the cookie set
  // by middleware first (server-controlled), fall back to the body field
  // sent by LeadForm if the cookie didn't survive (e.g. some embedded
  // browsers strip cookies on the same request that sets them). A null
  // value means we couldn't attribute — those rows are excluded from the
  // variant counts on /partners/leads.
  const cookieVariant = req.cookies.get(LANDING_VARIANT_COOKIE)?.value
  const bodyVariant   = clean(body?.landing_variant, 40)
  const landing_variant =
    isLandingVariant(cookieVariant) ? cookieVariant
    : isLandingVariant(bodyVariant) ? bodyVariant
    : null

  const row = {
    full_name,
    store_name,
    city,
    phone,
    whatsapp,
    email,
    gst_number:     clean(body?.gst_number,   40),
    monthly_volume: monthly_volume || null,
    note:           clean(body?.note,         2000),
    utm_source:     clean(body?.utm_source,   120),
    utm_medium:     clean(body?.utm_medium,   120),
    utm_campaign:   clean(body?.utm_campaign, 200),
    utm_content:    clean(body?.utm_content,  200),
    utm_term:       clean(body?.utm_term,     200),
    referrer:       clean(body?.referrer,     500),
    landing_path:   clean(body?.landing_path, 500),
    landing_variant,
    user_agent:     clean(req.headers.get('user-agent'), 500),
    ip_hash:        hashIp(ip),
    status:         'new',
  }

  const { data: inserted, error } = await supabaseAdmin
    .from('partner_signups')
    .insert(row)
    .select('id')
    .single()

  if (error || !inserted) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message?.includes('relation') && error?.message?.includes('does not exist')
          ? 'Lead capture is not yet provisioned. Please email us directly while we fix this.'
          : 'Could not save your details. Please try again.',
      },
      { status: 500 },
    )
  }

  // Fire-and-await ops notifications. We capture the per-channel outcome
  // back onto the lead row so the inbox can show what got through.
  const notify = await notifyNewPartnerLead({ id: inserted.id, ...row })

  await supabaseAdmin
    .from('partner_signups')
    .update({
      email_dispatch:    notify.email,
      whatsapp_dispatch: notify.whatsapp,
    })
    .eq('id', inserted.id)

  return NextResponse.json({ ok: true, id: inserted.id })
}
