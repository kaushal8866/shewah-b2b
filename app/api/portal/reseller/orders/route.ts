import { NextResponse } from 'next/server'
import { getResellerSession } from '@/lib/resellerAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { safeDbError } from '@/lib/sanitizeDbError'
import { notifyResellerEvent } from '@/lib/resellerNotify'

export async function GET() {
  const { reseller, error } = await getResellerSession()
  if (error || !reseller) {
    return NextResponse.json({ error: error || 'Forbidden' }, { status: 403 })
  }

  // Fetch orders with product details
  const { data: orders, error: dbErr } = await supabaseAdmin
    .from('reseller_orders')
    .select('*, products(code, name, photo_urls)')
    .eq('reseller_id', reseller.id)
    .order('created_at', { ascending: false })

  if (dbErr) {
    return NextResponse.json({ error: safeDbError(dbErr, 'reseller.orders.list', 'Could not load orders.') }, { status: 500 })
  }

  return NextResponse.json({ orders })
}

export async function POST(req: Request) {
  const { reseller, error } = await getResellerSession()
  if (error || !reseller) {
    return NextResponse.json({ error: error || 'Forbidden' }, { status: 403 })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const {
    product_id,
    quantity,
    ring_size,
    custom_attributes,
    customer_selling_price_paise,
    shipping_name,
    shipping_phone,
    shipping_address
  } = body

  if (!product_id || !quantity || !customer_selling_price_paise || !shipping_name || !shipping_phone || !shipping_address) {
    return NextResponse.json({ error: 'Missing required order fields' }, { status: 400 })
  }

  // 1. Fetch product and reseller floor price
  const { data: floorPriceRow } = await supabaseAdmin
    .from('reseller_product_prices')
    .select('floor_price_paise')
    .eq('product_id', product_id)
    .maybeSingle()

  if (!floorPriceRow) {
    return NextResponse.json({ error: 'This product is not enabled for resellers' }, { status: 403 })
  }

  const { data: product } = await supabaseAdmin
    .from('products')
    .select('name, code')
    .eq('id', product_id)
    .single()

  const floorCostPaise = Number(floorPriceRow.floor_price_paise)
  const qty = Number(quantity) || 1
  const sellingPricePaise = Number(customer_selling_price_paise)

  // Verify selling price is not below the floor cost
  const totalFloorCostPaise = floorCostPaise * qty
  if (sellingPricePaise < totalFloorCostPaise) {
    return NextResponse.json({ error: `Selling price (₹${sellingPricePaise / 100}) cannot be less than your cost (₹${totalFloorCostPaise / 100})` }, { status: 400 })
  }

  // 2. Fetch order payment deadline hour setting
  const { data: paymentHoursSetting } = await supabaseAdmin
    .from('settings')
    .select('value')
    .eq('key', 'reseller_order_payment_hours')
    .maybeSingle()
  const hours = Number(paymentHoursSetting?.value) || 48
  const deadline = new Date()
  deadline.setHours(deadline.getHours() + hours)

  // 3. Generate serial order number
  const { count } = await supabaseAdmin
    .from('reseller_orders')
    .select('*', { count: 'exact', head: true })
  const serialNumber = (count || 0) + 10001
  const orderNumber = `RSL-${serialNumber}`

  // 4. Calculate reseller earnings
  const earningsPaise = sellingPricePaise - totalFloorCostPaise

  // 5. Insert order
  const { data: newOrder, error: orderErr } = await supabaseAdmin
    .from('reseller_orders')
    .insert({
      order_number: orderNumber,
      reseller_id: reseller.id,
      product_id,
      quantity: qty,
      ring_size: ring_size || null,
      custom_attributes: custom_attributes || {},
      customer_selling_price_paise: sellingPricePaise,
      reseller_cost_paise: totalFloorCostPaise,
      reseller_earnings_paise: earningsPaise,
      payment_status: 'pending',
      shipping_name,
      shipping_phone,
      shipping_address,
      status: 'payment_pending',
      payment_deadline: deadline.toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .select('*')
    .single()

  if (orderErr) {
    return NextResponse.json({ error: safeDbError(orderErr, 'reseller.orders.create', 'Could not create your order.') }, { status: 500 })
  }

  // 6. Update reseller customer registry
  // Upsert the customer detail records
  try {
    const { data: existingCust } = await supabaseAdmin
      .from('reseller_customers')
      .select('*')
      .eq('reseller_id', reseller.id)
      .eq('phone', shipping_phone)
      .maybeSingle()

    if (existingCust) {
      await supabaseAdmin
        .from('reseller_customers')
        .update({
          last_order_date: new Date().toISOString(),
          total_orders: existingCust.total_orders + 1,
          total_value_paise: Number(existingCust.total_value_paise) + sellingPricePaise,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingCust.id)
    } else {
      await supabaseAdmin
        .from('reseller_customers')
        .insert({
          reseller_id: reseller.id,
          name: shipping_name,
          phone: shipping_phone,
          first_order_date: new Date().toISOString(),
          last_order_date: new Date().toISOString(),
          total_orders: 1,
          total_value_paise: sellingPricePaise,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
    }
  } catch (custErr) {
    console.error('Failed to update reseller customer registry:', custErr)
  }

  // 7. Fire WhatsApp notifications
  await notifyResellerEvent('order_placed_reseller', {
    toPhone: reseller.phone,
    name: reseller.owner_name,
    orderNumber,
    productName: product?.name || product?.code || 'Jewelry Piece',
    floorPricePaise: totalFloorCostPaise,
    deadline: deadline.toISOString()
  }).catch(() => {})

  await notifyResellerEvent('order_placed_admin', {
    orderNumber,
    resellerName: reseller.store_name,
    productName: product?.name || product?.code || 'Jewelry Piece',
    floorPricePaise: totalFloorCostPaise
  }).catch(() => {})

  return NextResponse.json({ order: newOrder })
}
