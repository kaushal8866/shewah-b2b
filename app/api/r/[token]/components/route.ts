import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { safeDbError } from '@/lib/sanitizeDbError'

export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  const token = params.token
  const { searchParams } = new URL(req.url)
  const productId = searchParams.get('product_id')

  if (!productId) {
    return NextResponse.json({ error: 'Product ID is required' }, { status: 400 })
  }

  // 1. Fetch active share link
  const { data: shareLink, error: linkErr } = await supabaseAdmin
    .from('reseller_share_links')
    .select('*')
    .eq('link_token', token)
    .eq('is_active', true)
    .maybeSingle()

  if (linkErr || !shareLink) {
    return NextResponse.json({ error: 'Storefront link is invalid or inactive.' }, { status: 404 })
  }

  // 2. Fetch children components
  const { data: kids, error: kidsErr } = await supabaseAdmin
    .from('products')
    .select('*')
    .eq('set_parent_id', productId)
    .eq('is_active', true)
    .order('component_sort_order', { ascending: true })

  if (kidsErr) {
    return NextResponse.json({ error: safeDbError(kidsErr, 'storefront.list_components', 'Could not load components.') }, { status: 500 })
  }

  // 3. Format components applying markup
  const markupMultiplier = 1 + Number(shareLink.markup_percent) / 100
  const formattedKids = (kids || []).map((p: any) => {
    const rawComp = p.karat_pricing
    let compPublicPricing: Record<string, any> | null = null
    if (rawComp && typeof rawComp === 'object') {
      compPublicPricing = {}
      for (const [key, row] of Object.entries(rawComp)) {
        if (!row) continue
        compPublicPricing[key] = {
          karat: (row as any).karat,
          weight: (row as any).weight,
          trade: Math.round((row as any).trade * markupMultiplier),
          mrp: Math.round((row as any).mrp * markupMultiplier),
          goldCost: Math.round(((row as any).goldCost || 0) * markupMultiplier),
          labourCost: Math.round(((row as any).labourCost || 0) * markupMultiplier)
        }
      }
    }

    const defaultPrice = p.trade_price ? Math.round(p.trade_price * markupMultiplier) : 0

    return {
      id: p.id,
      code: p.code,
      name: p.name,
      description: p.description,
      category: p.category,
      metal_type: p.metal_type,
      photo_urls: p.photo_urls || [],
      ref_karat: p.ref_karat,
      ref_color: p.ref_color,
      gold_weight_g: p.gold_weight_g,
      metal_weights: p.metal_weights || {},
      diamond_weight: p.diamond_weight,
      diamond_shape: p.diamond_shape,
      diamond_quality: p.diamond_quality,
      diamond_color: p.diamond_color,
      diamond_type: p.diamond_type,
      attributes: p.attributes || {},
      karat_pricing: compPublicPricing,
      selling_price_rupees: defaultPrice,
      sell_mode: p.sell_mode || 'single',
      component_label: p.component_label
    }
  })

  return NextResponse.json({ components: formattedKids })
}
