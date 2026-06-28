import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { notifyDiamondEvent } from '@/lib/diamondNotify'

export const dynamic = 'force-dynamic'

const TIER_DISCOUNTS: Record<string, number> = {
  starter: 10,
  silver: 15,
  gold: 20,
  platinum: 25
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const user: any = session?.user
    if (!user || user.role !== 'retailer' || !user.partnerId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const {
      type,
      shapeId,
      sizeId,
      qualityId,
      colorId,
      originalPricePerPc,
      originalPricePerCt,
      askedPrice,
      askedUnit,
      quantity,
      reason
    } = body

    if (
      !type || !shapeId || !sizeId || !qualityId || !colorId ||
      originalPricePerPc === undefined || originalPricePerCt === undefined ||
      askedPrice === undefined || !askedUnit || quantity === undefined
    ) {
      return NextResponse.json({ error: 'Missing required ask parameters' }, { status: 400 })
    }

    const qty = parseInt(quantity)
    const askVal = parseFloat(askedPrice)
    const origPc = parseFloat(originalPricePerPc)
    const origCt = parseFloat(originalPricePerCt)

    if (isNaN(qty) || qty <= 0) {
      return NextResponse.json({ error: 'Quantity must be greater than zero' }, { status: 400 })
    }
    if (isNaN(askVal) || askVal <= 0) {
      return NextResponse.json({ error: 'Asked price must be greater than zero' }, { status: 400 })
    }

    // Resolve size details to get approx_carats
    const { data: sizeData, error: sizeErr } = await supabaseAdmin
      .from('diamond_sizes')
      .select('approx_carats, label')
      .eq('id', sizeId)
      .maybeSingle()

    if (sizeErr || !sizeData) {
      return NextResponse.json({ error: 'Invalid size reference' }, { status: 400 })
    }

    const approxCarats = Number(sizeData.approx_carats) || 0
    let askedPricePerPc = askVal
    if (askedUnit === 'per_ct') {
      askedPricePerPc = askVal * approxCarats
    }

    const isInstantBuy = askedUnit === 'per_ct'
      ? Math.abs(askVal - origCt) < 0.01
      : Math.abs(askVal - origPc) < 0.01

    if (askedPricePerPc > origPc) {
      return NextResponse.json({ error: 'Asked price cannot exceed original price' }, { status: 400 })
    }

    // Floor price check: Cannot be below 60% of original (unless it is instant buy)
    if (!isInstantBuy) {
      const floorPrice = origPc * 0.60
      if (askedPricePerPc < floorPrice) {
        return NextResponse.json({ error: 'Asked price cannot be below 60% of the original quoted price.' }, { status: 400 })
      }
    }

    // Fetch partner details for tiering
    const { data: partner, error: partnerErr } = await supabaseAdmin
      .from('partners')
      .select('store_name, phone, diamond_tier, custom_diamond_discount_limit')
      .eq('id', user.partnerId)
      .maybeSingle()

    if (partnerErr || !partner) {
      return NextResponse.json({ error: 'Could not load partner settings' }, { status: 500 })
    }

    const tier = partner.diamond_tier || 'starter'
    const tierLimit = TIER_DISCOUNTS[tier] || 10
    const finalLimit = partner.custom_diamond_discount_limit !== null
      ? Number(partner.custom_diamond_discount_limit)
      : tierLimit

    const discountPct = isInstantBuy ? 0 : ((origPc - askedPricePerPc) / origPc) * 100
    const exceedsLimit = !isInstantBuy && discountPct > finalLimit

    const expiryAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString() // default 48h
    const purchaseWindow = isInstantBuy ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() : null

    // Insert the Ask record
    const { data: newAsk, error: insertErr } = await supabaseAdmin
      .from('cfg_diamond_asks')
      .insert([{
        partner_id: user.partnerId,
        diamond_type: type,
        shape_id: shapeId,
        size_id: sizeId,
        quality_bucket_id: qualityId,
        color_bucket_id: colorId,
        original_price_per_pc: origPc,
        original_price_per_ct: origCt,
        asked_price: askVal,
        asked_unit: askedUnit,
        quantity: qty,
        reason: reason || null,
        status: isInstantBuy ? 'approved' : 'pending',
        approved_price: isInstantBuy ? askVal : null,
        approved_unit: isInstantBuy ? askedUnit : null,
        purchase_window_expiry_at: purchaseWindow,
        exceeds_limit: exceedsLimit,
        expiry_at: expiryAt
      }])
      .select('id')
      .single()

    if (insertErr || !newAsk) {
      return NextResponse.json({ error: insertErr?.message || 'Failed to submit ask' }, { status: 500 })
    }

    // Resolve shape, quality and color labels for WhatsApp notification
    const { data: shape } = await supabaseAdmin.from('diamond_shapes').select('name').eq('id', shapeId).maybeSingle()
    const { data: qual } = await supabaseAdmin.from('diamond_quality_buckets').select('label').eq('id', qualityId).maybeSingle()
    const { data: col } = await supabaseAdmin.from('diamond_color_buckets').select('label').eq('id', colorId).maybeSingle()

    const specsStr = `${sizeData.label} ${qual?.label || ''}-${col?.label || ''} ${shape?.name || ''} (${type === 'lgd' ? 'LGD' : 'Natural'})`

    await notifyDiamondEvent('ask_submitted', {
      partnerName: partner.store_name,
      specs: specsStr,
      askedPrice: askVal,
      askedUnit: askedUnit === 'per_pc' ? 'pc' : 'ct',
      originalPrice: origPc,
      quantity: qty,
      reason: reason
    })

    return NextResponse.json({ ask: newAsk })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
