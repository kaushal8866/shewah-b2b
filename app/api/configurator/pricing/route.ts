import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { convertKaratWeight, pureGoldMass, KARAT_FACTORS } from '@/lib/karat'

export const dynamic = 'force-dynamic'

// Helper to look up labour rate with fallback hierarchy
async function lookupLabourRate(metalId: string, karat: number, finishId: string | null, category: string | null) {
  // Query all rates for this metal to find the most specific match in memory
  const { data: rates, error } = await supabaseAdmin
    .from('cfg_labour_rates')
    .select('*')
    .eq('metal_id', metalId)

  if (error || !rates || rates.length === 0) return null

  // Find best match in order of specificity:
  // 1. Exact match (karat, finish, category)
  // 2. Karat + Finish (null category)
  // 3. Karat + Category (null finish)
  // 4. Karat only (null finish, null category)
  // 5. Finish + Category (null karat)
  // 6. Finish only (null karat, null category)
  // 7. Category only (null karat, null finish)
  // 8. Global default for metal (null all)

  const match = (k: number | null, f: string | null, cat: string | null) => {
    return rates.find(r => 
      (k === null ? r.karat === null : r.karat === k) &&
      (f === null ? r.finish_id === null : r.finish_id === f) &&
      (cat === null ? r.category === null : r.category === cat)
    )
  }

  // Specificity searches:
  let found = match(karat, finishId, category)
  if (!found) found = match(karat, finishId, null)
  if (!found) found = match(karat, null, category)
  if (!found) found = match(karat, null, null)
  if (!found) found = match(null, finishId, category)
  if (!found) found = match(null, finishId, null)
  if (!found) found = match(null, null, category)
  if (!found) found = match(null, null, null)

  return found ? Number(found.rate_per_gram) : null
}

