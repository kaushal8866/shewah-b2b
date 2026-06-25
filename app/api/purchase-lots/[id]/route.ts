import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const role = (session.user as any).role
  if (role !== 'master' && role !== 'sub') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = params

  // Fetch purchase lot
  const { data: lot, error: lotError } = await supabaseAdmin
    .from('purchase_lots')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (lotError) {
    return NextResponse.json({ error: lotError.message }, { status: 500 })
  }

  if (!lot) {
    return NextResponse.json({ error: 'Purchase lot not found' }, { status: 404 })
  }

  // Fetch lot issuances with manufacturing order number
  const { data: issuances, error: issuancesError } = await supabaseAdmin
    .from('lot_issuances')
    .select(`
      *,
      manufacturing_orders (
        order_number,
        status
      )
    `)
    .eq('lot_id', id)
    .order('reserved_at', { ascending: false })

  if (issuancesError) {
    return NextResponse.json({ error: issuancesError.message }, { status: 500 })
  }

  // Fetch offset history for this lot
  const { data: offsets, error: offsetsError } = await supabaseAdmin
    .from('replenishment_offsets')
    .select(`
      *,
      replenishment_obligations (
        obligation_number,
        manufacturing_orders (
          order_number
        )
      )
    `)
    .eq('purchase_lot_id', id)
    .order('created_at', { ascending: false })

  return NextResponse.json({
    lot,
    issuances: issuances || [],
    offsets: offsets || []
  })
}
