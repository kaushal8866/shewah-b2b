import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { computeKaratPricing } from '@/lib/karat'

export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  const token = params.token
  const { searchParams } = new URL(req.url)
  const productId = searchParams.get('product_id')
  const karat = parseInt(searchParams.get('karat') || '18')

  if (!productId) {
    return NextResponse.json({ error: 'Product ID is required' }, { status: 400 })
  }

  // 1. Fetch storefront markup
  const { data: shareLink } = await supabaseAdmin
    .from('reseller_share_links')
    .select('id, reseller_id, markup_percent')
    .eq('link_token', token)
    .eq('is_active', true)
    .maybeSingle()

  if (!shareLink) {
    return NextResponse.json({ error: 'Storefront not found' }, { status: 404 })
  }

  // Verify reseller status is active
  const { data: reseller } = await supabaseAdmin
    .from('resellers')
    .select('status')
    .eq('id', shareLink.reseller_id)
    .single()

  if (!reseller || reseller.status !== 'active') {
    return NextResponse.json({ error: 'Storefront is inactive or pending activation.' }, { status: 403 })
  }

  // 2. Fetch product specs
  const { data: product } = await supabaseAdmin
    .from('products')
    .select('*')
    .eq('id', productId)
    .maybeSingle()

  if (!product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 })
  }

  // 3. Fetch latest gold rate + retail labour per karat from gold_rates table
  const { data: g } = await supabaseAdmin
    .from('gold_rates')
    .select('rate_24k, retail_labour_22k, retail_labour_18k, retail_labour_14k, retail_labour_10k, retail_labour_9k')
    .order('recorded_at', { ascending: false })
    .limit(1)
  const latest = g?.[0]
  if (!latest) {
    return NextResponse.json({ error: 'No gold rate is set yet — admin must record one.' }, { status: 503 })
  }
  const goldRate = Number(latest.rate_24k) || 7200
  const retailLabour: Record<number, number> = {
    22: Number(latest.retail_labour_22k) || 450,
    18: Number(latest.retail_labour_18k) || 450,
    14: Number(latest.retail_labour_14k) || 450,
    10: Number(latest.retail_labour_10k) || 450,
    9:  Number(latest.retail_labour_9k)  || 450,
  }

  // 4. Fetch reseller custom floor price if any
  const { data: resellerPrice } = await supabaseAdmin
    .from('reseller_product_prices')
    .select('floor_price_paise')
    .eq('reseller_id', shareLink.reseller_id)
    .eq('product_id', productId)
    .maybeSingle()

  // 5. Calculate live raw COGS for all karats
  const pricingList = computeKaratPricing({
    netGoldWeight: product.gold_weight_g || 0,
    rate24k: goldRate,
    retailLabour,
    diamondCost: product.diamond_cost || 0,
    makingCharges: product.making_charges || 0,
    igiCost: product.igi_cert_cost || 0,
    metalWeights: product.metal_weights || undefined,
    color: product.ref_color || undefined
  })

  const targetPricing = pricingList.find(p => p.karat === karat)
  if (!targetPricing) {
    return NextResponse.json({ error: 'Unsupported gold karat selection' }, { status: 400 })
  }

  let finalFloorCost = targetPricing.trade

  // If reseller has custom floor price, adjust by ratio
  let ratio = 1
  if (resellerPrice && resellerPrice.floor_price_paise) {
    const savedFloorRupees = Number(resellerPrice.floor_price_paise) / 100
    
    // Find base catalog trade price (typically 22K for gold, or silver trade price)
    let baseCatalogTrade = 0
    if (product.metal_type === 'silver') {
      baseCatalogTrade = Number(product.trade_price)
    } else {
      // Look up 22K trade from live calculated grid (so the ratio matches the same gold rate basis)
      const basePricing = pricingList.find(p => p.karat === 22)
      baseCatalogTrade = basePricing ? basePricing.trade : Number(product.trade_price)
    }

    if (baseCatalogTrade > 0) {
      ratio = savedFloorRupees / baseCatalogTrade
      finalFloorCost = targetPricing.trade * ratio
    }
  }

  // Apply reseller retail markup ONLY to the diamond value (since gold and labour are transparent in the market)
  const markupMultiplier = 1 + Number(shareLink.markup_percent) / 100

  const gold_value = Math.round(targetPricing.goldCost * ratio)
  const diamond_value = Math.round((product.diamond_cost || 0) * 1.28 * ratio * markupMultiplier)
  const making_charges = Math.round((targetPricing.labourCost + (product.making_charges || 0) + (product.igi_cert_cost || 0)) * ratio)
  
  const subtotal = gold_value + diamond_value + making_charges
  const gst = Math.round(subtotal * 0.03)
  const total = subtotal + gst

  const goldColorFormatted = product.ref_color ? product.ref_color.charAt(0).toUpperCase() + product.ref_color.slice(1).toLowerCase() : 'Yellow'
  const gold_component = `${karat}KT Gold ${goldColorFormatted}`
  const gold_rate = Math.round(goldRate * (KARAT_FACTORS[karat] || 1))

  const specs = product.diamond_specs || []
  const diamond_count = specs.reduce((sum: number, d: any) => sum + (parseInt(d.pieces) || 0), 0)
  const diamond_weight = specs.reduce((sum: number, d: any) => sum + ((parseFloat(d.weight) || 0) * (parseInt(d.pieces) || 1)), 0)

  const mappedDiamondSpecs = specs.map((spec: any) => {
    const pieces = parseInt(spec.pieces) || 0
    const weightPerPiece = parseFloat(spec.weight) || 0
    const totalWeight = pieces * weightPerPiece
    const ratePerCarat = weightPerPiece > 0 ? (parseFloat(spec.cost) / weightPerPiece) : 0
    const markedUpRate = Math.round(ratePerCarat * 1.28 * ratio * markupMultiplier)
    const markedUpValue = Math.round((parseFloat(spec.cost) || 0) * pieces * 1.28 * ratio * markupMultiplier)

    return {
      size_label: spec.size_label || '—',
      color: spec.color || '—',
      clarity: spec.quality || '—',
      shape: spec.shape || '—',
      count: pieces,
      price: markedUpRate,
      weight: totalWeight,
      value: markedUpValue
    }
  })

  return NextResponse.json({
    product_id: productId,
    karat,
    selling_price_rupees: total,
    breakup: {
      gold_component,
      gold_rate,
      gold_weight: targetPricing.weight,
      gold_value,

      diamond_component: product.diamond_quality && product.diamond_color ? `${product.diamond_quality}-${product.diamond_color}` : 'VVS/VS-EF',
      diamond_count,
      diamond_weight,
      diamond_value,

      making_charges,
      total: subtotal,
      diamond_discount: 0,
      sub_total: subtotal,
      gst,
      final_value: total,

      diamond_specs: mappedDiamondSpecs
    }
  })
}
