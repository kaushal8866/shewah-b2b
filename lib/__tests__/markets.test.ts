import { describe, it, expect } from 'vitest'
import {
  getMarket,
  formatCurrency,
  calculateMarketTax,
  computeDeliveryEstimate,
  MARKETS,
} from '../markets'

describe('International Market Architecture (lib/markets.ts)', () => {
  it('resolves market configurations accurately for target countries', () => {
    expect(getMarket('US').currency).toBe('USD')
    expect(getMarket('GB').currency).toBe('GBP')
    expect(getMarket('UK').currency).toBe('GBP') // UK alias to GB
    expect(getMarket('AU').currency).toBe('AUD')
    expect(getMarket('DE').currency).toBe('EUR')
    expect(getMarket('FR').currency).toBe('EUR')
    expect(getMarket('UNKNOWN').currency).toBe('USD') // default fallback
  })

  it('formats currency correctly with market symbols', () => {
    expect(formatCurrency(1250, 'USD')).toBe('$1,250')
    expect(formatCurrency(1250, 'GBP')).toBe('£1,250')
    expect(formatCurrency(1250, 'AUD')).toBe('A$1,250')
    expect(formatCurrency(1250, 'EUR')).toBe('€1,250')
  })

  it('calculates inclusive VAT correctly for UK (20%)', () => {
    const market = MARKETS.GB
    const res = calculateMarketTax(1200, market)
    expect(res.isInclusive).toBe(true)
    expect(res.grossPrice).toBe(1200)
    expect(res.netPrice).toBe(1000)
    expect(res.taxAmount).toBe(200)
    expect(res.taxLabel).toContain('VAT')
  })

  it('calculates inclusive MwSt correctly for Germany (19%)', () => {
    const market = MARKETS.DE
    const res = calculateMarketTax(1190, market)
    expect(res.isInclusive).toBe(true)
    expect(res.grossPrice).toBe(1190)
    expect(res.netPrice).toBe(1000)
    expect(res.taxAmount).toBe(190)
    expect(res.taxLabel).toContain('MwSt')
  })

  it('calculates inclusive GST correctly for Australia (10%)', () => {
    const market = MARKETS.AU
    const res = calculateMarketTax(1100, market)
    expect(res.isInclusive).toBe(true)
    expect(res.grossPrice).toBe(1100)
    expect(res.netPrice).toBe(1000)
    expect(res.taxAmount).toBe(100)
    expect(res.taxLabel).toContain('GST')
  })

  it('handles exclusive tax for US without hardcoded state tax in catalog', () => {
    const market = MARKETS.US
    const res = calculateMarketTax(1000, market)
    expect(res.isInclusive).toBe(false)
    expect(res.grossPrice).toBe(1000)
    expect(res.netPrice).toBe(1000)
    expect(res.taxAmount).toBe(0) // computed at checkout
  })

  it('computes delivery window correctly incorporating crafting lead days and business transit', () => {
    const fromDate = new Date('2026-10-01T10:00:00Z') // Thursday
    const estimate = computeDeliveryEstimate(10, 'US', fromDate)
    
    expect(estimate.earliestDate.getTime()).toBeGreaterThan(fromDate.getTime())
    expect(estimate.latestDate.getTime()).toBeGreaterThan(estimate.earliestDate.getTime())
    expect(typeof estimate.formattedRange).toBe('string')
    expect(estimate.formattedRange.length).toBeGreaterThan(0)
  })
})
