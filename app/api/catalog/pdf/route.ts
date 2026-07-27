import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'
import { renderCatalogPdf, CatalogPDFProduct } from '@/lib/catalogPdf'
import { toResponseBody } from '@/lib/pdfHelpers'

// Reads query params, so it can never be statically rendered. Without this the
// build probes it, the render throws, and the error is logged on every build.
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const showPrice = searchParams.get('showPrice') !== 'false' // default to true
    const priceType = (searchParams.get('priceType') || 'both') as 'trade' | 'mrp' | 'both'

    // Fetch all active products
    const { data: products, error } = await supabase
      .from('products')
      .select('id, code, name, category, metal_type, gold_karat, gold_weight_g, trade_price, mrp_suggested, photo_urls, diamond_specs')
      .eq('is_active', true)
      .order('code', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!products || products.length === 0) {
      return NextResponse.json({ error: 'No products found' }, { status: 404 })
    }

    // Format products for rendering
    const pdfProducts: CatalogPDFProduct[] = products.map((p) => ({
      id: p.id,
      code: p.code || '',
      name: p.name || '',
      category: p.category || '',
      metal_type: p.metal_type || 'gold',
      gold_karat: p.gold_karat,
      gold_weight_g: Number(p.gold_weight_g) || 0,
      trade_price: Number(p.trade_price) || 0,
      mrp_suggested: Number(p.mrp_suggested) || 0,
      photo_urls: p.photo_urls || [],
      diamond_specs: p.diamond_specs || [],
    }))

    const pdfBuffer = await renderCatalogPdf(pdfProducts, {
      showPrice,
      priceType,
    })

    const filename = `Shewah_Catalog_${showPrice ? `with_price_${priceType}` : 'no_price'}.pdf`

    return new NextResponse(toResponseBody(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (err) {
    console.error('Catalog PDF Generation Error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal Server Error' },
      { status: 500 }
    )
  }
}
