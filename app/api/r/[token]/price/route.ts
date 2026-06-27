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

  let finalFloorCost = targetPricing.cogs

  // If reseller has custom floor price, adjust by ratio
  let ratio = 1
  if (resellerPrice && resellerPrice.floor_price_paise) {
    const savedFloorRupees = Number(resellerPrice.floor_price_paise) / 100
    
    // Find base catalog COGS (typically 22K for gold, or silver COGS)
    let baseCatalogCogs = 0
    if (product.metal_type === 'silver') {
      baseCatalogCogs = Number(product.trade_price) / 1.28
    } else {
      // Look up 22K cogs from live calculated grid (so the ratio matches the same gold rate basis)
      const basePricing = pricingList.find(p => p.karat === 22)
      baseCatalogCogs = basePricing ? basePricing.cogs : (Number(product.trade_price) / 1.28)
    }

    if (baseCatalogCogs > 0) {
      ratio = savedFloorRupees / baseCatalogCogs
      finalFloorCost = targetPricing.cogs * ratio
    }
  }

  // Apply reseller retail markup
  const markupMultiplier = 1 + Number(shareLink.markup_percent) / 100
  const customerPriceRupees = Math.round(finalFloorCost * markupMultiplier)

  const gold_value = Math.round(targetPricing.goldCost * ratio * markupMultiplier)
  const diamond_value = Math.round((product.diamond_cost || 0) * ratio * markupMultiplier)
  const making_charges = Math.round((targetPricing.labourCost + (product.making_charges || 0) + (product.igi_cert_cost || 0)) * ratio * markupMultiplier)
  
  const subtotal = gold_value + diamond_value + making_charges
  const gst = Math.round(subtotal * 0.03)
  const total = subtotal + gst

  return NextResponse.json({
    product_id: productId,
    karat,
    selling_price_rupees: total,
    breakup: {
      gold_value,
      diamond_value,
      making_charges,
      gst,
      total
    }
  })
}
