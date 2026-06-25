import { NextResponse } from 'next/server'
import { getResellerSession } from '@/lib/resellerAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { safeDbError } from '@/lib/sanitizeDbError'

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const { reseller, error } = await getResellerSession()
  if (error || !reseller) {
    return NextResponse.json({ error: error || 'Forbidden' }, { status: 403 })
  }

  const productId = params.id

  // 1. Fetch product details
  const { data: product, error: prodErr } = await supabaseAdmin
    .from('products')
    .select('*')
    .eq('id', productId)
    .eq('is_active', true)
    .maybeSingle()

  if (prodErr) {
    return NextResponse.json({ error: safeDbError(prodErr, 'reseller.catalog.detail', 'Could not load product details.') }, { status: 500 })
  }
  if (!product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 })
  }

  // 2. Fetch floor price
  const { data: floorPriceRow } = await supabaseAdmin
    .from('reseller_product_prices')
    .select('floor_price_paise')
    .eq('product_id', productId)
    .maybeSingle()

  if (!floorPriceRow) {
    return NextResponse.json({ error: 'This product is not enabled for resellers' }, { status: 403 })
  }

  // 3. Fetch product category schema
  const { data: categoryRow } = await supabaseAdmin
    .from('product_categories')
    .select('*')
    .eq('name', product.category)
    .maybeSingle()

  return NextResponse.json({
    product: {
      ...product,
      floor_price_paise: floorPriceRow.floor_price_paise
    },
    categorySchema: categoryRow?.attribute_schema || []
  })
}
