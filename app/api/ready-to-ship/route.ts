import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { KARAT_FACTORS } from '@/lib/karat'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  const user = session?.user as { role?: string } | undefined
  if (!user || (user.role !== 'master' && user.role !== 'admin' && user.role !== 'sub')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') || 'available'
  const { data, error } = await supabaseAdmin
    .from('ready_to_ship_items')
    .select('*, product:products(id, code, name, photo_urls), source_mfg_order:manufacturing_orders!source_mfg_order_id(id, order_number)')
    .eq('status', status)
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const items = data || []
  const ids = items.map((i: { id: string }) => i.id)
  let offerCounts: Record<string, number> = {}
  if (ids.length > 0) {
    const { data: ofs } = await supabaseAdmin
      .from('ready_to_ship_offers')
      .select('item_id, status')
      .in('item_id', ids)
      .eq('status', 'pending')
    for (const o of (ofs || []) as { item_id: string }[]) {
      offerCounts[o.item_id] = (offerCounts[o.item_id] || 0) + 1
    }
  }

  return NextResponse.json({
    items: items.map((i: Record<string, unknown>) => ({ ...i, pending_offers: offerCounts[i.id as string] || 0 })),
  })
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  const user = session?.user as { role?: string } | undefined
  if (!user || (user.role !== 'master' && user.role !== 'admin' && user.role !== 'sub')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const {
      product_id,
      karat,
      gross_weight,
      list_price,
      diamond_specs,
      photos,
      internal_notes
    } = body

    if (!product_id || !karat || !gross_weight || !list_price) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const karatNum = parseInt(karat)
    if (isNaN(karatNum)) {
      return NextResponse.json({ error: 'Karat must be a number' }, { status: 400 })
    }

    // Was a fourth inline copy of the purity table, carrying the same wrong
    // values (14K 0.60 / 10K 0.42 / 9K 0.38). Use the canonical one.
    const factor = KARAT_FACTORS[karatNum] ?? KARAT_FACTORS[18]
    const pureWeight = Number(gross_weight) * factor

    const { data, error } = await supabaseAdmin
      .from('ready_to_ship_items')
      .insert([{
        product_id,
        karat: karatNum,
        gross_weight: Number(gross_weight),
        pure_24kt_weight: pureWeight,
        diamond_specs: diamond_specs || [],
        photos: photos || [],
        list_price: Number(list_price),
        status: 'available',
        internal_notes: internal_notes || null
      }])
      .select('*')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ item: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
