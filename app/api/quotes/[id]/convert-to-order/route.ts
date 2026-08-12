import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

// POST /api/quotes/[id]/convert-to-order
// Returns pre-filled order creation payloads for each item in the quote.
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session || (role !== 'master' && role !== 'sub')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const id = params.id


  // 1. Fetch quote
  const { data: quote, error: quoteError } = await supabaseAdmin
    .from('quotes')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (quoteError) {
    return NextResponse.json({ error: quoteError.message }, { status: 500 })
  }

  if (!quote) {
    return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
  }

  // 1b. An outstanding advance blocks production. The admin must either verify
  // the payment or waive it explicitly via /api/quotes/[id]/advance — the UI
  // disables the button, but that is not a guard on its own.
  if (quote.advance_status === 'awaiting_payment' || quote.advance_status === 'proof_submitted') {
    return NextResponse.json(
      {
        error: quote.advance_status === 'proof_submitted'
          ? 'Verify the submitted advance payment before converting this quote.'
          : 'This quote is awaiting an advance payment. Verify or waive it before converting.',
      },
      { status: 409 }
    )
  }

  // 2. Fetch items
  const { data: items, error: itemsError } = await supabaseAdmin
    .from('quote_items')
    .select('*')
    .eq('quote_id', id)
    .order('position', { ascending: true })

  if (itemsError) {
    return NextResponse.json({ error: itemsError.message }, { status: 500 })
  }

  // 3. Map items to order creation payloads
  const payloads = items.map((item: any) => {
    let goldKarat = '18'
    if (item.karat) {
      if (String(item.karat).toLowerCase().includes('silver')) {
        goldKarat = 'silver'
      } else {
        goldKarat = String(parseInt(String(item.karat).replace(/[^\d]/g, ''), 10) || 18)
      }
    }

    const itemDiamonds = Array.isArray(item.diamonds) ? item.diamonds : []
    const mappedDiamonds = itemDiamonds.map((d: any) => ({
      id: d.id || Math.random().toString(36).substring(7),
      shape_id: d.shape_id || '',
      size_id: d.size_id || '',
      role: d.role || 'center',
      weight: String(d.approx_carats != null ? d.approx_carats : (d.weight || '')),
      pieces: String(d.pieces || 1),
      quality: d.quality_id || d.quality || 'VS2',
      color: d.color_id || d.color || 'F',
      type: d.type || 'lgd',
      cost: String(d.rate_per_pc != null ? d.rate_per_pc : (d.cost || 0)),
      shape: (d.shape_name || d.shape || 'round').toLowerCase(),
      size_label: d.size_label || '',
    }))

    // Calculate sum of diamond costs
    const stoneCost = itemDiamonds.reduce((sum: number, d: any) => {
      const wt = Number(d.approx_carats != null ? d.approx_carats : d.weight) || 0
      const rate = Number(d.rate_per_pc != null ? d.rate_per_pc : d.cost) || 0
      return sum + (wt * rate)
    }, 0)

    return {
      partner_id: quote.partner_id || '',
      type: item.product_id ? 'catalog' : 'custom',
      model: 'wholesale',
      product_id: item.product_id || '',
      brief_text: item.name || '',
      quantity: String(item.quantity || 1),
      ring_size: item.ring_size || '',
      special_notes: quote.reference_no
        ? `Converted from Quote ${quote.quote_number}. Ref: ${quote.reference_no}`
        : `Converted from Quote ${quote.quote_number}`,
      gold_karat: goldKarat,
      gold_weight_estimated: String(item.gross_gold_weight_g || 0),
      making_charges: String(
        (Number(item.making_charges) || 0) * (Number(item.quantity) || 1) +
        (Number(item.labour_total) || 0)
      ),
      cad_cost: '0',
      stone_cost: String(stoneCost),
      trade_price: String(item.line_trade || 0),
      total_amount: String(item.line_total || 0),
      advance_paid: '0',
      order_date: new Date().toISOString().slice(0, 10),
      expected_delivery: new Date(Date.now() + 21 * 86400000).toISOString().slice(0, 10), // Default 21 days
      internal_notes: `Converted from Quote ${quote.quote_number}`,
      diamonds: mappedDiamonds,
      quote_id: quote.id,
      quote_item_id: item.id,
      assigned_manufacturer_id: item.labour_partner_id || '',
      metal_type: String(item.karat).toLowerCase().includes('silver') ? 'silver' : 'gold',
    }
  })

  return NextResponse.json({ quote, items: payloads })
}

// PATCH /api/quotes/[id]/convert-to-order
// Links a newly created order back to the quote and updates its status.
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session || (role !== 'master' && role !== 'sub')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const id = params.id
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { order_id } = body
  if (!order_id) {
    return NextResponse.json({ error: 'order_id is required' }, { status: 400 })
  }

  // Update the quote to link the order and mark it as converted
  const { data: updatedQuote, error: updateError } = await supabaseAdmin
    .from('quotes')
    .update({
      converted_order_id: order_id,
      status: 'converted_to_order',
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select('*')
    .single()

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, quote: updatedQuote })
}

