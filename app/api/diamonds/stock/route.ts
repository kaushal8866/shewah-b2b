import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getDiamondStockByGroup } from '@/lib/centralStock'

// Live diamond stock grouped by (material_type, shape, size).
// Used by the Stock dashboard cards and by the diamond catalog admin
// page (to render counts beside each row).
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const groups = await getDiamondStockByGroup()
    return NextResponse.json({ groups })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to load groups' }, { status: 500 })
  }
}
