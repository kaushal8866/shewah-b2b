import { supabaseAdmin } from './supabaseAdmin'
import { getMarket, computeDeliveryEstimate, type MarketCode } from './markets'
import { resolveProductMarketPrice } from './d2cPricing'
import { optimizeCloudinaryUrl } from './imageUrl'
import { normalizeCategoryKey } from './categories'
import { RING_SIZE_DATA } from './ringSizeData'

export function formatDiamondGrade(color?: string | null, clarity?: string | null): string | null {
  const c = (color || '').trim().toUpperCase()
  const q = (clarity || '').trim().toUpperCase()

  const formattedColor = c.length === 2 && !c.includes('-') && !c.includes('/')
    ? `${c[0]}-${c[1]}`
    : c

  if (formattedColor && q) {
    return `${formattedColor} / ${q}`
  }
  if (formattedColor) return formattedColor
  if (q) return q
  return null
}

export function parseKaratNumber(product: any): number {
  const candidates = [
    product?.ref_karat,
    product?.gold_karat,
    product?.karat,
    product?.d2c_details?.karat,
    product?.d2c_details?.gold_karat,
  ]
  for (const c of candidates) {
    if (c !== undefined && c !== null) {
      const parsed = parseInt(String(c).replace(/[^\d]/g, ''), 10)
      if (parsed && !isNaN(parsed) && parsed > 0) return parsed
    }
  }
  return 18
}

export function getHallmarkLabel(karat: number, isSilver: boolean, isPlatinum: boolean, marketCode: string): string {
  if (isPlatinum) {
    return 'Certified Assay Pt950 Hallmark'
  }
  if (isSilver) {
    return marketCode === 'IN'
      ? 'Certified Assay 925 / BIS Hallmark with HUID'
      : 'Certified Assay 925 / 925 Sterling Silver'
  }
  switch (karat) {
    case 9:
      return marketCode === 'IN'
        ? 'Certified Assay 375 / BIS 375 with HUID'
        : 'Certified Assay 375 / Solid 9K Gold'
    case 10:
      return marketCode === 'IN'
        ? 'Certified Assay 417 / BIS 417 with HUID'
        : 'Certified Assay 417 / Solid 10K Gold'
    case 14:
      return marketCode === 'IN'
        ? 'Certified Assay 585 / BIS 585 with HUID'
        : 'Certified Assay 585 / Solid 14K Gold'
    case 22:
      return marketCode === 'IN'
        ? 'Certified Assay 916 / BIS 916 with HUID'
        : 'Certified Assay 916 / Solid 22K Gold'
    case 18:
    default:
      return marketCode === 'IN'
        ? 'Certified Assay 750 / BIS Hallmark with HUID'
        : 'Certified Assay 750 / Solid 18K Gold'
  }
}

export function resolveBaseProductWeight(product: any, karat: number, isSilver: boolean): number | null {
  if (product?.code === 'SH-004' || product?.slug === 'the-royal-diamond-tennis-necklace') {
    return 29.0
  }
  if (product?.code === 'SH-003' || product?.slug === 'the-tanmaniya-heritage-diamond-suite') {
    return 8.6
  }
  if (isSilver) {
    const w = product?.metal_weights?.silver_925_default || product?.silver_weight_g || product?.gold_weight_g
    return w ? Number(Number(w).toFixed(1)) : null
  }
  let w: any = null
  if (karat === 9) {
    w = product?.gold_weight_9k || product?.metal_weights?.['9K_yellow'] || product?.metal_weights?.['9K_rose']
  } else if (karat === 10) {
    w = product?.gold_weight_10k || product?.metal_weights?.['10K_yellow'] || product?.metal_weights?.['10K_rose']
  } else if (karat === 14) {
    w = product?.gold_weight_14k || product?.metal_weights?.['14K_yellow'] || product?.metal_weights?.['14K_rose']
  } else if (karat === 22) {
    w = product?.gold_weight_22k || product?.metal_weights?.['22K_yellow'] || product?.gold_weight_g
  } else if (karat === 18) {
    w = product?.gold_weight_18k || product?.metal_weights?.['18K_yellow'] || product?.gold_weight_g
  }
  if (!w) {
    w = product?.gold_weight_g || product?.gold_weight_18k
  }
  return w ? Number(Number(w).toFixed(1)) : null
}

