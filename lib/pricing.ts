/**
 * Shewah B2B — Pricing Doctrine Engine (§6.8)
 * All monetary values are in Integer Paise (1 INR = 100 Paise).
 * All weights are in Integer Milligrams (1g = 1000mg).
 */

export const GST_RATE = 0.03 // 3% for jewelry

/**
 * Gold purity multipliers from SOP §6.2
 */
export const PURITY_MULTIPLIERS: Record<number, number> = {
  24: 1.0,
  22: 0.9166,
  18: 0.75,
  14: 0.585,
}

interface PricingInputs {
  goldWeightMg: number
  purityKarat: number
  goldRatePerGram: number // In Rupees (e.g., 6000)
  wastagePct: number // e.g., 0.02 for 2%
  makingPct: number // e.g., 0.14 for 14%
  stoneWeightCt: number
  stoneRatePerCt: number // In Rupees
  tradeMarginPct: number // e.g., 0.15 for 15%
}

export interface PricingResult {
  goldValue: number
  wastageValue: number
  makingCharges: number
  stoneValue: number
  subtotal: number
  tradeMargin: number
  preTax: number
  gst: number
  finalTotal: number
}

/**
 * The canonical pricing formula as per SOP §6.8
 */
export function calculateDetailedPrice(inputs: PricingInputs): PricingResult {
  const {
    goldWeightMg,
    purityKarat,
    goldRatePerGram,
    wastagePct,
    makingPct,
    stoneWeightCt,
    stoneRatePerCt,
    tradeMarginPct,
  } = inputs

  const purityMultiplier = PURITY_MULTIPLIERS[purityKarat] || 0.75

  // Gold Value = gold_weight_mg × purity_multiplier × (ibja_rate_per_g / 1000)
  // To keep it in paise: (mg * multiplier * rate) / 10
  // Math: (mg / 1000) * multiplier * rate * 100 = (mg * multiplier * rate) / 10
  const goldValue = Math.round((goldWeightMg * purityMultiplier * goldRatePerGram) / 10)
  
  const wastageValue = Math.round(goldValue * wastagePct)
  const makingCharges = Math.round((goldValue + wastageValue) * makingPct)
  
  // Stone = stone_weight_ct × stone_rate_per_ct (in Rupees) -> * 100 for paise
  const stoneValue = Math.round(stoneWeightCt * stoneRatePerCt * 100)
  
  const subtotal = goldValue + wastageValue + makingCharges + stoneValue
  const tradeMargin = Math.round(subtotal * tradeMarginPct)
  
  const preTax = subtotal + tradeMargin
  const gst = Math.round(preTax * GST_RATE)
  const finalTotal = preTax + gst

  return {
    goldValue,
    wastageValue,
    makingCharges,
    stoneValue,
    subtotal,
    tradeMargin,
    preTax,
    gst,
    finalTotal,
  }
}
