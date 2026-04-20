import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { notifyRetailerOrderUpdate } from '@/lib/whatsappNotify'
import { notifyRetailerOfferDecision } from '@/lib/readyToShipNotify'

/**
 * Master decisions on a Ready-to-Ship offer. Body:
 *   { offer_id, decision: 'accept'|'counter'|'reject', counter_price?, counter_note? }
 *
 * On accept: creates a real `orders` row pointed at the catalog product (if
 * any), marks the item `sold` and links it back, rejects every other pending
 * offer on the same item, and fires the WhatsApp ping to the winning retailer.
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
  const { data: offer, error: oerr } = await supabaseAdmin
    .from('ready_to_ship_offers')
    .select('*')
    .eq('id', body.offer_id)
    .eq('item_id', itemId)
    .maybeSingle<{
      id: string; item_id: string; partner_id: string; offer_price: number; status: string
    }>()
  if (oerr || !offer) return NextResponse.json({ error: oerr?.message || 'Offer not found' }, { status: 404 })
  if (offer.status !== 'pending' && offer.status !== 'countered') {
    return NextResponse.json({ error: `Offer already ${offer.status}` }, { status: 400 })
  }

  const { data: item, error: ierr } = await supabaseAdmin
    .from('ready_to_ship_items')
    .select('id, product_id, status, list_price, karat, gross_weight, pure_24kt_weight')
    .eq('id', itemId)
    .maybeSingle<{
      id: string; product_id: string | null; status: string; list_price: number;
      karat: number; gross_weight: number; pure_24kt_weight: number | null
    }>()
  if (ierr || !item) return NextResponse.json({ error: 'Item not found' }, { status: 404 })
  if (item.status !== 'available') return NextResponse.json({ error: `Item ${item.status}` }, { status: 400 })

  if (body.decision === 'reject') {
    await supabaseAdmin
      .from('ready_to_ship_offers')
      .update({ status: 'rejected', decided_at: new Date().toISOString(), decided_by: user.id || null })
      .eq('id', offer.id)
    await notifyRetailerOfferDecision({ offerId: offer.id, decision: 'rejected' })
    return NextResponse.json({ ok: true })
  }

  if (body.decision === 'counter') {
    const counter = Number(body.counter_price)
    if (!counter || counter <= 0) return NextResponse.json({ error: 'counter_price required' }, { status: 400 })
    await supabaseAdmin
      .from('ready_to_ship_offers')
      .update({
        status: 'countered',
        counter_price: counter,
        counter_note: body.counter_note || null,
        decided_at: new Date().toISOString(),
        decided_by: user.id || null,
      })
      .eq('id', offer.id)
    await notifyRetailerOfferDecision({ offerId: offer.id, decision: 'countered' })
    return NextResponse.json({ ok: true })
  }

  // accept — create the real customer order, mark the item sold, dismiss
  // every other pending offer for this item.
  const year = new Date().getFullYear()
  const { data: lastRow } = await supabaseAdmin
    .from('orders')
    .select('order_number')
    .ilike('order_number', `SH-ORD-${year}-%`)
    .order('order_number', { ascending: false })
    .limit(1)
    .returns<{ order_number: string }[]>()
  let seq = 1
  if (lastRow?.[0]?.order_number) {
    const m = String(lastRow[0].order_number).match(/(\d+)$/)
    if (m) seq = (parseInt(m[1]) || 0) + 1
  }

  const orderInsert: Record<string, unknown> = {
    order_number: `SH-ORD-${year}-${String(seq).padStart(3, '0')}`,
    partner_id: offer.partner_id,
    product_id: item.product_id,
    type: 'catalog',
    model: 'wholesale',
    quantity: 1,
    trade_price: offer.offer_price,
    total_amount: offer.offer_price,
    advance_paid: 0,
    balance_due: offer.offer_price,
    status: 'production', // already physically made
    order_date: new Date().toISOString().slice(0, 10),
    expected_delivery: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    selected_karat: item.karat,
    gold_karat: item.karat,
    gross_weight_at_karat: item.gross_weight,
    gold_pure_24kt_g: item.pure_24kt_weight,
    internal_notes: `Created from accepted Ready-to-Ship offer (item ${item.id})`,
  }

  let createdOrder: { id: string; order_number: string } | null = null
  let createErr: { message: string; code?: string } | null = null
  for (let attempt = 0; attempt < 5; attempt++) {
    orderInsert.order_number = `SH-ORD-${year}-${String(seq).padStart(3, '0')}`
    const r = await supabaseAdmin
      .from('orders')
      .insert([orderInsert])
      .select('id, order_number')
      .single()
    if (!r.error) { createdOrder = r.data; createErr = null; break }
    createErr = r.error as { message: string; code?: string }
    if (createErr.code === '23505') { seq += 1; continue }
    break
  }
  if (!createdOrder) {
    return NextResponse.json({ error: createErr?.message || 'Failed to create order' }, { status: 500 })
  }

  await supabaseAdmin
    .from('ready_to_ship_offers')
    .update({
      status: 'accepted',
      decided_at: new Date().toISOString(),
      decided_by: user.id || null,
      resulting_order_id: createdOrder.id,
    })
    .eq('id', offer.id)

  // Auto-reject every other pending offer on the same item.
  await supabaseAdmin
    .from('ready_to_ship_offers')
    .update({
      status: 'rejected',
      decided_at: new Date().toISOString(),
      decided_by: user.id || null,
    })
    .eq('item_id', itemId)
    .eq('status', 'pending')
    .neq('id', offer.id)

  await supabaseAdmin
    .from('ready_to_ship_items')
    .update({
      status: 'sold',
      sold_to_partner_id: offer.partner_id,
      sold_order_id: createdOrder.id,
      sold_at: new Date().toISOString(),
    })
    .eq('id', itemId)

  // Best-effort retailer pings: order is in production (physically already made)
  // so we send the offer-accepted note plus the existing dispatched-style ping
  // is reserved for actual dispatch.
  await notifyRetailerOfferDecision({ offerId: offer.id, decision: 'accepted', orderId: createdOrder.id })
  // Suppress unused-import warning while keeping the helper close at hand.
  void notifyRetailerOrderUpdate

  return NextResponse.json({ ok: true, order: createdOrder })
}
