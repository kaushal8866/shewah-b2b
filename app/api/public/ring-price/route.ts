import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { computeQuoteItem, computeQuoteTotals } from '@/lib/quoteCompute'
import { DEFAULT_QUOTE_MARGIN_PCT, DEFAULT_QUOTE_GST_RATE_PCT } from '@/lib/quoteDefaults'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Public ring price calculator.
 *
 * Runs the same `computeQuoteItem` / `computeQuoteTotals` the internal quoting
 * system uses, against the same live gold, labour and stone rates. That is the
 * whole point: a published price that is computed rather than transcribed
 * cannot drift away from what the business actually charges.
 *
 * The computation stays server-side deliberately. Shipping the rate tables to
 * the browser would hand a competitor a complete, current price list.
 */

/** Centre-stone options offered publicly, in carats. Snapped to `diamond_sizes`. */
const CARAT_CHOICES = [0.25, 0.5, 0.75, 1.0] as const
const KARAT_CHOICES = [9, 14, 18] as const
const STONE_CHOICES = ['lgd', 'natural'] as const

/**
 * Gross metal weight of the finished band, in grams, by karat and setting.
 *
 * ⚠ THE ONE ESTIMATED INPUT ON THIS ROUTE. Everything else is read live from
 * the database. These are anchored on the real entry piece — a 9K solitaire at
 * 1.76g — and scaled for heavier alloys and busier settings.
 *
 * Replace with bench figures when you have them; the shape of the table is
 * already correct, only the numbers need to change.
 */
const BAND_WEIGHT_G: Record<number, Record<string, number>> = {
  9:  { solitaire: 1.76, halo: 2.10, three_stone: 2.30 },
  14: { solitaire: 1.95, halo: 2.35, three_stone: 2.55 },
  18: { solitaire: 2.15, halo: 2.60, three_stone: 2.85 },
}
const SETTING_CHOICES = ['solitaire', 'halo', 'three_stone'] as const
type Setting = (typeof SETTING_CHOICES)[number]

/** Accent stones set around the centre, by setting style. */
const ACCENTS: Record<Setting, { carats: number; pieces: number }> = {
  solitaire:   { carats: 0,    pieces: 0 },
  halo:        { carats: 0.01, pieces: 16 },
  three_stone: { carats: 0.10, pieces: 2 },
}

function bad(message: string) {
  return NextResponse.json({ ok: false, error: message }, { status: 400 })
}

