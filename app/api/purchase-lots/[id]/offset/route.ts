import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { previewReplenishmentOffset, executeReplenishmentOffset } from '@/lib/replenishmentEngine'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const role = (session.user as any).role
  if (role !== 'master') {
    return NextResponse.json({ error: 'Forbidden. Master access required for replenishment offsets.' }, { status: 403 })
  }

  const { id: lotId } = params

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.confirmed) {
    return NextResponse.json({ error: 'Confirmation required' }, { status: 400 })
  }

  // 1. Fetch the lot details
  const { data: lot, error: lotError } = await supabaseAdmin
    .from('purchase_lots')
    .select('*')
    .eq('id', lotId)
    .single()

  if (lotError || !lot) {
    return NextResponse.json({ error: lotError?.message || 'Lot not found' }, { status: 404 })
  }

  if (!['gold_24k', 'silver_925', 'silver_999'].includes(lot.material_type)) {
    return NextResponse.json({ error: 'This lot does not support replenishment offsets' }, { status: 400 })
  }

  // 2. Generate the preview again
  const preview = await previewReplenishmentOffset({
    materialType: lot.material_type as 'gold_24k' | 'silver_925' | 'silver_999',
    purchaseQtyG: Number(lot.total_qty),
    purchaseRate: Number(lot.unit_cost)
  })

  if (preview.offsets.length === 0) {
    return NextResponse.json({ message: 'No obligations found to offset', total_delta: 0 })
  }

  // 3. Execute the offset
  try {
    const result = await executeReplenishmentOffset(preview, lot.id)

    // Save realized variance on the lot itself (as a note or audit record if needed, but the replenishment_offsets rows capture it)
    return NextResponse.json({
      success: true,
      total_delta: result.total_delta,
      offsets_executed: preview.offsets.length
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Offset execution failed' }, { status: 500 })
  }
}
