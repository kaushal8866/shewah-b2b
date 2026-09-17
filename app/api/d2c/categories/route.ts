import { NextResponse } from 'next/server'
import { fetchNonEmptyD2CCategories } from '@/lib/categories'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const activeCategories = await fetchNonEmptyD2CCategories()
    const totalPieces = activeCategories.reduce((sum, c) => sum + c.count, 0)

    const responseList = [
      {
        key: 'all',
        label: 'All Creations',
        shortLabel: 'All',
        href: '/jewellery',
        count: totalPieces,
      },
      ...activeCategories,
    ]

    return NextResponse.json(
      {
        success: true,
        categories: responseList,
        totalPieces,
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
        },
      }
    )
  } catch (err: any) {
    console.error('[GET /api/d2c/categories] Error:', err)
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 })
  }
}
