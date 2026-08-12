import { describe, it, expect } from 'vitest'
import { buildItemBreakdown, type QuoteItemPDFData } from '../quotePdf'

// Regression suite for quote Q-260811-001, which shipped to a customer with a
// per-piece price stating the line total (a 2× overstatement), a cost box that
// double-counted labour, and a diamond break-up showing half the stones.
//
// The item, solved back from its stored fields:
//   0.90g of 9K gold (factor 0.375) at ₹15,773/g 24kt  →  ₹5,323/pc
//   labour ₹1,100/g on 0.90g                           →    ₹990/pc
//   one 1.00ct stone at ₹8,400/ct                      →  ₹8,400/pc
//   hallmarking                                        →     ₹55/pc
//   unit trade = unit COGS (margin_pct 0)              → ₹14,768/pc
//   line total × 2                                     → ₹29,536

const baseItem: QuoteItemPDFData = {
  name: 'Emerald Studs',
  quantity: 2,
  karat: '9K',
  gross_gold_weight_g: 0.9,
  net_24kt_weight_g: 0.3375,
  gold_rate_24k: 15773,
  labour_rate_per_g: 1100,
  labour_total: 1980,          // ALREADY line-level: 990 × 2
  diamonds: [{
    pieces: 1,
    weight: 1.0,
    rate_per_pc: 8400,         // ₹ per carat, despite the name
    shape_name: 'Emerald',
    size_label: '7x5 mm',
    clarity_label: 'VVS/VS-EF',
  }],
  making_charges: 0,
  hallmarking: 55,
  other_charges: 0,
  line_cogs: 29536,
  line_trade: 29536,
  line_total: 29536,
}

describe('buildItemBreakdown — qty 2, the Q-260811-001 item', () => {
  const bd = buildItemBreakdown(baseItem, 0, 'exclusive', 3)

  it('derives the per-piece price instead of repeating the line total', () => {
    // The bug: the PDF printed line_trade, which computeQuoteItem sets to
    // unitTrade × quantity — identical to line_total. It read "₹29,536 / pc".
    expect(bd.unit_trade).toBe(14768)
    expect(bd.unit_trade).not.toBe(baseItem.line_total)
  })

  it('scales gold to the whole line', () => {
    expect(bd.gold_rate).toBe(5915)      // 15,773 × 0.375, the 9K per-gram rate
    expect(bd.gold_weight).toBeCloseTo(1.8, 10)
    expect(bd.gold_val).toBe(10646)      // 5,323 × 2
  })

  it('shows every stone in the order, not one piece worth', () => {
    // The bug: "Total: 1 stone, 1.00ct" on an order of 2 pieces × 1 stone.
    expect(bd.dia_count).toBe(2)
    expect(bd.dia_weight).toBeCloseTo(2.0, 10)
    expect(bd.dia_val).toBe(16800)
  })

  it('does not double-count labour', () => {
    // The bug: labour_total (line-level, 1,980) was added to hallmarking
    // (per-piece, 55) and printed as 2,035 — a figure at neither level.
    expect(bd.making_charges).toBe(2090)   // 1,980 + 55 × 2
    expect(bd.making_charges).not.toBe(2035)
  })

  it('closes on the line total — the invariant the bug broke', () => {
    expect(bd.total_raw).toBe(29536)
    expect(bd.sub_total).toBe(29536)
    expect(bd.final_value).toBe(baseItem.line_total)
    expect(bd.final_value).not.toBe(15758)  // what the customer was sent
  })

  it('leaves tax to the footer on an exclusive quote', () => {
    // Printing "GST 0" here while the footer adds 3% misleads the reader.
    expect(bd.show_gst).toBe(false)
    expect(bd.gst).toBe(0)
  })

  it('spans the break-up row across the line, keeping per-unit rates per-unit', () => {
    expect(bd.rows).toHaveLength(1)
    const [r] = bd.rows
    expect(r.pieces).toBe(2)
    expect(r.weight).toBeCloseTo(2.0, 10)
    expect(r.total).toBe(16800)
    expect(r.ct_per_pc).toBe(1)      // carats in ONE stone — not scaled
    expect(r.rate).toBe(8400)        // ₹ per carat — not scaled
    expect(r.shape).toBe('Emerald')
  })

  it('reconciles the break-up table with the diamond summary', () => {
    const rowSum = bd.rows.reduce((s, r) => s + r.total, 0)
    expect(rowSum).toBe(bd.dia_val)
  })
})

