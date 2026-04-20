import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

const DETAIL_COLS = `
  id, code, name, description, category,
  diamond_weight, diamond_shape, diamond_quality, diamond_color, diamond_type,
  gold_karat, gold_weight_g,
  gold_weight_22k, gold_weight_18k, gold_weight_14k, gold_weight_10k, gold_weight_9k,
  karat_pricing,
  trade_price, photo_urls, delivery_days, models_available, tags
`

export async function GET(_: Request, ctx: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const user: any = session?.user
  if (!user || user.role !== 'retailer' || !user.partnerId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data, error } = await supabaseAdmin
    .from('products')
    .select(DETAIL_COLS)
    .eq('id', ctx.params.id)
    .eq('is_active', true)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Strip internal cost components from karat_pricing before sending to the
  // retailer. Only karat / weight / trade / mrp are part of the public contract.
  type FullPricingRow = { karat: number; weight: number; trade: number; mrp: number; goldCost?: number; labourCost?: number; cogs?: number }
  type PublicPricingRow = { karat: number; weight: number; trade: number; mrp: number }
  const raw = (data as { karat_pricing?: Record<string, FullPricingRow> | null }).karat_pricing
  let publicPricing: Record<string, PublicPricingRow> | null = null
  if (raw && typeof raw === 'object') {
    publicPricing = {}
    for (const [k, row] of Object.entries(raw)) {
      if (!row) continue
      publicPricing[k] = { karat: row.karat, weight: row.weight, trade: row.trade, mrp: row.mrp }
    }
  }
  return NextResponse.json({ product: { ...data, karat_pricing: publicPricing } })
}
