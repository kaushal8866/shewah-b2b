import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { cascadeOrderStatusToMfg } from '@/lib/mfgOrderLifecycle'

export const dynamic = 'force-dynamic'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!user || (user.role !== 'master' && !user.permissions?.includes('orders'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const id = params.id
  if (!id) {
    return NextResponse.json({ error: 'Missing order id' }, { status: 400 })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { newStatus } = body || {}
  if (!newStatus) {
    return NextResponse.json({ error: 'Missing newStatus' }, { status: 400 })
  }

  try {
    const res = await cascadeOrderStatusToMfg({
      orderId: id,
      newStatus,
    })

    return NextResponse.json({ success: true, affected: res.affected })
  } catch (error: any) {
    console.error('[cascade-mfg] Cascade failed:', error)
    return NextResponse.json(
      { error: error?.message || 'Cascade status to manufacturing orders failed' },
      { status: 500 }
    )
  }
}
