import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

const DEFAULTS = {
  window_days: 7,
  variance_g: 2.0,
  negative_count: 1,
  unlinked_count: 3,
}

type Thresholds = {
  window_days: number
  variance_g: number
  negative_count: number
  unlinked_count: number
}

type PartnerSummary = {
  partner_id: string
  partner_name: string
  city: string | null
  consumed_total: number
  benchmark_total: number
  variance_total: number
  negative_count: number
  unlinked_count: number
  unlinked_consumed: number
  reasons: string[]
}

async function isAuthorized(req: NextRequest): Promise<boolean> {
  const auth = req.headers.get('authorization') || ''
  const expected = process.env.CRON_SECRET
  if (expected && auth === `Bearer ${expected}`) return true

  const session = await getServerSession(authOptions)
  return (session?.user as any)?.role === 'master'
}

async function loadSettings(): Promise<{ thresholds: Thresholds, emailTo: string, emailFrom: string }> {
  const { data } = await supabaseAdmin
    .from('settings')
    .select('key,value')
    .in('key', [
      'reconciliation_alert_window_days',
      'reconciliation_alert_variance_g',
      'reconciliation_alert_negative_count',
      'reconciliation_alert_unlinked_count',
      'reconciliation_alert_email_to',
      'reconciliation_alert_email_from',
    ])
  const map: Record<string, string> = {}
  for (const r of data || []) map[r.key] = r.value || ''
  const num = (k: string, d: number) => {
    const n = parseFloat(map[k])
    return Number.isFinite(n) && n >= 0 ? n : d
  }
  return {
    thresholds: {
      window_days:    Math.max(1, Math.round(num('reconciliation_alert_window_days', DEFAULTS.window_days))),
      variance_g:     num('reconciliation_alert_variance_g',     DEFAULTS.variance_g),
      negative_count: Math.max(0, Math.round(num('reconciliation_alert_negative_count', DEFAULTS.negative_count))),
      unlinked_count: Math.max(0, Math.round(num('reconciliation_alert_unlinked_count', DEFAULTS.unlinked_count))),
    },
    emailTo:   (map['reconciliation_alert_email_to']   || '').trim(),
    emailFrom: (map['reconciliation_alert_email_from'] || '').trim(),
  }
}

// Today in Asia/Kolkata, formatted YYYY-MM-DD. Matches the schema default so a
// daily run hitting the endpoint at 23:30 IST or 02:00 IST both bucket into
// the same business day.
function istToday(): string {
  const now = new Date()
  const istMs = now.getTime() + 5.5 * 60 * 60 * 1000
  return new Date(istMs).toISOString().split('T')[0]
}

