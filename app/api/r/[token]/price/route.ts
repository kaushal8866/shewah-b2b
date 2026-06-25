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

  // 2. Fetch product specs
  const { data: product } = await supabaseAdmin
    .from('products')
    .select('*')
    .eq('id', productId)
    .maybeSingle()

  if (!product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 })
  }

  // 3. Fetch gold rate settings
  const { data: goldRateSetting } = await supabaseAdmin
    .from('settings')
    .select('value')
    .eq('key', 'gold_rate_24k')
    .maybeSingle()
  const goldRate = Number(goldRateSetting?.value) || 7200

  // 4. Fetch retail gold labour rates per karat
  const { data: labourRows } = await supabaseAdmin
    .from('labour_rates')
    .select('karat, rate_per_g')
  
  const retailLabour: Record<number, number> = { 22: 450, 18: 450, 14: 450, 10: 450, 9: 450 }
  if (labourRows) {
    labourRows.forEach((row: any) => {
      retailLabour[row.karat] = Number(row.rate_per_g) || 450
    })
  }

  // 5. Calculate floor price using computeKaratPricing
  const pricingList = computeKaratPricing({
    netGoldWeight: product.gold_weight_g || 0,
    rate24k: goldRate,
    retailLabour,
    diamondCost: product.diamond_cost || 0,
    makingCharges: product.making_charges || 0,
    igiCost: product.igi_cert_cost || 0,
    metalWeights: product.metal_weights || undefined
  })

  const targetPricing = pricingList.find(p => p.karat === karat)
  if (!targetPricing) {
    return NextResponse.json({ error: 'Unsupported gold karat selection' }, { status: 400 })
  }

  // Apply markup
  const costRupees = targetPricing.cogs // base floor COGS
  const markupMultiplier = 1 + Number(shareLink.markup_percent) / 100
  const customerPriceRupees = Math.round(costRupees * markupMultiplier)

  return NextResponse.json({
    product_id: productId,
    karat,
    selling_price_rupees: customerPriceRupees
  })
}
