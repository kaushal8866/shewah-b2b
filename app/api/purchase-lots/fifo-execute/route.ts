import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { computeFifoPlan, executeFifoPlan, getDiamondSizeBand } from '@/lib/fifoEngine'
import { KARAT_FACTORS } from '@/lib/karat'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const role = (session.user as any).role
  if (role !== 'master' && role !== 'sub') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const {
    manufacturing_order_id,
    material_type,
    required_qty,
    gold_karat,
    diamond_shape,
    diamond_color,
    diamond_clarity,
    diamond_size_carat,
    cert_number,
    existing_lot_id
  } = body

  if (!manufacturing_order_id || !material_type || required_qty == null) {
    return NextResponse.json({ error: 'Missing manufacturing_order_id, material_type, or required_qty' }, { status: 400 })
  }

  let sizeBand = undefined
  if (diamond_size_carat) {
    sizeBand = getDiamondSizeBand(Number(diamond_size_carat))
  }

  let qty = Number(required_qty)
  if (material_type === 'gold_24k') {
    const karatNum = gold_karat ? (parseInt(gold_karat.replace(/[^\d]/g, '')) || 24) : 24
    const factor = KARAT_FACTORS[karatNum] ?? 1.0
    qty = parseFloat((qty * factor).toFixed(4))
  }

  try {
    // 1. Compute FIFO picks
    const plan = await computeFifoPlan({
      materialType: material_type,
      requiredQty: qty,
      goldKarat: gold_karat,
      diamondShape: diamond_shape,
      diamondColor: diamond_color,
      diamondClarity: diamond_clarity,
      diamondSizeBand: sizeBand,
      certNumber: cert_number,
      existingLotId: existing_lot_id
    })

    if (plan.reservations.length === 0) {
      return NextResponse.json({ error: 'No matching lots found with remaining quantity' }, { status: 400 })
    }

    // 2. Execute reservation writes
    const createdBy = (session.user as any).id
    const result = await executeFifoPlan(plan, manufacturing_order_id, 'reserved', createdBy)

    return NextResponse.json({
      success: true,
      total_cost: result.total_cost,
      reservations: plan.reservations
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'FIFO reservation failed' }, { status: 500 })
  }
}
