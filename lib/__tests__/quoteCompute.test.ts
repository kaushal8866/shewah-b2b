import { describe, it, expect } from 'vitest'
import { computeQuoteItem, computeQuoteTotals } from '../quoteCompute'

// These assertions previously lived in app/api/quotes/test-compute/route.ts —
// a publicly reachable, unauthenticated endpoint that ran them in production
// and also probed the database. They belong here instead.

describe('computeQuoteItem', () => {
  // 18K, 10g gross, ₹6000/g 24kt, ₹200/g labour, qty 2.
  //   18K purity 0.75 → 24kt pure weight = 10 × 0.75 = 7.5g
  //   gold      = 7.5 × 6000                        = 45,000
  //   labour    = 10 × 200                          =  2,000 per pc
  //   making 1000 + hallmarking 45 + other 500
  //   unit COGS = 45000 + 2000 + 1000 + 45 + 500    = 48,545
  //   unit trade: 28% margin applies to diamonds only, and there are none,
  //               so trade == COGS + 0 markup on a diamond cost of 0.
  const input = {
    gross_gold_weight_g: 10,
    karat: '18K',
    gold_rate_24k: 6000,
    labour_rate_per_g: 200,
    diamonds: [],
    making_charges: 1000,
    hallmarking: 45,
    other_charges: 500,
    quantity: 2,
  }

  const result = computeQuoteItem(input, 28)

  it('converts gross weight to 24kt pure mass', () => {
    expect(result.net_24kt_weight_g).toBe(7.5)
  })

  it('bills labour on gross weight across the full quantity', () => {
    expect(result.labour_total).toBe(4000)
  })

  it('sums unit COGS from gold, labour and fixed charges', () => {
    expect(result.unit_cogs).toBe(48545)
  })

  it('scales COGS by quantity', () => {
    expect(result.line_cogs).toBe(48545 * 2)
  })

  // Margin still applies ONLY to diamond cost — metal and labour are quoted
  // transparently by design. With no diamonds that would price at exactly
  // COGS, so the minimum-margin floor now lifts it clear of cost.
  it('applies the margin floor rather than selling at cost', () => {
    expect(result.margin_floor_applied).toBe(true)
    expect(result.unit_trade).toBeGreaterThan(result.unit_cogs)
    expect(result.unit_trade).toBe(Math.round(result.unit_cogs * 1.1))
  })

  it('leaves a diamond-bearing item on its normal markup', () => {
    const withStones = computeQuoteItem({
      ...input,
      diamonds: [{ weight: 0.5, pieces: 2, rate_per_pc: 40000 } as any],
    }, 28)
    expect(withStones.margin_floor_applied).toBe(false)
  })

  it('honours an explicit minimum margin', () => {
    const strict = computeQuoteItem(input, 28, 25)
    expect(strict.unit_trade).toBe(Math.round(strict.unit_cogs * 1.25))
  })
})

describe('computeQuoteTotals', () => {
  const items = [{ line_total: 100000 }]

  it('adds GST on top when exclusive', () => {
    const t = computeQuoteTotals(items, 'exclusive', 3)
    expect(t.subtotal).toBe(100000)
    expect(t.gst_amount).toBe(3000)
    expect(t.grand_total).toBe(103000)
  })

  it('extracts GST from the total when inclusive', () => {
    // 100000 / 1.03 = 97087.38 → net 97087, tax 2913, total unchanged.
    const t = computeQuoteTotals(items, 'inclusive', 3)
    expect(t.subtotal).toBe(97087)
    expect(t.gst_amount).toBe(2913)
    expect(t.grand_total).toBe(100000)
  })

  // Was a real defect: inclusive mode left `subtotal` tax-inclusive while
  // extracting `gst_amount` from it, so the two overstated the grand total.
  it('reconciles subtotal + gst to grand_total in every treatment', () => {
    for (const mode of ['exclusive', 'inclusive', 'none'] as const) {
      const t = computeQuoteTotals(items, mode, 3)
      expect(t.subtotal + t.gst_amount, `mode=${mode}`).toBe(t.grand_total)
    }
  })

  it('reconciles across rates and awkward amounts', () => {
    for (const rate of [0, 1.5, 3, 5, 12, 18]) {
      for (const amount of [1, 999, 12345, 99999]) {
        const t = computeQuoteTotals([{ line_total: amount }], 'inclusive', rate)
        expect(t.subtotal + t.gst_amount, `rate=${rate} amount=${amount}`).toBe(t.grand_total)
      }
    }
  })

  it('charges nothing when GST treatment is none', () => {
    const t = computeQuoteTotals(items, 'none', 3)
    expect(t.gst_amount).toBe(0)
    expect(t.grand_total).toBe(100000)
  })
})
