import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { applyMfgStatusChange } from '@/lib/mfgOrderLifecycle'

export const dynamic = 'force-dynamic'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!user || (user.role !== 'master' && !user.permissions?.includes('manufacturing'))) {
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

  const {
    prevStatus,
    newStatus,
    goldWeightRequired,
    goldWeightActual,
    goldKarat,
    materialFromFloat,
    partnerId,
  } = body || {}

  if (!newStatus) {
    return NextResponse.json({ error: 'Missing newStatus' }, { status: 400 })
  }

  try {
    await applyMfgStatusChange({
      mfgOrderId: id,
      prevStatus: prevStatus ?? '',
      newStatus,
      goldWeightRequired: goldWeightRequired != null ? Number(goldWeightRequired) : null,
      goldWeightActual: goldWeightActual != null ? Number(goldWeightActual) : null,
      goldKarat: goldKarat != null ? Number(goldKarat) : null,
      materialFromFloat: !!materialFromFloat,
      partnerId: partnerId ?? null,
      userId: user.id,
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[mfg-status] Transition failed:', error)
    return NextResponse.json(
      { error: error?.message || 'Status transition failed' },
      { status: 500 }
    )
  }
}
