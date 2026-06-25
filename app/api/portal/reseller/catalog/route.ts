import { NextResponse } from 'next/server'
import { getResellerSession } from '@/lib/resellerAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { safeDbError } from '@/lib/sanitizeDbError'

export async function GET() {
  const { reseller, error } = await getResellerSession()
  if (error || !reseller) {
    return NextResponse.json({ error: error || 'Forbidden' }, { status: 403 })
  }

  // Fetch reseller product prices joined with product details
  const { data, error: dbErr } = await supabaseAdmin
    .from('reseller_product_prices')
    .select(`
      floor_price_paise,
      product: products (
        id, code, name, description, category, metal_type, photo_urls,
        ref_karat, ref_color, priced_at_rate, priced_at, is_active,
        attributes
      )
    `)

  if (dbErr) {
    return NextResponse.json({ error: safeDbError(dbErr, 'reseller.catalog.list', 'Could not load catalog.') }, { status: 500 })
  }

  // Filter for active products and format response
  const list = (data || [])
    .filter((row: any) => row.product && row.product.is_active)
    .map((row: any) => ({
      id: row.product.id,
      code: row.product.code,
      name: row.product.name,
      description: row.product.description,
      category: row.product.category,
      metal_type: row.product.metal_type,
      photo_urls: row.product.photo_urls || [],
      ref_karat: row.product.ref_karat,
      ref_color: row.product.ref_color,
      floor_price_paise: row.floor_price_paise,
      attributes: row.product.attributes || {}
    }))

  return NextResponse.json({ products: list })
}
