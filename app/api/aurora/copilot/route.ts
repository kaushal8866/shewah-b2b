import { NextRequest, NextResponse } from 'next/server'
import { CIOAgent } from '@/lib/aurora/orchestration/agents/CIOAgent'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { query, routePath, productId, cadRequestId, customerId, orderId } = body || {}

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 })
    }

    const result = await CIOAgent.processRequest({
      query: String(query),
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
