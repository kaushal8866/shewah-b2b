import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getD2CCatalog } from '@/lib/d2cCatalog'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

export async function GET(req: NextRequest) {
	try {
		const session = await getServerSession(authOptions).catch(() => null)
		const { searchParams } = new URL(req.url)

		const catalog = await getD2CCatalog({
			market: searchParams.get('market'),
			category: searchParams.get('category'),
			featured: searchParams.get('featured'),
			shape: searchParams.get('shape'),
			diamondType: searchParams.get('diamondType'),
			style: searchParams.get('style'),
			search: searchParams.get('q'),
			limit: searchParams.get('limit'),
			hideUnpriced: searchParams.get('hideUnpriced') === 'true' || process.env.HIDE_UNPRICED_PRODUCTS === 'true',
			isTradeSession: Boolean(session?.user),
		})

		return NextResponse.json(catalog, {
			headers: {
				'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
			},
		})
	} catch (err: any) {
		console.error('[GET /api/d2c/products] Error:', err)
		return NextResponse.json({ error: 'Failed to fetch catalog' }, { status: 500 })
	}
}
