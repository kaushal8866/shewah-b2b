import { pure24kt, getMetalWeight, pureGoldMass, DEFAULT_MIN_MARGIN_PCT } from './karat'

export interface DiamondSpec {
  shape_id: string
  size_id: string
  quality_id: string
  color_id: string
  type: 'lgd' | 'natural'
  pieces: number
  /**
   * ₹ PER CARAT, despite the name. Line cost is `weight × pieces × rate`, and
   * the stone-price admin fills this from a "Base rate (₹ per carat)" input.
   * The key is kept as-is because it is persisted inside the
   * `quote_items.diamonds` JSONB on every existing quote; renaming it would
   * need a data migration. The UI labels now say ₹/ct.
   */
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
  /** True when the minimum-margin floor had to lift the price above raw COGS. */
  margin_floor_applied: boolean
}

export function computeQuoteItem(
  input: QuoteItemInput,
  marginPct: number = 28,
  minMarginPct: number = DEFAULT_MIN_MARGIN_PCT,
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
    const wt   = Math.max(Number((d as any).weight || (d as any).approx_carats) || 0, 0)
    const pcs  = Math.max(Number((d as any).pieces) || 0, 0)
    const rate = Math.max(Number(d.rate_per_pc) || 0, 0)   // rate per carat
    const igi  = Math.max(Number(d.igi_charge) || 0, 0)
    // total_carats × rate_per_carat + igi
    return sum + (wt * pcs * rate) + igi
  }, 0)

  const makingCharges = Math.max(Number(input.making_charges) || 0, 0)
  const hallmarking = Math.max(Number(input.hallmarking) || 0, 0)
  const otherCharges = Math.max(Number(input.other_charges) || 0, 0)

  const unitCogs = goldCostPerPc + labourCostPerPc + diamondCostPerPc + makingCharges + hallmarking + otherCharges

  // Margin applies only to diamond cost — gold, labour, making, hallmarking and
  // IGI are quoted transparently. An item with no diamonds would therefore
  // price at exactly COGS, so a minimum-margin floor keeps it above cost.
  const rawUnitTrade = goldCostPerPc + labourCostPerPc + Math.round(diamondCostPerPc * (1 + marginPct / 100)) + makingCharges + hallmarking + otherCharges
  const minMargin = Math.max(minMarginPct, 0) / 100
  const tradeFloor = Math.round(unitCogs * (1 + minMargin))
  const marginFloorApplied = tradeFloor > rawUnitTrade
  const unitTrade = marginFloorApplied ? tradeFloor : rawUnitTrade

  return {
    net_24kt_weight_g: net24ktWeight,
    labour_total: labourTotal,
    diamond_cost_total: diamondCostPerPc * quantity,
    unit_cogs: unitCogs,
    unit_trade: unitTrade,
    line_cogs: unitCogs * quantity,
    line_trade: unitTrade * quantity,
    line_total: unitTrade * quantity,
    margin_floor_applied: marginFloorApplied,
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

  let netSubtotal: number
  let gstAmount: number
  let grandTotal: number

  if (gstTreatment === 'exclusive') {
    // Line totals are pre-tax; tax is added on top.
    netSubtotal = Math.round(subtotal)
    gstAmount   = Math.round(subtotal * gstRate)
    grandTotal  = netSubtotal + gstAmount
  } else if (gstTreatment === 'inclusive') {
    // Line totals already contain the tax. `subtotal` must be reported NET of
    // it so the three fields reconcile — previously subtotal stayed
    // tax-inclusive while gst_amount was extracted from it, so
    // `subtotal + gst_amount` overstated the grand total by the tax amount.
    // Every PDF and ledger consuming both fields was internally inconsistent.
    grandTotal  = Math.round(subtotal)
    netSubtotal = Math.round(subtotal / (1 + gstRate))
    gstAmount   = grandTotal - netSubtotal   // derived, so the sum always closes
  } else {
    netSubtotal = Math.round(subtotal)
    gstAmount   = 0
    grandTotal  = netSubtotal
  }

  return {
    subtotal: netSubtotal,
    gst_amount: gstAmount,
    grand_total: grandTotal,
  }
}