function istDateNDaysAgo(days: number): string {
  const todayIST = istToday()
  const d = new Date(`${todayIST}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().split('T')[0]
}

async function summarisePartner(partnerId: string, sinceISO: string): Promise<Omit<PartnerSummary, 'partner_id' | 'partner_name' | 'city' | 'reasons'>> {
  const { data: txs } = await supabaseAdmin
    .from('material_transactions')
    .select('id, quantity, order_id, creates_negative_balance')
    .eq('manufacturing_partner_id', partnerId)
    .eq('transaction_type', 'consumption')
    .gte('date', sinceISO)

  const list = txs || []
  const orderIds = Array.from(new Set(list.map((t: any) => t.order_id).filter(Boolean)))

  let orderMap: Record<string, any> = {}
  if (orderIds.length) {
    const { data: ords } = await supabaseAdmin
      .from('orders')
      .select('id, gold_weight_estimated, gold_weight_actual')
      .in('id', orderIds)
    orderMap = Object.fromEntries((ords || []).map((o: any) => [o.id, o]))
  }

  const groups: Record<string, { consumed: number }> = {}
  let negativeCount = 0
  let unlinkedCount = 0
  let unlinkedConsumed = 0

  for (const t of list) {
    const qty = Number(t.quantity) || 0
    if (t.creates_negative_balance) negativeCount++
    if (!t.order_id) {
      unlinkedCount++
      unlinkedConsumed += qty
      continue
    }
    const g = groups[t.order_id] ||= { consumed: 0 }
    g.consumed += qty
  }

  let consumedTotal = 0
  let benchmarkTotal = 0
  let varianceTotal = 0
  for (const [orderId, g] of Object.entries(groups)) {
    consumedTotal += g.consumed
    const o = orderMap[orderId]
    const benchmark = o?.gold_weight_actual != null
      ? Number(o.gold_weight_actual)
      : (o?.gold_weight_estimated != null ? Number(o.gold_weight_estimated) : null)
    if (benchmark != null) {
      benchmarkTotal += benchmark
      varianceTotal += g.consumed - benchmark
    }
  }

  return {
    consumed_total: consumedTotal,
    benchmark_total: benchmarkTotal,
    variance_total: varianceTotal,
    negative_count: negativeCount,
    unlinked_count: unlinkedCount,
    unlinked_consumed: unlinkedConsumed,
  }
}

function fmt(n: number, digits = 3) { return Number(n).toFixed(digits) }

function buildMessage(runDate: string, t: Thresholds, flagged: PartnerSummary[], baseUrl: string): string {
  if (!flagged.length) {
    return `Shewah karigar reconciliation — ${runDate}\nAll active karigars are within thresholds over the last ${t.window_days} days. ✓`
  }
  const lines: string[] = []
  lines.push(`Shewah karigar reconciliation — ${runDate}`)
  lines.push(`${flagged.length} karigar${flagged.length === 1 ? '' : 's'} flagged in the last ${t.window_days} day${t.window_days === 1 ? '' : 's'}:`)
  lines.push('')
  for (const p of flagged) {
    const head = `• ${p.partner_name}${p.city ? ` (${p.city})` : ''}`
    const bits: string[] = []
    if (Math.abs(p.variance_total) > 0.001) {
      bits.push(`net variance ${p.variance_total > 0 ? '+' : ''}${fmt(p.variance_total)}g`)
    }
    if (p.negative_count > 0) bits.push(`${p.negative_count} negative-balance row${p.negative_count === 1 ? '' : 's'}`)
    if (p.unlinked_count > 0) bits.push(`${p.unlinked_count} unlinked (${fmt(p.unlinked_consumed)}g)`)
    lines.push(head)
    if (bits.length) lines.push(`   ${bits.join(' · ')}`)
    lines.push(`   ${baseUrl}/manufacturing/partners/${p.partner_id}/reconciliation`)
  }
  lines.push('')
  lines.push(`Thresholds: variance ≥${fmt(t.variance_g, 2)}g · neg ≥${t.negative_count} · unlinked ≥${t.unlinked_count}`)
  return lines.join('\n')
}

type DispatchResult = { channel: string | null, sent: boolean, error: string | null }

async function dispatchEmail(
  subject: string,
  body: string,
  to: string,
  from: string,
): Promise<DispatchResult> {
  const apiKey = process.env.RESEND_API_KEY
  const recipients = to.split(/[,;\s]+/).map(s => s.trim()).filter(Boolean)
  if (!apiKey || !from || recipients.length === 0) {
    return { channel: null, sent: false, error: null } // dispatch not configured
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from,
        to: recipients,
        subject,
        text: body,
      }),
    })
    if (!res.ok) {
      const txt = await res.text().catch(() => '')
      return { channel: 'email', sent: false, error: `Resend ${res.status}: ${txt.slice(0, 200)}` }
    }
    return { channel: 'email', sent: true, error: null }
  } catch (e: any) {
    return { channel: 'email', sent: false, error: e?.message || 'network error' }
  }
}

async function runDigest(req: NextRequest) {
  const { thresholds: t, emailTo, emailFrom } = await loadSettings()

  const sinceISO = istDateNDaysAgo(t.window_days)

  const { data: partners, error: partnersErr } = await supabaseAdmin
    .from('manufacturing_partners')
    .select('id, name, city, status')
    .or('status.eq.active,status.is.null')
    .order('name')

  if (partnersErr) {
    return NextResponse.json({ error: partnersErr.message }, { status: 500 })
  }

  const summaries: PartnerSummary[] = []
  for (const p of partners || []) {
    const s = await summarisePartner(p.id, sinceISO)
    const reasons: string[] = []
    if (Math.abs(s.variance_total) >= t.variance_g) reasons.push('variance')
    if (s.negative_count >= t.negative_count && t.negative_count > 0) reasons.push('negative_balance')
    if (s.unlinked_count >= t.unlinked_count && t.unlinked_count > 0) reasons.push('unlinked')

    summaries.push({
      partner_id: p.id,
      partner_name: p.name,
      city: p.city ?? null,
      ...s,
      reasons,
    })
  }

  const flagged = summaries.filter(s => s.reasons.length > 0)
  const runDate = istToday()

  // Make today's snapshot idempotent: clear any stale rows for this run_date
  // (e.g. partners that were flagged earlier today but no longer trip any
  // threshold) before inserting the current set.
  const { error: delErr } = await supabaseAdmin
    .from('reconciliation_alerts')
    .delete()
    .eq('run_date', runDate)
  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 })
  }

  const proto = req.headers.get('x-forwarded-proto') || 'https'
  const host = req.headers.get('host') || ''
  const baseUrl = process.env.NEXTAUTH_URL || (host ? `${proto}://${host}` : '')
  const message = buildMessage(runDate, t, flagged, baseUrl)

  // Dispatch the digest only when there is something to report.
  let dispatch: DispatchResult = { channel: null, sent: false, error: null }
  if (flagged.length > 0) {
    dispatch = await dispatchEmail(
      `Shewah karigar reconciliation — ${runDate} (${flagged.length} flagged)`,
      message,
      emailTo,
      emailFrom,
    )
  }

  if (flagged.length > 0) {
    const notifiedAt = dispatch.sent ? new Date().toISOString() : null
    const rows = flagged.map(p => ({
      partner_id: p.partner_id,
      run_date: runDate,
      window_days: t.window_days,
      consumed_total: p.consumed_total,
      benchmark_total: p.benchmark_total,
      variance_total: p.variance_total,
      negative_count: p.negative_count,
      unlinked_count: p.unlinked_count,
      unlinked_consumed: p.unlinked_consumed,
      triggered_reasons: p.reasons,
      notified_at: notifiedAt,
      notify_channel: dispatch.channel,
      notify_error: dispatch.error,
    }))
    const { error: insErr } = await supabaseAdmin.from('reconciliation_alerts').insert(rows)
    if (insErr) {
      return NextResponse.json({ error: insErr.message }, { status: 500 })
    }
  }

  return NextResponse.json({
    run_date: runDate,
    window_days: t.window_days,
    thresholds: t,
    partners_scanned: summaries.length,
    partners_flagged: flagged.length,
    flagged,
    message,
    dispatch: {
      configured: !!process.env.RESEND_API_KEY && !!emailFrom && !!emailTo,
      ...dispatch,
      recipients: emailTo,
    },
  })
}

export async function POST(req: NextRequest) {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return runDigest(req)
}

export async function GET(req: NextRequest) {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return runDigest(req)
}
