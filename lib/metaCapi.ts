import crypto from 'crypto'

/**
 * Meta Conversions API — server-side event delivery.
 *
 * Why this exists: the browser pixel alone loses a large share of conversions
 * to ad blockers, ITP and iOS tracking prompts, and it cannot see the moment
 * that actually matters here — a WhatsApp conversation turning into an order,
 * which happens entirely off-site. Without server events Meta optimises toward
 * cheap clicks instead of customers.
 *
 * Safety properties, in order of importance:
 *   1. Never throws. A Meta outage must not fail a lead submission.
 *   2. No-ops when unconfigured, so the app runs unchanged without credentials.
 *   3. Never logs raw PII — only hashes leave this module.
 *
 * Environment (add to .env.local; nothing sends until the first two are set):
 *
 *   META_PIXEL_ID            Same id already in app/layout.tsx — 1809742277070832
 *   META_CAPI_ACCESS_TOKEN   Events Manager > your pixel > Settings >
 *                            Conversions API > Generate access token.
 *                            Treat as a secret; it can write to your pixel.
 *   META_CAPI_TEST_EVENT_CODE  Optional. Set while verifying in the Test Events
 *                            tab, then REMOVE IT — events sent with a test code
 *                            are excluded from optimisation and reporting.
 */

const API_VERSION = 'v20.0'

/** Meta requires SHA-256 of normalised values for all user identifiers. */
function hash(value: string | null | undefined): string | undefined {
  if (!value) return undefined
  const normalised = value.trim().toLowerCase()
  if (!normalised) return undefined
  return crypto.createHash('sha256').update(normalised).digest('hex')
}

/**
 * Phone must be digits only, including country code, before hashing.
 * Indian numbers arrive in several shapes (0-prefixed, +91, bare 10-digit).
 */
function hashPhone(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined
  let digits = String(raw).replace(/\D/g, '')
  if (!digits) return undefined
  digits = digits.replace(/^0+/, '')
  if (digits.length === 10) digits = `91${digits}`
  return crypto.createHash('sha256').update(digits).digest('hex')
}

export type CapiUser = {
  email?: string | null
  phone?: string | null
  firstName?: string | null
  city?: string | null
  /** `_fbp` cookie — set by the browser pixel. Raw, not hashed. */
  fbp?: string | null
  /** `_fbc` cookie, or fbclid rebuilt into fbc form. Raw, not hashed. */
  fbc?: string | null
  clientIp?: string | null
  userAgent?: string | null
}

export type CapiEvent = {
  eventName:
    | 'Lead'                  // D2C bespoke enquiry — what the ring campaign optimises on
    | 'CompleteRegistration'  // B2B partner signup — deliberately a different event
    | 'Contact'
    | 'Schedule'
    | 'ViewContent'
    | 'InitiateCheckout'
    | 'Purchase'
  /**
   * Must match the browser pixel's eventID for the same action, or Meta counts
   * the conversion twice and every reported cost-per-lead is half the truth.
   */
  eventId: string
  eventSourceUrl?: string | null
  user: CapiUser
  customData?: Record<string, unknown>
  /** Unix seconds. Defaults to now; Meta rejects events older than 7 days. */
  eventTime?: number
}

export function isCapiConfigured(): boolean {
  return Boolean(process.env.META_CAPI_ACCESS_TOKEN && process.env.META_PIXEL_ID)
}

/**
 * Build the `_fbc` value Meta expects when only an `fbclid` is available.
 * Format: fb.1.<timestamp-ms>.<fbclid>
 */
export function fbcFromFbclid(fbclid: string | null | undefined, createdAtMs = Date.now()): string | undefined {
  if (!fbclid) return undefined
  return `fb.1.${createdAtMs}.${fbclid}`
}

/**
 * Fire-and-forget. Awaiting is optional — callers should not block a user
 * response on Meta's round trip.
 */
export async function sendCapiEvent(event: CapiEvent): Promise<{ sent: boolean; error?: string }> {
  const pixelId = process.env.META_PIXEL_ID
  const token = process.env.META_CAPI_ACCESS_TOKEN

  if (!pixelId || !token) {
    return { sent: false, error: 'not-configured' }
  }

  const u = event.user
  const userData: Record<string, unknown> = {
    em: hash(u.email),
    ph: hashPhone(u.phone),
    fn: hash(u.firstName),
    ct: hash(u.city),
    country: hash('in'),
    fbp: u.fbp || undefined,
    fbc: u.fbc || undefined,
    client_ip_address: u.clientIp || undefined,
    client_user_agent: u.userAgent || undefined,
  }
  for (const k of Object.keys(userData)) {
    if (userData[k] === undefined) delete userData[k]
  }

  const payload: Record<string, unknown> = {
    data: [
      {
        event_name: event.eventName,
        event_time: event.eventTime ?? Math.floor(Date.now() / 1000),
        event_id: event.eventId,
        action_source: 'website',
        event_source_url: event.eventSourceUrl || undefined,
        user_data: userData,
        custom_data: event.customData || undefined,
      },
    ],
  }
  // Only present while verifying in Events Manager; unset it in production.
  if (process.env.META_CAPI_TEST_EVENT_CODE) {
    payload.test_event_code = process.env.META_CAPI_TEST_EVENT_CODE
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/${API_VERSION}/${pixelId}/events?access_token=${encodeURIComponent(token)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        // Meta occasionally hangs; a lead must never wait on it.
        signal: AbortSignal.timeout(4000),
      },
    )

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      // Body may echo back hashed identifiers only — safe to log.
      console.error('[meta-capi] rejected', res.status, body.slice(0, 400))
      return { sent: false, error: `http-${res.status}` }
    }
    return { sent: true }
  } catch (err: any) {
    console.error('[meta-capi] send failed:', err?.message || err)
    return { sent: false, error: err?.message || 'unknown' }
  }
}