// POST /api/configurator/pricing
// Computes real-time price breakup for a custom configuration
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { productId, metal_id, karat, finish_id, stone_config, selected_addons, token, reseller_id } = body

    if (!productId || !metal_id || !karat) {
      return NextResponse.json({ error: 'productId, metal_id, and karat are required' }, { status: 400 })
    }

    // 1. Fetch Product
    const { data: product, error: prodErr } = await supabaseAdmin
      .from('products')
      .select('*')
      .eq('id', productId)
      .maybeSingle()

    if (prodErr) throw prodErr
    if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 })

    // 2. Fetch Selected Metal & Karat
    const [metalRes, karatRes, finishRes] = await Promise.all([
      supabaseAdmin.from('cfg_metals').select('*').eq('id', metal_id).maybeSingle(),
      supabaseAdmin.from('cfg_karats').select('*').eq('metal_id', metal_id).eq('karat', karat).maybeSingle(),
      finish_id ? supabaseAdmin.from('cfg_finishes').select('*').eq('id', finish_id).maybeSingle() : Promise.resolve({ data: null, error: null })
    ])

    if (metalRes.error) throw metalRes.error
    if (karatRes.error) throw karatRes.error
    if (finishRes.error) throw finishRes.error

    const metal = metalRes.data
    const karatInfo = karatRes.data
    const finish = finishRes.data

    if (!metal || !karatInfo) {
      return NextResponse.json({ error: 'Selected Metal or Karat is invalid/inactive' }, { status: 400 })
    }

    // 3. Resolve Live Metal Rate
    let metalRatePerGram = 0
    let purityFactor = Number(karatInfo.purity_factor)

    // Fetch latest gold rates
    const { data: goldRates } = await supabaseAdmin
      .from('gold_rates')
      .select('rate_24k')
      .order('recorded_at', { ascending: false })
      .limit(1)

    const latestGoldRate = goldRates?.[0]?.rate_24k ? Number(goldRates[0].rate_24k) : 0

    // Fetch settings for silver/platinum rates
    const { data: settingsData } = await supabaseAdmin.from('settings').select('key, value')
    const settingsMap = new Map((settingsData || []).map(s => [s.key, s.value]))

    if (metal.metal_type === 'gold') {
      metalRatePerGram = latestGoldRate * purityFactor
    } else if (metal.metal_type === 'silver') {
      const silverRate = Number(settingsMap.get('silver_rate_b2b') || 80)
      metalRatePerGram = silverRate
    } else if (metal.metal_type === 'platinum') {
      const platinumRate = Number(settingsMap.get('platinum_rate_b2b') || 3500)
      metalRatePerGram = platinumRate
    }

    // 4. Convert weight using physical density ratios
    const baseWeight = Number(product.gold_weight_g || 0)
    const baseKarat = product.gold_karat || 18

    // Reference keys
    const refKaratKey = `${baseKarat}K`
    const refColorKey = 'yellow' // reference base color

    // Target keys
    let targetKaratKey = `${karat}K`
    let targetColorKey = 'default'

    if (metal.metal_type === 'gold') {
      targetColorKey = metal.name.toLowerCase().includes('white') ? 'white' : metal.name.toLowerCase().includes('rose') ? 'rose' : 'yellow'
    } else if (metal.metal_type === 'silver') {
      targetKaratKey = 'silver_925'
    } else if (metal.metal_type === 'platinum') {
      targetKaratKey = 'platinum_950'
    }

    const calculatedWeight = convertKaratWeight(
      baseWeight,
      refKaratKey,
      refColorKey,
      targetKaratKey,
      targetColorKey
    )

    const metalCost = Math.round(calculatedWeight * metalRatePerGram)

    // 5. Calculate Labour Cost
    const baseLabourRate = await lookupLabourRate(metal_id, karat, finish_id, product.category)
    const surchargePercent = finish ? Number(finish.labour_surcharge_percent || 0) : 0

    let labourCost = 0
    if (baseLabourRate !== null) {
      labourCost = Math.round(baseLabourRate * calculatedWeight * (1 + surchargePercent))
    } else {
      // Fallback to fixed product making charges
      const fixedMaking = Number(product.making_charges || settingsMap.get('default_making_charges') || 2500)
      labourCost = Math.round(fixedMaking * (1 + surchargePercent))
    }

    // 6. Calculate Stone Cost
    let stoneCost = 0
    let stonesDetail: any[] = []

    if (stone_config && Array.isArray(stone_config) && stone_config.length > 0) {
      for (const sc of stone_config) {
        const count = Number(sc.count || 1)
        
        let priceQuery = supabaseAdmin
          .from('cfg_stone_prices')
          .select('price_per_piece, is_available')
          .eq('stone_type_id', sc.stone_type_id)
          .eq('shape_id', sc.shape_id)
          .eq('size_id', sc.size_id)

        if (sc.clarity_grade_id) {
          priceQuery = priceQuery.eq('clarity_grade_id', sc.clarity_grade_id)
        } else {
          priceQuery = priceQuery.is('clarity_grade_id', null)
        }

        if (sc.color_grade_id) {
          priceQuery = priceQuery.eq('color_grade_id', sc.color_grade_id)
        } else {
          priceQuery = priceQuery.is('color_grade_id', null)
        }

        const { data: priceRecord } = await priceQuery.maybeSingle()
        const pPerPiece = priceRecord ? Number(priceRecord.price_per_piece) : 0

        stoneCost += pPerPiece * count
        stonesDetail.push({
          ...sc,
          price_per_piece: pPerPiece,
          total_price: pPerPiece * count,
          available: priceRecord ? priceRecord.is_available : false
        })
      }
    } else {
      // Fallback to base product diamond cost
      stoneCost = Number(product.diamond_cost || 0)
    }

    // 7. Calculate Add-ons Cost
    let addonCost = 0
    let addonsDetail: any[] = []

    if (selected_addons && Array.isArray(selected_addons) && selected_addons.length > 0) {
      const addonIds = selected_addons.map(a => a.addon_id)
      const { data: addonsInfo } = await supabaseAdmin
        .from('cfg_product_addons')
        .select('*')
        .in('id', addonIds)

      for (const selected of selected_addons) {
        const info = (addonsInfo || []).find(a => a.id === selected.addon_id)
        if (!info) continue

        let itemPrice = 0
        if (info.pricing_type === 'fixed') {
          itemPrice = Number(info.price)
        } else if (info.pricing_type === 'per_character') {
          const chars = String(selected.text || '').length
          itemPrice = Number(info.price) * chars
        } else if (info.pricing_type === 'percent') {
          const baseSum = metalCost + labourCost + stoneCost
          itemPrice = baseSum * (Number(info.price) / 100)
        }

        addonCost += Math.round(itemPrice)
        addonsDetail.push({
          addon_id: selected.addon_id,
          name: info.name,
          price: Math.round(itemPrice),
          pricing_type: info.pricing_type
        })
      }
    }

    // Standard IGI cost fallback if not explicitly included in addons
    const igiCost = Number(product.igi_cert_cost || settingsMap.get('default_igi_cost') || 1500)
    const floorPriceTotal = metalCost + labourCost + stoneCost + addonCost + igiCost

    // 8. Resolve Reseller Markup
    let resolvedResellerId: string | null = reseller_id || null
    let markupMultiplier = 1.0

    if (token && !resolvedResellerId) {
      const { data: shareLink } = await supabaseAdmin
        .from('reseller_share_links')
        .select('reseller_id, markup_percent')
        .eq('link_token', token)
        .eq('is_active', true)
        .maybeSingle()

      if (shareLink) {
        resolvedResellerId = shareLink.reseller_id
        markupMultiplier = 1 + Number(shareLink.markup_percent || 0) / 100
      }
    }

    // Check reseller overrides / custom markup for this product
    let resellerPrice = floorPriceTotal
    let markupType = 'percent'
    let markupValue = 0

    if (resolvedResellerId) {
      const { data: customPrice } = await supabaseAdmin
        .from('reseller_product_prices')
        .select('markup_type, markup_value')
        .eq('reseller_id', resolvedResellerId)
        .eq('product_id', productId)
        .maybeSingle()

      if (customPrice && customPrice.markup_value !== null) {
        markupType = customPrice.markup_type || 'percent'
        markupValue = Number(customPrice.markup_value)

        if (markupType === 'percent') {
          resellerPrice = Math.round(floorPriceTotal * (1 + markupValue / 100))
        } else {
          resellerPrice = Math.round(floorPriceTotal + markupValue)
        }
      } else {
        resellerPrice = Math.round(floorPriceTotal * markupMultiplier)
      }
    }

    return NextResponse.json({
      productId,
      gold_rate_locked: latestGoldRate,
      weights: {
        base_net_gold_weight: baseWeight,
        calculated_net_gold_weight: calculatedWeight,
        purity_factor: purityFactor
      },
      breakup: {
        metal_cost: metalCost,
        labour_cost: labourCost,
        stone_cost: stoneCost,
        addon_cost: addonCost,
        igi_cert_cost: igiCost,
        floor_price_total: floorPriceTotal,
        reseller_price_total: resellerPrice
      },
      stonesDetail,
      addonsDetail
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
