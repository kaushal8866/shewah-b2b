import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getMarket, type MarketCode } from '@/lib/markets'
import { resolveProductMarketPrice } from '@/lib/d2cPricing'
import { fetchNonEmptyD2CCategories, getDbCategoriesForQuery, normalizeCategoryKey } from '@/lib/categories'
import { optimizeCloudinaryUrl } from '@/lib/imageUrl'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const marketParam = (searchParams.get('market') || 'US').toUpperCase() as MarketCode
    const market = getMarket(marketParam)
    const category = searchParams.get('category')
    const featured = searchParams.get('featured')
    const shape = searchParams.get('shape')
    const diamondType = searchParams.get('diamondType')
    const style = searchParams.get('style')
    const search = searchParams.get('q')
    const rawLimit = searchParams.get('limit')
    const limit = rawLimit ? Math.max(1, Math.min(Number(rawLimit) || 1000, 2000)) : 2000
    const hideUnpriced = searchParams.get('hideUnpriced') === 'true' || process.env.HIDE_UNPRICED_PRODUCTS === 'true'

    let query = supabaseAdmin
      .from('products')
      .select('id, code, name, slug, category, photo_urls, d2c_status, d2c_featured, d2c_title, d2c_subtitle, d2c_description, d2c_crafting_lead_days, return_policy_type, return_window_days, return_eligible, diamond_shape, diamond_type, gold_karat, metal_type, d2c_details, is_active, is_configurable, karat_pricing, mrp_suggested, trade_price')
      .eq('is_active', true)
      .eq('d2c_status', 'published')

    if (category && category !== 'all') {
      const dbCategories = getDbCategoriesForQuery(category)
      if (dbCategories.length > 0) {
        query = query.in('category', dbCategories)
      } else {
        query = query.ilike('category', category)
      }
    }
    if (featured === 'true') {
      query = query.eq('d2c_featured', true)
    }
    if (shape && shape.trim()) {
      const term = `%${shape.trim()}%`
      query = query.or(`diamond_shape.ilike.${term},name.ilike.${term},d2c_title.ilike.${term}`)
    }
    if (diamondType && diamondType.trim()) {
      const term = `%${diamondType.trim()}%`
      query = query.or(`diamond_type.ilike.${term},d2c_subtitle.ilike.${term}`)
    }
    if (style && style.trim()) {
      const term = `%${style.trim()}%`
      query = query.or(`name.ilike.${term},d2c_title.ilike.${term},d2c_subtitle.ilike.${term},d2c_description.ilike.${term}`)
    }
    if (search && search.trim()) {
      const term = `%${search.trim()}%`
      query = query.or(`name.ilike.${term},d2c_title.ilike.${term},code.ilike.${term}`)
    }

    query = query.order('name', { ascending: true }).limit(limit)

    const { data: products, error } = await query
    if (error) throw error

    // When showing 'all' creations without search, show sets together as unified creations
    // rather than fragmenting individual components as duplicate cards
    let visibleProducts = (!category || category === 'all') && !search
      ? (products || []).filter(p => !(p.d2c_details as any)?.is_component_of_set)
      : (products || [])

    if (hideUnpriced) {
      visibleProducts = visibleProducts.filter(p => Number(p.trade_price || p.mrp_suggested) > 0)
    }

    // Resolve market-specific prices concurrently
    const sanitizedProducts = await Promise.all(
      visibleProducts.map(async (p) => {
        const pricing = await resolveProductMarketPrice(p.id, market.code, undefined, p)
        const details = (p.d2c_details || {}) as Record<string, any>
        const optimizedPhotos = (p.photo_urls || [])
          .map((u: string) => optimizeCloudinaryUrl(u, 800))
          .filter((u: string | null): u is string => Boolean(u))
        return {
          id: p.id,
          code: p.code,
          name: p.d2c_title || p.name,
          slug: p.slug || p.code.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          subtitle: p.d2c_subtitle || '',
          description: p.d2c_description || '',
          category: normalizeCategoryKey(p.category),
          photoUrls: optimizedPhotos,
          primaryPhotoUrl: optimizedPhotos[0] || null,
          secondaryPhotoUrl: optimizedPhotos[1] || optimizedPhotos[0] || null,
          isFeatured: p.d2c_featured || false,
          isSet: Boolean(details.is_set),
          isSetComponent: Boolean(details.is_component_of_set),
          setParentCode: details.parent_set_code || null,
          setLabel: details.is_set ? 'Complete Suite • Available Together or Separately' : null,
          craftingLeadDays: p.d2c_crafting_lead_days || 14,
          returnPolicy: {
            type: p.return_policy_type || 'made_to_order',
            windowDays: p.return_window_days ?? 30,
            eligible: p.return_eligible ?? true,
          },
          specs: {
            diamondShape: p.diamond_shape || null,
            diamondType: p.diamond_type || null,
            metalType: p.metal_type || 'gold',
            karat: p.gold_karat || 18,
          },
          price: {
            amount: pricing.unitPrice,
            compareAt: pricing.compareAtPrice,
            currency: pricing.currency,
            formatted: pricing.formattedPrice,
            taxLabel: pricing.taxLabel,
            isAvailable: pricing.isAvailable,
            label: pricing.label || (pricing.isAvailable ? null : 'Price on request'),
          },
        }
      })
    )

    const activeCategories = await fetchNonEmptyD2CCategories()
    const totalPieces = activeCategories.reduce((sum, c) => sum + c.count, 0)
    const categoryOptions = [
      { key: 'all', label: 'All Creations', shortLabel: 'All', count: totalPieces, href: '/jewellery' },
      ...activeCategories,
    ]

    return NextResponse.json({
      market: market.code,
      currency: market.currency,
      count: sanitizedProducts.length,
      categories: categoryOptions,
      products: sanitizedProducts,
    })
  } catch (err: any) {
    console.error('[GET /api/d2c/products] Error:', err)
    return NextResponse.json({ error: 'Failed to fetch catalog' }, { status: 500 })
  }
}
