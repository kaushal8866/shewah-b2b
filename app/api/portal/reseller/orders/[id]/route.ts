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

  return NextResponse.json({ order, payments: payments || [] })
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
