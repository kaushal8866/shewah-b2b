import { NextRequest, NextResponse } from 'next/server'
import { resolveProductMarketPrice } from '@/lib/d2cPricing'
import { getMarket, type MarketCode } from '@/lib/markets'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const { productId, marketCode, config } = body

    if (!productId) {
      return NextResponse.json({ error: 'productId is required' }, { status: 400 })
    }

    const market = getMarket(marketCode)
    const pricing = await resolveProductMarketPrice(productId, market.code, config)

    return NextResponse.json({
      productId,
      market: market.code,
      currency: pricing.currency,
      unitPrice: pricing.unitPrice,
      compareAtPrice: pricing.compareAtPrice,
      formattedPrice: pricing.formattedPrice,
      taxModel: pricing.taxModel,
      taxAmount: pricing.taxAmount,
      taxLabel: pricing.taxLabel,
      isAvailable: pricing.isAvailable,
      unavailableReason: pricing.unavailableReason,
    })
  } catch (err: any) {
    console.error('[POST /api/d2c/price] Error:', err)
    return NextResponse.json({ error: 'Price calculation failed' }, { status: 500 })
  }
}
