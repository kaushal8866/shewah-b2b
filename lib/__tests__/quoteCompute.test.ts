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

  // Documents current behaviour: margin is applied ONLY to diamond cost, so a
  // zero-diamond item earns no margin at all. See Phase 1.6 of the audit.
  it('earns zero margin on an item with no diamonds', () => {
    expect(result.unit_trade).toBe(result.unit_cogs)
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
    // 100000 − (100000 / 1.03) = 2912.62 → 2913
    const t = computeQuoteTotals(items, 'inclusive', 3)
    expect(t.gst_amount).toBe(2913)
    expect(t.grand_total).toBe(100000)
  })

  // KNOWN DEFECT (audit Phase 1.7): in inclusive mode `subtotal` remains the
  // tax-inclusive sum of line totals while `gst_amount` is extracted from it,
  // so subtotal + gst != grand_total. Anything consuming both fields — quote
  // PDFs, the invoice ledger — is internally inconsistent. This test pins the
  // current behaviour so the fix is a deliberate, visible change.
  it('inclusive subtotal does not currently net off tax', () => {
    const t = computeQuoteTotals(items, 'inclusive', 3)
    expect(t.subtotal).toBe(100000)
    expect(t.subtotal + t.gst_amount).not.toBe(t.grand_total)
  })

  it('charges nothing when GST treatment is none', () => {
    const t = computeQuoteTotals(items, 'none', 3)
    expect(t.gst_amount).toBe(0)
    expect(t.grand_total).toBe(100000)
  })
})
