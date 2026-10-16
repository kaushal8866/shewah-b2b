import { NextRequest, NextResponse } from 'next/server'
import { fetchProductDetail } from '@/lib/d2cProductDetail'

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { searchParams } = new URL(req.url)
    const marketParam = searchParams.get('market') || 'US'

    const data = await fetchProductDetail(params.slug, marketParam)
    if (!data) {
      return NextResponse.json({ error: 'Product not found or unavailable in D2C' }, { status: 404 })
    }

    return NextResponse.json(data)
  } catch (err: any) {
    console.error('[GET /api/d2c/products/[slug]] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
