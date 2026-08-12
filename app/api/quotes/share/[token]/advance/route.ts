import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { notifyInternalAdvanceSubmitted } from '@/lib/quoteShareNotify'
import { runInBackground } from '@/lib/backgroundTask'

export const dynamic = 'force-dynamic'

// POST /api/quotes/share/[token]/advance
// Customer submits proof of the advance transfer. There is no payment gateway:
// they pay by bank/UPI and tell us the reference, then an admin verifies it.
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

  if (new Date(shareLink.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: 'Quote link has expired' }, { status: 410 })
  }

  // 2. Parse body
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const reference = String(body.reference || '').trim()
  const proofUrl = String(body.proof_url || '').trim()
  const paidAmountRaw = body.paid_amount

  // One of the two is required — a bare "I paid" with nothing to check against
  // gives the admin no way to verify.
  if (!reference && !proofUrl) {
    return NextResponse.json(
      { error: 'Provide a payment reference (UTR) or upload a screenshot.' },
      { status: 400 }
    )
  }

  // 3. Fetch quote
  const { data: quote, error: quoteError } = await supabaseAdmin
    .from('quotes')
    .select('*, partners(owner_name, store_name)')
    .eq('id', shareLink.quote_id)
    .maybeSingle()

  if (quoteError) {
    return NextResponse.json({ error: quoteError.message }, { status: 500 })
  }

  if (!quote) {
    return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
  }

  // 4. Only a quote awaiting payment (or one being corrected after a rejected
  // submission) can take proof.
  if (quote.advance_status !== 'awaiting_payment' && quote.advance_status !== 'proof_submitted') {
    const reason = quote.advance_status === 'not_requested'
      ? 'This quote has not been approved yet.'
      : quote.advance_status === 'verified'
        ? 'The advance for this quote is already verified.'
        : 'No advance is being collected for this quote.'
    return NextResponse.json({ error: reason }, { status: 400 })
  }

  const paidAmount = Number(paidAmountRaw)
  const nowStr = new Date().toISOString()

  const { data: updated, error: updateError } = await supabaseAdmin
    .from('quotes')
    .update({
      advance_status: 'proof_submitted',
      advance_reference: reference || null,
      advance_proof_url: proofUrl || null,
      // Fall back to the amount due when the customer does not state one.
      advance_paid_amount: Number.isFinite(paidAmount) && paidAmount > 0
        ? paidAmount
        : Number(quote.advance_due) || 0,
      advance_submitted_at: nowStr,
      updated_at: nowStr,
    })
    .eq('id', quote.id)
    .select('*')
    .single()

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  let customerName = 'Customer'
  if (quote.partners) {
    customerName = quote.partners.store_name || quote.partners.owner_name
  } else if (quote.walk_in_name) {
    customerName = quote.walk_in_name
  }

  runInBackground('notify.quote.advance', () => notifyInternalAdvanceSubmitted({
    quoteId: quote.id,
    customerName,
    amount: Number(updated.advance_paid_amount) || 0,
    reference: updated.advance_reference,
    proofUrl: updated.advance_proof_url,
  }))

  return NextResponse.json({
    success: true,
    advance_status: updated.advance_status,
    advance_paid_amount: Number(updated.advance_paid_amount) || 0,
    advance_submitted_at: updated.advance_submitted_at,
  })
}
