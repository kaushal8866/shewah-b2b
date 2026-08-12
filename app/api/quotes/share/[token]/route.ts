import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { buildItemBreakdown, computeQuoteAdvance } from '@/lib/quoteCompute'

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

  // 4b. Backfill shape names so the break-up table can name each stone. Older
  // diamond rows store only shape_id.
  const { data: shapes } = await supabaseAdmin.from('diamond_shapes').select('id, name')
  const shapeMap = new Map((shapes || []).map((s: any) => [s.id, s.name]))
  const namedItems = (items || []).map((item: any) => ({
    ...item,
    diamonds: Array.isArray(item.diamonds)
      ? item.diamonds.map((d: any) => ({
          ...d,
          shape_name: d.shape_name || (d.shape_id ? shapeMap.get(d.shape_id) : null) || null,
        }))
      : [],
  }))

  // 4c. Advance. Once the customer has approved, the stored figures are the
  // agreed ones and must not be recomputed — the gold rate moves daily and the
  // amount they committed to cannot move under them.
  const isFrozen = quote.advance_status && quote.advance_status !== 'not_requested'
  const computed = computeQuoteAdvance(namedItems, quote.margin_pct || 0, quote.grand_total)
  const advance = {
    status: quote.advance_status || 'not_requested',
    due: isFrozen ? Number(quote.advance_due) : computed.advance_due,
    gold_value: isFrozen ? Number(quote.advance_gold_value) : computed.gold_value,
    diamond_value: isFrozen ? Number(quote.advance_diamond_value) : computed.diamond_value,
    gold_pct: isFrozen ? Number(quote.advance_gold_pct) : computed.gold_pct,
    diamond_pct: isFrozen ? Number(quote.advance_diamond_pct) : computed.diamond_pct,
    balance_due: isFrozen
      ? Math.max(Number(quote.grand_total) - Number(quote.advance_due), 0)
      : computed.balance_due,
    reference: quote.advance_reference || null,
    proof_url: quote.advance_proof_url || null,
    paid_amount: quote.advance_paid_amount ?? null,
    submitted_at: quote.advance_submitted_at || null,
    verified_at: quote.advance_verified_at || null,
    note: quote.advance_note || null,
  }

  // Bank details only once money is actually due — no reason to publish them
  // on a quote the customer has not approved.
  let bank: Record<string, string> | null = null
  if (advance.status === 'awaiting_payment' || advance.status === 'proof_submitted') {
    const { data: settings } = await supabaseAdmin.from('settings').select('*')
    const settingMap = new Map((settings || []).map((s: any) => [s.key, s.value]))
    bank = {
      account_name: settingMap.get('bank_details_account_name') || 'Shewah',
      bank_name: settingMap.get('bank_details_bank_name') || '',
      account_no: settingMap.get('bank_details_account_no') || '',
      ifsc: settingMap.get('bank_details_ifsc') || '',
      upi: settingMap.get('bank_details_upi') || '',
    }
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

  const sanitizedItems = namedItems.map((item: any) => {
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
      ...(quote.show_breakup ? {
        gold_rate_24k: item.gold_rate_24k,
        making_charges: item.making_charges,
        hallmarking: item.hallmarking,
        other_charges: item.other_charges,
        other_charges_label: item.other_charges_label,
        labour_rate_per_g: item.labour_rate_per_g,
        labour_total: item.labour_total,
        diamonds: sanitizedDiamonds,
      } : {}),
      line_trade: item.line_trade,
      line_total: item.line_total,
      reference_images: item.reference_images,
      // The same line-level arithmetic the PDF renders, so the digital quote
      // shows an identical breakdown without shipping a PDF to the customer.
      // Every figure here is a price the customer pays — no COGS, no margin.
      ...(quote.show_breakup ? {
        breakdown: buildItemBreakdown(
          item, quote.margin_pct || 0, quote.gst_treatment, quote.gst_rate_pct,
        ),
      } : {}),
    }
  })

  return NextResponse.json({
    quote: sanitizedQuote,
    items: sanitizedItems,
    advance,
    bank,
  })
}
