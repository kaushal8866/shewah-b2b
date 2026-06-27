import { pure24kt, getMetalWeight, pureGoldMass } from './karat'

export interface DiamondSpec {
  shape_id: string
  size_id: string
  quality_id: string
  color_id: string
  type: 'lgd' | 'natural'
  pieces: number
  rate_per_pc: number
  row_total?: number
  igi_charge?: number
}

export interface QuoteItemInput {
  gross_gold_weight_g: number
  karat: string | number
  gold_rate_24k: number
  labour_rate_per_g: number
  diamonds: DiamondSpec[]
  making_charges: number
  hallmarking: number
  other_charges: number
  quantity: number
  metal_weights?: any
}

export interface ComputedQuoteItem {
  net_24kt_weight_g: number
  labour_total: number
  diamond_cost_total: number
  unit_cogs: number
  unit_trade: number
  line_cogs: number
  line_trade: number
  line_total: number
}

export function computeQuoteItem(
  input: QuoteItemInput,
  marginPct: number = 28
): ComputedQuoteItem {
  const quantity = Math.max(Number(input.quantity) || 1, 1)
  
  const isSilver = String(input.karat).toLowerCase() === 'silver'
  
  let grossGoldWeight = Math.max(Number(input.gross_gold_weight_g) || 0, 0)
  if (input.metal_weights && Object.keys(input.metal_weights).length > 0) {
    if (isSilver) {
      const silverGrade = String(input.karat).toLowerCase().includes('999') ? 'silver_999' : 'silver_925'
      grossGoldWeight = getMetalWeight(input.metal_weights, silverGrade, 'default') || grossGoldWeight
    } else {
      let karatStr = '22K'
      if (typeof input.karat === 'number') {
        karatStr = `${input.karat}K`
      } else if (typeof input.karat === 'string') {
        const num = parseInt(input.karat.replace(/[^\d]/g, '')) || 22
        karatStr = `${num}K`
      }
      grossGoldWeight = getMetalWeight(input.metal_weights, karatStr, 'yellow') || grossGoldWeight
    }
  }

  let net24ktWeight = 0
  let goldCostPerPc = 0

  if (isSilver) {
    net24ktWeight = grossGoldWeight
    const silverRate = Math.max(Number(input.gold_rate_24k) || 0, 0)
    goldCostPerPc = Math.round(net24ktWeight * silverRate)
  } else {
    let karatStr = '18K'
    if (typeof input.karat === 'number') {
      karatStr = `${input.karat}K`
    } else if (typeof input.karat === 'string') {
      const num = parseInt(input.karat.replace(/[^\d]/g, '')) || 18
      karatStr = `${num}K`
    }
    net24ktWeight = pureGoldMass(grossGoldWeight, karatStr)
    const goldRate24k = Math.max(Number(input.gold_rate_24k) || 0, 0)
    goldCostPerPc = Math.round(net24ktWeight * goldRate24k)
  }

  const labourRatePerG = Math.max(Number(input.labour_rate_per_g) || 0, 0)
  const labourCostPerPc = Math.round(labourRatePerG * grossGoldWeight)
  const labourTotal = labourCostPerPc * quantity

  const diamonds = Array.isArray(input.diamonds) ? input.diamonds : []
  const diamondCostPerPc = diamonds.reduce((sum, d) => {
    const wt = Math.max(Number((d as any).weight || (d as any).approx_carats) || 0, 0)
    const rate = Math.max(Number(d.rate_per_pc) || 0, 0)
    const igi = Math.max(Number(d.igi_charge) || 0, 0)
    return sum + (wt * rate) + igi
  }, 0)

  const makingCharges = Math.max(Number(input.making_charges) || 0, 0)
  const hallmarking = Math.max(Number(input.hallmarking) || 0, 0)
  const otherCharges = Math.max(Number(input.other_charges) || 0, 0)

  const unitCogs = goldCostPerPc + labourCostPerPc + diamondCostPerPc + makingCharges + hallmarking + otherCharges
  const unitTrade = goldCostPerPc + labourCostPerPc + Math.round(diamondCostPerPc * (1 + marginPct / 100)) + makingCharges + hallmarking + otherCharges

  return {
    net_24kt_weight_g: net24ktWeight,
    labour_total: labourTotal,
    diamond_cost_total: diamondCostPerPc * quantity,
    unit_cogs: unitCogs,
    unit_trade: unitTrade,
    line_cogs: unitCogs * quantity,
    line_trade: unitTrade * quantity,
    line_total: unitTrade * quantity,
  }
}

export interface QuoteTotals {
  subtotal: number
  gst_amount: number
  grand_total: number
}

export function computeQuoteTotals(
  items: Array<{ line_total: number }>,
  gstTreatment: 'exclusive' | 'inclusive' | 'none',
  gstRatePct: number = 3
): QuoteTotals {
  const subtotal = items.reduce((sum, item) => sum + (Number(item.line_total) || 0), 0)
  const gstRate = Math.max(Number(gstRatePct) || 0, 0) / 100

  let gstAmount = 0
  let grandTotal = subtotal

  if (gstTreatment === 'exclusive') {
    gstAmount = Math.round(subtotal * gstRate)
    grandTotal = subtotal + gstAmount
  } else if (gstTreatment === 'inclusive') {
    grandTotal = subtotal
    gstAmount = Math.round(grandTotal - (grandTotal / (1 + gstRate)))
    // If inclusive, the subtotal stored in DB is typically net of tax
    // Wait, let's keep subtotal as the sum of line_totals, and show gst_amount.
  } else {
    // none
    gstAmount = 0
    grandTotal = subtotal
  }

  return {
    subtotal: Math.round(subtotal),
    gst_amount: Math.round(gstAmount),
    grand_total: Math.round(grandTotal),
  }
}
