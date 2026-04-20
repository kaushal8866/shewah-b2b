import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// Read-only listing for the audit trail. Filters: material_type, partner_id,
// vendor_id, from, to. Caps at 500 rows to keep the page snappy.
export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const material_type = searchParams.get('material_type')
  const partner_id = searchParams.get('partner_id')
  const vendor_id = searchParams.get('vendor_id')
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const limit = Math.min(500, parseInt(searchParams.get('limit') || '200'))

  let q = supabaseAdmin
    .from('stock_movements')
    .select(`
      *,
      vendors(id, name),
      manufacturing_partners(id, name)
    `)
    .order('movement_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit)

  if (material_type) q = q.eq('material_type', material_type)
  if (partner_id) q = q.eq('manufacturing_partner_id', partner_id)
  if (vendor_id) q = q.eq('vendor_id', vendor_id)
  if (from) q = q.gte('movement_date', from)
  if (to) q = q.lte('movement_date', to)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ movements: data || [] })
}
