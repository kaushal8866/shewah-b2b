import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { notifyInternalQuoteResponse } from '@/lib/quoteShareNotify'
import { runInBackground } from '@/lib/backgroundTask'
import { computeQuoteAdvance } from '@/lib/quoteCompute'

export const dynamic = 'force-dynamic'

// POST /api/quotes/share/[token]/respond
// Receives customer approval or revision requests, updates status, and fires alerts.
export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  const token = params.token

  // 1. Validate share token
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

  // 2. Parse request body
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { action, note } = body
  if (action !== 'accept' && action !== 'request_changes') {
    return NextResponse.json(
      { error: "Action must be either 'accept' or 'request_changes'" },
      { status: 400 }
    )
  }

  // 3. Fetch quote header
  const { data: quote, error: quoteError } = await supabaseAdmin
    .from('quotes')
    .select('*, partners(owner_name, store_name, city)')
    .eq('id', shareLink.quote_id)
    .maybeSingle()

  if (quoteError) {
    return NextResponse.json({ error: quoteError.message }, { status: 500 })
  }

  if (!quote) {
    return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
  }

  // Prevent responding to already accepted or converted quotes
  if (quote.status === 'accepted' || quote.status === 'converted_to_order') {
    return NextResponse.json(
      { error: `This quote has already been ${quote.status === 'accepted' ? 'accepted' : 'converted to an order'}.` },
      { status: 400 }
    )
  }

  // 4. Update quote in database
  const nowStr = new Date().toISOString()
  const updates: any = {
    customer_response_note: note || null,
    updated_at: nowStr,
  }

  if (action === 'accept') {
    updates.status = 'accepted'
    updates.accepted_at = nowStr

    // Freeze the advance at the moment of approval. Gold moves daily, so the
    // amount the customer commits to here must not be recomputed later against
    // a newer rate.
    const { data: quoteItems, error: itemsError } = await supabaseAdmin
      .from('quote_items')
      .select('*')
      .eq('quote_id', quote.id)

    if (itemsError) {
      return NextResponse.json({ error: itemsError.message }, { status: 500 })
    }

    const advance = computeQuoteAdvance(
      quoteItems || [], quote.margin_pct || 0, quote.grand_total,
    )
    updates.advance_due = advance.advance_due
    updates.advance_gold_value = advance.gold_value
    updates.advance_diamond_value = advance.diamond_value
    updates.advance_gold_pct = advance.gold_pct
    updates.advance_diamond_pct = advance.diamond_pct
    // Nothing to collect on a zero-value quote — don't park it in a payment
    // state an admin would then have to clear by hand.
    updates.advance_status = advance.advance_due > 0 ? 'awaiting_payment' : 'waived'
  }

  const { data: updatedQuote, error: updateError } = await supabaseAdmin
    .from('quotes')
    .update(updates)
    .eq('id', quote.id)
    .select('*')
    .single()

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  // 5. Send notifications to internal team
  let customerName = 'Customer'
  if (quote.partners) {
    customerName = quote.partners.store_name || quote.partners.owner_name
  } else if (quote.walk_in_name) {
    customerName = quote.walk_in_name
  }

  // Fire-and-forget notification dispatch
  runInBackground('notify.quote.response', () => notifyInternalQuoteResponse({
    quoteId: quote.id,
    decision: action === 'accept' ? 'accepted' : 'revision',
    comment: note,
    customerName,
  }))

  return NextResponse.json({
    success: true,
    status: updatedQuote.status,
    customer_response_note: updatedQuote.customer_response_note,
    advance: {
      status: updatedQuote.advance_status,
      due: Number(updatedQuote.advance_due) || 0,
      gold_value: Number(updatedQuote.advance_gold_value) || 0,
      diamond_value: Number(updatedQuote.advance_diamond_value) || 0,
      gold_pct: Number(updatedQuote.advance_gold_pct) || 0,
      diamond_pct: Number(updatedQuote.advance_diamond_pct) || 0,
      balance_due: Math.max(
        (Number(updatedQuote.grand_total) || 0) - (Number(updatedQuote.advance_due) || 0), 0,
      ),
    },
  })
}
