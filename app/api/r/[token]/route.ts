import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { safeDbError } from '@/lib/sanitizeDbError'
import { notifyResellerEvent } from '@/lib/resellerNotify'
import { computeKaratPricing } from '@/lib/karat'
import { DEFAULT_HOMEPAGE_SECTIONS } from '@/lib/defaultSections'

export async function GET(req: Request, { params }: { params: { token: string } }) {
  const token = params.token

  // 1. Fetch active share link
  const { data: shareLink, error: linkErr } = await supabaseAdmin
    .from('reseller_share_links')
    .select('*')
    .eq('link_token', token)
    .eq('is_active', true)
    .maybeSingle()

  if (linkErr) {
    return NextResponse.json({ error: safeDbError(linkErr, 'storefront.get_link', 'Could not load storefront.') }, { status: 500 })
  }
  if (!shareLink) {
    return NextResponse.json({ error: 'Storefront link is invalid or has been deactivated.' }, { status: 404 })
  }

  // 2. Fetch associated reseller profile
  const { data: reseller, error: resellerErr } = await supabaseAdmin
    .from('resellers')
    .select('id, store_name, owner_name, phone, email')
    .eq('id', shareLink.reseller_id)
    .single()

  if (resellerErr || !reseller) {
    return NextResponse.json({ error: 'Reseller profile not found.' }, { status: 404 })
  }

  // 3. Fetch associated theme config
  const { data: theme } = await supabaseAdmin
    .from('reseller_themes')
    .select('*')
    .eq('reseller_id', reseller.id)
    .maybeSingle()

  // 4. Fetch reseller products with floor prices
  let query = supabaseAdmin
    .from('reseller_product_prices')
    .select(`
      floor_price_paise,
      product: products (
        id, code, name, description, category, metal_type, photo_urls,
        ref_karat, ref_color, priced_at_rate, priced_at, is_active,
        attributes
      )
    `)

  if (shareLink.scope === 'curated' && Array.isArray(shareLink.curated_product_ids)) {
    // If empty curated list, return empty
    if (shareLink.curated_product_ids.length === 0) {
      return NextResponse.json({
        reseller,
        theme: theme || null,
        products: []
      })
    }
    query = query.in('product_id', shareLink.curated_product_ids)
  }

  const { data: prices, error: prodErr } = await query

  if (prodErr) {
    return NextResponse.json({ error: safeDbError(prodErr, 'storefront.list_products', 'Could not load products.') }, { status: 500 })
  }

  // 5. Increment click count analytics asynchronously
  supabaseAdmin
    .from('reseller_share_links')
    .update({ click_count: (shareLink.click_count || 0) + 1, updated_at: new Date().toISOString() })
    .eq('id', shareLink.id)
    .then(() => {}) // fire-and-forget

  // 6. Fetch latest gold rate + retail labour per karat from gold_rates table
  const { data: g } = await supabaseAdmin
    .from('gold_rates')
    .select('rate_24k, retail_labour_22k, retail_labour_18k, retail_labour_14k, retail_labour_10k, retail_labour_9k')
    .order('recorded_at', { ascending: false })
    .limit(1)
  const latest: any = g?.[0]
  const goldRate = Number(latest?.rate_24k) || 7200
  const retailLabour: Record<number, number> = {
    22: Number(latest?.retail_labour_22k) || 450,
    18: Number(latest?.retail_labour_18k) || 450,
    14: Number(latest?.retail_labour_14k) || 450,
    10: Number(latest?.retail_labour_10k) || 450,
    9:  Number(latest?.retail_labour_9k)  || 450,
  }

  // 7. Format products applying markup & STRIPPING wholesale rates
  const markupMultiplier = 1 + Number(shareLink.markup_percent) / 100
  const formattedProducts = (prices || [])
    .filter((row: any) => row.product && row.product.is_active)
    .map((row: any) => {
      const p = row.product
      let costRupees = Number(row.floor_price_paise) / 100

      // If gold product and ref_karat is not 22, adjust base floor price proportionally
      if (p.metal_type === 'gold' && p.ref_karat) {
        const refKaratNum = parseInt(p.ref_karat) || 18
        if (refKaratNum !== 22) {
          const pricingList = computeKaratPricing({
            netGoldWeight: p.gold_weight_g || 0,
            rate24k: goldRate,
            retailLabour,
            diamondCost: p.diamond_cost || 0,
            makingCharges: p.making_charges || 0,
            igiCost: p.igi_cert_cost || 0,
            metalWeights: p.metal_weights || undefined
          })

          const basePricing22 = pricingList.find(x => x.karat === 22)
          const targetPricing = pricingList.find(x => x.karat === refKaratNum)

          if (basePricing22 && targetPricing && basePricing22.cogs > 0) {
            const ratio = costRupees / basePricing22.cogs
            costRupees = targetPricing.cogs * ratio
          }
        }
      }

      const customerPriceRupees = Math.round(costRupees * markupMultiplier)

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
        attributes: p.attributes || {},
        // ONLY expose the marked up retail price to the public customer!
        selling_price_rupees: customerPriceRupees
      }
    })

  let finalTheme = theme
  if (!finalTheme) {
    finalTheme = {
      store_name: reseller.store_name,
      logo_url: null,
      favicon_url: null,
      colors: {
        primary: '#1E3A5F',
        secondary: '#C9A86A',
        background: '#FFFFFF',
        surface: '#F5F5F5',
        text: '#1C1917',
        borders: '#E7E5E4',
        accent: '#F59E0B'
      },
      typography: {
        heading: 'Inter',
        body: 'Inter',
        scale: 'medium'
      },
      buttons: {
        shape: 'rounded-xl',
        style: 'fill',
        hover: 'darken',
        shadow: 'sm'
      },
      layout: {
        density: 'comfortable',
        spacing: 'medium'
      },
      sections: DEFAULT_HOMEPAGE_SECTIONS
    }
  } else if (!finalTheme.sections || !Array.isArray(finalTheme.sections) || finalTheme.sections.length === 0) {
    finalTheme.sections = DEFAULT_HOMEPAGE_SECTIONS
  }

  return NextResponse.json({
    reseller,
    theme: finalTheme,
    products: formattedProducts
  })
}