describe('buildItemBreakdown — quantity is a no-op at 1', () => {
  const singleItem: QuoteItemPDFData = {
    ...baseItem, quantity: 1, labour_total: 990, line_cogs: 14768, line_trade: 14768, line_total: 14768,
  }
  const single = buildItemBreakdown(singleItem, 0, 'exclusive', 3)

  it('makes the unit price and the line total coincide', () => {
    expect(single.unit_trade).toBe(14768)
    expect(single.final_value).toBe(14768)
  })

  it('leaves each component unscaled', () => {
    expect(single.gold_val).toBe(5323)
    expect(single.dia_count).toBe(1)
    expect(single.dia_weight).toBeCloseTo(1.0, 10)
    expect(single.dia_val).toBe(8400)
    expect(single.making_charges).toBe(1045)   // 990 + 55
    expect(single.rows[0].pieces).toBe(1)
  })
})

describe('buildItemBreakdown — margin applies to diamonds only', () => {
  // At 28%, diamonds are marked up and metal/labour stay transparent, so the
  // line total moves to (5,323 + 990 + 10,752 + 55) × 2.
  const marked = buildItemBreakdown({ ...baseItem, line_total: 34240 }, 28, 'exclusive', 3)

  it('marks up the stones and still closes on the line total', () => {
    expect(marked.dia_val).toBe(21504)          // round(8,400 × 1.28) × 2
    expect(marked.gold_val).toBe(10646)         // untouched
    expect(marked.making_charges).toBe(2090)    // untouched
    expect(marked.final_value).toBe(34240)
    expect(marked.rows[0].rate).toBe(10752)     // per-carat rate carries the markup
  })
})

describe('buildItemBreakdown — inclusive GST is extracted, not added', () => {
  const incl = buildItemBreakdown(baseItem, 0, 'inclusive', 3)

  it('divides out the contained tax rather than multiplying it on', () => {
    // computeQuoteTotals divides for inclusive quotes; this path multiplied,
    // which overstated the tax on every inclusive PDF (886 instead of 860).
    expect(incl.gst).toBe(860)                  // 29,536 − round(29,536 / 1.03)
    expect(incl.gst).not.toBe(886)
    expect(incl.show_gst).toBe(true)
    expect(incl.gst_label).toBe('GST (incl.)')
  })

  it('keeps the final value tax-inclusive', () => {
    expect(incl.final_value).toBe(29536)
    expect(incl.sub_total).toBe(29536)
  })
})

describe('buildItemBreakdown — degenerate inputs', () => {
  it('treats a missing or zero quantity as 1 rather than dividing by zero', () => {
    const bd = buildItemBreakdown({ ...baseItem, quantity: 0 }, 0, 'exclusive', 3)
    expect(bd.quantity).toBe(1)
    expect(Number.isFinite(bd.unit_trade)).toBe(true)
    expect(bd.unit_trade).toBe(29536)
  })

  it('handles an item with no stones', () => {
    const bd = buildItemBreakdown({ ...baseItem, diamonds: [], line_total: 12736 }, 0, 'exclusive', 3)
    expect(bd.dia_count).toBe(0)
    expect(bd.dia_val).toBe(0)
    expect(bd.rows).toHaveLength(0)
    expect(bd.final_value).toBe(12736)   // 10,646 gold + 2,090 making
  })
})
