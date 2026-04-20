import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import {
  recordPurchase, receiveFromPartner, recordAdjustment, MaterialType,
} from '@/lib/centralStock'

// Single endpoint for every flavour of "stock coming in":
//   • from='vendor'          → recordPurchase
//   • from='partner'         → receiveFromPartner (returns)
//   • from='adjustment_in'   → recordAdjustment(+)
//   • from='adjustment_out'  → recordAdjustment(-)
export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user?.role !== 'master') {
    return NextResponse.json({ error: 'Master access required' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const {
    from, material_type, item_label, quantity,
    vendor_id, manufacturing_partner_id,
    reference, notes, movement_date,
  } = body || {}

  if (!from || !material_type || !quantity) {
    return NextResponse.json(
      { error: 'from, material_type, quantity are required' },
      { status: 400 },
    )
  }
  const qty = Number(quantity)
  if (!Number.isFinite(qty) || qty <= 0) {
    return NextResponse.json({ error: 'quantity must be a positive number' }, { status: 400 })
  }

  const created_by = (session.user as any)?.id || null
  const common = {
    material_type: material_type as MaterialType,
    item_label: item_label || null,
    quantity: qty,
    reference: reference || null,
    notes: notes || null,
    movement_date: movement_date || null,
    created_by,
  }

  try {
    let row: any
    if (from === 'vendor') {
      if (!vendor_id) return NextResponse.json({ error: 'vendor_id required' }, { status: 400 })
      row = await recordPurchase({ ...common, vendor_id })
    } else if (from === 'partner') {
      if (!manufacturing_partner_id) {
        return NextResponse.json({ error: 'manufacturing_partner_id required' }, { status: 400 })
      }
      row = await receiveFromPartner({ ...common, manufacturing_partner_id })
    } else if (from === 'adjustment_in') {
      row = await recordAdjustment({ ...common, direction: 'in' })
    } else if (from === 'adjustment_out') {
      row = await recordAdjustment({ ...common, direction: 'out' })
    } else {
      return NextResponse.json({ error: `Unknown from="${from}"` }, { status: 400 })
    }
    return NextResponse.json({ movement: row })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to record receipt' }, { status: 400 })
  }
}
