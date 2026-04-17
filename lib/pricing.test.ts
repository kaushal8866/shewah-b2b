import { describe, it, expect } from 'vitest'
import { calculateDetailedPrice, PricingResult } from './pricing'

describe('Pricing Engine (§6.8)', () => {
  it('should calculate price correctly for 18K gold ring', () => {
    const inputs = {
      goldWeightMg: 3500, // 3.5g
      purityKarat: 18,
      goldRatePerGram: 6000,
      wastagePct: 0.02, // 2%
      makingPct: 0.14, // 14%
      stoneWeightCt: 0.5,
      stoneRatePerCt: 80000, // 80k/ct
      tradeMarginPct: 0.15, // 15%
    }

    const result: PricingResult = calculateDetailedPrice(inputs)

    // 1. Gold Value
    // 3500mg * 0.75 * 6000 = 15,750,000 / 10 = 1,575,000 paise (15,750 INR)
    expect(result.goldValue).toBe(1575000)

    // 2. Wastage (2% of Gold Value)
    // 1,575,000 * 0.02 = 31,500 paise
    expect(result.wastageValue).toBe(31500)

    // 3. Making (14% of Gold + Wastage)
    // (1,575,000 + 31,500) * 0.14 = 1,606,500 * 0.14 = 224,910 paise
    expect(result.makingCharges).toBe(224910)

    // 4. Stone (0.5ct * 80,000 INR/ct * 100 paise/INR)
    // 40,000 INR * 100 = 4,000,000 paise
    expect(result.stoneValue).toBe(4000000)

    // 5. Subtotal
    // 1,575,000 + 31,500 + 224,910 + 4,000,000 = 5,831,410 paise
    expect(result.subtotal).toBe(5831410)

    // 6. Trade Margin (15% of Subtotal)
    // 5,831,410 * 0.15 = 874,711.5 -> 874,712 paise
    expect(result.tradeMargin).toBe(874712)

    // 7. Pre Tax
    // 5,831,410 + 874,712 = 6,706,122 paise
    expect(result.preTax).toBe(6706122)

    // 8. GST (3% of Pre Tax)
    // 6,706,122 * 0.03 = 201,183.66 -> 201,184 paise
    expect(result.gst).toBe(201184)

    // 9. Final Total
    // 6,706,122 + 201,184 = 6,907,306 paise
    expect(result.finalTotal).toBe(6907306)
  })

  it('should handle zero values gracefully', () => {
    const inputs = {
      goldWeightMg: 0,
      purityKarat: 18,
      goldRatePerGram: 6000,
      wastagePct: 0,
      makingPct: 0,
      stoneWeightCt: 0,
      stoneRatePerCt: 0,
      tradeMarginPct: 0,
    }

    const result = calculateDetailedPrice(inputs)
    expect(result.finalTotal).toBe(0)
  })

  it('should apply correct purity multipliers', () => {
    const rate = 6000
    const weight = 1000 // 1g
    
    const results = {
      k24: calculateDetailedPrice({ ...baseInputs(weight, 24, rate) }).goldValue,
      k22: calculateDetailedPrice({ ...baseInputs(weight, 22, rate) }).goldValue,
      k18: calculateDetailedPrice({ ...baseInputs(weight, 18, rate) }).goldValue,
      k14: calculateDetailedPrice({ ...baseInputs(weight, 14, rate) }).goldValue,
    }

    // 24K: 1000 * 1.0 * 6000 / 10 = 600,000
    expect(results.k24).toBe(600000)
    // 22K: 1000 * 0.9166 * 6000 / 10 = 549,960
    expect(results.k22).toBe(549960)
    // 18K: 1000 * 0.75 * 6000 / 10 = 450,000
    expect(results.k18).toBe(450000)
    // 14K: 1000 * 0.585 * 6000 / 10 = 351,000
    expect(results.k14).toBe(351000)
  })
})

function baseInputs(mg: number, karat: number, rate: number) {
  return {
    goldWeightMg: mg,
    purityKarat: karat,
    goldRatePerGram: rate,
    wastagePct: 0,
    makingPct: 0,
    stoneWeightCt: 0,
    stoneRatePerCt: 0,
    tradeMarginPct: 0,
  }
}