export async function POST(req: NextRequest) {
  let body: any
  try { body = await req.json() } catch { return bad('Invalid request.') }

  const carat = Number(body?.carat)
  const karat = Number(body?.karat)
  const setting = String(body?.setting || 'solitaire') as Setting
  const stone = String(body?.stone || 'lgd')

  if (!CARAT_CHOICES.includes(carat as any)) return bad('Choose a centre stone size.')
  if (!KARAT_CHOICES.includes(karat as any)) return bad('Choose a gold purity.')
  if (!SETTING_CHOICES.includes(setting)) return bad('Choose a setting.')
  if (!STONE_CHOICES.includes(stone as any)) return bad('Choose a stone type.')

  // ── Live rates ────────────────────────────────────────────────────────
  const [goldRes, labourRes, sizesRes] = await Promise.all([
    supabaseAdmin.from('gold_rates').select('rate_24k').order('recorded_at', { ascending: false }).limit(1).maybeSingle(),
    supabaseAdmin.from('labour_rates').select('rate_per_gram').eq('karat', karat).maybeSingle(),
    supabaseAdmin.from('diamond_sizes').select('id, approx_carats').not('approx_carats', 'is', null),
  ])

  const goldRate24k = Number(goldRes.data?.rate_24k) || 0
  if (!goldRate24k) {
    return NextResponse.json(
      { ok: false, error: 'Live gold rate unavailable. Please send a brief and we will quote by hand.' },
      { status: 503 },
    )
  }
  const labourPerG = Number(labourRes.data?.rate_per_gram) || 0

  // Snap the requested carat to the nearest stocked size, then price that size.
  const sizes = (sizesRes.data || []) as Array<{ id: string; approx_carats: number }>
  if (!sizes.length) return NextResponse.json({ ok: false, error: 'Stone sizes unavailable.' }, { status: 503 })

  const nearest = sizes.reduce((best, s) =>
    Math.abs(Number(s.approx_carats) - carat) < Math.abs(Number(best.approx_carats) - carat) ? s : best)

  // `price_per_piece` is per PIECE, not per carat — verified against the data:
  // every lgd cell equals 15,000 x approx_carats exactly.
  const { data: priceRows } = await supabaseAdmin
    .from('cfg_stone_prices')
    .select('price_per_piece')
    .eq('type', stone)
    .eq('size_id', nearest.id)
    .order('price_per_piece', { ascending: true })
    .limit(1)

  const centrePricePerPiece = Number(priceRows?.[0]?.price_per_piece) || 0
  if (!centrePricePerPiece) {
    return NextResponse.json(
      { ok: false, error: 'That combination is not priced yet. Send a brief and we will quote it by hand.' },
      { status: 404 },
    )
  }
  const centreCarats = Number(nearest.approx_carats) || carat
  // computeQuoteItem multiplies weight x pieces x rate, so hand it a per-carat
  // rate derived from the per-piece cell rather than the raw cell value.
  const centreRatePerCarat = centrePricePerPiece / centreCarats

  const grossWeight = BAND_WEIGHT_G[karat]?.[setting] ?? BAND_WEIGHT_G[9].solitaire
  const accent = ACCENTS[setting]

  const diamonds: any[] = [
    {
      shape_id: 'centre', size_id: nearest.id, quality_id: '', color_id: '',
      type: stone, pieces: 1, weight: centreCarats,
      rate_per_pc: centreRatePerCarat,
    },
  ]
  if (accent.pieces > 0) {
    diamonds.push({
      shape_id: 'accent', size_id: '', quality_id: '', color_id: '',
      type: 'lgd', pieces: accent.pieces, weight: accent.carats,
      // Accents priced at the same per-carat rate as the centre stone.
      rate_per_pc: centreRatePerCarat,
    })
  }

  const item = computeQuoteItem(
    {
      gross_gold_weight_g: grossWeight,
      karat,
      gold_rate_24k: goldRate24k,
      labour_rate_per_g: labourPerG,
      diamonds,
      making_charges: 0,
      hallmarking: 0,
      other_charges: 0,
      quantity: 1,
    },
    DEFAULT_QUOTE_MARGIN_PCT,
  )

  const totals = computeQuoteTotals([{ line_total: item.line_total }], 'exclusive', DEFAULT_QUOTE_GST_RATE_PCT)

  // Present the same four lines the printed quote uses. Gold and labour are
  // reported at cost; the margin sits on the stone, so it is folded into the
  // stone line rather than hidden in a separate unexplained charge.
  const goldCost = Math.round((grossWeight * (karat / 24)) * goldRate24k)
  const labourCost = Math.round(labourPerG * grossWeight)
  const stoneLine = Math.max(item.unit_trade - goldCost - labourCost, 0)

  return NextResponse.json({
    ok: true,
    input: { carat, karat, setting, stone },
    stone_carats: centreCarats,
    lines: [
      { item: `${karat}KT gold (${grossWeight.toFixed(2)}g)`, amount: goldCost },
      { item: `${stone === 'lgd' ? 'Lab-grown diamonds' : 'Natural diamonds'} (${centreCarats.toFixed(2)}ct centre)`, amount: stoneLine },
      { item: 'Making charges', amount: labourCost },
      { item: `GST (${DEFAULT_QUOTE_GST_RATE_PCT}%)`, amount: totals.gst_amount },
    ],
    subtotal: totals.subtotal,
    gst: totals.gst_amount,
    total: totals.grand_total,
    gold_rate_24k: goldRate24k,
    note: 'Indicative. Your final quote is itemised the same way, at the gold rate on the day you order.',
  })
}
