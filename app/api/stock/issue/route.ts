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
    })
    return NextResponse.json({ movement: row })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to issue' }, { status: 400 })
  }
}
