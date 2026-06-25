import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { notifyResellerEvent } from '@/lib/resellerNotify'

export async function POST(req: Request) {
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const { event, toPhone, productName, orderNumber, ...rest } = body

  if (!event || !toPhone) {
    return NextResponse.json({ error: 'Event type and recipient are required' }, { status: 400 })
  }

  // 1. Resolve UUID reseller_id to actual phone number if needed
  let resolvedPhone = toPhone
  let resellerName = ''
  if (toPhone.match(/^[0-9a-fA-F-]{36}$/)) {
    const { data: resRow } = await supabaseAdmin
      .from('resellers')
      .select('phone, owner_name, store_name')
      .eq('id', toPhone)
      .maybeSingle()
    if (resRow?.phone) {
      resolvedPhone = resRow.phone
      resellerName = resRow.store_name || resRow.owner_name
    }
  }

  // 2. Resolve UUID product_id to readable SKU details if needed
  let resolvedProduct = productName || ''
  if (productName && productName.match(/^[0-9a-fA-F-]{36}$/)) {
    const { data: prodRow } = await supabaseAdmin
      .from('products')
      .select('code, name')
      .eq('id', productName)
      .maybeSingle()
    if (prodRow) {
      resolvedProduct = `${prodRow.code} · ${prodRow.name}`
    }
  }

  // 3. Resolve UUID order_id to order number if needed
  let resolvedOrder = orderNumber || ''
  if (orderNumber && orderNumber.match(/^[0-9a-fA-F-]{36}$/)) {
    const { data: ordRow } = await supabaseAdmin
      .from('reseller_orders')
      .select('order_number')
      .eq('id', orderNumber)
      .maybeSingle()
    if (ordRow) {
      resolvedOrder = ordRow.order_number
    }
  }

  // Dispatch notification using the template engine
  await notifyResellerEvent(event, {
    toPhone: resolvedPhone,
    productName: resolvedProduct,
    orderNumber: resolvedOrder,
    resellerName,
    ...rest
  })

  return NextResponse.json({ ok: true })
}
