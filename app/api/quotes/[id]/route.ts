import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { computeQuoteItem, computeQuoteTotals } from '@/lib/quoteCompute'

export const dynamic = 'force-dynamic'

// GET /api/quotes/[id]
// Returns full details of a specific quote and its line items.
export async function GET(
  _: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session || (role !== 'master' && role !== 'sub')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const id = params.id

  // Fetch quote header
  const { data: quote, error: quoteError } = await supabaseAdmin
    .from('quotes')
    .select('*, partners(*), prepared_by_user:app_users!prepared_by(display_name, username)')
    .eq('id', id)
    .maybeSingle()

  if (quoteError) {
    return NextResponse.json({ error: quoteError.message }, { status: 500 })
  }

  if (!quote) {
    return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
  }

  // Fetch quote items sorted by position
  const { data: items, error: itemsError } = await supabaseAdmin
    .from('quote_items')
    .select('*')
    .eq('quote_id', id)
    .order('position', { ascending: true })

  if (itemsError) {
    return NextResponse.json({ error: itemsError.message }, { status: 500 })
  }

  return NextResponse.json({ quote, items })
}

// PATCH /api/quotes/[id]
// Updates a quote's contents. Only allowed if status is 'draft'.
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session || (role !== 'master' && role !== 'sub')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const id = params.id

  // 1. Fetch current quote status
  const { data: existingQuote, error: getError } = await supabaseAdmin
    .from('quotes')
    .select('status')
    .eq('id', id)
    .maybeSingle()

  if (getError) {
    return NextResponse.json({ error: getError.message }, { status: 500 })
  }

  if (!existingQuote) {
    return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
  }

  if (existingQuote.status !== 'draft') {
    return NextResponse.json(
      { error: 'Only draft quotes can be updated. Please create a new revision instead.' },
      { status: 409 }
    )
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const items = Array.isArray(body.items) ? body.items : []
  if (items.length === 0) {
    return NextResponse.json({ error: 'Quote must contain at least one item' }, { status: 400 })
  }

  const marginPct = Number(body.margin_pct) ?? Number(existingQuote.margin_pct)
  const gstRatePct = Number(body.gst_rate_pct) ?? Number(existingQuote.gst_rate_pct)
  const gstTreatment = body.gst_treatment || 'exclusive'

  // Compute calculated values for each item
  const computedItems = items.map((item: any, index: number) => {
    const computed = computeQuoteItem({
      gross_gold_weight_g: Number(item.gross_gold_weight_g) || 0,
      karat: item.karat,
      gold_rate_24k: Number(item.gold_rate_24k) || 0,
      labour_rate_per_g: Number(item.labour_rate_per_g) || 0,
      diamonds: item.diamonds || [],
      making_charges: Number(item.making_charges) || 0,
      hallmarking: Number(item.hallmarking) || 0,
      other_charges: Number(item.other_charges) || 0,
      quantity: Number(item.quantity) || 1,
    }, marginPct)

    return {
      ...item,
      position: index + 1,
      net_24kt_weight_g: computed.net_24kt_weight_g,
      labour_total: computed.labour_total,
      line_cogs: computed.line_cogs,
      line_trade: computed.line_trade,
      line_total: computed.line_total,
      diamonds: Array.isArray(item.diamonds) ? item.diamonds : [],
      reference_images: Array.isArray(item.reference_images) ? item.reference_images : [],
    }
  })

  // Compute header totals
  const totals = computeQuoteTotals(computedItems, gstTreatment, gstRatePct)

  const updateHeader: any = {
    partner_id: body.partner_id || null,
    walk_in_name: body.walk_in_name || null,
    walk_in_phone: body.walk_in_phone || null,
    walk_in_city: body.walk_in_city || null,
    reference_no: body.reference_no || null,
    quote_date: body.quote_date || undefined, // Keep existing if not provided
    valid_until: body.valid_until || undefined,
    gst_treatment: gstTreatment,
    gst_rate_pct: gstRatePct,
    margin_pct: marginPct,
    show_breakup: body.show_breakup !== false,
    show_24kt_column: body.show_24kt_column !== false,
    cover_note: body.cover_note !== undefined ? body.cover_note : undefined,
    terms_text: body.terms_text || undefined,
    subtotal: totals.subtotal,
    gst_amount: totals.gst_amount,
    grand_total: totals.grand_total,
    updated_at: new Date().toISOString(),
  }

  // 2. Perform the update on the quote header
  const { data: updatedQuote, error: updateError } = await supabaseAdmin
    .from('quotes')
    .update(updateHeader)
    .eq('id', id)
    .select('*')
    .single()

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  // 3. Delete existing quote items and insert updated ones
  const { error: deleteError } = await supabaseAdmin
    .from('quote_items')
    .delete()
    .eq('quote_id', id)

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  const itemsToInsert = computedItems.map((item) => ({
    quote_id: id,
    position: item.position,
    product_id: item.product_id || null,
    name: item.name || 'Custom Jewel Item',
    category: item.category || null,
    ring_size: item.ring_size || null,
    quantity: Math.max(Number(item.quantity) || 1, 1),
    karat: String(item.karat),
    gross_gold_weight_g: Number(item.gross_gold_weight_g) || 0,
    net_24kt_weight_g: item.net_24kt_weight_g,
    gold_rate_24k: Number(item.gold_rate_24k) || 0,
    labour_source: item.labour_source || 'partner',
    labour_partner_id: item.labour_partner_id || null,
    labour_rate_per_g: Number(item.labour_rate_per_g) || 0,
    labour_total: item.labour_total,
    diamonds: item.diamonds,
    making_charges: Number(item.making_charges) || 0,
    hallmarking: Number(item.hallmarking) || 0,
    other_charges: Number(item.other_charges) || 0,
    other_charges_label: item.other_charges_label || null,
    line_cogs: item.line_cogs,
    line_trade: item.line_trade,
    line_total: item.line_total,
    reference_images: item.reference_images,
  }))

  const { error: itemsError } = await supabaseAdmin
    .from('quote_items')
    .insert(itemsToInsert)

  if (itemsError) {
    return NextResponse.json({ error: itemsError.message }, { status: 500 })
  }

  return NextResponse.json({ quote: updatedQuote, items: itemsToInsert })
}

// DELETE /api/quotes/[id]
// Deletes a draft quote. Items are deleted cascade.
export async function DELETE(
  _: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session || (role !== 'master' && role !== 'sub')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const id = params.id

  const { data: quote, error: getError } = await supabaseAdmin
    .from('quotes')
    .select('status')
    .eq('id', id)
    .maybeSingle()

  if (getError) {
    return NextResponse.json({ error: getError.message }, { status: 500 })
  }

  if (!quote) {
    return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
  }

  if (quote.status !== 'draft') {
    return NextResponse.json(
      { error: 'Only draft quotes can be deleted.' },
      { status: 400 }
    )
  }

  const { error: deleteError } = await supabaseAdmin
    .from('quotes')
    .delete()
    .eq('id', id)

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
