import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

// GET /api/quotes/share/[token]
// Public endpoint that returns sanitized details for a shared quote.
export async function GET(
  _: Request,
  { params }: { params: { token: string } }
) {
  const token = params.token

  // 1. Fetch and validate share link
  const { data: shareLink, error: shareError } = await supabaseAdmin
    .from('quote_share_links')
    .select('*')
    .eq('token', token)
    .maybeSingle()

  if (shareError) {
    return NextResponse.json({ error: shareError.message }, { status: 500 })
  }

  if (!shareLink) {
    return NextResponse.json({ error: 'Quote link not found' }, { status: 404 })
  }

  if (shareLink.revoked_at) {
    return NextResponse.json({ error: 'Quote link has been revoked' }, { status: 410 })
  }

  const expiresAt = new Date(shareLink.expires_at)
  if (expiresAt.getTime() < Date.now()) {
    return NextResponse.json({ error: 'Quote link has expired' }, { status: 410 })
  }

  // 2. Fetch linked quote
  const { data: quote, error: quoteError } = await supabaseAdmin
    .from('quotes')
    .select('*, partners(owner_name, store_name, city, phone), prepared_by_user:app_users!prepared_by(display_name, username)')
    .eq('id', shareLink.quote_id)
    .maybeSingle()

  if (quoteError) {
    return NextResponse.json({ error: quoteError.message }, { status: 500 })
  }

  if (!quote) {
    return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
  }

  // 3. Update view statistics and quote status if first time viewed
  const nowStr = new Date().toISOString()
  const isFirstView = shareLink.opened_count === 0

  const { error: updateLinkError } = await supabaseAdmin
    .from('quote_share_links')
    .update({
      opened_at: isFirstView ? nowStr : shareLink.opened_at,
      opened_count: shareLink.opened_count + 1,
    })
    .eq('token', token)

  if (updateLinkError) {
    console.error('Failed to update quote_share_links view telemetry:', updateLinkError)
  }

  if (isFirstView || quote.status === 'sent') {
    const quoteUpdates: any = {
      viewed_at: quote.viewed_at || nowStr,
    }
    // Only transition status from 'sent' to 'viewed'
    if (quote.status === 'sent') {
      quoteUpdates.status = 'viewed'
    }

    const { error: updateQuoteError } = await supabaseAdmin
      .from('quotes')
      .update(quoteUpdates)
      .eq('id', quote.id)

    if (updateQuoteError) {
      console.error('Failed to update quote status to viewed:', updateQuoteError)
    } else {
      // Sync local object for response
      if (quote.status === 'sent') quote.status = 'viewed'
      if (!quote.viewed_at) quote.viewed_at = nowStr
    }
  }

  // 4. Fetch quote items
  const { data: items, error: itemsError } = await supabaseAdmin
    .from('quote_items')
    .select('*')
    .eq('quote_id', quote.id)
    .order('position', { ascending: true })

  if (itemsError) {
    return NextResponse.json({ error: itemsError.message }, { status: 500 })
  }

  // 5. Sanitize payload (remove COGS, margins, and karigar details)
  const sanitizedQuote = {
    id: quote.id,
    quote_number: quote.quote_number,
    quote_date: quote.quote_date,
    valid_until: quote.valid_until,
    reference_no: quote.reference_no,
    gst_treatment: quote.gst_treatment,
    gst_rate_pct: quote.gst_rate_pct,
    show_breakup: quote.show_breakup,
    show_24kt_column: quote.show_24kt_column,
    cover_note: quote.cover_note,
    terms_text: quote.terms_text,
    subtotal: quote.subtotal,
    gst_amount: quote.gst_amount,
    grand_total: quote.grand_total,
    status: quote.status,
    walk_in_name: quote.walk_in_name,
    walk_in_phone: quote.walk_in_phone,
    walk_in_city: quote.walk_in_city,
    partners: quote.partners ? {
      name: quote.partners.owner_name,
      store_name: quote.partners.store_name,
      city: quote.partners.city,
    } : null,
    prepared_by_user: quote.prepared_by_user ? {
      display_name: quote.prepared_by_user.display_name,
    } : null,
  }

  const sanitizedItems = items.map((item: any) => {
    // Sanitize diamonds specs to avoid leaking diamond margin or COGS if any
    const sanitizedDiamonds = (item.diamonds || []).map((d: any) => ({
      shape_id: d.shape_id,
      size_id: d.size_id,
      pieces: d.pieces,
      approx_carats: d.approx_carats,
      type: d.type,
      // Only include rate if showing breakup
      ...(quote.show_breakup ? { rate_per_pc: d.rate_per_pc, igi_charge: d.igi_charge } : {}),
    }))

    return {
      name: item.name,
      category: item.category,
      ring_size: item.ring_size,
      quantity: item.quantity,
      karat: item.karat,
      gross_gold_weight_g: item.gross_gold_weight_g,
      net_24kt_weight_g: quote.show_24kt_column ? item.net_24kt_weight_g : undefined,
      // Only include specific charges if showing breakup
      ...(quote.show_breakup ? {
        gold_rate_24k: item.gold_rate_24k,
        making_charges: item.making_charges,
        hallmarking: item.hallmarking,
        other_charges: item.other_charges,
        other_charges_label: item.other_charges_label,
        diamonds: sanitizedDiamonds,
      } : {}),
      line_trade: item.line_trade,
      line_total: item.line_total,
      reference_images: item.reference_images,
    }
  })

  return NextResponse.json({ quote: sanitizedQuote, items: sanitizedItems })
}
