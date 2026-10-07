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

    // 6. Resolve Set / Suite hierarchy if applicable
    let setInfo: any = null
    let parentSetInfo: any = null

    if (details.is_set && Array.isArray(details.component_codes) && details.component_codes.length > 0) {
      const { data: componentProds } = await supabaseAdmin
        .from('products')
        .select('*')
        .in('code', details.component_codes)
        .eq('is_active', true)
        .eq('d2c_status', 'published')

      if (componentProds && componentProds.length > 0) {
        const componentsWithPricing = await Promise.all(
          componentProds.map(async (c) => {
            const cPricing = await resolveProductMarketPrice(c.id, market.code)
            const cDetails = (c.d2c_details || {}) as Record<string, any>
            // Filter out any internal manufacturer screenshot URLs from component photos
            const cleanComponentPhotos = (c.photo_urls || []).map((u: string) =>
              u.includes('Screenshot_2026-07-10') || u.includes('e0s3em')
                ? 'https://res.cloudinary.com/ddnlacdta/image/upload/v1782577185/ose19027_aepd7a.jpg'
                : u
            )
            const rawCompGold = c.gold_weight_18k || c.gold_weight_g
            const compGold = rawCompGold ? Number(Number(rawCompGold).toFixed(1)) : (c.code.includes('PEND') ? 4.5 : 4.1)
            const compDiamond = c.code.includes('PEND') ? 1.31 : c.code.includes('EARR') ? 1.10 : (c.diamond_weight || null)

            return {
          id: c.id,
          code: c.code,
          name: c.d2c_title || c.name,
          slug: c.slug || c.code.toLowerCase(),
          subtitle: c.d2c_subtitle || '',
          category: c.category,
          role: cDetails.component_type || (c.category === 'earrings' ? 'earrings' : 'pendant'),
          roleLabel: cDetails.component_label || (c.code.includes('PEND') ? 'Pendant & Chain' : 'Matched Drop Earrings'),
          photoUrls: cleanComponentPhotos.length > 0 ? cleanComponentPhotos : ['https://res.cloudinary.com/ddnlacdta/image/upload/v1782577185/ose19027_aepd7a.jpg'],
          primaryPhotoUrl: cleanComponentPhotos[0] || 'https://res.cloudinary.com/ddnlacdta/image/upload/v1782577185/ose19027_aepd7a.jpg',
          approxGoldWeight: compGold,
          diamondWeightCarats: compDiamond,
          price: {
            amount: cPricing.unitPrice,
            compareAt: cPricing.compareAtPrice,
            currency: cPricing.currency,
            formatted: cPricing.formattedPrice,
          },
        }
      })
    )

    const sumComponentPrices = componentsWithPricing.reduce((sum, c) => sum + c.price.amount, 0)
    const suiteSavingsAmount = Math.max(0, sumComponentPrices - pricing.unitPrice)

    setInfo = {
      isSet: true,
      setName: product.d2c_title || product.name,
      savingsLabel: details.suite_savings_label || 'Save on Complete Suite',
      sumComponentPrices,
      suiteSavingsAmount,
      formattedSavings: suiteSavingsAmount > 0 ? `${market.currencySymbol}${suiteSavingsAmount.toLocaleString('en-US')}` : null,
      components: componentsWithPricing,
    }
  }
} else if (details.is_component_of_set && details.parent_set_code) {
  const { data: parentProd } = await supabaseAdmin
    .from('products')
    .select('*')
    .eq('code', details.parent_set_code)
    .eq('is_active', true)
    .eq('d2c_status', 'published')
    .maybeSingle()

  if (parentProd) {
    const parentPricing = await resolveProductMarketPrice(parentProd.id, market.code)
    const parentDetails = (parentProd.d2c_details || {}) as Record<string, any>
    const siblingCodes = (parentDetails.component_codes || []).filter((c: string) => c !== product.code)

    let siblings: any[] = []
    if (siblingCodes.length > 0) {
      const { data: sibProds } = await supabaseAdmin
        .from('products')
        .select('*')
        .in('code', siblingCodes)
        .eq('is_active', true)
        .eq('d2c_status', 'published')

      if (sibProds) {
        siblings = await Promise.all(
          sibProds.map(async (s) => {
            const sPricing = await resolveProductMarketPrice(s.id, market.code)
            const sDetails = (s.d2c_details || {}) as Record<string, any>
            const sPhotos = (s.photo_urls || []).map((u: string) =>
              u.includes('Screenshot_2026-07-10') || u.includes('e0s3em')
                ? 'https://res.cloudinary.com/ddnlacdta/image/upload/v1782577185/ose19027_aepd7a.jpg'
                : u
            )
            const sRawGold = s.gold_weight_18k || s.gold_weight_g
            return {
              id: s.id,
              code: s.code,
              name: s.d2c_title || s.name,
              slug: s.slug || s.code.toLowerCase(),
              roleLabel: sDetails.component_label || s.name,
              photoUrl: sPhotos[0] || 'https://res.cloudinary.com/ddnlacdta/image/upload/v1782577185/ose19027_aepd7a.jpg',
              approxGoldWeight: sRawGold ? Number(Number(sRawGold).toFixed(1)) : null,
              price: {
                amount: sPricing.unitPrice,
                formatted: sPricing.formattedPrice,
              },
            }
          })
        )
      }
    }

    const parentPhotos = (parentProd.photo_urls || []).map((u: string) =>
      u.includes('Screenshot_2026-07-10') || u.includes('e0s3em')
        ? 'https://res.cloudinary.com/ddnlacdta/image/upload/v1783844231/NCK61.1_q8hiom.webp'
        : u
    )

    parentSetInfo = {
      parentId: parentProd.id,
      parentCode: parentProd.code,
      parentName: parentProd.d2c_title || parentProd.name,
      parentSlug: parentProd.slug,
      parentPhotoUrl: parentPhotos[0] || 'https://res.cloudinary.com/ddnlacdta/image/upload/v1783844231/NCK61.1_q8hiom.webp',
      parentPrice: {
        amount: parentPricing.unitPrice,
        formatted: parentPricing.formattedPrice,
      },
      siblings,
    }
  }
}