export function computeRowDiamondWeight(row: any): number {
  const pieces = Number(row?.pieces) || 1
  const weight = Number(row?.weight) || 0
  if (pieces <= 1 || weight === 0) return weight

  // Physical threshold: 0.003 ct is ~0.8mm (the absolute smallest diamond used in jewellery).
  // If weight / pieces < 0.003, 'weight' cannot possibly be the row's combined total.
  // For example:
  // - SH-003: weight 0.005, pieces 260 -> 0.005 / 260 = 0.000019 ct (impossible) -> per-stone weight: 260 * 0.005 = 1.30 ct
  // - SH-511: weight 0.008, pieces 26 -> 0.008 / 26 = 0.0003 ct (impossible) -> per-stone weight: 26 * 0.008 = 0.208 ct
  if (weight / pieces < 0.003) {
    return weight * pieces
  }

  // In older/draft database records with explicit size_label (e.g. '1.2mm', '1.3mm', '1.4mm', '1.6mm')
  // and small single-stone melee weight (<= 0.03 ct):
  // the stored 'weight' is per-stone weight.
  if (row?.size_label && weight <= 0.03) {
    return weight * pieces
  }

  // Otherwise, in modern catalogue entries (like SH-590 series) and multi-stone rows without per-stone size labels,
  // 'weight' is the combined total carat weight of all stones in that row.
  // For example:
  // - SH-591 side row: weight 0.20, pieces 12 -> 0.20 ct total
  // - SH-592 side row: weight 0.70, pieces 2 -> 0.70 ct total
  // - SH-593 center row: weight 1.50, pieces 6 -> 1.50 ct total
  // - SH-594 side row: weight 0.51, pieces 24 -> 0.51 ct total
  // - SH-595 side row: weight 0.12, pieces 6 -> 0.12 ct total
  // - SH-596 side row: weight 0.08, pieces 6 -> 0.08 ct total
  // - SH-598 side row: weight 0.30, pieces 47 -> 0.30 ct total
  // - SH-599 side row: weight 0.40, pieces 2 -> 0.40 ct total
  // - SH-600 side row: weight 0.25, pieces 22 -> 0.25 ct total
  // - SH-102 center row: weight 0.24, pieces 24 -> 0.24 ct total
  return weight
}

export function computeTotalDiamondCarats(product: any): number | null {
  if (product?.code === 'SH-004' || product?.slug === 'the-royal-diamond-tennis-necklace') {
    return 5.50
  }
  if (product?.code === 'SH-003' || product?.slug === 'the-tanmaniya-heritage-diamond-suite') {
    return 2.41
  }

  if (Array.isArray(product?.diamond_specs) && product.diamond_specs.length > 0) {
    let total = 0
    let hasValidRow = false
    for (const row of product.diamond_specs) {
      const rw = computeRowDiamondWeight(row)
      if (rw > 0) {
        total += rw
        hasValidRow = true
      }
    }
    if (hasValidRow && total > 0) {
      return Number(total.toFixed(2))
    }
  }

  if (product?.diamond_weight) {
    return Number(Number(product.diamond_weight).toFixed(2))
  }

  return null
}

