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
    diamond_shape_id, diamond_size_id, pieces,
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

  // Diamond rows must always carry shape, size, and pieces — the catalog &
  // shortage alerts depend on it. Reject anything else server-side.
  const isDiamond = String(material_type).startsWith('diamond')
  let normalizedPieces: number | null = null
  if (isDiamond) {
    if (!diamond_shape_id) return NextResponse.json({ error: 'diamond_shape_id is required for diamond receipts' }, { status: 400 })
    if (!diamond_size_id)  return NextResponse.json({ error: 'diamond_size_id is required for diamond receipts' }, { status: 400 })
    const p = Number(pieces)
    if (!Number.isInteger(p) || p <= 0) {
      return NextResponse.json({ error: 'pieces must be a positive whole number for diamond receipts' }, { status: 400 })
    }
    normalizedPieces = p
  } else if (pieces != null && pieces !== '') {
    // Non-diamond rows shouldn't carry pieces — drop silently rather than
    // letting a stray UI value land in the ledger.
    normalizedPieces = null
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
    diamond_shape_id: isDiamond ? diamond_shape_id : null,
    diamond_size_id: isDiamond ? diamond_size_id : null,
    pieces: normalizedPieces,
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
