import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// ============================================================================
// Inbound WhatsApp webhook (Task 40)
// ----------------------------------------------------------------------------
// The outbound CAD-revision ping sent to the design team includes the line:
//   Reply "ACK <order#>" to mark this revision as acknowledged.
//
// When the design team replies, the WhatsApp gateway forwards the message
// here. We parse `ACK <order#>` (case-insensitive, leading/trailing junk OK),
// look up the order, find the latest unacknowledged `revision_request` row in
// `cad_revisions` for that order's CAD request, and stamp `acknowledged_at`.
//
// Auth: if a `whatsapp_inbound_token` setting is configured, the request must
// carry it as `Authorization: Bearer <token>`. If empty (default), we skip
// auth so the route works in dev. We additionally only accept replies from
// the configured shop `whatsapp_number` to prevent random retailers from
// acknowledging revisions on the team's behalf.
// ============================================================================

type InboundPayload = {
  // The sender's phone number (digits, with or without +). Normalized below.
  from?: string
  phone?: string
  sender?: string
  // The message body. Several common gateway field names accepted.
  message?: string
  body?: string
  text?: string
}

function pickString(...vals: any[]): string {
  for (const v of vals) {
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return ''
}

function digits(s: string): string {
  return (s || '').replace(/\D/g, '')
}

function parseAckCommand(message: string): string | null {
  // Accept: "ACK ORD-001", "ack #ORD-001", "Ack: ord-001", etc.
  const m = message.match(/\back\b[\s:#-]*([A-Za-z0-9_\-\/]+)/i)
  return m ? m[1].trim() : null
}

export async function POST(req: Request) {
  // -- Load relevant settings ------------------------------------------------
  const { data: settingRows } = await supabaseAdmin
    .from('settings')
    .select('key, value')
    .in('key', ['whatsapp_inbound_token', 'whatsapp_number', 'whatsapp_notifications_enabled'])
  const cfg: Record<string, string> = {}
  for (const row of settingRows || []) cfg[(row as any).key] = (row as any).value || ''

  if ((cfg.whatsapp_notifications_enabled || 'true').toLowerCase() === 'false') {
    return NextResponse.json({ ok: false, reason: 'globally_disabled' }, { status: 200 })
  }

  // -- Verify bearer token if configured -------------------------------------
  const expectedToken = (cfg.whatsapp_inbound_token || '').trim()
  if (expectedToken) {
    const auth = req.headers.get('authorization') || ''
    const presented = auth.toLowerCase().startsWith('bearer ')
      ? auth.slice(7).trim()
      : ''
    if (presented !== expectedToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  // -- Parse body ------------------------------------------------------------
  let body: InboundPayload
  try { body = (await req.json()) as InboundPayload } catch { body = {} }

  const message = pickString(body.message, body.body, body.text)
  const fromRaw = pickString(body.from, body.phone, body.sender)
  if (!message) {
    return NextResponse.json({ error: 'Missing message' }, { status: 400 })
  }

  // -- Verify sender matches the configured shop number ----------------------
  // Compare on the trailing 10 digits to be tolerant of country-code prefixes.
  const shopDigits = digits(cfg.whatsapp_number || '')
  const fromDigits = digits(fromRaw)
  if (shopDigits && fromDigits) {
    const tail = (s: string) => s.slice(-10)
    if (tail(shopDigits) !== tail(fromDigits)) {
      return NextResponse.json(
        { ok: false, reason: 'sender_not_authorized' },
        { status: 200 },
      )
    }
  }

  // -- Parse ACK <order#> ----------------------------------------------------
  const orderRef = parseAckCommand(message)
  if (!orderRef) {
    return NextResponse.json(
      { ok: false, reason: 'no_ack_command' },
      { status: 200 },
    )
  }

  // -- Resolve order ---------------------------------------------------------
  const { data: order, error: orderErr } = await supabaseAdmin
    .from('orders')
    .select('id, order_number, cad_request_id')
    .eq('order_number', orderRef)
    .maybeSingle()
  if (orderErr) {
    console.error('[whatsapp:inbound] order lookup failed', orderErr.message)
    return NextResponse.json({ error: orderErr.message }, { status: 500 })
  }
  if (!order || !order.cad_request_id) {
    return NextResponse.json(
      { ok: false, reason: 'order_or_cad_not_found', orderRef },
      { status: 200 },
    )
  }

  // -- Find the latest unacknowledged revision_request row -------------------
  const { data: pending, error: revErr } = await supabaseAdmin
    .from('cad_revisions')
    .select('id, created_at, acknowledged_at')
    .eq('cad_request_id', order.cad_request_id)
    .eq('kind', 'revision_request')
    .is('acknowledged_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (revErr) {
    console.error('[whatsapp:inbound] revision lookup failed', revErr.message)
    return NextResponse.json({ error: revErr.message }, { status: 500 })
  }
  if (!pending) {
    return NextResponse.json(
      { ok: false, reason: 'no_pending_revision', orderRef },
      { status: 200 },
    )
  }

  const ackedAt = new Date().toISOString()
  const { error: updErr } = await supabaseAdmin
    .from('cad_revisions')
    .update({ acknowledged_at: ackedAt })
    .eq('id', pending.id)
  if (updErr) {
    console.error('[whatsapp:inbound] ack update failed', updErr.message)
    return NextResponse.json({ error: updErr.message }, { status: 500 })
  }

  console.log('[whatsapp:inbound] revision acknowledged', {
    orderRef,
    revisionId: pending.id,
    ackedAt,
  })

  return NextResponse.json({
    ok: true,
    orderRef,
    revisionId: pending.id,
    acknowledged_at: ackedAt,
  })
}

// Some WhatsApp gateways (e.g. Meta Cloud API) verify the webhook with a GET
// challenge. Echo back a `hub.challenge` query param if present so the route
// can be plugged into those flows without extra wiring.
export async function GET(req: Request) {
  const url = new URL(req.url)
  const challenge = url.searchParams.get('hub.challenge')
  if (challenge) return new NextResponse(challenge, { status: 200 })
  return NextResponse.json({ ok: true })
}
