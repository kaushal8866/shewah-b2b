import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { nextQuoteNumber } from '@/lib/quoteNumber'
import { computeQuoteItem, computeQuoteTotals } from '@/lib/quoteCompute'
import { DEFAULT_QUOTE_MARGIN_PCT, DEFAULT_QUOTE_GST_RATE_PCT, DEFAULT_QUOTE_TERMS } from '@/lib/quoteDefaults'

export const dynamic = 'force-dynamic'

// GET /api/quotes
// Returns a paginated, filtered list of quotes.
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session || (role !== 'master' && role !== 'sub')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const page = Math.max(parseInt(searchParams.get('page') || '1', 10), 1)
  const limit = Math.max(parseInt(searchParams.get('limit') || '25', 10), 1)
  const status = searchParams.get('status')
  const query = searchParams.get('q') // Quote number or customer name

  const from = (page - 1) * limit
  const to = from + limit - 1

  let dbQuery = supabaseAdmin
    .from('quotes')
    .select('*, partners(owner_name, store_name, city)', { count: 'exact' })
    .order('created_at', { ascending: false })

  if (status) {
    dbQuery = dbQuery.eq('status', status)
  }

  if (query) {
    // Search by quote_number, walk_in_name, or partner details
    // For simple multi-search we can build an OR filter
    dbQuery = dbQuery.or(`quote_number.ilike.%${query}%,walk_in_name.ilike.%${query}%,reference_no.ilike.%${query}%`)
  }

  const { data, count, error } = await dbQuery.range(from, to)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    quotes: data,
    total: count || 0,
    page,
    limit,
  })
}

// POST /api/quotes
// Creates a new quote and its items in draft status.
export async function POST(req: NextRequest) {
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

  const items = Array.isArray(body.items) ? body.items : []
  if (items.length === 0) {
    return NextResponse.json({ error: 'Quote must contain at least one item' }, { status: 400 })
  }

  const marginPct = Number(body.margin_pct) ?? DEFAULT_QUOTE_MARGIN_PCT
  const gstRatePct = Number(body.gst_rate_pct) ?? DEFAULT_QUOTE_GST_RATE_PCT
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
      // Ensure JSON structure for diamonds matches spec
      diamonds: Array.isArray(item.diamonds) ? item.diamonds : [],
      reference_images: Array.isArray(item.reference_images) ? item.reference_images : [],
    }
  })

  // Compute header totals
  const totals = computeQuoteTotals(computedItems, gstTreatment, gstRatePct)

  const insertHeader: any = {
    partner_id: body.partner_id || null,
    walk_in_name: body.walk_in_name || null,
    walk_in_phone: body.walk_in_phone || null,
    walk_in_city: body.walk_in_city || null,
    reference_no: body.reference_no || null,
    prepared_by: (session.user as any).id || null,
    quote_date: body.quote_date || new Date().toISOString().slice(0, 10),
    valid_until: body.valid_until,
    gst_treatment: gstTreatment,
    gst_rate_pct: gstRatePct,
    margin_pct: marginPct,
    show_breakup: body.show_breakup !== false,
    show_24kt_column: body.show_24kt_column !== false,
    cover_note: body.cover_note || null,
    terms_text: body.terms_text || DEFAULT_QUOTE_TERMS,
    subtotal: totals.subtotal,
    gst_amount: totals.gst_amount,
    grand_total: totals.grand_total,
    status: 'draft',
  }

  if (!insertHeader.valid_until) {
    return NextResponse.json({ error: 'valid_until date is required' }, { status: 400 })
  }

  let createdQuote: any = null
  let insertError: any = null

  // 5-attempt retry loop on unique quote_number
  for (let attempt = 0; attempt < 5; attempt++) {
    const qNum = await nextQuoteNumber(attempt)
    insertHeader.quote_number = qNum

    const { data, error } = await supabaseAdmin
      .from('quotes')
      .insert([insertHeader])
      .select('*')
      .single()

    if (!error) {
      createdQuote = data
      insertError = null
      break
    }

    insertError = error
    // Check if unique violation error (23505) was on quote_number
    if ((error as any).code === '23505') {
      continue
    }
    break
  }

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  // Insert items linked to the quote
  const itemsToInsert = computedItems.map((item) => ({
    quote_id: createdQuote.id,
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
    // Cleanup quote header if items insertion failed
    await supabaseAdmin.from('quotes').delete().eq('id', createdQuote.id)
    return NextResponse.json({ error: itemsError.message }, { status: 500 })
  }

  return NextResponse.json({ quote: createdQuote, items: itemsToInsert })
}
