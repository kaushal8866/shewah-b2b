import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

const LIST_COLS = `
  id, code, name, category, trade_price, gold_karat,
  diamond_weight, delivery_days, photo_urls, karat_pricing
`

export async function GET() {
  const session = await getServerSession(authOptions)
  const user: any = session?.user
  if (!user || user.role !== 'retailer') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data, error } = await supabaseAdmin
    .from('products')
    .select(LIST_COLS)
    .eq('is_active', true)
    .order('code')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Surface the cheapest karat row so the catalog list can show
  // "Starts from ₹X (9kt)" without re-deriving on the client.
  const products = (data || []).map((p: any) => {
    const kp = p.karat_pricing || {}
    const rows = Object.values(kp).filter((r: any) => r && r.trade > 0) as any[]
    let cheapest: any = rows.length
      ? rows.reduce((m, r) => (r.trade < m.trade ? r : m))
      : null
    // Legacy fallback: pre-migration products that have not been re-priced yet
    // still need a price to show on the catalog list. Synthesize the row from
    // the canonical trade_price + the product's saved karat.
    if (!cheapest && p.trade_price) {
      cheapest = { karat: p.gold_karat || 22, trade: Number(p.trade_price) }
    }
    return { ...p, starts_from: cheapest }
  })
  return NextResponse.json({ products })
}
