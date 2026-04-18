import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// Fields the retailer is allowed to see. Internal financials (gold weights, COGS,
// margin, manufacturer assignment, internal notes, locked gold rate) are excluded.
const LIST_COLS = `
  id, order_number, status, type, model, quantity, ring_size, special_notes, brief_text,
  trade_price, total_amount, advance_paid, balance_due,
  order_date, expected_delivery, dispatch_date, actual_delivery,
  courier, tracking_number, brief_images, product_id,
  product:products ( id, code, name, photo_urls )
`

async function getRetailerUser() {
  const session = await getServerSession(authOptions)
  const user: any = session?.user
  if (!user || user.role !== 'retailer' || !user.partnerId) return null
  return user
}

export async function GET(req: Request) {
  const user = await getRetailerUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const limit = Math.min(parseInt(searchParams.get('limit') || '100') || 100, 200)

  const { data, error } = await supabaseAdmin
    .from('orders')
    .select(LIST_COLS)
    .eq('partner_id', user.partnerId)
    .order('order_date', { ascending: false })
    .limit(limit)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ orders: data || [] })
}

export async function POST(req: Request) {
  const user = await getRetailerUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }

  const type = body.type === 'custom' ? 'custom' : 'catalog'
  const quantity = Math.max(parseInt(body.quantity) || 1, 1)
  const ringSize = typeof body.ring_size === 'string' && body.ring_size.trim() ? body.ring_size.trim() : null
  const specialNotes = typeof body.special_notes === 'string' && body.special_notes.trim() ? body.special_notes.trim() : null
  const briefText = type === 'custom' && typeof body.brief_text === 'string' ? body.brief_text.trim() : null
  const briefImages = Array.isArray(body.reference_images)
    ? body.reference_images.filter((u: any) => typeof u === 'string').slice(0, 20)
    : []

  if (type === 'catalog' && !body.product_id) {
    return NextResponse.json({ error: 'Pick a product' }, { status: 400 })
  }
  if (type === 'custom' && !briefText) {
    return NextResponse.json({ error: 'Please describe what you need' }, { status: 400 })
  }

  // Pull product info for catalog orders to derive trade_price + delivery date.
  let productRow: any = null
  if (type === 'catalog') {
    const { data: p, error: pe } = await supabaseAdmin
      .from('products')
      .select('id, trade_price, delivery_days, gold_karat, gold_weight_g, making_charges')
      .eq('id', body.product_id)
      .eq('is_active', true)
      .maybeSingle()
    if (pe) return NextResponse.json({ error: pe.message }, { status: 500 })
    if (!p) return NextResponse.json({ error: 'Product not available' }, { status: 400 })
    productRow = p
  }

  // Latest gold rate (locks the rate at order time, same as admin order form).
  let goldRate = 0
  const { data: g } = await supabaseAdmin
    .from('gold_rates')
    .select('rate_24k')
    .order('recorded_at', { ascending: false })
    .limit(1)
  if (g?.[0]) goldRate = g[0].rate_24k

  const tradePrice = productRow?.trade_price || 0
  const totalAmount = tradePrice * quantity
  const deliveryDays = productRow?.delivery_days || 21
  const expectedDelivery = new Date(Date.now() + deliveryDays * 86400000).toISOString().slice(0, 10)
  const orderDate = new Date().toISOString().slice(0, 10)

  // Compute a starting sequence based on the highest existing order_number for
  // this year. We retry on unique-violation (23505) so concurrent submissions
  // do not collide.
  const year = new Date().getFullYear()
  const { data: lastRow } = await supabaseAdmin
    .from('orders')
    .select('order_number')
    .ilike('order_number', `SH-ORD-${year}-%`)
    .order('order_number', { ascending: false })
    .limit(1)
  let seq = 1
  if (lastRow?.[0]?.order_number) {
    const m = String(lastRow[0].order_number).match(/(\d+)$/)
    if (m) seq = (parseInt(m[1]) || 0) + 1
  }

  const insert: any = {
    order_number: `SH-ORD-${year}-${String(seq).padStart(3, '0')}`,
    partner_id: user.partnerId,
    product_id: type === 'catalog' ? body.product_id : null,
    type,
    model: 'wholesale',
    quantity,
    ring_size: ringSize,
    special_notes: specialNotes,
    brief_text: briefText,
    brief_images: briefImages,
    gold_rate_at_order: goldRate,
    trade_price: tradePrice,
    total_amount: totalAmount,
    advance_paid: 0,
    balance_due: totalAmount,
    order_date: orderDate,
    expected_delivery: expectedDelivery,
    status: 'brief_received',
    gold_source: 'self',
    gold_weight_estimated: productRow?.gold_weight_g || null,
    making_charges: productRow?.making_charges || null,
    cad_cost: 0,
    stone_cost: 0,
    internal_notes: `Placed via retailer portal by ${user.username}`,
  }

  let created: any = null
  let error: any = null
  for (let attempt = 0; attempt < 5; attempt++) {
    insert.order_number = `SH-ORD-${year}-${String(seq).padStart(3, '0')}`
    const r = await supabaseAdmin
      .from('orders')
      .insert([insert])
      .select('id, order_number, status')
      .single()
    if (!r.error) { created = r.data; error = null; break }
    error = r.error
    // Postgres unique-violation -> bump sequence and retry.
    if ((r.error as any).code === '23505' && r.error.message?.includes('order_number')) {
      seq += 1
      continue
    }
    break
  }

  if (error) {
    // The COGS columns from Task #5 may not be present in every environment.
    // Retry without those optional columns so the portal still works.
    if (error.message?.match(/gold_source|gold_weight_estimated|making_charges|cad_cost|stone_cost|gold_karat|brief_images/)) {
      const minimal = {
        order_number: insert.order_number,
        partner_id: insert.partner_id,
        product_id: insert.product_id,
        type: insert.type,
        model: insert.model,
        quantity: insert.quantity,
        ring_size: insert.ring_size,
        special_notes: insert.special_notes,
        brief_text: insert.brief_text,
        gold_rate_at_order: insert.gold_rate_at_order,
        trade_price: insert.trade_price,
        total_amount: insert.total_amount,
        advance_paid: insert.advance_paid,
        balance_due: insert.balance_due,
        order_date: insert.order_date,
        expected_delivery: insert.expected_delivery,
        status: insert.status,
        internal_notes: insert.internal_notes,
      }
      const retry = await supabaseAdmin
        .from('orders')
        .insert([minimal])
        .select('id, order_number, status')
        .single()
      if (retry.error) return NextResponse.json({ error: retry.error.message }, { status: 500 })
      return NextResponse.json({ order: retry.data })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ order: created })
}
