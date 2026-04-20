import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { notifyRetailerOfferDecision } from '@/lib/readyToShipNotify'

/**
 * Master decisions on a Ready-to-Ship offer. Body:
 *   { offer_id, decision: 'accept'|'counter'|'reject', counter_price?, counter_note? }
 *
 * Accept is delegated to the `accept_ready_to_ship_offer` plpgsql function
 * so order creation, sibling-offer rejection, and the item flip-to-sold all
 * land in a single transaction. WhatsApp pings are best-effort and run
 * after the database commit.
 */
type Body = {
  offer_id: string
  decision: 'accept' | 'counter' | 'reject'
  counter_price?: number
  counter_note?: string | null
}

export async function POST(req: Request, ctx: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const user = session?.user as { role?: string; id?: string } | undefined
  if (!user || (user.role !== 'master' && user.role !== 'admin' && user.role !== 'sub')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: Body
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }

  const itemId = ctx.params.id

  if (body.decision === 'reject') {
    const { data: updated, error } = await supabaseAdmin
      .from('ready_to_ship_offers')
      .update({ status: 'rejected', decided_at: new Date().toISOString(), decided_by: user.id || null })
      .eq('id', body.offer_id)
      .eq('item_id', itemId)
      .in('status', ['pending', 'countered'])
      .select('id')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!updated || updated.length === 0) {
      return NextResponse.json({ error: 'Offer is no longer open or does not match this item' }, { status: 409 })
    }
    await notifyRetailerOfferDecision({ offerId: body.offer_id, decision: 'rejected' })
    return NextResponse.json({ ok: true })
  }

  if (body.decision === 'counter') {
    const counter = Number(body.counter_price)
    if (!counter || counter <= 0) return NextResponse.json({ error: 'counter_price required' }, { status: 400 })
    const { data: updated, error } = await supabaseAdmin
      .from('ready_to_ship_offers')
      .update({
        status: 'countered',
        counter_price: counter,
        counter_note: body.counter_note || null,
        decided_at: new Date().toISOString(),
        decided_by: user.id || null,
      })
      .eq('id', body.offer_id)
      .eq('item_id', itemId)
      .in('status', ['pending', 'countered'])
      .select('id')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!updated || updated.length === 0) {
      return NextResponse.json({ error: 'Offer is no longer open or does not match this item' }, { status: 409 })
    }
    await notifyRetailerOfferDecision({ offerId: body.offer_id, decision: 'countered' })
    return NextResponse.json({ ok: true })
  }

  // Accept — single atomic RPC.
  const { data: rpcRows, error: rpcErr } = await supabaseAdmin.rpc('accept_ready_to_ship_offer', {
    p_item_id: itemId,
    p_offer_id: body.offer_id,
    p_decided_by: user.id || null,
  })
  if (rpcErr) return NextResponse.json({ error: rpcErr.message }, { status: 500 })

  const created = Array.isArray(rpcRows) && rpcRows.length > 0
    ? rpcRows[0] as { order_id: string; order_number: string }
    : null
  if (!created) return NextResponse.json({ error: 'Failed to create order' }, { status: 500 })

  await notifyRetailerOfferDecision({ offerId: body.offer_id, decision: 'accepted', orderId: created.order_id })

  return NextResponse.json({ ok: true, order: { id: created.order_id, order_number: created.order_number } })
}
