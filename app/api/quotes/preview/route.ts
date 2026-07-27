import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { computeQuoteItem, computeQuoteTotals } from '@/lib/quoteCompute'
import { DEFAULT_QUOTE_MARGIN_PCT, DEFAULT_QUOTE_GST_RATE_PCT } from '@/lib/quoteDefaults'

export const dynamic = 'force-dynamic'

// POST /api/quotes/preview
// Stateless calculator that returns live quote cost calculations.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session || (role !== 'master' && role !== 'sub')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const items = Array.isArray(body.items) ? body.items : []
  // Coalesce BEFORE converting: Number(undefined) is NaN, not nullish, so
  // `Number(body.x) ?? DEFAULT` always kept the NaN and never fell back.
  const marginPct = Number(body.margin_pct ?? DEFAULT_QUOTE_MARGIN_PCT)
  const gstRatePct = Number(body.gst_rate_pct ?? DEFAULT_QUOTE_GST_RATE_PCT)
  const gstTreatment = body.gst_treatment || 'exclusive'

  const computedItems = items.map((item: any, index: number) => {
    const computed = computeQuoteItem({
      gross_gold_weight_g: Number(item.gross_gold_weight_g) || 0,
      karat: item.karat,
      gold_rate_24k: Number(item.gold_rate_24k) || 0,
      labour_rate_per_g: Number(item.labour_rate_per_g) || 0,
      diamonds: item.diamonds || [],
      making_charges: Number(item.making_charges) || 0,
      hallmarking: Number(item.hallmarking) || 0,
      other_charges: Number(item.other_charges) || 0,
      quantity: Number(item.quantity) || 1,
      metal_weights: item.metal_weights || null,
    }, marginPct)

    return {
      ...item,
      position: index + 1,
      net_24kt_weight_g: computed.net_24kt_weight_g,
      labour_total: computed.labour_total,
      diamond_cost_total: computed.diamond_cost_total,
      unit_cogs: computed.unit_cogs,
      unit_trade: computed.unit_trade,
      line_cogs: computed.line_cogs,
      line_trade: computed.line_trade,
      line_total: computed.line_total,
    }
  })

  const totals = computeQuoteTotals(computedItems, gstTreatment, gstRatePct)

  return NextResponse.json({
    items: computedItems,
    subtotal: totals.subtotal,
    gst_amount: totals.gst_amount,
    grand_total: totals.grand_total,
  })
}