// POST: Log Customer Callback Enquiry or Increment Enquiry Analytics
export async function POST(req: Request, { params }: { params: { token: string } }) {
  const token = params.token

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const { customer_name, customer_phone, customer_message, product_id, action } = body

  // 1. Fetch active share link
  const { data: shareLink } = await supabaseAdmin
    .from('reseller_share_links')
    .select('*')
    .eq('link_token', token)
    .eq('is_active', true)
    .maybeSingle()

  if (!shareLink) {
    return NextResponse.json({ error: 'Storefront not found' }, { status: 404 })
  }

  // 2. Handle simple enquiry analytics increment or full callback logging
  if (action === 'enquiry_click') {
    await supabaseAdmin
      .from('reseller_share_links')
      .update({
        enquiry_count: (shareLink.enquiry_count || 0) + 1,
        updated_at: new Date().toISOString()
      })
      .eq('id', shareLink.id)
    return NextResponse.json({ ok: true })
  }

  if (!customer_name || !customer_phone) {
    return NextResponse.json({ error: 'Name and Phone are required' }, { status: 400 })
  }

  // 3. Log callback enquiry to reseller_customers table if they are new, or alert reseller
  // Fetch reseller info
  const { data: reseller } = await supabaseAdmin
    .from('resellers')
    .select('phone, owner_name')
    .eq('id', shareLink.reseller_id)
    .single()

  let resolvedProductName = 'Jewelry Piece'
  if (product_id) {
    const { data: product } = await supabaseAdmin
      .from('products')
      .select('code, name')
      .eq('id', product_id)
      .maybeSingle()
    if (product) {
      resolvedProductName = `${product.code} - ${product.name}`
    }
  }

  // Increment enquiry count
  await supabaseAdmin
    .from('reseller_share_links')
    .update({
      enquiry_count: (shareLink.enquiry_count || 0) + 1,
      updated_at: new Date().toISOString()
    })
    .eq('id', shareLink.id)

  // Trigger WhatsApp alert to Reseller
  if (reseller) {
    await notifyResellerEvent('callback_request', {
      toPhone: reseller.phone,
      productName: resolvedProductName,
      customerName: customer_name,
      customerPhone: customer_phone,
      customerMessage: customer_message
    }).catch(() => {})
  }

  return NextResponse.json({ ok: true })
}
