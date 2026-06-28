import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { notifyDiamondEvent } from '@/lib/diamondNotify'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    const user: any = session?.user
    if (!user || user.role !== 'retailer' || !user.partnerId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = params

    // 1. Fetch the Ask details
    const { data: ask, error: askErr } = await supabaseAdmin
      .from('cfg_diamond_asks')
      .select(`
        *,
        size:diamond_sizes(label, approx_carats),
        shape:diamond_shapes(name),
        quality:diamond_quality_buckets(label),
        color:diamond_color_buckets(label)
      `)
      .eq('id', id)
      .eq('partner_id', user.partnerId)
      .maybeSingle()

    if (askErr || !ask) {
      return NextResponse.json({ error: 'Negotiation ask not found' }, { status: 404 })
    }

    // 2. Validate current status & purchase window
    const now = new Date()
    let currentStatus = ask.status
    if (currentStatus === 'pending' && new Date(ask.expiry_at) < now) {
      currentStatus = 'expired'
    } else if (currentStatus === 'approved' && ask.purchase_window_expiry_at && new Date(ask.purchase_window_expiry_at) < now) {
      currentStatus = 'expired'
    }

    if (currentStatus !== 'approved') {
      return NextResponse.json({ error: `This ask cannot be purchased (current status: ${currentStatus})` }, { status: 400 })
    }

    // 3. Resolve the approved per-piece price
    const approxCarats = Number(ask.size?.approx_carats) || 0
    const approvedPrice = Number(ask.approved_price)
    let pricePerPiece = approvedPrice
    if (ask.approved_unit === 'per_ct') {
      pricePerPiece = approvedPrice * approxCarats
    }

    if (isNaN(pricePerPiece) || pricePerPiece <= 0) {
      return NextResponse.json({ error: 'Invalid approved price in ask record' }, { status: 500 })
    }

    const totalAmount = Math.round(pricePerPiece * ask.quantity)

    // 4. Fetch the latest gold rate for consistency
    let goldRate: number | null = null
    const { data: g } = await supabaseAdmin
      .from('gold_rates')
      .select('rate_24k')
      .order('recorded_at', { ascending: false })
      .limit(1)
    if (g?.[0]) goldRate = Number(g[0].rate_24k)

    const expectedDelivery = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10) // 7 days delivery
    const orderDate = now.toISOString().slice(0, 10)

    // Generate unique order number (re-try loop to handle concurrency safety)
    let createdOrder: any = null
    let dbError: any = null
    const year = now.getFullYear()

    for (let attempt = 0; attempt < 5; attempt++) {
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

      const orderNumber = `SH-ORD-${year}-${String(seq).padStart(3, '0')}`
      const specsStr = `${ask.size?.label || ''} ${ask.quality?.label || ''}-${ask.color?.label || ''} ${ask.shape?.name || ''} (${ask.diamond_type === 'lgd' ? 'LGD' : 'Natural'})`

      const { data: ord, error: ordErr } = await supabaseAdmin
        .from('orders')
        .insert([{
          order_number: orderNumber,
          partner_id: user.partnerId,
          product_id: null,
          type: 'loose_diamond',
          model: 'wholesale',
          quantity: ask.quantity,
          ring_size: null,
          special_notes: `Loose Diamond Procurement: ${specsStr}`,
          brief_text: `Diamond Procurement from approved Ask #${ask.id.slice(0, 8)}. Quantity: ${ask.quantity} pcs`,
          gold_rate_at_order: goldRate,
          trade_price: pricePerPiece,
          total_amount: totalAmount,
          advance_paid: 0,
          balance_due: totalAmount,
          order_date: orderDate,
          expected_delivery: expectedDelivery,
          status: 'brief_received',
          gold_source: 'self',
          making_charges: 0,
          cad_cost: 0,
          stone_cost: totalAmount,
          internal_notes: `Loose diamond order converted from Ask #${ask.id}`
        }])
        .select('*')
        .maybeSingle()

      if (ordErr) {
        dbError = ordErr
        if (ordErr.code === '23505') {
          // unique violation, retry
          continue
        }
        break
      }

      createdOrder = ord
      break
    }

    if (!createdOrder) {
      return NextResponse.json({ error: dbError?.message || 'Failed to generate order' }, { status: 500 })
    }

    // 5. Update the Ask record with converted status and order reference
    await supabaseAdmin
      .from('cfg_diamond_asks')
      .update({
        status: 'converted_to_order',
        order_id: createdOrder.id
      })
      .eq('id', ask.id)

    // 6. Trigger order placed notifications to admin
    const { data: partner } = await supabaseAdmin
      .from('partners')
      .select('store_name')
      .eq('id', user.partnerId)
      .maybeSingle()

    const specsStr = `${ask.size?.label || ''} ${ask.quality?.label || ''}-${ask.color?.label || ''} ${ask.shape?.name || ''} (${ask.diamond_type === 'lgd' ? 'LGD' : 'Natural'})`

    await notifyDiamondEvent('order_placed', {
      partnerName: partner?.store_name || 'Retailer',
      specs: specsStr,
      quantity: ask.quantity,
      orderNumber: createdOrder.order_number,
      askId: ask.id.slice(0, 8)
    })

    return NextResponse.json({ order: createdOrder })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
