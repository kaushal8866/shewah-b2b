import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getStockBalances } from '@/lib/centralStock'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const balances = await getStockBalances()
    return NextResponse.json({ balances })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to load balances' }, { status: 500 })
  }
}
