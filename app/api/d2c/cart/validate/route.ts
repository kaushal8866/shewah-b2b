import { NextRequest, NextResponse } from 'next/server'
import { getMarket, formatCurrency, computeDeliveryEstimate, type MarketCode } from '@/lib/markets'
import { resolveProductMarketPrice } from '@/lib/d2cPricing'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

interface CartItemInput {
  productId: string
  quantity: number
  config?: {
    metalTone?: string
    karat?: number | string
    diamondType?: 'natural' | 'lab_grown' | 'lgd'
    ringSize?: string
    customEngraving?: string
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const rawMarketCode = (body.marketCode || 'US').toUpperCase() as MarketCode
    const destinationCountry = body.destinationCountry ? body.destinationCountry.trim().toUpperCase() : null
    const items: CartItemInput[] = Array.isArray(body.items) ? body.items : []

    // 1. Market Locking Detection
    let activeMarket = getMarket(rawMarketCode)
    let marketMismatch = false
    let correctedMarketCode = activeMarket.code

    if (destinationCountry) {
      const destinationMarket = getMarket(destinationCountry)
      if (destinationMarket.code !== activeMarket.code) {
        marketMismatch = true
        correctedMarketCode = destinationMarket.code
        activeMarket = destinationMarket // Re-lock to destination country's market
      }
    }

    if (items.length === 0) {
      return NextResponse.json({
        isValid: true,
        items: [],
        subtotal: 0,
        taxAmount: 0,
        shippingAmount: 0,
        totalAmount: 0,
        currency: activeMarket.currency,
        marketCode: activeMarket.code,
        marketMismatch,
        correctedMarketCode,
      })
    }

    // 2. Query products and resolve server-authoritative pricing for each item
    let subtotal = 0
    let maxLeadDays = 14
    const validatedItems = []

    for (const item of items) {
      const qty = Math.max(1, Number(item.quantity) || 1)
      const pricing = await resolveProductMarketPrice(item.productId, activeMarket.code, item.config)

      const { data: product } = await supabaseAdmin
        .from('products')
        .select('id, code, name, d2c_title, category, photo_urls, d2c_crafting_lead_days')
        .eq('id', item.productId)
        .maybeSingle()

      if (!product || !pricing.isAvailable) {
        return NextResponse.json({
          isValid: false,
          error: `Item ${item.productId} is no longer available for purchase in this region.`,
        }, { status: 400 })
      }

      const itemLeadDays = product.d2c_crafting_lead_days || 14
      if (itemLeadDays > maxLeadDays) maxLeadDays = itemLeadDays

      const lineTotal = pricing.unitPrice * qty
      subtotal += lineTotal

      validatedItems.push({
        productId: product.id,
        code: product.code,
        name: product.d2c_title || product.name,
        category: product.category,
        photoUrl: product.photo_urls?.[0] || null,
        quantity: qty,
        unitPrice: pricing.unitPrice,
        lineTotal,
        currency: pricing.currency,
        formattedUnitPrice: formatCurrency(pricing.unitPrice, pricing.currency),
        formattedLineTotal: formatCurrency(lineTotal, pricing.currency),
        config: item.config || {},
        taxModel: pricing.taxModel,
        taxAmount: pricing.taxAmount * qty,
      })
    }

    // 3. Calculate tax based on market configuration
    let taxAmount = 0
    if (activeMarket.taxModel === 'inclusive') {
      const net = subtotal / (1 + activeMarket.taxRate)
      taxAmount = Math.round(subtotal - net)
    } else if (activeMarket.taxModel === 'exclusive') {
      taxAmount = Math.round(subtotal * activeMarket.taxRate)
    }

    // 4. Shipping calculation
    const defaultShipping = activeMarket.shippingMethods.find(m => m.isDefault) || activeMarket.shippingMethods[0]
    const shippingAmount = defaultShipping ? defaultShipping.baseCost : 0

    const totalAmount = activeMarket.taxModel === 'exclusive'
      ? subtotal + taxAmount + shippingAmount
      : subtotal + shippingAmount

    // 5. Estimated Delivery Window
    const deliveryWindow = computeDeliveryEstimate(maxLeadDays, activeMarket.code)

    return NextResponse.json({
      isValid: true,
      marketCode: activeMarket.code,
      currency: activeMarket.currency,
      marketMismatch,
      correctedMarketCode,
      items: validatedItems,
      subtotal,
      taxAmount,
      taxLabel: activeMarket.taxLabel,
      taxModel: activeMarket.taxModel,
      shippingAmount,
      shippingName: defaultShipping?.name || 'Express Insured Delivery',
      totalAmount,
      formattedSubtotal: formatCurrency(subtotal, activeMarket.currency),
      formattedTax: formatCurrency(taxAmount, activeMarket.currency),
      formattedShipping: shippingAmount === 0 ? 'Complimentary' : formatCurrency(shippingAmount, activeMarket.currency),
      formattedTotal: formatCurrency(totalAmount, activeMarket.currency),
      estimatedDeliveryWindow: deliveryWindow.formattedRange,
    })
  } catch (err: any) {
    console.error('[POST /api/d2c/cart/validate] Error:', err)
    return NextResponse.json({ error: 'Cart validation failed' }, { status: 500 })
  }
}
