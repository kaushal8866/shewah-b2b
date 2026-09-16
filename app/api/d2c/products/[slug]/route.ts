import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getMarket, computeDeliveryEstimate, type MarketCode } from '@/lib/markets'
import { resolveProductMarketPrice } from '@/lib/d2cPricing'

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const rawSlug = params.slug?.toLowerCase().trim()
    const { searchParams } = new URL(req.url)
    const marketParam = (searchParams.get('market') || 'US').toUpperCase() as MarketCode
    const market = getMarket(marketParam)

    // 1. Query by direct slug or fallback code
    let { data: product, error } = await supabaseAdmin
      .from('products')
      .select('*')
      .or(`slug.eq.${rawSlug},code.ilike.${rawSlug}`)
      .eq('is_active', true)
      .eq('d2c_status', 'published')
      .maybeSingle()

    // 2. If not found, check product_slug_redirects table for renamed slugs
    if (!product) {
      const { data: redirectRow } = await supabaseAdmin
        .from('product_slug_redirects')
        .select('product_id')
        .eq('old_slug', rawSlug)
        .maybeSingle()

      if (redirectRow?.product_id) {
        const { data: redirectedProd } = await supabaseAdmin
          .from('products')
          .select('*')
          .eq('id', redirectRow.product_id)
          .eq('is_active', true)
          .eq('d2c_status', 'published')
          .maybeSingle()
        product = redirectedProd
      }
    }

    if (!product) {
      return NextResponse.json({ error: 'Product not found or unavailable in D2C' }, { status: 404 })
    }

    // 3. Resolve active market pricing
    const pricing = await resolveProductMarketPrice(product.id, market.code)

    // 4. Determine product-specific configuration schema
    const isRing = (product.category || '').toLowerCase().includes('ring')
    const details = (product.d2c_details || {}) as Record<string, any>

    const allMetals = [
      { id: '18k_yellow', name: '18K Yellow Gold', tone: 'yellow', karat: 18, colorHex: '#E5C483' },
      { id: '18k_white',  name: '18K White Gold',  tone: 'white',  karat: 18, colorHex: '#E8E8E8' },
      { id: '18k_rose',   name: '18K Rose Gold',   tone: 'rose',   karat: 18, colorHex: '#E8B4B8' },
      { id: 'platinum',   name: '950 Platinum',    tone: 'platinum', karat: 'Platinum', colorHex: '#D8D8D8' },
    ]

    const allStones = [
      { id: 'lgd',     name: 'Lab-Grown Diamond (IGI Certified)', type: 'lab_grown' },
      { id: 'natural', name: 'Natural Diamond (GIA Certified)',   type: 'natural' },
    ]

    // Respect product-specific restrictions from d2c_details if defined
    const allowedMetals = Array.isArray(details.allowed_metals) && details.allowed_metals.length > 0
      ? allMetals.filter(m => details.allowed_metals.includes(m.id))
      : allMetals

    const allowedStones = Array.isArray(details.allowed_stones) && details.allowed_stones.length > 0
      ? allStones.filter(s => details.allowed_stones.includes(s.id))
      : allStones

    const availableSizes = Array.isArray(details.sizes) && details.sizes.length > 0
      ? details.sizes
      : (isRing ? ['US 4', 'US 4.5', 'US 5', 'US 5.5', 'US 6', 'US 6.5', 'US 7', 'US 7.5', 'US 8', 'US 8.5', 'US 9'] : [])

    // 5. Compute delivery window estimate
    const leadDays = product.d2c_crafting_lead_days || 14
    const deliveryEstimate = computeDeliveryEstimate(leadDays, market.code)

    const isStandardReturn = product.return_policy_type === 'standard'

    const responseData = {
      id: product.id,
      code: product.code,
      name: product.d2c_title || product.name,
      slug: product.slug || product.code.toLowerCase(),
      subtitle: product.d2c_subtitle || 'Bespoke Craftsmanship • Antwerp Cut Diamonds',
      description: product.d2c_description || product.description || 'An exquisite masterwork hand-crafted in solid gold.',
      category: product.category,
      photoUrls: product.photo_urls || [],
      primaryPhotoUrl: product.photo_urls?.[0] || null,
      craftingLeadDays: leadDays,
      estimatedDeliveryWindow: deliveryEstimate.formattedRange,
      returnPolicy: {
        type: product.return_policy_type || 'made_to_order',
        windowDays: product.return_window_days ?? (isStandardReturn ? 14 : 0),
        eligible: product.return_eligible ?? isStandardReturn,
      },
      specifications: {
        approxGoldWeight: product.gold_weight_18k || product.gold_weight_g || null,
        diamondWeightCarats: product.diamond_weight || null,
        diamondShape: product.diamond_shape || 'Round Brilliant',
        diamondColor: product.diamond_color || 'F-G',
        diamondClarity: product.diamond_quality || 'VS',
        hallmark: 'BIS Hallmark / Solid 18K Gold',
        certification: 'IGI / GIA Certified Solitaire',
      },
      configurationSchema: {
        isConfigurable: product.is_configurable ?? true,
        metals: allowedMetals,
        stones: allowedStones,
        sizes: availableSizes,
        isRing,
      },
      price: {
        amount: pricing.unitPrice,
        compareAt: pricing.compareAtPrice,
        currency: pricing.currency,
        formatted: pricing.formattedPrice,
        taxLabel: pricing.taxLabel,
        isAvailable: pricing.isAvailable,
      },
      market: market.code,
    }

    return NextResponse.json(responseData)
  } catch (err: any) {
    console.error('[GET /api/d2c/products/[slug]] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
