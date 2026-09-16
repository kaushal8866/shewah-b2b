import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getMarket, computeDeliveryEstimate, isHighValueOrder } from '@/lib/markets'
import { resolveProductMarketPrice } from '@/lib/d2cPricing'
import { getPaymentGateway } from '@/lib/payments/provider'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const { customer, shippingAddress, items, notes } = body

    if (!customer?.email || !customer?.fullName) {
      return NextResponse.json({ error: 'Customer name and email are required.' }, { status: 400 })
    }
    if (!shippingAddress?.line1 || !shippingAddress?.city || !shippingAddress?.country) {
      return NextResponse.json({ error: 'Valid shipping address is required.' }, { status: 400 })
    }
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Cart is empty.' }, { status: 400 })
    }

    // 1. Enforce Market Locking by destination country
    const destinationCountry = shippingAddress.country.trim().toUpperCase()
    const activeMarket = getMarket(destinationCountry)

    // 2. Authoritatively recalculate every line item on the server
    let subtotal = 0
    let maxLeadDays = 14
    const frozenLineItems = []

    for (const item of items) {
      const qty = Math.max(1, Number(item.quantity) || 1)
      const pricing = await resolveProductMarketPrice(item.productId, activeMarket.code, item.config)

      const { data: product } = await supabaseAdmin
        .from('products')
        .select('id, code, name, d2c_title, category, photo_urls, d2c_crafting_lead_days')
        .eq('id', item.productId)
        .maybeSingle()

      if (!product || !pricing.isAvailable) {
        return NextResponse.json({
          error: `Product ${item.productId} is unavailable for order in ${activeMarket.name}.`,
        }, { status: 400 })
      }

      const itemLeadDays = product.d2c_crafting_lead_days || 14
      if (itemLeadDays > maxLeadDays) maxLeadDays = itemLeadDays

      const lineTotal = pricing.unitPrice * qty
      subtotal += lineTotal

      frozenLineItems.push({
        productId: product.id,
        code: product.code,
        name: product.d2c_title || product.name,
        category: product.category,
        photoUrl: product.photo_urls?.[0] || null,
        quantity: qty,
        unitPrice: pricing.unitPrice,
        lineTotal,
        currency: pricing.currency,
        config: item.config || {},
        taxModel: pricing.taxModel,
        taxAmount: pricing.taxAmount * qty,
      })
    }

    // 3. Calculate taxes and shipping
    let taxAmount = 0
    if (activeMarket.taxModel === 'inclusive') {
      const net = subtotal / (1 + activeMarket.taxRate)
      taxAmount = Math.round(subtotal - net)
    } else if (activeMarket.taxModel === 'exclusive') {
      taxAmount = Math.round(subtotal * activeMarket.taxRate)
    }

    const defaultShipping = activeMarket.shippingMethods.find(m => m.isDefault) || activeMarket.shippingMethods[0]
    const shippingAmount = defaultShipping ? defaultShipping.baseCost : 0

    const totalAmount = activeMarket.taxModel === 'exclusive'
      ? subtotal + taxAmount + shippingAmount
      : subtotal + shippingAmount

    // 4. Find or create Customer with explicit consents
    const cleanEmail = customer.email.trim().toLowerCase()
    const cleanPhone = (customer.phone || '').replace(/\D/g, '') || '919999999999'

    let customerId: string
    const { data: existingCustomer } = await supabaseAdmin
      .from('customers')
      .select('id')
      .eq('email', cleanEmail)
      .maybeSingle()

    if (existingCustomer) {
      customerId = existingCustomer.id
      // Update consents if newly submitted
      await supabaseAdmin.from('customers').update({
        full_name: customer.fullName,
        marketing_consent: Boolean(customer.marketingConsent),
        marketing_consent_at: customer.marketingConsent ? new Date().toISOString() : null,
        privacy_policy_agreed: Boolean(customer.privacyPolicyAgreed),
      }).eq('id', customerId)
    } else {
      const { data: newCust, error: custErr } = await supabaseAdmin
        .from('customers')
        .insert({
          full_name: customer.fullName,
          email: cleanEmail,
          whatsapp: cleanPhone,
          source: 'website_d2c',
          marketing_consent: Boolean(customer.marketingConsent),
          marketing_consent_at: customer.marketingConsent ? new Date().toISOString() : null,
          privacy_policy_agreed: Boolean(customer.privacyPolicyAgreed),
        })
        .select('id')
        .single()

      if (custErr) throw custErr
      customerId = newCust.id
    }

    // 5. Store Address in customer_addresses
    await supabaseAdmin.from('customer_addresses').insert({
      customer_id: customerId,
      label: 'Shipping',
      line1: shippingAddress.line1,
      line2: shippingAddress.line2 || null,
      city: shippingAddress.city,
      state: shippingAddress.state || null,
      pincode: shippingAddress.postalCode || '00000',
      country: shippingAddress.country,
      is_default: true,
    })

    // 6. High-Value Screening Gate (Market-Aware & Config-Driven)
    const orderReviewStatus = isHighValueOrder(totalAmount, activeMarket.code)
      ? 'pending_review'
      : 'not_required'

    // 7. Generate unique order number
    const year = new Date().getFullYear()
    const randSuffix = Math.floor(1000 + Math.random() * 9000)
    const orderNumber = `SH-D2C-${year}-${randSuffix}`

    const deliveryEstimate = computeDeliveryEstimate(maxLeadDays, activeMarket.code)
    const orderDate = new Date().toISOString().split('T')[0]
    const expectedDeliveryDate = deliveryEstimate.latestDate.toISOString().split('T')[0]

    // 8. Insert Order Record
    const { data: orderRow, error: orderErr } = await supabaseAdmin
      .from('orders')
      .insert({
        order_number: orderNumber,
        customer_id: customerId,
        audience: 'd2c',
        order_channel: 'd2c',
        order_review_status: orderReviewStatus,
        type: 'catalog',
        model: 'white_label',
        quantity: items.reduce((sum: number, it: any) => sum + (it.quantity || 1), 0),
        trade_price: subtotal,
        subtotal_amount: subtotal,
        tax_amount: taxAmount,
        shipping_amount: shippingAmount,
        total_amount: totalAmount,
        advance_paid: 0,
        currency: activeMarket.currency,
        status: 'brief_received',
        order_date: orderDate,
        expected_delivery: expectedDeliveryDate,
        expected_delivery_date: expectedDeliveryDate,
        special_notes: notes || null,
        internal_notes: `D2C web order from ${activeMarket.name}. Review status: ${orderReviewStatus}.`,
        payment_status: 'pending',
        shipping_address_snapshot: shippingAddress,
        d2c_items: frozenLineItems,
        price_snapshot_version: '1.0',
      })
      .select('id, order_number')
      .single()

    if (orderErr) throw orderErr

    // 9. Generate secure guest tracking token
    const journeyToken = crypto.randomBytes(24).toString('hex')
    const expiresAt = new Date(Date.now() + 90 * 86400000).toISOString() // 90 days validity

    await supabaseAdmin.from('customer_journey_links').insert({
      token: journeyToken,
      customer_id: customerId,
      order_id: orderRow.id,
      expires_at: expiresAt,
    })

    // 10. Create Payment Session
    const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || 'https://shewah.co'
    const gateway = getPaymentGateway()

    const paymentSession = await gateway.createSession({
      orderId: orderRow.id,
      orderNumber: orderRow.order_number,
      amount: totalAmount,
      currency: activeMarket.currency,
      customerEmail: cleanEmail,
      customerName: customer.fullName,
      successUrl: `${origin}/order-confirmation/${orderRow.id}`,
      cancelUrl: `${origin}/checkout?canceled=true`,
      metadata: {
        journeyToken,
        orderReviewStatus,
      },
    })

    return NextResponse.json({
      success: true,
      orderId: orderRow.id,
      orderNumber: orderRow.order_number,
      journeyToken,
      redirectUrl: paymentSession.redirectUrl,
      sessionId: paymentSession.sessionId,
      provider: paymentSession.provider,
    })
  } catch (err: any) {
    console.error('[POST /api/d2c/checkout/order] Error:', err)
    return NextResponse.json({ error: err?.message || 'Order creation failed' }, { status: 500 })
  }
}