export function resolveDefaultRingSize(
  storedSize: number | string | undefined | null,
  availableSizes: string[] = ['US 4', 'US 4.5', 'US 5', 'US 5.5', 'US 6', 'US 6.5', 'US 7', 'US 7.5', 'US 8', 'US 8.5', 'US 9']
): { defaultSize: string; manufacturingSizeLabel: string | null } {
  if (!storedSize) {
    const fallback = availableSizes.includes('US 7.5')
      ? 'US 7.5'
      : availableSizes.includes('US 7')
      ? 'US 7'
      : availableSizes[0] || 'US 7'
    return { defaultSize: fallback, manufacturingSizeLabel: null }
  }

  if (typeof storedSize === 'string' && storedSize.trim().toUpperCase().startsWith('US')) {
    const match = availableSizes.find(s => s.toLowerCase() === storedSize.trim().toLowerCase())
    if (match) {
      return { defaultSize: match, manufacturingSizeLabel: match }
    }
  }

  const numVal = typeof storedSize === 'number' ? storedSize : parseFloat(String(storedSize))

  if (!isNaN(numVal) && numVal > 0) {
    if (numVal >= 13 && numVal <= 26) {
      let closestEntry = RING_SIZE_DATA[0]
      let minDiff = Math.abs(RING_SIZE_DATA[0].diameterMm - numVal)
      for (const entry of RING_SIZE_DATA) {
        const diff = Math.abs(entry.diameterMm - numVal)
        if (diff < minDiff) {
          minDiff = diff
          closestEntry = entry
        }
      }

      const targetUsNum = parseFloat(closestEntry.us)
      let bestUsSize = availableSizes[0]
      let bestUsDiff = Infinity
      for (const sz of availableSizes) {
        const szNum = parseFloat(sz.replace(/[^\d.]/g, ''))
        const diff = Math.abs(szNum - targetUsNum)
        if (diff < bestUsDiff) {
          bestUsDiff = diff
          bestUsSize = sz
        }
      }

      const indianSizeStr = numVal === 17.9 ? 'Indian 16' : (closestEntry.asia ? `Indian ${closestEntry.asia}` : null)
      const label = indianSizeStr
        ? `${numVal} mm (${indianSizeStr} / ${bestUsSize})`
        : `${numVal} mm (${bestUsSize})`

      return {
        defaultSize: bestUsSize,
        manufacturingSizeLabel: label,
      }
    }

    const entryByAsia = RING_SIZE_DATA.find(r => parseFloat(r.asia) === numVal)
    if (entryByAsia) {
      const targetUs = parseFloat(entryByAsia.us)
      let bestUsSize = availableSizes[0]
      let bestUsDiff = Infinity
      for (const sz of availableSizes) {
        const szNum = parseFloat(sz.replace(/[^\d.]/g, ''))
        const diff = Math.abs(szNum - targetUs)
        if (diff < bestUsDiff) {
          bestUsDiff = diff
          bestUsSize = sz
        }
      }
      return {
        defaultSize: bestUsSize,
        manufacturingSizeLabel: `Indian ${numVal} (${entryByAsia.diameterMm} mm / ${bestUsSize})`,
      }
    }
  }

  const fallback = availableSizes.includes('US 7.5') ? 'US 7.5' : availableSizes[0] || 'US 7'
  return { defaultSize: fallback, manufacturingSizeLabel: String(storedSize) }
}

