import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

// POST /api/quotes/[id]/convert-to-order
// Returns pre-filled order creation payloads for each item in the quote.
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
    let karatNum = 18
    if (item.karat) {
      karatNum = parseInt(String(item.karat).replace(/[^\d]/g, ''), 10) || 18
    }

    const itemDiamonds = Array.isArray(item.diamonds) ? item.diamonds : []
    const mappedDiamonds = itemDiamonds.map((d: any) => ({
      id: d.id || Math.random().toString(36).substring(7),
      shape_id: d.shape_id || '',
      size_id: d.size_id || '',
      role: d.role || 'center',
      weight: d.approx_carats || '',
      pieces: String(d.pieces || 1),
      quality: d.quality_id || 'VS',
      color: d.color_id || 'F-G',
      type: d.type || 'lgd',
      cost: String(d.rate_per_pc || 0),
    }))

    // Calculate sum of diamond costs
    const stoneCost = itemDiamonds.reduce((sum: number, d: any) => {
      return sum + (Number(d.pieces) || 0) * (Number(d.rate_per_pc) || 0)
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
        ? `Converted from Quote ${quote.quote_number}. Ref Ref: ${quote.reference_no}`
        : `Converted from Quote ${quote.quote_number}`,
      gold_karat: String(karatNum),
      gold_weight_estimated: String(item.gross_gold_weight_g || 0),
      making_charges: String(item.making_charges || 0),
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
    }
  })

  return NextResponse.json({ quote, items: payloads })
}
