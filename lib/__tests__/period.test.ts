import { describe, it, expect } from 'vitest'
import { istToday, istDayStart, istDayEnd, istMonthStart } from '../period'
import {
  RECOGNISED_ORDER_STATUSES,
  RECOGNISED_RESELLER_STATUSES,
  ADVANCE_CATEGORIES,
} from '../pnlEngine'

describe('IST period boundaries', () => {
  it('produces offset-aware bounds, not bare Z timestamps', () => {
    // `${date}T23:59:59Z` ran the window to 05:29 the NEXT morning IST.
    expect(istDayStart('2026-03-01')).toBe('2026-03-01T00:00:00+05:30')
    expect(istDayEnd('2026-03-31')).toBe('2026-03-31T23:59:59.999+05:30')
  })

  it('closes the day before the next one opens', () => {
    expect(new Date(istDayEnd('2026-03-31')).getTime())
      .toBeLessThan(new Date(istDayStart('2026-04-01')).getTime())
  })

  it('reports the IST date even when the server clock is behind in UTC', () => {
    // 2026-03-31 22:00 UTC is already 2026-04-01 03:30 in IST.
    expect(istToday(new Date('2026-03-31T22:00:00Z'))).toBe('2026-04-01')
  })

  it('derives the month start from the IST date', () => {
    expect(istMonthStart('2026-04-17')).toBe('2026-04-01')
  })
})

describe('revenue recognition sets', () => {
  it('excludes unpaid reseller orders that the cron job auto-cancels', () => {
    const s = RECOGNISED_RESELLER_STATUSES as readonly string[]
    expect(s).not.toContain('payment_pending')
    expect(s).not.toContain('customer_placed')
    // Pre-payment CAD stages are not earned revenue either.
    expect(s).not.toContain('brief_received')
    expect(s).not.toContain('cad_in_progress')
    expect(s).not.toContain('cad_sent')
    expect(s).not.toContain('design_approved')
  })

  it('recognises reseller revenue from confirmed onward', () => {
    expect(RECOGNISED_RESELLER_STATUSES).toContain('confirmed')
    expect(RECOGNISED_RESELLER_STATUSES).toContain('delivered')
  })

  it('never counts a cancelled order', () => {
    expect(RECOGNISED_ORDER_STATUSES as readonly string[]).not.toContain('cancelled')
    expect(RECOGNISED_RESELLER_STATUSES as readonly string[]).not.toContain('cancelled')
  })

  it('treats advances as collections rather than revenue', () => {
    expect(ADVANCE_CATEGORIES).toContain('order_advance')
    expect(ADVANCE_CATEGORIES).toContain('balance_collection')
  })
})