// Clean and sanitize photos (scrub internal screenshots)
let sanitizedPhotos = (product.photo_urls || []).map((u: string) => {
  if (u.includes('Screenshot_2026-07-10') || u.includes('e0s3em')) {
    return 'https://res.cloudinary.com/ddnlacdta/image/upload/v1783844231/NCK61.1_q8hiom.webp'
  }
  return u
})

if (product.code === 'SH-003' || product.slug === 'the-tanmaniya-heritage-diamond-suite') {
  sanitizedPhotos = [
    'https://res.cloudinary.com/ddnlacdta/image/upload/v1783844231/NCK61.1_q8hiom.webp',
    'https://res.cloudinary.com/ddnlacdta/image/upload/v1782577185/ose19027_aepd7a.jpg'
  ]
}

// Compute reconciled gold weight
let reconciledGoldWeight: number | null = null
if (product.code === 'SH-004' || product.slug === 'the-royal-diamond-tennis-necklace') {
  reconciledGoldWeight = 29.0
} else if (product.code === 'SH-003' || product.slug === 'the-tanmaniya-heritage-diamond-suite') {
  reconciledGoldWeight = 8.6
} else if (product.gold_weight_18k || product.gold_weight_g) {
  reconciledGoldWeight = Number(Number(product.gold_weight_18k || product.gold_weight_g).toFixed(1))
}

// Compute reconciled diamond total weight
let reconciledDiamondWeight: number | null = null
if (product.code === 'SH-003' || product.slug === 'the-tanmaniya-heritage-diamond-suite') {
  reconciledDiamondWeight = 2.41
} else if (product.code === 'SH-004' || product.slug === 'the-royal-diamond-tennis-necklace') {
  reconciledDiamondWeight = 5.50
} else {
  reconciledDiamondWeight = product.diamond_weight ? Number(Number(product.diamond_weight).toFixed(2)) : null
}

// Reconciled diamond color and clarity
const diamondColor = product.diamond_color || (product.code === 'SH-003' ? 'EF' : product.code === 'SH-004' ? 'GH' : 'F-G')
const diamondClarity = product.diamond_clarity || (product.code === 'SH-003' ? 'VVS-VS' : product.code === 'SH-004' ? 'VS-SI' : 'VVS-VS')

const responseData = {
  id: product.id,
  code: product.code,
  name: product.d2c_title || product.name,
  slug: product.slug || product.code.toLowerCase(),
  subtitle: product.d2c_subtitle || 'Bespoke Craftsmanship • Certified Diamonds',
  description: product.d2c_description || product.description || 'An exquisite masterwork hand-crafted in solid gold.',
  category: product.category,
  photoUrls: sanitizedPhotos,
  primaryPhotoUrl: sanitizedPhotos[0] || null,
  craftingLeadDays: leadDays,
  estimatedDeliveryWindow: deliveryEstimate.formattedRange,
  returnPolicy: {
    type: product.return_policy_type || 'made_to_order',
    windowDays: product.return_window_days ?? (isStandardReturn ? 14 : 0),
    eligible: product.return_eligible ?? isStandardReturn,
  },
  specifications: {
    approxGoldWeight: reconciledGoldWeight,
    diamondWeightCarats: reconciledDiamondWeight,
    diamondShape: product.diamond_shape || 'Round Brilliant',
    diamondColor,
    diamondClarity,
    hallmark: market.code === 'IN'
      ? 'Certified Assay 750 / BIS Hallmark with HUID'
      : 'Certified Assay 750 / Solid 18K Gold',
    certification: 'IGI / GIA Certified Diamonds',
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
      setInfo,
      parentSetInfo,
    }

    return NextResponse.json(responseData)
  } catch (err: any) {
    console.error('[GET /api/d2c/products/[slug]] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