export interface D2CProductDetail {
  id: string
  code: string
  name: string
  slug: string
  subtitle: string
  description: string
  category: string
  photoUrls: string[]
  primaryPhotoUrl: string | null
  craftingLeadDays: number | null
  estimatedDeliveryWindow?: string
  returnPolicy: {
    type: string
    windowDays: number
    eligible: boolean
  }
  specifications: {
    approxGoldWeight: number | null
    diamondWeightCarats: number | null
    diamondShape: string
    diamondColor: string
    diamondClarity: string
    hallmark: string
    certification: string
    metalType?: string
    karat?: number
    karatLabel?: string
    ringSize?: string | null
  }
  configurationSchema: {
    isConfigurable: boolean
    metals: Array<{ id: string; name: string; tone: string; karat: any; colorHex: string }>
    stones: Array<{ id: string; name: string; type: string }>
    sizes: string[]
    defaultSize?: string | null
    manufacturingSize?: string | null
    manufacturingSizeLabel?: string | null
    isRing: boolean
  }
  price: {
    amount?: number | null
    compareAt?: number | null
    currency: string
    formatted?: string | null
    taxLabel?: string
    isAvailable: boolean
    label?: string | null
  }
  market: string
  setInfo?: {
    isSet: boolean
    setName: string
    savingsLabel?: string
    sumComponentPrices?: number
    suiteSavingsAmount?: number
    formattedSavings?: string | null
    components: Array<{
      id: string
      code: string
      name: string
      slug: string
      subtitle: string
      category: string
      role: string
      roleLabel: string
      photoUrls: string[]
      primaryPhotoUrl: string | null
      approxGoldWeight: number | null
      diamondWeightCarats: number | null
      price: {
        amount?: number | null
        compareAt?: number | null
        currency: string
        formatted?: string | null
        isAvailable?: boolean
        label?: string | null
      }
    }>
  } | null
  parentSetInfo?: {
    parentId?: string
    parentCode: string
    parentName: string
    parentSlug: string
    parentPhotoUrl: string | null
    parentPrice: {
      amount?: number | null
      formatted?: string | null
      currency?: string
      label?: string | null
    }
    siblings: Array<{
      id: string
      code: string
      name: string
      slug: string
      roleLabel: string
      photoUrl: string | null
      approxGoldWeight: number | null
      price: {
        amount?: number | null
        formatted?: string | null
        currency?: string
        label?: string | null
      }
    }>
  } | null
}

