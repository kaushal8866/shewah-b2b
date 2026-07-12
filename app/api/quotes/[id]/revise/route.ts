import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

// POST /api/quotes/[id]/revise
// Clones the quote to create a new revision in draft status.
export async function POST(
  _: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session || (role !== 'master' && role !== 'sub')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const id = params.id

  // 1. Fetch parent quote
  const { data: parentQuote, error: getQuoteError } = await supabaseAdmin
    .from('quotes')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (getQuoteError) {
    return NextResponse.json({ error: getQuoteError.message }, { status: 500 })
  }

  if (!parentQuote) {
    return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
  }

  // 2. Fetch parent quote items
  const { data: parentItems, error: getItemsError } = await supabaseAdmin
    .from('quote_items')
    .select('*')
    .eq('quote_id', id)
    .order('position', { ascending: true })

  if (getItemsError) {
    return NextResponse.json({ error: getItemsError.message }, { status: 500 })
  }

  // 3. Compute new revision quote number
  let baseNumber = parentQuote.quote_number
  let version = 2
  const vMatch = baseNumber.match(/-v(\d+)$/)
  if (vMatch) {
    version = parseInt(vMatch[1], 10) + 1
    baseNumber = baseNumber.slice(0, -vMatch[0].length)
  }

  let newQuoteNumber = `${baseNumber}-v${version}`
  let checkExists = true
  while (checkExists) {
    const { data } = await supabaseAdmin
      .from('quotes')
      .select('id')
      .eq('quote_number', newQuoteNumber)
      .maybeSingle()
    
    if (!data) {
      checkExists = false
    } else {
      version++
      newQuoteNumber = `${baseNumber}-v${version}`
    }
  }

  // 4. Insert cloned quote header in 'draft' status
  const insertQuote: any = {
    quote_number: newQuoteNumber,
    partner_id: parentQuote.partner_id,
    walk_in_name: parentQuote.walk_in_name,
    walk_in_phone: parentQuote.walk_in_phone,
    walk_in_city: parentQuote.walk_in_city,
    customer_id: parentQuote.customer_id,
    reference_no: parentQuote.reference_no,
    prepared_by: (session.user as any).id || null,
    quote_date: new Date().toISOString().slice(0, 10),
    valid_until: parentQuote.valid_until,
    gst_treatment: parentQuote.gst_treatment,
    gst_rate_pct: parentQuote.gst_rate_pct,
    margin_pct: parentQuote.margin_pct,
    show_breakup: parentQuote.show_breakup,
    show_24kt_column: parentQuote.show_24kt_column,
    cover_note: parentQuote.cover_note,
    terms_text: parentQuote.terms_text,
    subtotal: parentQuote.subtotal,
    gst_amount: parentQuote.gst_amount,
    grand_total: parentQuote.grand_total,
    status: 'draft',
    parent_quote_id: parentQuote.parent_quote_id || parentQuote.id, // Point to original ancestor or direct parent
  }

  const { data: createdQuote, error: createQuoteError } = await supabaseAdmin
    .from('quotes')
    .insert([insertQuote])
    .select('*')
    .single()

  if (createQuoteError) {
    return NextResponse.json({ error: createQuoteError.message }, { status: 500 })
  }

  // 5. Insert cloned items linked to the new revision quote
  const itemsToInsert = parentItems.map((item: any) => ({
    quote_id: createdQuote.id,
    position: item.position,
    product_id: item.product_id,
    name: item.name,
    category: item.category,
    ring_size: item.ring_size,
    quantity: item.quantity,
    karat: item.karat,
    gross_gold_weight_g: item.gross_gold_weight_g,
    net_24kt_weight_g: item.net_24kt_weight_g,
    gold_rate_24k: item.gold_rate_24k,
    labour_source: item.labour_source,
    labour_partner_id: item.labour_partner_id,
    labour_rate_per_g: item.labour_rate_per_g,
    labour_total: item.labour_total,
    diamonds: item.diamonds,
    making_charges: item.making_charges,
    hallmarking: item.hallmarking,
    other_charges: item.other_charges,
    other_charges_label: item.other_charges_label,
    line_cogs: item.line_cogs,
    line_trade: item.line_trade,
    line_total: item.line_total,
    reference_images: item.reference_images,
  }))

  const { error: insertItemsError } = await supabaseAdmin
    .from('quote_items')
    .insert(itemsToInsert)

  if (insertItemsError) {
    // Cleanup quote header if items insertion failed
    await supabaseAdmin.from('quotes').delete().eq('id', createdQuote.id)
    return NextResponse.json({ error: insertItemsError.message }, { status: 500 })
  }

  return NextResponse.json({ quote: createdQuote, items: itemsToInsert })
}
