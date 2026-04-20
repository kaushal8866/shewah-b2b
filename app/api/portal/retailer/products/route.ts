import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { SELLABLE_KARATS, type KaratPrice } from '@/lib/karat'

type ProductListRow = {
  id: string
  code: string
  name: string
  category: string | null
  trade_price: number | null
  gold_karat: number | null
  diamond_weight: number | null
  delivery_days: number | null
  photo_urls: string[] | null
  karat_pricing: Record<string, KaratPrice> | null
}

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
  type StartsFrom = { karat: number; trade: number }
  const rows: ProductListRow[] = (data || []) as ProductListRow[]
  // The "Starts from ₹X (Ykt)" UX is meant to lead with the lowest karat the
  // SKU is sold in (9kt for most pieces). Walk SELLABLE_KARATS bottom-up so
  // the label is deterministic — falling through to higher karats only when a
  // labour rate is missing and that karat has no priced row.
  const products = rows.map((p) => {
    const kp = p.karat_pricing || {}
    let pick: StartsFrom | null = null
    for (const k of [...SELLABLE_KARATS].sort((a, b) => a - b)) {
      const row = kp[String(k)]
      if (row && row.trade > 0) {
        pick = { karat: row.karat, trade: row.trade }
        break
      }
    }
    // Legacy fallback: pre-migration products that have not been re-priced yet
    // still need a price to show. Synthesize from the canonical trade_price.
    if (!pick && p.trade_price) {
      pick = { karat: p.gold_karat || 22, trade: Number(p.trade_price) }
    }
    return { ...p, starts_from: pick }
  })
  return NextResponse.json({ products })
}
