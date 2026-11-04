import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { fetchProductDetail } from '@/lib/d2cProductDetail'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getServerSession(authOptions).catch(() => null)
    const isTradeSession = Boolean(session?.user)

    const { searchParams } = new URL(req.url)
    const marketParam = searchParams.get('market') || 'US'

    const data = await fetchProductDetail(params.slug, marketParam, isTradeSession)
    if (!data) {
      return NextResponse.json({ error: 'Product not found or unavailable in D2C' }, { status: 404 })
    }

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
      },
    })
  } catch (err: any) {
    console.error('[GET /api/d2c/products/[slug]] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
