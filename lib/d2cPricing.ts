/**
 * Server-Authoritative D2C Pricing Engine
 * File: lib/d2cPricing.ts
 *
 * Resolves commercial pricing per product and market without ever exposing
 * internal manufacturing costs, karigar charges, gold float balances, or supplier details.
 */

import { supabaseAdmin } from './supabaseAdmin'
import { getMarket, formatCurrency, type MarketCode, type CurrencyCode } from './markets'

export interface ResolvedD2CPrice {
  productId: string
  marketCode: MarketCode
  currency: CurrencyCode
  unitPrice: number
  compareAtPrice: number | null
  pricingMode: 'fixed' | 'formula_base'
  effectiveFrom: string
  isAvailable: boolean
  unavailableReason?: string
  taxModel: 'inclusive' | 'exclusive' | 'uncollected'
  taxAmount: number
  taxLabel: string
  formattedPrice: string
}

export interface ConfigurationDelta {
  metalId?: string
  karat?: number | string
  metalTone?: string // 'yellow' | 'white' | 'rose' | 'platinum'
  diamondType?: 'natural' | 'lab_grown' | 'lgd'
  caratSize?: number
  ringSize?: string
  customEngraving?: string
}

/**
 * Resolve authoritatively priced line item for a product in a specified market.
 */
export async function resolveProductMarketPrice(
  productId: string,
  marketCode: MarketCode,
  config?: ConfigurationDelta
): Promise<ResolvedD2CPrice> {
  const market = getMarket(marketCode)
  const nowIso = new Date().toISOString()

  // 1. Query active price from normalized d2c_market_prices table with open or future effective_to
  const { data: priceRows, error: priceErr } = await supabaseAdmin
    .from('d2c_market_prices')
    .select('*')
    .eq('product_id', productId)
    .eq('market_code', market.code)
    .eq('is_active', true)
    .lte('effective_from', nowIso)
    .or(`effective_to.is.null,effective_to.gte.${nowIso}`)
    .order('effective_from', { ascending: false })
    .limit(1)

  // 2. Query product publishing status and basic specs
  const { data: product, error: prodErr } = await supabaseAdmin
    .from('products')
    .select('id, code, name, d2c_status, is_active, is_configurable, karat_pricing, mrp_suggested, trade_price, d2c_details')
    .eq('id', productId)
    .maybeSingle()

  if (prodErr || !product || !product.is_active || product.d2c_status !== 'published') {
    return {
      productId,
      marketCode: market.code,
      currency: market.currency,
      unitPrice: 0,
      compareAtPrice: null,
      pricingMode: 'fixed',
      effectiveFrom: nowIso,
      isAvailable: false,
      unavailableReason: 'This piece is currently not available for order in your region.',
      taxModel: market.taxModel,
      taxAmount: 0,
      taxLabel: market.taxLabel,
      formattedPrice: formatCurrency(0, market.currency),
    }
  }

  let basePrice = 0
  let compareAt: number | null = null
  let pricingMode: 'fixed' | 'formula_base' = 'fixed'
  let effectiveFrom = nowIso

  if (priceRows && priceRows.length > 0) {
    const row = priceRows[0]
    basePrice = Number(row.price) || 0
    compareAt = row.compare_at_price ? Number(row.compare_at_price) : null
    pricingMode = row.pricing_mode as 'fixed' | 'formula_base'
    effectiveFrom = row.effective_from || nowIso
  } else {
    // Fallback if market price row is not yet provisioned:
    // Derive from commercial baseline without leaking internal formula
    // Default baseline anchor: mrp_suggested or trade_price converted to target currency
    const inrBase = Number(product.mrp_suggested || product.trade_price) || 100000
    // Market conversion baseline approximations
    const rates: Record<CurrencyCode, number> = {
      USD: 0.012,
      GBP: 0.0095,
      AUD: 0.018,
      EUR: 0.011,
      INR: 1.0,
    }
    const rawConverted = inrBase * (rates[market.currency] ?? 0.012)
    // Round to standard luxury price endings (e.g. $1,450 or ₹1,25,000)
    basePrice = market.currency === 'INR'
      ? Math.round(rawConverted / 500) * 500
      : Math.round(rawConverted / 10) * 10
  }

  // 3. If configurable, apply valid product-specific delta increments
  let finalUnitPrice = basePrice
  if (config && product.is_configurable !== false) {
    const details = (product.d2c_details || {}) as Record<string, any>
    const allowedMetals = details.allowed_metals as string[] | undefined
    const allowedStones = details.allowed_stones as string[] | undefined

    // Platinum premium adjustment if selected and allowed for this piece
    if (config.metalTone === 'platinum') {
      if (!allowedMetals || allowedMetals.includes('platinum')) {
        finalUnitPrice += Math.round(basePrice * 0.25)
      }
    }
    // Karat adjustment: 18K vs 14K baseline
    if (config.karat === 14 || config.karat === '14K') {
      finalUnitPrice -= Math.round(basePrice * 0.10)
    }
    // Diamond type adjustment: Natural vs Lab-Grown (if allowed for this piece)
    if (config.diamondType === 'natural') {
      if (!allowedStones || allowedStones.includes('natural')) {
        finalUnitPrice += Math.round(basePrice * 1.50)
      }
    }
  }

  // 4. Calculate market tax breakdown
  let taxAmount = 0
  if (market.taxModel === 'inclusive') {
    const net = finalUnitPrice / (1 + market.taxRate)
    taxAmount = Math.round(finalUnitPrice - net)
  } else if (market.taxModel === 'exclusive') {
    taxAmount = Math.round(finalUnitPrice * market.taxRate)
  }

  return {
    productId,
    marketCode: market.code,
    currency: market.currency,
    unitPrice: Math.round(finalUnitPrice),
    compareAtPrice: compareAt ? Math.round(compareAt) : null,
    pricingMode,
    effectiveFrom,
    isAvailable: true,
    taxModel: market.taxModel,
    taxAmount,
    taxLabel: market.taxLabel,
    formattedPrice: formatCurrency(finalUnitPrice, market.currency),
  }
}
