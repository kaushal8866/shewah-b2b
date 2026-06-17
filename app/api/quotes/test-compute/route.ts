import { NextResponse } from 'next/server'
import { computeQuoteItem, computeQuoteTotals } from '@/lib/quoteCompute'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

// GET /api/quotes/test-compute
// Runs assertions on the pricing calculations in lib/quoteCompute.ts.
export async function GET() {
  const assertions: Array<{ name: string; passed: boolean; expected: any; actual: any }> = []

  const assert = (name: string, actual: any, expected: any) => {
    const passed = JSON.stringify(actual) === JSON.stringify(expected)
    assertions.push({ name, passed, expected, actual })
    return passed
  }

  // Test DB connection inside Next.js
  let dbStatus = 'untested'
  let dbError: any = null
  try {
    const { data, error } = await supabaseAdmin.from('quotes').select('id').limit(1)
    if (error) {
      dbStatus = 'error'
      dbError = { message: error.message, code: error.code, details: error.details }
    } else {
      dbStatus = 'success'
    }
  } catch (err: any) {
    dbStatus = 'exception'
    dbError = { message: err.message, stack: err.stack, cause: err.cause }
  }

  // Test Case 1: computeQuoteItem with basic parameters (18K, 10g, gold rate 6000, labor 200)
  // Gross gold weight = 10g.
  // 18K purity factor = 0.75.
  // 24kt pure weight = 10 * 0.75 = 7.5g.
  // Gold cost = 7.5 * 6000 = 45000.
  // Labour total = 10 * 200 = 2000.
  // Making = 1000, Hallmarking = 45, Other = 500.
  // Unit COGS = 45000 + 2000 + 1000 + 45 + 500 = 48545.
  // Unit trade (with 28% margin) = 48545 * 1.28 = 62137.6 -> round to 62138.
  // Quantity = 2.
  // Line COGS = 48545 * 2 = 97090.
  // Line trade = 62138.
  // Line total = 62138 * 2 = 124276.
  const itemInput = {
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

  const computedItem = computeQuoteItem(itemInput, 28)
  
  assert('net_24kt_weight_g is 7.5', computedItem.net_24kt_weight_g, 7.5)
  assert('labour_total is 4000', computedItem.labour_total, 4000)
  assert('unit_cogs is 48545', computedItem.unit_cogs, 48545)
  assert('unit_trade is 62138', computedItem.unit_trade, 62138)
  assert('line_cogs is 97090', computedItem.line_cogs, 97090)
  assert('line_total is 124276', computedItem.line_total, 124276)

  // Test Case 2: computeQuoteTotals with GST exclusive (3% GST)
  const items = [{ line_total: 100000 }]
  const totalsExclusive = computeQuoteTotals(items, 'exclusive', 3)
  assert('Exclusive Subtotal is 100000', totalsExclusive.subtotal, 100000)
  assert('Exclusive GST is 3000', totalsExclusive.gst_amount, 3000)
  assert('Exclusive Grand Total is 103000', totalsExclusive.grand_total, 103000)

  // Test Case 3: computeQuoteTotals with GST inclusive (3% GST)
  // Grand total = 100000.
  // GST = 100000 - (100000 / 1.03) = 100000 - 97087.37 -> round to 2913.
  const totalsInclusive = computeQuoteTotals(items, 'inclusive', 3)
  assert('Inclusive Subtotal is 100000', totalsInclusive.subtotal, 100000)
  assert('Inclusive GST is 2913', totalsInclusive.gst_amount, 2913)
  assert('Inclusive Grand Total is 100000', totalsInclusive.grand_total, 100000)

  // Test Case 4: computeQuoteTotals with GST none
  const totalsNone = computeQuoteTotals(items, 'none', 3)
  assert('None Subtotal is 100000', totalsNone.subtotal, 100000)
  assert('None GST is 0', totalsNone.gst_amount, 0)
  assert('None Grand Total is 100000', totalsNone.grand_total, 100000)

  const allPassed = assertions.every(a => a.passed)

  return NextResponse.json({
    success: allPassed,
    summary: `${assertions.filter(a => a.passed).length}/${assertions.length} assertions passed`,
    dbStatus,
    dbError,
    assertions,
  }, {
    status: allPassed ? 200 : 500
  })
}
