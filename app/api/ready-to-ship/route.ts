import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  const user = session?.user as { role?: string } | undefined
  if (!user || (user.role !== 'master' && user.role !== 'admin' && user.role !== 'sub')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') || 'available'
  const { data, error } = await supabaseAdmin
    .from('ready_to_ship_items')
    .select('*, product:products(id, code, name, photo_urls), source_mfg_order:manufacturing_orders!source_mfg_order_id(id, order_number)')
    .eq('status', status)
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const items = data || []
  const ids = items.map((i: { id: string }) => i.id)
  let offerCounts: Record<string, number> = {}
  if (ids.length > 0) {
    const { data: ofs } = await supabaseAdmin
      .from('ready_to_ship_offers')
      .select('item_id, status')
      .in('item_id', ids)
      .eq('status', 'pending')
    for (const o of (ofs || []) as { item_id: string }[]) {
      offerCounts[o.item_id] = (offerCounts[o.item_id] || 0) + 1
    }
  }

  return NextResponse.json({
    items: items.map((i: Record<string, unknown>) => ({ ...i, pending_offers: offerCounts[i.id as string] || 0 })),
  })
}
