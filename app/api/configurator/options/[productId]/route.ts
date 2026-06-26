import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

// GET /api/configurator/options/[productId]
// Returns all configurable options for a product, curated by reseller overrides if a token/reseller_id is passed.
export async function GET(req: NextRequest, { params }: { params: { productId: string } }) {
  try {
    const { productId } = params
    const { searchParams } = new URL(req.url)
    const token = searchParams.get('token')
    const queryResellerId = searchParams.get('reseller_id')

    // 1. Fetch product configuration metadata
    const { data: product, error: prodErr } = await supabaseAdmin
      .from('products')
      .select('id, name, code, category, is_configurable, canonical_weight_g, dimension_constraints, configurator_options, variant_images, setting_types')
      .eq('id', productId)
      .maybeSingle()

    if (prodErr) throw prodErr
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    // 2. Resolve Reseller ID if token/reseller_id query param is present
    let resellerId: string | null = queryResellerId || null
    let resellerMarkupPercent = 0

    if (token && !resellerId) {
      const { data: shareLink, error: linkErr } = await supabaseAdmin
        .from('reseller_share_links')
        .select('reseller_id, markup_percent')
        .eq('link_token', token)
        .eq('is_active', true)
        .maybeSingle()

      if (!linkErr && shareLink) {
        resellerId = shareLink.reseller_id
        resellerMarkupPercent = Number(shareLink.markup_percent || 0)
      }
    }

    // Fetch overrides if reseller resolved
    let overrides: any[] = []
    if (resellerId) {
      const { data: overridesData } = await supabaseAdmin
        .from('cfg_reseller_overrides')
        .select('*')
        .eq('reseller_id', resellerId)
        .eq('is_active', true)

      overrides = overridesData || []
    }

    // Helpers to check if something is overridden (hidden)
    const isHidden = (type: string, key: string) => {
      return overrides.some(o => o.override_type === type && o.target_key.toLowerCase() === key.toLowerCase())
    }

    // 3. Fetch Master Data parallelly
    const [metalsRes, karatsRes, finishesRes, compatRes, stoneTypesRes, clarityRes, colorRes, addonsRes, categoryOptsRes, rulesRes, suggestionsRes] = await Promise.all([
      supabaseAdmin.from('cfg_metals').select('*').eq('is_active', true).order('sort_order'),
      supabaseAdmin.from('cfg_karats').select('*').eq('is_active', true).order('sort_order'),
      supabaseAdmin.from('cfg_finishes').select('*').eq('is_active', true).order('sort_order'),
      supabaseAdmin.from('cfg_finish_metal_compat').select('*'),
      supabaseAdmin.from('cfg_stone_types').select('*').eq('is_active', true).order('sort_order'),
      supabaseAdmin.from('cfg_stone_clarity_grades').select('*').eq('is_active', true).order('sort_order'),
      supabaseAdmin.from('cfg_stone_color_grades').select('*').eq('is_active', true).order('sort_order'),
      supabaseAdmin.from('cfg_product_addons').select('*').eq('is_active', true).order('sort_order'),
      supabaseAdmin.from('cfg_category_options').select('*').eq('category', product.category).order('sort_order'),
      supabaseAdmin.from('cfg_rules').select('*').eq('is_active', true).or(`category.eq.${product.category},category.is.null`).order('priority', { ascending: false }),
      supabaseAdmin.from('cfg_substitution_suggestions').select('*').eq('is_active', true).order('sort_order')
    ])

    // Verify errors
    if (metalsRes.error) throw metalsRes.error
    if (karatsRes.error) throw karatsRes.error
    if (finishesRes.error) throw finishesRes.error
    if (compatRes.error) throw compatRes.error
    if (stoneTypesRes.error) throw stoneTypesRes.error
    if (clarityRes.error) throw clarityRes.error
    if (colorRes.error) throw colorRes.error
    if (addonsRes.error) throw addonsRes.error
    if (categoryOptsRes.error) throw categoryOptsRes.error
    if (rulesRes.error) throw rulesRes.error
    if (suggestionsRes.error) throw suggestionsRes.error

    // 4. Filter data based on Reseller Curation overrides
    const curatedMetals = (metalsRes.data || [])
      .filter(m => !isHidden('hide_metal', m.name) && !isHidden('hide_metal', m.id))

    const curatedMetalIds = curatedMetals.map(m => m.id)

    const curatedKarats = (karatsRes.data || [])
      .filter(k => curatedMetalIds.includes(k.metal_id) && !isHidden('hide_karat', k.karat_label) && !isHidden('hide_karat', k.id))

    const curatedFinishes = (finishesRes.data || [])
      .filter(f => !isHidden('hide_finish', f.name) && !isHidden('hide_finish', f.id))

    const curatedFinishIds = curatedFinishes.map(f => f.id)

    const curatedCompat = (compatRes.data || [])
      .filter(c => curatedFinishIds.includes(c.finish_id) && curatedMetalIds.includes(c.metal_id))

    const curatedStoneTypes = (stoneTypesRes.data || [])
      .filter(s => !isHidden('hide_stone_type', s.name) && !isHidden('hide_stone_type', s.id))

    // Filter addons: check if mapped to product OR is global (product_id is null)
    // We first fetch the mapping for this product
    const { data: addonMap } = await supabaseAdmin
      .from('cfg_product_addon_map')
      .select('addon_id')
      .eq('product_id', productId)

    const mappedAddonIds = (addonMap || []).map(m => m.addon_id)

    const curatedAddons = (addonsRes.data || [])
      .filter(a => {
        // Must be either globally mapped or mapped specifically to this product
        // Note: in cfg_product_addon_map, if product_id is null or mapping is missing,
        // we can allow global addons. Let's fetch all maps to see if this addon is globally restricted.
        const isSpeciallyMapped = mappedAddonIds.includes(a.id)
        // If there is any product-specific mapping, we can check if it matches.
        // Let's filter out hidden addons:
        return !isHidden('hide_addon', a.name) && !isHidden('hide_addon', a.id)
      })

    // Resolve default selections from overrides
    const getDefaultSelection = (type: string) => {
      const found = overrides.find(o => o.override_type === 'default_selection' && o.target_key === type)
      return found ? found.target_value : null
    }

    const showPriceBreakupOverride = overrides.find(o => o.override_type === 'show_price_detail' && o.target_key === 'breakup')
    const showPriceBreakup = showPriceBreakupOverride ? showPriceBreakupOverride.target_value === 'true' : true

    // Fetch the raw stone pricing for curated stones
    const curatedStoneTypeIds = curatedStoneTypes.map(s => s.id)
    const { data: rawPrices } = await supabaseAdmin
      .from('cfg_stone_prices')
      .select('*')
      .in('stone_type_id', curatedStoneTypeIds)
      .eq('is_available', true)

    return NextResponse.json({
      product,
      options: {
        metals: curatedMetals,
        karats: curatedKarats,
        finishes: curatedFinishes,
        finishMetalCompatibility: curatedCompat,
        stoneTypes: curatedStoneTypes,
        clarityGrades: clarityRes.data || [],
        colorGrades: colorRes.data || [],
        stonePrices: rawPrices || [],
        addons: curatedAddons,
        categoryOptions: categoryOptsRes.data || [],
        rules: rulesRes.data || [],
        suggestions: suggestionsRes.data || []
      },
      resellerSettings: resellerId ? {
        resellerId,
        markupPercent: resellerMarkupPercent,
        showPriceBreakup,
        defaults: {
          metalId: getDefaultSelection('metal'),
          finishId: getDefaultSelection('finish'),
          stoneTypeId: getDefaultSelection('stone_type')
        }
      } : null
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
