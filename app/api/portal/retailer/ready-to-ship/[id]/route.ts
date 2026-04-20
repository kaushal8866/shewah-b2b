import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

async function getRetailerUser() {
  const session = await getServerSession(authOptions)
  const user = session?.user as { role?: string; partnerId?: string; username?: string; id?: string } | undefined
  if (!user || user.role !== 'retailer' || !user.partnerId) return null
  return user
}

/** Submit (or replace) this retailer's offer on a Ready-to-Ship piece. */
export async function POST(req: Request, ctx: { params: { id: string } }) {
  const user = await getRetailerUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: { offer_price?: number; note?: string | null } = {}
  try { body = await req.json() } catch {}
  const offerPrice = Number(body.offer_price)
  if (!offerPrice || offerPrice <= 0) return NextResponse.json({ error: 'offer_price required' }, { status: 400 })

  // Validate item is still listed.
  const { data: item } = await supabaseAdmin
    .from('ready_to_ship_items')
    .select('id, status')
    .eq('id', ctx.params.id)
    .maybeSingle<{ id: string; status: string }>()
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (item.status !== 'available') return NextResponse.json({ error: 'Item is no longer available' }, { status: 400 })

  // Withdraw any prior pending/countered offer from this retailer on the same item.
  await supabaseAdmin
    .from('ready_to_ship_offers')
    .update({ status: 'withdrawn', decided_at: new Date().toISOString() })
    .eq('item_id', item.id)
    .eq('partner_id', user.partnerId)
    .in('status', ['pending', 'countered'])

  const { data: created, error } = await supabaseAdmin
    .from('ready_to_ship_offers')
    .insert([{
      item_id: item.id,
      partner_id: user.partnerId,
      offer_price: offerPrice,
      note: body.note || null,
      status: 'pending',
    }])
    .select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ offer: created })
}
