import { NextResponse } from 'next/server'
import { getResellerSession } from '@/lib/resellerAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { safeDbError } from '@/lib/sanitizeDbError'
import { notifyResellerEvent } from '@/lib/resellerNotify'

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const { reseller, error } = await getResellerSession()
  if (error || !reseller) {
    return NextResponse.json({ error: error || 'Forbidden' }, { status: 403 })
  }

  const orderId = params.id

  // Fetch order details
  const { data: order, error: dbErr } = await supabaseAdmin
    .from('reseller_orders')
    .select('*, products(code, name, photo_urls, ref_karat, ref_color)')
    .eq('id', orderId)
    .eq('reseller_id', reseller.id)
    .maybeSingle()

  if (dbErr) {
    return NextResponse.json({ error: safeDbError(dbErr, 'reseller.orders.detail', 'Could not load order details.') }, { status: 500 })
  }
  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  // Fetch associated payments
  const { data: payments } = await supabaseAdmin
    .from('reseller_payments')
    .select('*')
    .eq('linked_order_id', orderId)
    .order('created_at', { ascending: false })

  let groupOrders: any[] = []
  if (order.set_order_group_id) {
    const { data: gData } = await supabaseAdmin
      .from('reseller_orders')
      .select('*, products(code, name, photo_urls, ref_karat, ref_color)')
      .eq('set_order_group_id', order.set_order_group_id)
      .eq('reseller_id', reseller.id)
    groupOrders = gData || []
  }

  return NextResponse.json({ order, payments: payments || [], groupOrders })
}

// Resellers submit proof of payment for this order
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { reseller, error } = await getResellerSession()
  if (error || !reseller) {
    return NextResponse.json({ error: error || 'Forbidden' }, { status: 403 })
  }

  const orderId = params.id

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const { payment_method, transaction_reference, proof_screenshot_url } = body

  if (!payment_method || !proof_screenshot_url) {
    return NextResponse.json({ error: 'Payment method and screenshot proof are required' }, { status: 400 })
  }

  // 1. Fetch order details to get total cost
  const { data: order, error: orderErr } = await supabaseAdmin
    .from('reseller_orders')
    .select('*')
    .eq('id', orderId)
    .eq('reseller_id', reseller.id)
    .maybeSingle()

  if (orderErr || !order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  // 2. Insert reseller payment row
  const { data: newPayment, error: payErr } = await supabaseAdmin
    .from('reseller_payments')
    .insert({
      reseller_id: reseller.id,
      amount_paise: order.reseller_cost_paise, // full floor price amount
      payment_method,
      transaction_reference: transaction_reference || null,
      proof_screenshot_url,
      payment_type: 'order_payment',
      linked_order_id: orderId,
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .select('*')
    .single()

  if (payErr) {
    return NextResponse.json({ error: safeDbError(payErr, 'reseller.orders.upload_payment', 'Could not save payment proof.') }, { status: 500 })
  }

  // 3. Notify admins on WhatsApp
  await notifyResellerEvent('payment_uploaded', {
    resellerName: reseller.store_name,
    orderNumber: order.order_number,
    amountPaise: order.reseller_cost_paise
  }).catch(() => {})

  return NextResponse.json({ payment: newPayment })
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const { reseller, error } = await getResellerSession()
  if (error || !reseller) {
    return NextResponse.json({ error: error || 'Forbidden' }, { status: 403 })
  }

  const orderId = params.id
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const { action, rejection_reason } = body

  // Fetch order details
  const { data: order, error: orderErr } = await supabaseAdmin
    .from('reseller_orders')
    .select('*')
    .eq('id', orderId)
    .eq('reseller_id', reseller.id)
    .maybeSingle()

  if (orderErr || !order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  if (action === 'confirm') {
    if (order.status !== 'customer_placed') {
      return NextResponse.json({ error: 'Order is already processed' }, { status: 400 })
    }

    let confirmQuery = supabaseAdmin.from('reseller_orders').update({
      status: 'payment_pending',
      updated_at: new Date().toISOString()
    })
    if (order.set_order_group_id) {
      confirmQuery = confirmQuery.eq('set_order_group_id', order.set_order_group_id)
    } else {
      confirmQuery = confirmQuery.eq('id', orderId)
    }
    const { data: updatedRows, error: updErr } = await confirmQuery.select('*')

    if (updErr || !updatedRows || updatedRows.length === 0) {
      return NextResponse.json({ error: 'Could not confirm order: ' + (updErr?.message || 'No rows updated') }, { status: 500 })
    }
    const updated = updatedRows.find((r: any) => r.id === orderId) || updatedRows[0]
    
    // Log system message in chat thread
    await supabaseAdmin.from('reseller_messages').insert({
      reseller_id: reseller.id,
      sender_role: 'system',
      body: `Reseller ${reseller.owner_name} has confirmed customer storefront order ${order.order_number}. Awaiting floor price payment confirmation.`,
      thread_type: 'order',
      linked_order_id: orderId
    })

    return NextResponse.json({ order: updated })
  }

  if (action === 'reject') {
    if (order.status !== 'customer_placed') {
      return NextResponse.json({ error: 'Order is already processed' }, { status: 400 })
    }

    let rejectQuery = supabaseAdmin.from('reseller_orders').update({
      status: 'cancelled',
      custom_attributes: {
        ...order.custom_attributes,
        rejection_reason: rejection_reason || 'Rejected by reseller boutique'
      },
      updated_at: new Date().toISOString()
    })
    if (order.set_order_group_id) {
      rejectQuery = rejectQuery.eq('set_order_group_id', order.set_order_group_id)
    } else {
      rejectQuery = rejectQuery.eq('id', orderId)
    }
    const { data: updatedRows, error: updErr } = await rejectQuery.select('*')

    if (updErr || !updatedRows || updatedRows.length === 0) {
      return NextResponse.json({ error: 'Could not reject order: ' + (updErr?.message || 'No rows updated') }, { status: 500 })
    }
    const updated = updatedRows.find((r: any) => r.id === orderId) || updatedRows[0]

    return NextResponse.json({ order: updated })
  }

  if (action === 'mark-paid') {
    let paidQuery = supabaseAdmin.from('reseller_orders').update({
      customer_payment_status: 'paid',
      updated_at: new Date().toISOString()
    })
    if (order.set_order_group_id) {
      paidQuery = paidQuery.eq('set_order_group_id', order.set_order_group_id)
    } else {
      paidQuery = paidQuery.eq('id', orderId)
    }
    const { data: updatedRows, error: updErr } = await paidQuery.select('*')

    if (updErr || !updatedRows || updatedRows.length === 0) {
      return NextResponse.json({ error: 'Could not update payment status: ' + (updErr?.message || 'No rows updated') }, { status: 500 })
    }
    const updated = updatedRows.find((r: any) => r.id === orderId) || updatedRows[0]

    return NextResponse.json({ order: updated })
  }

  return NextResponse.json({ error: 'Unsupported action' }, { status: 400 })
}
