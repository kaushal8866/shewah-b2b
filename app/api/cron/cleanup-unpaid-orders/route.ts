import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { notifyResellerEvent } from '@/lib/resellerNotify'

export async function GET(req: Request) {
  // Allow authorization header verification if security token is configured
  const authHeader = req.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized CRON request' }, { status: 401 })
  }

  try {
    const now = new Date().toISOString()

    // 1. Find all pending payment orders that have crossed their deadline
    const { data: overdueOrders, error: fetchErr } = await supabaseAdmin
      .from('reseller_orders')
      .select(`
        *,
        resellers (
          phone,
          owner_name
        ),
        products (
          code,
          name
        )
      `)
      .eq('status', 'payment_pending')
      .lt('payment_deadline', now)

    if (fetchErr) {
      console.error('[CRON Cleanup] Error loading overdue orders:', fetchErr.message)
      return NextResponse.json({ error: fetchErr.message }, { status: 500 })
    }

    if (!overdueOrders || overdueOrders.length === 0) {
      return NextResponse.json({ processed: 0, message: 'No overdue reseller orders found.' })
    }

    console.log(`[CRON Cleanup] Found ${overdueOrders.length} overdue reseller orders. Initiating cancellation...`)

    let cancelledCount = 0

    for (const order of overdueOrders) {
      // 2. Cancel order
      const { error: cancelErr } = await supabaseAdmin
        .from('reseller_orders')
        .update({
          status: 'cancelled',
          updated_at: new Date().toISOString()
        })
        .eq('id', order.id)

      if (cancelErr) {
        console.error(`[CRON Cleanup] Failed to cancel order ${order.order_number}:`, cancelErr.message)
        continue
      }

      cancelledCount++

      // 3. Notify reseller of payment deadline cancellation
      if (order.resellers?.phone) {
        const prodName = order.products?.code || 'Jewelry SKU'
        await notifyResellerEvent('order_status_update', {
          toPhone: order.resellers.phone,
          orderNumber: order.order_number,
          productName: prodName,
          status: 'Cancelled (Payment Deadline Crossed)'
        }).catch((err) => {
          console.error(`[CRON Cleanup] Notification failed for order ${order.order_number}:`, err?.message || err)
        })
      }
    }

    return NextResponse.json({
      processed: overdueOrders.length,
      cancelled: cancelledCount,
      message: `Successfully cancelled ${cancelledCount} unpaid reseller orders.`
    })

  } catch (err: any) {
    console.error('[CRON Cleanup] Critical exception:', err?.message || err)
    return NextResponse.json({ error: err?.message || 'Server crash' }, { status: 500 })
  }
}
