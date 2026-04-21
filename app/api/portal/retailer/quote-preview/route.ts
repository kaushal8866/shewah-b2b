import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { computeKaratPricing, SELLABLE_KARATS, type SellableKarat } from '@/lib/karat'

// POST /api/portal/retailer/quote-preview
// Body: {
//   gold_weight_g: number,                      // net gold weight in g
//   karat: 22|18|14|10|9,                       // karat the retailer is comparing
//   diamonds: [{ pieces, cost }],               // per-row diamond cost (₹/pc)
//   making_charges?: number, igi_cost?: number, // optional add-ons
// }
// Returns the computed Shewah comparison quote for the given karat using the
// latest gold rate + retail labour, so the retailer can see what their piece
// would cost if Shewah made it.
export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  const user: any = session?.user
  if (!user || user.role !== 'retailer') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }

  const goldWeight = Number(body.gold_weight_g) || 0
  const requested = parseInt(body.karat) || 22
  const isSellable = (n: number): n is SellableKarat =>
    (SELLABLE_KARATS as readonly number[]).includes(n)
  const karat: SellableKarat = isSellable(requested) ? requested : 22

  const diamondCost = Array.isArray(body.diamonds)
    ? body.diamonds.reduce((sum: number, d: any) => {
        const pcs = Math.max(parseInt(d?.pieces) || 1, 1)
        const c = Number(d?.cost) || 0
        return sum + pcs * c
      }, 0)
    : 0
  const makingCharges = Math.max(Number(body.making_charges) || 0, 0)
  const igiCost = Math.max(Number(body.igi_cost) || 0, 0)

  // Latest gold rate + retail labour per karat. We always pull all five so
  // the per-karat helper can produce the full grid; the UI just displays
  // the requested karat.
  const { data: g } = await supabaseAdmin
    .from('gold_rates')
    .select('rate_24k, retail_labour_22k, retail_labour_18k, retail_labour_14k, retail_labour_10k, retail_labour_9k')
    .order('recorded_at', { ascending: false })
    .limit(1)
  const latest: any = g?.[0]
  if (!latest) {
    return NextResponse.json({ error: 'No gold rate is set yet — Shewah admin must record one before a quote can be shown.' }, { status: 503 })
  }

  const retailLabour: Record<number, number> = {
    22: Number(latest.retail_labour_22k) || 0,
    18: Number(latest.retail_labour_18k) || 0,
    14: Number(latest.retail_labour_14k) || 0,
    10: Number(latest.retail_labour_10k) || 0,
    9:  Number(latest.retail_labour_9k)  || 0,
  }

  const pricing = computeKaratPricing({
    netGoldWeight: goldWeight,
    rate24k: Number(latest.rate_24k) || 0,
    retailLabour,
    diamondCost,
    makingCharges,
    igiCost,
  })
  const row = pricing.find(p => p.karat === karat) || null

  return NextResponse.json({
    karat,
    gold_weight_g: goldWeight,
    rate_24k: Number(latest.rate_24k) || 0,
    diamond_cost_total: diamondCost,
    making_charges: makingCharges,
    igi_cost: igiCost,
    quote: row,            // { karat, weight (24kt-pure g), goldCost, labourCost, cogs, trade, mrp }
    all_karats: pricing,   // full grid for transparency
  })
}
