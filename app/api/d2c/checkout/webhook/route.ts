import { NextRequest, NextResponse } from 'next/server'
import { getPaymentGateway } from '@/lib/payments/provider'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text()
    const signature = req.headers.get('stripe-signature') || req.headers.get('x-payment-signature') || ''

    const gateway = getPaymentGateway()
    const verification = await gateway.verifyWebhook(rawBody, signature)

    if (!verification.isValid) {
      console.warn('[Webhook] Verification failed:', verification.error)
      return NextResponse.json({ error: verification.error || 'Invalid signature' }, { status: 400 })
    }

    const { orderId, paymentReference } = verification
    if (!orderId) {
      // Non-order event, acknowledge receipt
      return NextResponse.json({ received: true })
    }

    // 1. Fetch current order state
    const { data: order, error: fetchErr } = await supabaseAdmin
      .from('orders')
      .select('id, order_number, payment_status, order_review_status, total_amount')
      .eq('id', orderId)
      .maybeSingle()

    if (fetchErr || !order) {
      console.error(`[Webhook] Order not found for id: ${orderId}`)
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Idempotency: if already marked paid, return success immediately
    if (order.payment_status === 'paid') {
      return NextResponse.json({ received: true, message: 'Order already confirmed' })
    }

    // 2. Update payment status
    const updatePayload: any = {
      payment_status: 'paid',
      payment_reference: paymentReference || null,
      updated_at: new Date().toISOString(),
    }

    // High-value / operational review gate check:
    // If order does not require special high-value screening, advance status to order_confirmed
    if (order.order_review_status === 'not_required' || order.order_review_status === 'approved') {
      updatePayload.status = 'order_confirmed'
    } else {
      // Held for operational review
      updatePayload.status = 'brief_received'
      console.log(`[Webhook] Order ${order.order_number} held for operational high-value review.`)
    }

    const { error: updateErr } = await supabaseAdmin
      .from('orders')
      .update(updatePayload)
      .eq('id', orderId)

    if (updateErr) throw updateErr

    console.log(`[Webhook] Successfully confirmed payment for order ${order.order_number}`)
    return NextResponse.json({ received: true, orderNumber: order.order_number })
  } catch (err: any) {
    console.error('[POST /api/d2c/checkout/webhook] Error:', err)
    return NextResponse.json({ error: err?.message || 'Webhook processing failed' }, { status: 500 })
  }
}