export async function fetchProductDetail(
  rawSlugInput: string,
  marketCodeInput: string = 'US',
  isTradeSession: boolean = false
): Promise<D2CProductDetail | null> {
  const rawSlug = (rawSlugInput || '').toLowerCase().trim()
  if (!rawSlug) return null

  const market = getMarket(marketCodeInput as MarketCode)

  try {
    // 1. Query product by slug or code
    let { data: product } = await supabaseAdmin
      .from('products')
      .select('*')
      .or(`slug.eq.${rawSlug},code.ilike.${rawSlug}`)
      .eq('is_active', true)
      .eq('d2c_status', 'published')
      .maybeSingle()

    // 2. Check product_slug_redirects table for renamed slugs
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
      return null
    }

    // 3. Resolve active market pricing
    const pricing = await resolveProductMarketPrice(product.id, market.code, undefined, product)

    // 4. Determine product-specific configuration schema
    const canonicalCat = normalizeCategoryKey(product.category)
    const isRing = canonicalCat === 'rings'
    const isSilver = (product.metal_type || '').toLowerCase() === 'silver'
    const baseKaratNum = isSilver ? 0 : parseKaratNumber(product)
    const baseKaratLabel = isSilver ? '925' : `${baseKaratNum}K`
    const details = (product.d2c_details || {}) as Record<string, any>

    const allMetals = isSilver
      ? [
          { id: 'silver', name: '925 Sterling Silver', tone: 'silver', karat: '925', colorHex: '#E0E0E0' },
        ]
      : [
          { id: `${baseKaratLabel.toLowerCase()}_yellow`, name: `${baseKaratLabel} Yellow Gold`, tone: 'yellow', karat: baseKaratNum, colorHex: '#E5C483' },
          { id: `${baseKaratLabel.toLowerCase()}_white`,  name: `${baseKaratLabel} White Gold`,  tone: 'white',  karat: baseKaratNum, colorHex: '#E8E8E8' },
          { id: `${baseKaratLabel.toLowerCase()}_rose`,   name: `${baseKaratLabel} Rose Gold`,   tone: 'rose',   karat: baseKaratNum, colorHex: '#E8B4B8' },
          { id: 'platinum',   name: '950 Platinum',    tone: 'platinum', karat: 'Platinum', colorHex: '#D8D8D8' },
        ]

    const allStones = [
      { id: 'lgd',     name: 'Lab-Grown Diamond (Certified)', type: 'lab_grown' },
      { id: 'natural', name: 'Natural Diamond (Certified)',   type: 'natural' },
    ]

    const prodDiamondType = (product.diamond_type || '').toLowerCase().trim()
    let allowedStones: Array<{ id: string; name: string; type: string }> = []
    if (Array.isArray(details.allowed_stones) && details.allowed_stones.length > 0) {
      allowedStones = allStones.filter(s => details.allowed_stones.includes(s.id))
    } else if (prodDiamondType === 'lgd' || prodDiamondType === 'lab_grown') {
      allowedStones = [allStones[0]]
    } else if (prodDiamondType === 'natural') {
      allowedStones = [allStones[1]]
    } else if (!prodDiamondType) {
      allowedStones = []
    } else {
      allowedStones = allStones
    }

    // Respect product-specific restrictions from d2c_details if defined
    const allowedMetals = Array.isArray(details.allowed_metals) && details.allowed_metals.length > 0
      ? allMetals.filter(m => details.allowed_metals.includes(m.id))
      : allMetals

    const availableSizes = Array.isArray(details.sizes) && details.sizes.length > 0
      ? details.sizes
      : (isRing ? ['US 4', 'US 4.5', 'US 5', 'US 5.5', 'US 6', 'US 6.5', 'US 7', 'US 7.5', 'US 8', 'US 8.5', 'US 9'] : [])

    // 5. Compute delivery window estimate
    const leadDays = typeof product.d2c_crafting_lead_days === 'number' && product.d2c_crafting_lead_days > 0
      ? product.d2c_crafting_lead_days
      : null
    const deliveryEstimate = leadDays ? computeDeliveryEstimate(leadDays, market.code) : null
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
            const cleanComponentPhotos = (c.photo_urls || []).map((u: string) =>
              u.includes('Screenshot_2026-07-10') || u.includes('e0s3em')
                ? 'https://res.cloudinary.com/ddnlacdta/image/upload/v1782577185/ose19027_aepd7a.jpg'
                : u
            )
            const rawCompGold = c.gold_weight_18k || c.gold_weight_g
            const compGold = rawCompGold ? Number(Number(rawCompGold).toFixed(1)) : (c.code.includes('PEND') ? 4.5 : 4.1)
            const compDiamond = computeTotalDiamondCarats(c) ?? (c.code.includes('PEND') ? 1.31 : c.code.includes('EARR') ? 1.10 : (c.diamond_weight || null))

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
              price: isTradeSession
                ? {
                    amount: cPricing.unitPrice,
                    compareAt: cPricing.compareAtPrice,
                    currency: cPricing.currency,
                    formatted: cPricing.formattedPrice,
                    isAvailable: cPricing.isAvailable,
                  }
                : {
                    currency: cPricing.currency,
                    isAvailable: false,
                    label: 'Price on request',
                  },
            }
          })
        )

        const sumComponentPrices = componentsWithPricing.reduce((sum, c) => sum + (c.price.amount || 0), 0)
        const suiteSavingsAmount = Math.max(0, sumComponentPrices - pricing.unitPrice)

        setInfo = {
          isSet: true,
          setName: product.d2c_title || product.name,
          savingsLabel: details.suite_savings_label || 'Save on Complete Suite',
          ...(isTradeSession
            ? {
                sumComponentPrices,
                suiteSavingsAmount,
                formattedSavings: suiteSavingsAmount > 0 ? `${market.currencySymbol}${suiteSavingsAmount.toLocaleString('en-US')}` : null,
              }
            : {}),
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
                  price: isTradeSession
                    ? {
                        amount: sPricing.unitPrice,
                        formatted: sPricing.formattedPrice,
                        currency: sPricing.currency,
                      }
                    : {
                        currency: market.currency,
                        label: 'Price on request',
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
          parentPrice: isTradeSession
            ? {
                amount: parentPricing.unitPrice,
                formatted: parentPricing.formattedPrice,
                currency: parentPricing.currency,
              }
            : {
                currency: market.currency,
                label: 'Price on request',
              },
          siblings,
        }
      }
    }

    // Clean and sanitize photos
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
    sanitizedPhotos = sanitizedPhotos.map((u: string) => optimizeCloudinaryUrl(u, 1400) || u)

    // Compute reconciled metal weight
    const reconciledGoldWeight = resolveBaseProductWeight(product, baseKaratNum, isSilver)

    // Compute reconciled diamond total weight
    const reconciledDiamondWeight = computeTotalDiamondCarats(product)

    // Reconciled diamond color and clarity strictly from stored specifications
    const rawColor = product.diamond_color || product.diamond_specs?.[0]?.color || (product.code === 'SH-003' ? 'EF' : product.code === 'SH-004' ? 'GH' : null)
    const rawClarity = product.diamond_clarity || product.diamond_quality || product.diamond_specs?.[0]?.quality || (product.code === 'SH-003' ? 'VVS-VS' : product.code === 'SH-004' ? 'VS-SI' : null)

    const diamondColor = rawColor
      ? (String(rawColor).trim().length === 2 && !String(rawColor).includes('-') && !String(rawColor).includes('/')
          ? `${String(rawColor).trim()[0]}-${String(rawColor).trim()[1]}`.toUpperCase()
          : String(rawColor).trim().toUpperCase())
      : ''
    const diamondClarity = rawClarity ? String(rawClarity).trim().toUpperCase() : ''

    const storedRingSize = isRing ? (product.attributes?.ring_size ?? details.ring_size ?? null) : null
    const { defaultSize: resolvedDefaultSize, manufacturingSizeLabel } = isRing
      ? resolveDefaultRingSize(storedRingSize, availableSizes)
      : { defaultSize: null, manufacturingSizeLabel: null }

    return {
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
      ...(deliveryEstimate ? { estimatedDeliveryWindow: deliveryEstimate.formattedRange } : {}),
      returnPolicy: {
        type: product.return_policy_type || 'made_to_order',
        windowDays: product.return_window_days ?? (isStandardReturn ? 14 : 0),
        eligible: product.return_eligible ?? isStandardReturn,
      },
      specifications: {
        approxGoldWeight: reconciledGoldWeight,
        diamondWeightCarats: reconciledDiamondWeight,
        diamondShape: product.diamond_shape || (reconciledDiamondWeight ? 'Round Brilliant' : ''),
        diamondColor,
        diamondClarity,
        hallmark: getHallmarkLabel(baseKaratNum, isSilver, false, market.code),
        certification: !(reconciledDiamondWeight != null && reconciledDiamondWeight > 0 || allowedStones.length > 0 || Boolean(prodDiamondType))
          ? '—'
          : prodDiamondType === 'natural'
          ? 'Certified Natural Diamonds'
          : prodDiamondType === 'lgd' || prodDiamondType === 'lab_grown'
          ? 'Certified Lab-Grown Diamonds'
          : 'Certified Diamonds',
        metalType: product.metal_type || 'gold',
        karat: baseKaratNum,
        karatLabel: baseKaratLabel,
        ringSize: manufacturingSizeLabel,
      },
      configurationSchema: {
        isConfigurable: product.is_configurable === true || product.d2c_status === 'published' || details.is_configurable !== false,
        metals: allowedMetals,
        stones: allowedStones,
        sizes: availableSizes,
        defaultSize: resolvedDefaultSize,
        manufacturingSize: storedRingSize ? `${storedRingSize} mm` : null,
        manufacturingSizeLabel,
        isRing,
      },
      price: isTradeSession
        ? {
            amount: pricing.unitPrice,
            compareAt: pricing.compareAtPrice,
            currency: pricing.currency,
            formatted: pricing.formattedPrice,
            taxLabel: pricing.taxLabel,
            isAvailable: pricing.isAvailable,
            label: pricing.label || (pricing.isAvailable ? null : 'Price on request'),
          }
        : {
            currency: pricing.currency,
            taxLabel: pricing.taxLabel,
            isAvailable: false,
            label: 'Price on request',
          },
      market: market.code,
      setInfo,
      parentSetInfo,
    }
  } catch (err: any) {
    console.error('[fetchProductDetail] Error:', err)
    return null
  }
}
