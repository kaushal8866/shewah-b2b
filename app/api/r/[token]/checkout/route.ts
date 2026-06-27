import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getStorefrontCustomer } from '@/lib/storefrontAuth'
import { safeDbError } from '@/lib/sanitizeDbError'
import { computeKaratPricing } from '@/lib/karat'

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const token = params.token
  
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const {
    items,
    shipping_name,
    shipping_phone,
    shipping_address,
    customer_notes,
    promo_code
  } = body

  if (!items || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: 'Cart items are required for checkout' }, { status: 400 })
  }
  if (!shipping_name || !shipping_phone || !shipping_address) {
    return NextResponse.json({ error: 'Shipping details are required' }, { status: 400 })
  }

  // 1. Resolve reseller storefront details
  const { data: shareLink } = await supabaseAdmin
    .from('reseller_share_links')
    .select('id, reseller_id, markup_percent')
    .eq('link_token', token)
    .eq('is_active', true)
    .maybeSingle()

  if (!shareLink) {
    return NextResponse.json({ error: 'Storefront not found or inactive' }, { status: 404 })
  }

  // Verify reseller status is active
  const { data: reseller } = await supabaseAdmin
    .from('resellers')
    .select('status')
    .eq('id', shareLink.reseller_id)
    .single()

  if (!reseller || reseller.status !== 'active') {
    return NextResponse.json({ error: 'Storefront is inactive or pending activation.' }, { status: 403 })
  }

  const resellerId = shareLink.reseller_id
  const markupPercent = Number(shareLink.markup_percent) || 0

  // 2. Fetch optional logged-in customer session
  const customer = await getStorefrontCustomer()

  // 3. Validate promo code if provided
  let discountType = 'none'
  let discountValue = 0
  if (promo_code) {
    const { data: coupon } = await supabaseAdmin
      .from('reseller_storefront_coupons')
      .select('*')
      .eq('reseller_id', resellerId)
      .eq('code', promo_code.trim().toUpperCase())
      .eq('is_active', true)
      .maybeSingle()

    if (coupon && (!coupon.expires_at || new Date(coupon.expires_at) > new Date())) {
      discountType = coupon.discount_type
      discountValue = Number(coupon.discount_value)
    }
  }

  // 4. Resolve payment hours settings
  const { data: paymentHoursSetting } = await supabaseAdmin
    .from('settings')
    .select('value')
    .eq('key', 'reseller_order_payment_hours')
    .maybeSingle()
  const hours = Number(paymentHoursSetting?.value) || 48
  const deadline = new Date()
  deadline.setHours(deadline.getHours() + hours)

  // 5. Query total count for generating sequential serial numbers
  const { count } = await supabaseAdmin
    .from('reseller_orders')
    .select('*', { count: 'exact', head: true })
  
  const baseSerial = (count || 0) + 10001
  const insertedOrders = []

  // 6. Process each item in checkout
  for (let idx = 0; idx < items.length; idx++) {
    const item = items[idx]
    const { id: productId, quantity = 1, ring_size, custom_attributes = {} } = item

    // Fetch product floor price
    const { data: floorPriceRow } = await supabaseAdmin
      .from('reseller_product_prices')
      .select('floor_price_paise')
      .eq('reseller_id', resellerId)
      .eq('product_id', productId)
      .maybeSingle()

    if (!floorPriceRow) {
      return NextResponse.json({ error: `Product ID ${productId} is not enabled for resellers` }, { status: 403 })
    }

    const baseFloorPaise = Number(floorPriceRow.floor_price_paise)

    // Fetch product specs
    const { data: product } = await supabaseAdmin
      .from('products')
      .select('*')
      .eq('id', productId)
      .maybeSingle()

    if (!product) {
      return NextResponse.json({ error: `Product ID ${productId} not found` }, { status: 404 })
    }

    // Calculate live raw COGS for all karats
    const pricingList = computeKaratPricing({
      netGoldWeight: product.gold_weight_g || 0,
      rate24k: goldRate,
      retailLabour,
      diamondCost: product.diamond_cost || 0,
      makingCharges: product.making_charges || 0,
      igiCost: product.igi_cert_cost || 0,
      metalWeights: product.metal_weights || undefined,
      color: product.ref_color || undefined
    })

    const orderedKarat = parseInt(String(custom_attributes?.karat || product.ref_karat || '18').replace(/[^\d]/g, '')) || 18
    const targetPricing = pricingList.find(p => p.karat === orderedKarat)
    
    let ratio = 1
    let finalFloorCost = targetPricing ? targetPricing.trade : (baseFloorPaise / 100)

    // Adjust by ratio based on custom floor price
    if (baseFloorPaise > 0) {
      const savedFloorRupees = baseFloorPaise / 100
      let baseCatalogTrade = 0
      if (product.metal_type === 'silver') {
        baseCatalogTrade = Number(product.trade_price)
      } else {
        const basePricing = pricingList.find(p => p.karat === 22)
        baseCatalogTrade = basePricing ? basePricing.trade : Number(product.trade_price)
      }

      if (baseCatalogTrade > 0 && targetPricing) {
        ratio = savedFloorRupees / baseCatalogTrade
        finalFloorCost = targetPricing.trade * ratio
      }
    } else {
      ratio = 1
    }

    const qty = Number(quantity) || 1
    const totalCostPaise = Math.round(finalFloorCost * 100) * qty

    // Calculate customer marked-up price before discount (markup applies only to diamonds)
    const markupMultiplier = 1 + markupPercent / 100
    const goldCost = targetPricing ? targetPricing.goldCost : 0
    const labourCost = targetPricing ? targetPricing.labourCost : 0
    const otherCost = (Number(product.making_charges) || 0) + (Number(product.igi_cert_cost) || 0)

    const customerPricePerPieceRupees = Math.round(
      (goldCost * ratio) + 
      ((labourCost + otherCost) * ratio) + 
      ((Number(product.diamond_cost) || 0) * 1.28 * ratio * markupMultiplier)
    )

    const rawCustomerPricePaise = customerPricePerPieceRupees * 100 * qty

    // Apply coupon discount if active
    let itemPricePaise = rawCustomerPricePaise
    if (discountType === 'percent') {
      itemPricePaise = Math.round(rawCustomerPricePaise * (1 - discountValue / 100))
    } else if (discountType === 'amount') {
      // Divide amount discount across items equally
      const share = Math.round((discountValue * 100) / items.length)
      itemPricePaise = Math.max(rawCustomerPricePaise - share, totalCostPaise) // cannot go below floor cost
    }

    // Generate serial order number
    const orderNumber = `RSL-SF-${baseSerial + idx}`
    const earningsPaise = itemPricePaise - totalCostPaise

    // Insert order record
    const { data: newOrder, error: orderErr } = await supabaseAdmin
      .from('reseller_orders')
      .insert({
        order_number: orderNumber,
        reseller_id: resellerId,
        product_id: productId,
        quantity: qty,
        ring_size: ring_size || null,
        custom_attributes: {
          ...custom_attributes,
          customer_notes: customer_notes || ''
        },
        customer_selling_price_paise: itemPricePaise,
        reseller_cost_paise: totalCostPaise,
        reseller_earnings_paise: earningsPaise,
        payment_status: 'pending',
        shipping_name,
        shipping_phone,
        shipping_address,
        status: 'customer_placed', // storefront-specific initial status
        payment_deadline: deadline.toISOString(),
        customer_id: customer?.id || null,
        configuration_summary: {
          karat: custom_attributes.karat || 'Default',
          ring_size: ring_size || 'N/A',
          notes: customer_notes || '',
          discount_code: promo_code || null,
          discount_applied_paise: rawCustomerPricePaise - itemPricePaise
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select('*')
      .single()

    if (orderErr) {
      return NextResponse.json({ error: safeDbError(orderErr, 'storefront.checkout', 'Failed to capture checkout details.') }, { status: 500 })
    }

    insertedOrders.push(newOrder)

    // Update customer registry for reseller
    try {
      const cleanPhone = shipping_phone.replace(/\s+/g, '')
      const { data: existingCust } = await supabaseAdmin
        .from('reseller_customers')
        .select('*')
        .eq('reseller_id', resellerId)
        .eq('phone', cleanPhone)
        .maybeSingle()

      if (existingCust) {
        await supabaseAdmin
          .from('reseller_customers')
          .update({
            last_order_date: new Date().toISOString(),
            total_orders: existingCust.total_orders + 1,
            total_value_paise: Number(existingCust.total_value_paise) + itemPricePaise,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingCust.id)
      } else {
        await supabaseAdmin
          .from('reseller_customers')
          .insert({
            reseller_id: resellerId,
            name: shipping_name,
            phone: cleanPhone,
            first_order_date: new Date().toISOString(),
            last_order_date: new Date().toISOString(),
            total_orders: 1,
            total_value_paise: itemPricePaise
          })
      }
    } catch {}
  }

  // 7. Clear synced cart in database if customer is logged in
  if (customer) {
    await supabaseAdmin
      .from('reseller_storefront_carts')
      .update({ items: [], updated_at: new Date().toISOString() })
      .eq('customer_id', customer.id)
  }

  // 8. Update reseller notifications feed
  await supabaseAdmin
    .from('reseller_notifications')
    .insert({
      reseller_id: resellerId,
      title: 'New Storefront Checkout',
      body: `Customer ${shipping_name} placed a new order for ${items.length} item(s)`,
      type: 'order',
      link: `/portal/reseller/orders`
    })

  // 9. Mark abandoned cart entry (if any existed for this phone/customer) as recovered
  try {
    const cleanPhone = shipping_phone.replace(/\s+/g, '')
    await supabaseAdmin
      .from('reseller_storefront_abandoned_carts')
      .update({ status: 'recovered', updated_at: new Date().toISOString() })
      .eq('reseller_id', resellerId)
      .eq(customer ? 'customer_id' : 'guest_phone', customer ? customer.id : cleanPhone)
      .eq('status', 'active')
  } catch {}

  // 10. Update link statistics
  await supabaseAdmin
    .from('reseller_share_links')
    .update({
      order_count: (shareLink.order_count || 0) + 1,
      updated_at: new Date().toISOString()
    })
    .eq('id', shareLink.id)

  return NextResponse.json({
    success: true,
    orders: insertedOrders.map(o => ({ order_number: o.order_number, id: o.id })),
    deadline
  })
}
