import { NextRequest, NextResponse } from 'next/server'
import { CIOAgent } from '@/lib/aurora/orchestration/agents/CIOAgent'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { query, routePath, productId, cadRequestId, customerId, orderId, history } = body || {}

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 })
    }

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
    console.error('[AURORA.copilot] Error:', err)
    return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 })
  }
}
