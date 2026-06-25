import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { safeDbError } from '@/lib/sanitizeDbError'
import { notifyResellerEvent } from '@/lib/resellerNotify'

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

  // 6. Format products applying markup & STRIPPING wholesale rates
  const markupMultiplier = 1 + Number(shareLink.markup_percent) / 100
  const formattedProducts = (prices || [])
    .filter((row: any) => row.product && row.product.is_active)
    .map((row: any) => {
      const costRupees = Number(row.floor_price_paise) / 100
      const customerPriceRupees = Math.round(costRupees * markupMultiplier)

      return {
        id: row.product.id,
        code: row.product.code,
        name: row.product.name,
        description: row.product.description,
        category: row.product.category,
        metal_type: row.product.metal_type,
        photo_urls: row.product.photo_urls || [],
        ref_karat: row.product.ref_karat,
        ref_color: row.product.ref_color,
        attributes: row.product.attributes || {},
        // ONLY expose the marked up retail price to the public customer!
        selling_price_rupees: customerPriceRupees
      }
    })

  return NextResponse.json({
    reseller,
    theme: theme || null,
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
