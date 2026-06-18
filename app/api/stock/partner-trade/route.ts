import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { recordPartnerTrade } from '@/lib/centralStock'

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user?.role !== 'master') {
    return NextResponse.json({ error: 'Master access required' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const {
    partner_id,
    trade_type,
    material_type,
    diamond_shape_id,
    diamond_size_id,
    carats,
    pieces,
    rate_per_carat,
    reference,
    notes,
    trade_date,
    allow_negative_central,
  } = body || {}

  if (!partner_id || !trade_type || !material_type || !diamond_shape_id || !diamond_size_id || !carats || !pieces || rate_per_carat == null) {
    return NextResponse.json(
      { error: 'partner_id, trade_type, material_type, diamond_shape_id, diamond_size_id, carats, pieces, rate_per_carat are required' },
      { status: 400 },
    )
  }

  const numCarats = Number(carats)
  const numPieces = Number(pieces)
  const numRate = Number(rate_per_carat)

  if (isNaN(numCarats) || numCarats <= 0) {
    return NextResponse.json({ error: 'carats must be a positive number' }, { status: 400 })
  }
  if (!Number.isInteger(numPieces) || numPieces <= 0) {
    return NextResponse.json({ error: 'pieces must be a positive whole number' }, { status: 400 })
  }
  if (isNaN(numRate) || numRate < 0) {
    return NextResponse.json({ error: 'rate_per_carat must be a non-negative number' }, { status: 400 })
  }

  try {
    const trade = await recordPartnerTrade({
      partner_id,
      trade_type,
      material_type,
      diamond_shape_id,
      diamond_size_id,
      carats: numCarats,
      pieces: numPieces,
      rate_per_carat: numRate,
      reference,
      notes,
      trade_date,
      created_by: (session.user as any)?.id || null,
      allow_negative_central: !!allow_negative_central,
    })
    return NextResponse.json({ trade })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to record trade' }, { status: 400 })
  }
}
