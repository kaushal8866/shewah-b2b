import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { computeQuoteAdvance } from '@/lib/quoteCompute'

export const dynamic = 'force-dynamic'

type Action = 'verify' | 'waive' | 'reject' | 'request'

// POST /api/quotes/[id]/advance
// Admin-gated. Decides whether an approved quote may proceed to production:
// verify the money landed, waive the advance entirely, send a submission back
// for correction, or ask for an advance on a quote that skipped one.
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session || (role !== 'master' && role !== 'sub')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const action: Action = body.action
  if (!['verify', 'waive', 'reject', 'request'].includes(action)) {
    return NextResponse.json(
      { error: "Action must be one of 'verify', 'waive', 'reject', 'request'" },
      { status: 400 }
    )
  }

  const { data: quote, error: quoteError } = await supabaseAdmin
    .from('quotes')
    .select('*')
    .eq('id', params.id)
    .maybeSingle()

  if (quoteError) {
    return NextResponse.json({ error: quoteError.message }, { status: 500 })
  }

  if (!quote) {
    return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
  }

  const nowStr = new Date().toISOString()
  const note = body.note ? String(body.note).trim() : null
  const updates: any = { updated_at: nowStr, advance_note: note }

  if (action === 'verify') {
    if (quote.advance_status !== 'proof_submitted' && quote.advance_status !== 'awaiting_payment') {
      return NextResponse.json(
        { error: `Cannot verify an advance that is '${quote.advance_status}'.` },
        { status: 400 }
      )
    }
    updates.advance_status = 'verified'
    updates.advance_verified_at = nowStr
    updates.advance_verified_by = (session.user as any).id || null
    // An admin verifying against a bank statement may know the true figure
    // better than what the customer typed.
    if (body.paid_amount != null) {
      const amt = Number(body.paid_amount)
      if (!Number.isFinite(amt) || amt < 0) {
        return NextResponse.json({ error: 'paid_amount must be a positive number' }, { status: 400 })
      }
      updates.advance_paid_amount = amt
    }
  } else if (action === 'waive') {
    // "Proceed without advance" — a trusted customer, or an order the desk
    // wants to start before the money lands.
    updates.advance_status = 'waived'
    updates.advance_verified_at = nowStr
    updates.advance_verified_by = (session.user as any).id || null
  } else if (action === 'reject') {
    if (quote.advance_status !== 'proof_submitted') {
      return NextResponse.json(
        { error: 'Only a submitted proof can be sent back.' },
        { status: 400 }
      )
    }
    // Back to awaiting payment, keeping the rejected reference visible so the
    // customer can see what was wrong with it.
    updates.advance_status = 'awaiting_payment'
    updates.advance_submitted_at = null
  } else if (action === 'request') {
    if (quote.status !== 'accepted' && quote.status !== 'converted_to_order') {
      return NextResponse.json(
        { error: 'The customer has not approved this quote yet.' },
        { status: 400 }
      )
    }
    const { data: items, error: itemsError } = await supabaseAdmin
      .from('quote_items')
      .select('*')
      .eq('quote_id', quote.id)

    if (itemsError) {
      return NextResponse.json({ error: itemsError.message }, { status: 500 })
    }

    const advance = computeQuoteAdvance(items || [], quote.margin_pct || 0, quote.grand_total)
    updates.advance_due = advance.advance_due
    updates.advance_gold_value = advance.gold_value
    updates.advance_diamond_value = advance.diamond_value
    updates.advance_gold_pct = advance.gold_pct
    updates.advance_diamond_pct = advance.diamond_pct
    updates.advance_status = 'awaiting_payment'
    updates.advance_verified_at = null
    updates.advance_verified_by = null
  }

  const { data: updated, error: updateError } = await supabaseAdmin
    .from('quotes')
    .update(updates)
    .eq('id', quote.id)
    .select('*')
    .single()

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    advance_status: updated.advance_status,
    advance_due: Number(updated.advance_due) || 0,
    advance_paid_amount: updated.advance_paid_amount ?? null,
    advance_verified_at: updated.advance_verified_at,
  })
}
