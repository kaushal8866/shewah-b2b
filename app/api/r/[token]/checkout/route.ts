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
    .select('id, reseller_id, markup_percent, order_count')
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

  // 3. Claim the promo code atomically, before anything is written.
  //
  // This previously only checked is_active and expires_at, so a code could be
  // reused without limit, by anyone, on any order size. claim_coupon locks the
  // row, enforces the global cap / per-customer cap / minimum order value, and
  // records the redemption in one transaction — so two simultaneous checkouts
  // cannot both consume the last redemption.
  let discountType = 'none'
  let discountValue = 0
  if (promo_code) {
    // Cheap proxy for order value: the reseller floor price of each line.
    // Enough for the minimum-order-value gate without running the full pricing
    // pass twice.
    const productIds = items.map((i: any) => i?.id).filter(Boolean)
    const { data: floorRows } = await supabaseAdmin
      .from('reseller_product_prices')
      .select('product_id, floor_price_paise')
      .eq('reseller_id', resellerId)
      .in('product_id', productIds)

    const floorByProduct = new Map<string, number>(
      (floorRows || []).map((r: any) => [r.product_id, Number(r.floor_price_paise) || 0]),
    )
    const cartValuePaise = items.reduce(
      (sum: number, i: any) => sum + (floorByProduct.get(i?.id) ?? 0) * (Number(i?.quantity) || 1),
      0,
    )

    const { data: claimed, error: claimErr } = await supabaseAdmin.rpc('claim_coupon', {
      p_reseller_id:       resellerId,
      p_code:              String(promo_code).trim(),
      p_customer_id:       customer?.id ?? null,
      p_guest_phone:       customer ? null : String(shipping_phone).replace(/\s+/g, ''),
      p_order_value_paise: cartValuePaise,
    })

    if (claimErr) {
      console.error('[storefront.checkout] coupon claim failed:', claimErr.message)
    } else if (Array.isArray(claimed) && claimed.length > 0) {
      discountType  = claimed[0].discount_type
      discountValue = Number(claimed[0].discount_value)
    }
    // No rows back means a limit was hit or the code is invalid. Checkout
    // continues at full price rather than failing the order outright.
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

  // 5. Resolve the live gold rate + per-karat retail labour. Every line item
  //    below is priced off these, so bail out rather than guess if no rate has
  //    been recorded — a fabricated rate would silently misprice the order.
  const { data: goldRateRows } = await supabaseAdmin
    .from('gold_rates')
    .select('rate_24k, retail_labour_22k, retail_labour_18k, retail_labour_14k, retail_labour_10k, retail_labour_9k')
    .order('recorded_at', { ascending: false })
    .limit(1)
  const latestRate = goldRateRows?.[0]
  if (!latestRate?.rate_24k) {
    return NextResponse.json(
      { error: 'Pricing is temporarily unavailable. Please try again shortly.' },
      { status: 503 },
    )
  }
  const goldRate = Number(latestRate.rate_24k)
  const retailLabour: Record<number, number> = {
    22: Number(latestRate.retail_labour_22k) || 450,
    18: Number(latestRate.retail_labour_18k) || 450,
    14: Number(latestRate.retail_labour_14k) || 450,
    10: Number(latestRate.retail_labour_10k) || 450,
    9:  Number(latestRate.retail_labour_9k)  || 450,
  }

  // 6. Reserve order serials from a Postgres sequence.
  //
  // This used to be `count(*) + 10001`. Two checkouts running concurrently
  // both read the same count and minted the same order number. A sequence is
  // atomic and never reuses a value.
  const serials: number[] = []
  for (let i = 0; i < items.length; i++) {
    const { data: serial, error: serialErr } = await supabaseAdmin.rpc('next_reseller_order_number')
    if (serialErr || !serial) {
      console.error('[storefront.checkout] serial allocation failed:', serialErr?.message)
      return NextResponse.json({ error: 'Could not create the order. Please try again.' }, { status: 500 })
    }
    // 'RSL-SF-10042' → 10042
    serials.push(Number(String(serial).replace(/\D/g, '')))
  }

  const insertedOrders = []

  // 7. Process each item in checkout
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

    // Curated Set Checkout splitting logic
    const reqComponents = custom_attributes?.components ? (Array.isArray(custom_attributes.components) ? custom_attributes.components : []) : []
    const selectedComponents = reqComponents.filter((c: any) => c.selected)

    if (selectedComponents.length > 0) {
      const setGroupId = crypto.randomUUID()

      for (let compIdx = 0; compIdx < selectedComponents.length; compIdx++) {
        const compItem = selectedComponents[compIdx]
        const compId = compItem.id

        // Fetch child component specs
        const { data: compProduct } = await supabaseAdmin
          .from('products')
          .select('*')
          .eq('id', compId)
          .maybeSingle()

        if (!compProduct) continue

        // Calculate live raw COGS for this component
        const compPricingList = computeKaratPricing({
          netGoldWeight: compProduct.gold_weight_g || 0,
          rate24k: goldRate,
          retailLabour,
          diamondCost: compProduct.diamond_cost || 0,
          makingCharges: compProduct.making_charges || 0,
          igiCost: compProduct.igi_cert_cost || 0,
          metalWeights: compProduct.metal_weights || undefined,
          color: compProduct.ref_color || undefined
        })

        const compKarat = parseInt(String(custom_attributes?.karat || compProduct.ref_karat || '18').replace(/[^\d]/g, '')) || 18
        const compTargetPricing = compPricingList.find(p => p.karat === compKarat)
        const compFinalFloorCost = compTargetPricing ? compTargetPricing.trade : (compProduct.trade_price || 0)

        const compQty = Number(quantity) || 1
        const compTotalCostPaise = Math.round(compFinalFloorCost * 100) * compQty

        // Apply reseller markup
        const markupMultiplier = 1 + markupPercent / 100
        const compGoldCost = compTargetPricing ? compTargetPricing.goldCost : 0
        const compLabourCost = compTargetPricing ? compTargetPricing.labourCost : 0
        const compOtherCost = (Number(compProduct.making_charges) || 0) + (Number(compProduct.igi_cert_cost) || 0)

        const compCustomerPricePerPieceRupees = Math.round(
          compGoldCost +
          compLabourCost + compOtherCost +
          ((Number(compProduct.diamond_cost) || 0) * 1.28 * markupMultiplier)
        )

        let compItemPricePaise = compCustomerPricePerPieceRupees * 100 * compQty
        if (discountType === 'percent') {
          compItemPricePaise = Math.round(compItemPricePaise * (1 - discountValue / 100))
        } else if (discountType === 'amount') {
          const share = Math.round((discountValue * 100) / items.length)
          compItemPricePaise = Math.max(compItemPricePaise - share, compTotalCostPaise)
        }

        const compEarningsPaise = compItemPricePaise - compTotalCostPaise
        const compOrderNumber = `RSL-SF-${serials[idx]}-${compIdx}`

        // Insert component order record
        const { data: newCompOrder, error: compOrderErr } = await supabaseAdmin
          .from('reseller_orders')
          .insert({
            order_number: compOrderNumber,
            reseller_id: resellerId,
            product_id: compId,
            quantity: compQty,
            ring_size: ring_size || null,
            custom_attributes: {
              ...custom_attributes,
              customer_notes: customer_notes || ''
            },
            customer_selling_price_paise: compItemPricePaise,
            reseller_cost_paise: compTotalCostPaise,
            reseller_earnings_paise: compEarningsPaise,
            payment_status: 'pending',
            shipping_name,
            shipping_phone,
            shipping_address,
            status: 'customer_placed',
            payment_deadline: deadline.toISOString(),
            customer_id: customer?.id || null,
            configuration_summary: {
              karat: custom_attributes.karat || 'Default',
              ring_size: ring_size || 'N/A',
              notes: customer_notes || '',
              discount_code: promo_code || null,
              discount_applied_paise: (compCustomerPricePerPieceRupees * 100 * compQty) - compItemPricePaise
            },
            set_order_group_id: setGroupId,
            component_label: compProduct.component_label || compProduct.category,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select('*')
          .single()

        if (compOrderErr) {
          return NextResponse.json({ error: compOrderErr.message }, { status: 500 })
        }

        insertedOrders.push(newCompOrder)
      }

      continue
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
    const orderNumber = `RSL-SF-${serials[idx]}`
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

  // 8. Clear synced cart in database if customer is logged in
  if (customer) {
    await supabaseAdmin
      .from('reseller_storefront_carts')
      .update({ items: [], updated_at: new Date().toISOString() })
      .eq('customer_id', customer.id)
  }

  // 9. Update reseller notifications feed
  await supabaseAdmin
    .from('reseller_notifications')
    .insert({
      reseller_id: resellerId,
      title: 'New Storefront Checkout',
      body: `Customer ${shipping_name} placed a new order for ${items.length} item(s)`,
      type: 'order',
      link: `/portal/reseller/orders`
    })

  // 10. Mark abandoned cart entry (if any existed for this phone/customer) as recovered
  try {
    const cleanPhone = shipping_phone.replace(/\s+/g, '')
    await supabaseAdmin
      .from('reseller_storefront_abandoned_carts')
      .update({ status: 'recovered', updated_at: new Date().toISOString() })
      .eq('reseller_id', resellerId)
      .eq(customer ? 'customer_id' : 'guest_phone', customer ? customer.id : cleanPhone)
      .eq('status', 'active')
  } catch {}

  // 11. Update link statistics
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
