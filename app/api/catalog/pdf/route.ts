import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'
import { renderCatalogPdf, CatalogPDFProduct } from '@/lib/catalogPdf'
import { toResponseBody } from '@/lib/pdfHelpers'

// Reads query params, so it can never be statically rendered.
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const PDF_TIMEOUT_MS = 25000

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const showPrice = searchParams.get('showPrice') !== 'false' // default to true
    const priceType = (searchParams.get('priceType') || 'both') as 'trade' | 'mrp' | 'both'
    const limitParam = parseInt(searchParams.get('limit') || '60', 10)
    const limit = Math.min(Math.max(limitParam || 60, 1), 100)

    // Fetch active products with bounded query
    const { data: products, error } = await supabase
      .from('products')
      .select('id, code, name, category, metal_type, gold_karat, gold_weight_g, trade_price, mrp_suggested, photo_urls, diamond_specs, diamond_weight')
      .eq('is_active', true)
      .order('code', { ascending: true })
      .limit(limit)

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

    // Execute PDF rendering bounded by timeout to ensure the route never wedges the server
    const pdfPromise = renderCatalogPdf(pdfProducts, {
      showPrice,
      priceType,
    })

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Catalog PDF generation exceeded timeout boundary')), PDF_TIMEOUT_MS)
    )

    const pdfBuffer = await Promise.race([pdfPromise, timeoutPromise])

    const filename = `Shewah_Catalog_${showPrice ? `with_price_${priceType}` : 'no_price'}.pdf`

    return new NextResponse(toResponseBody(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'private, no-cache, no-store, max-age=0',
      },
    })
  } catch (err: any) {
    console.error('Catalog PDF Generation Error:', err)
    const isTimeout = err?.message?.includes('timeout')
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal Server Error' },
      { status: isTimeout ? 504 : 500 }
    )
  }
}
