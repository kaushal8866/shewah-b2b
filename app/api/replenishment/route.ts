import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const role = (session.user as any).role
  if (role !== 'master') {
    return NextResponse.json({ error: 'Forbidden. Master access required for replenishment operations.' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  // Query replenishment obligations
  let query = supabaseAdmin
    .from('replenishment_obligations')
    .select(`
      *,
      manufacturing_orders (
        order_number,
        status,
        gold_karat
      )
    `)

  if (status) {
    query = query.eq('status', status)
  }
  if (from) {
    query = query.gte('created_at', from)
  }
  if (to) {
    query = query.lte('created_at', to)
  }

  query = query.order('created_at', { ascending: false })

  const { data: obligations, error: obligationsError } = await query
  if (obligationsError) {
    return NextResponse.json({ error: obligationsError.message }, { status: 500 })
  }

  // Get offsets for the obligations
  const { data: offsets, error: offsetsError } = await supabaseAdmin
    .from('replenishment_offsets')
    .select(`
      *,
      purchase_lots (
        lot_number
      )
    `)
    .order('created_at', { ascending: false })

  if (offsetsError) {
    return NextResponse.json({ error: offsetsError.message }, { status: 500 })
  }

  // Calculate MTD Gold Replacement Variance
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)
  const startOfMonthStr = startOfMonth.toISOString().split('T')[0]

  const { data: mtdOffsets } = await supabaseAdmin
    .from('replenishment_offsets')
    .select('delta')
    .gte('offset_date', startOfMonthStr)

  const mtdVariance = mtdOffsets?.reduce((sum, offset) => sum + Number(offset.delta), 0) ?? 0

  return NextResponse.json({
    obligations: obligations || [],
    offsets: offsets || [],
    mtd_variance: mtdVariance
  })
}
