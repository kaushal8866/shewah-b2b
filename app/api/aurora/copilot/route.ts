import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { CIOAgent } from '@/lib/aurora/orchestration/agents/CIOAgent'

export const dynamic = 'force-dynamic'

/**
 * AURORA copilot.
 *
 * MASTER ONLY. The agent reads orders, invoices, quotes and partners through
 * `supabaseAdmin` — the service-role client, with RLS bypassed — and answers
 * with consolidated revenue and outstanding-balance figures. That is the same
 * data /cash/pnl and /profitability already restrict to master, so exposing it
 * through a chat box to any admin would route around that boundary.
 *
 * The check lives here rather than relying solely on the middleware matcher.
 * This app has already shipped a fully unauthenticated endpoint (/api/upload)
 * precisely because it sat in the matcher's exclusion list and nobody looked
 * inside the handler.
 */

// Each request is a Gemini call plus possibly an outbound scrape — real money,
// with no ceiling before this. Per-instance on serverless, so it throttles a
// single hot caller rather than enforcing a global quota; a durable counter
// belongs in Postgres if usage grows.
const RATE_LIMIT_MAX = 20
const RATE_LIMIT_WINDOW_MS = 60_000
const hits = new Map<string, { count: number; resetAt: number }>()

function overRateLimit(key: string): boolean {
  const now = Date.now()
  const hit = hits.get(key)
  if (!hit || now > hit.resetAt) {
    hits.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return false
  }
  hit.count += 1
  if (hits.size > 1000) {
    hits.forEach((v, k) => { if (now > v.resetAt) hits.delete(k) })
  }
  return hit.count > RATE_LIMIT_MAX
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!session || user?.role !== 'master') {
    return NextResponse.json(
      { error: 'AURORA is available to the master admin only.' },
      { status: 403 },
    )
  }

  if (overRateLimit(String(user.id))) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait a moment before asking again.' },
      { status: 429 },
    )
  }

  try {
    const body = await req.json()
    const { query, routePath, productId, cadRequestId, customerId, orderId, history } = body || {}

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 })
    }
    // Bound the prompt: an unbounded string is both a cost and an injection
    // surface, and no genuine operator question runs to thousands of chars.
    const trimmed = String(query).slice(0, 2000)

    // Prior turns, so follow-ups resolve. Validated and capped rather than
    // trusted: this is client-supplied and goes straight into a model prompt,
    // so it is both a cost and an injection surface.
    const priorTurns = Array.isArray(history)
      ? history
          .filter((t: any) => t && (t.role === 'user' || t.role === 'assistant') && typeof t.text === 'string')
          .slice(-8)
          .map((t: any) => ({ role: t.role as 'user' | 'assistant', text: t.text.slice(0, 1000) }))
      : []

    const result = await CIOAgent.processRequest({
      query: trimmed,
      history: priorTurns,
      routePath,
      productId,
      cadRequestId,
      customerId,
      orderId,
    })

    return NextResponse.json(result)
  } catch (err: any) {
    // Log the detail, return a generic message — the same posture the rest of
    // the app adopted with lib/sanitizeDbError.
    console.error('[AURORA.copilot] Error:', err)
    return NextResponse.json({ error: 'Could not process that request.' }, { status: 500 })
  }
}
