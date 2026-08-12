import { describe, it, expect } from 'vitest'
import {
  computeQuoteItem,
  computeQuoteTotals,
  computeQuoteAdvance,
  type QuoteItemBreakdownInput,
} from '../quoteCompute'

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

  // lib/quotePdf.ts read `line_trade` as a per-piece price and printed it as
  // "₹X / pc". It is not: BOTH line fields are line-level and identical, so on
  // a qty-2 item the PDF stated double the true unit price. Nothing persists
  // the per-unit figure — consumers must divide by quantity (or read
  // `unit_trade` off this return value).
  it('reports line_trade and line_total at LINE level, never per piece', () => {
    expect(result.line_trade).toBe(result.unit_trade * input.quantity)
    expect(result.line_total).toBe(result.unit_trade * input.quantity)
    expect(result.line_trade).toBe(result.line_total)
    expect(result.line_trade).not.toBe(result.unit_trade)
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

describe('computeQuoteAdvance', () => {
  // The Q-260811-001 item: gold ₹10,646 and stones ₹16,800 across the line,
  // making/labour/hallmarking ₹2,090, grand total ₹30,422 incl. 3% GST.
  const item: QuoteItemBreakdownInput = {
    quantity: 2,
    karat: '9K',
    gross_gold_weight_g: 0.9,
    gold_rate_24k: 15773,
    labour_total: 1980,
    diamonds: [{ pieces: 1, weight: 1.0, rate_per_pc: 8400 }],
    making_charges: 0,
    hallmarking: 55,
    other_charges: 0,
    line_total: 29536,
  }

  const adv = computeQuoteAdvance([item], 0, 30422)

  it('takes all of the gold and half of the stones', () => {
    expect(adv.gold_value).toBe(10646)
    expect(adv.diamond_value).toBe(16800)
    expect(adv.advance_due).toBe(19046)   // 10,646 + 8,400
  })

  it('leaves making charges and GST to the balance', () => {
    expect(adv.balance_due).toBe(11376)
    expect(adv.advance_due + adv.balance_due).toBe(30422)
  })

  it('excludes making, labour and hallmarking from the advance base', () => {
    // 2,090 of making/labour/hallmarking is in the line total but not the base.
    expect(adv.gold_value + adv.diamond_value).toBe(27446)
    expect(adv.gold_value + adv.diamond_value + 2090).toBe(item.line_total)
  })

  it('sums across multiple items', () => {
    const two = computeQuoteAdvance([item, item], 0, 60844)
    expect(two.gold_value).toBe(21292)
    expect(two.diamond_value).toBe(33600)
    expect(two.advance_due).toBe(38092)
  })

  it('takes the advance on marked-up stone value, as quoted', () => {
    // At 28% the customer is quoted 21,504 of diamond, so half of THAT is due.
    const marked = computeQuoteAdvance([item], 28, 35247)
    expect(marked.diamond_value).toBe(21504)
    expect(marked.advance_due).toBe(10646 + 10752)
  })

  it('never asks for more up front than the quote is worth', () => {
    // A quote discounted below its component cost must not invert the balance.
    const capped = computeQuoteAdvance([item], 0, 15000)
    expect(capped.advance_due).toBe(15000)
    expect(capped.balance_due).toBe(0)
  })

  it('handles a stone-free item', () => {
    const noStones = computeQuoteAdvance([{ ...item, diamonds: [] }], 0, 13126)
    expect(noStones.diamond_value).toBe(0)
    expect(noStones.advance_due).toBe(10646)
  })

  it('returns zeroes for an empty quote', () => {
    const empty = computeQuoteAdvance([], 0, 0)
    expect(empty.advance_due).toBe(0)
    expect(empty.balance_due).toBe(0)
  })
})
