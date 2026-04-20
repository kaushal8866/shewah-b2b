import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { issueToPartner, MaterialType } from '@/lib/centralStock'

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  // Issuing material is a master-only action: it touches both the central
  // ledger and the karigar's float, so we don't want sub-users doing it.
  if (session.user?.role !== 'master') {
    return NextResponse.json({ error: 'Master access required' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const {
    material_type, item_label, quantity, manufacturing_partner_id,
    rate_per_unit, reference, notes, movement_date, allow_negative_central,
    diamond_shape_id, diamond_size_id, pieces,
  } = body || {}

  if (!material_type || !manufacturing_partner_id || !quantity) {
    return NextResponse.json(
      { error: 'material_type, manufacturing_partner_id, quantity are required' },
      { status: 400 },
    )
  }
  const qty = Number(quantity)
  if (!Number.isFinite(qty) || qty <= 0) {
    return NextResponse.json({ error: 'quantity must be a positive number' }, { status: 400 })
  }

  const isDiamond = String(material_type).startsWith('diamond')
  let normalizedPieces: number | null = null
  if (isDiamond) {
    if (!diamond_shape_id) return NextResponse.json({ error: 'diamond_shape_id is required for diamond issues' }, { status: 400 })
    if (!diamond_size_id)  return NextResponse.json({ error: 'diamond_size_id is required for diamond issues' }, { status: 400 })
    const p = Number(pieces)
    if (!Number.isInteger(p) || p <= 0) {
      return NextResponse.json({ error: 'pieces must be a positive whole number for diamond issues' }, { status: 400 })
    }
    normalizedPieces = p
  }

  try {
    const row = await issueToPartner({
      material_type: material_type as MaterialType,
      item_label: item_label || null,
      quantity: qty,
      manufacturing_partner_id,
      rate_per_unit: rate_per_unit != null ? Number(rate_per_unit) : null,
      reference: reference || null,
      notes: notes || null,
      movement_date: movement_date || null,
      allow_negative_central: !!allow_negative_central,
      created_by: (session.user as any)?.id || null,
      diamond_shape_id: isDiamond ? diamond_shape_id : null,
      diamond_size_id: isDiamond ? diamond_size_id : null,
      pieces: normalizedPieces,
    })
    return NextResponse.json({ movement: row })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to issue' }, { status: 400 })
  }
}
