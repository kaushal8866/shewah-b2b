import { pure24kt, getMetalWeight, pureGoldMass, DEFAULT_MIN_MARGIN_PCT, KARAT_FACTORS } from './karat'

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

// ── Per-item breakdown ───────────────────────────────────────────────────────
//
// Lives here rather than in quotePdf.ts because it is pure arithmetic that both
// the PDF and the customer-facing digital quote need, and importing quotePdf
// would drag PDFKit into every JSON route that wants a gold/diamond split.

/** The subset of a stored quote_item this breakdown reads. */
export interface QuoteItemBreakdownInput {
  quantity: number
  karat: string | number
  gross_gold_weight_g: number
  gold_rate_24k: number
  /** ALREADY line-level: labourPerPc × quantity, as computeQuoteItem returns it. */
  labour_total: number
  diamonds: any[]
  making_charges: number
  hallmarking: number
  other_charges: number
  line_total: number
}

export interface DiamondBreakupRow {
  size: string
  color: string
  clarity: string
  shape: string
  /** Stones across the whole line = per-piece count × quantity. */
  pieces: number
  /** ₹ per carat, marked up. A rate, so it is NOT scaled by quantity. */
  rate: number
  /** Carats in one stone. A per-stone figure, so NOT scaled by quantity. */
  ct_per_pc: number
  /** Total carats across the line = pieces × ct_per_pc. */
  weight: number
  total: number
}

export interface ItemBreakdown {
  quantity: number
  /** Price of a single piece. */
  unit_trade: number
  gold_component: string
  gold_rate: number
  gold_weight: number
  gold_val: number
  diamond_label: string
  dia_count: number
  dia_weight: number
  dia_val: number
  making_charges: number
  total_raw: number
  discount: number
  sub_total: number
  gst: number
  /** False when tax belongs to the document footer rather than the item box. */
  show_gst: boolean
  gst_label: string
  final_value: number
  rows: DiamondBreakupRow[]
}

/**
 * Every number the per-item cost box and diamond break-up table render.
 *
 * Kept pure and separate from the PDFKit draw calls because this arithmetic was
 * previously inlined among ~200 lines of `doc.text()` and no test could reach
 * it. It silently mixed per-piece and line-level values: gold and diamond were
 * per-piece while `labour_total` is per-LINE, so on a qty-2 item the box
 * double-counted labour and its "Final Value" matched neither the unit price
 * nor the line total.
 *
 * Everything here is LINE-level, so `final_value === item.line_total` and the
 * box reconciles with both the headline and the footer subtotal.
 */
export function buildItemBreakdown(
  item: QuoteItemBreakdownInput,
  marginPct: number,
  gstTreatment: 'exclusive' | 'inclusive' | 'none',
  gstRatePct: number,
): ItemBreakdown {
  const qty = Math.max(Number(item.quantity) || 1, 1)
  const margin = 1 + (Number(marginPct) || 0) / 100

  const isSilver = String(item.karat).toLowerCase() === 'silver'
  const itemKaratStr = typeof item.karat === 'number' ? `${item.karat}K` : String(item.karat)
  const karatNum = parseInt(String(item.karat).replace(/[^\d]/g, '')) || 24
  const karatFactor = isSilver ? 1 : (KARAT_FACTORS[karatNum] || 1)

  // computeQuoteItem sets BOTH line_trade and line_total to unitTrade × quantity,
  // so neither column carries the per-piece price — derive it.
  const unit_trade = Math.round((Number(item.line_total) || 0) / qty)

  const gold_component = `${itemKaratStr} Gold`
  const gold_rate = Math.round(item.gold_rate_24k * karatFactor)
  const gold_weight = item.gross_gold_weight_g * qty
  const gold_val = Math.round(item.gross_gold_weight_g * item.gold_rate_24k * karatFactor) * qty

  const diamonds = Array.isArray(item.diamonds) ? item.diamonds : []
  const dia_count = diamonds.reduce((sum, d) => sum + (parseInt(d.pieces) || 0), 0) * qty
  const dia_weight = diamonds.reduce(
    (sum, d) => sum + (parseInt(d.pieces) || 1) * (parseFloat(d.approx_carats || d.weight) || 0), 0,
  ) * qty
  const dia_val = diamonds.reduce((sum, d) => {
    const wt = parseFloat(d.approx_carats || d.weight) || 0
    const rate = parseFloat(d.rate_per_pc || d.cost) || 0
    const pieces = parseInt(d.pieces) || 0
    const igi = parseFloat(d.igi_charge) || 0
    return sum + Math.round(((wt * pieces * rate) + igi) * margin)
  }, 0) * qty

  // labour_total is ALREADY line-level (labourPerPc × quantity, see
  // computeQuoteItem). Only the other three are per-piece and get scaled.
  const making_charges = Math.round(
    item.labour_total + (item.making_charges + item.hallmarking + item.other_charges) * qty,
  )

  const total_raw = gold_val + dia_val + making_charges
  const discount = 0
  const sub_total = total_raw - discount
  const final_value = sub_total

  // On an `exclusive` quote the tax is a document-level line in the footer, so
  // the item box stays pre-tax instead of printing a flat "GST 0" beside a
  // Final Value the footer then adds 3% to.
  const gstRate = Math.max(Number(gstRatePct) || 0, 0) / 100
  const show_gst = gstTreatment === 'inclusive'
  // Inclusive line totals already contain the tax, so extract it by division —
  // matching computeQuoteTotals. Multiplying (the old behaviour) overstated it.
  const gst = show_gst ? sub_total - Math.round(sub_total / (1 + gstRate)) : 0

  const rows: DiamondBreakupRow[] = diamonds.map((d) => {
    const pieces = (parseInt(d.pieces) || 0) * qty
    const ct_per_pc = parseFloat(d.approx_carats || d.weight) || 0
    const weight = pieces * ct_per_pc
    const rate = d.rate_per_pc ? Math.round(parseFloat(d.rate_per_pc) * margin) : 0
    return {
      size: d.size_label || '—',
      color: d.color_label || d.color || '—',
      clarity: d.clarity_label || d.quality || '—',
      shape: d.shape_name || d.shape_label || d.name || '—',
      pieces,
      rate,
      ct_per_pc,
      weight,
      total: Math.round(weight * rate),
    }
  })

  return {
    quantity: qty,
    unit_trade,
    gold_component,
    gold_rate,
    gold_weight,
    gold_val,
    diamond_label: diamonds[0]?.clarity_label || diamonds[0]?.quality || 'VVS/VS-EF',
    dia_count,
    dia_weight,
    dia_val,
    making_charges,
    total_raw,
    discount,
    sub_total,
    gst,
    show_gst,
    gst_label: show_gst ? 'GST (incl.)' : 'GST',
    final_value,
    rows,
  }
}

// ── Advance ──────────────────────────────────────────────────────────────────

/**
 * Advance covers the metal and stone the workshop must buy up front. Gold moves
 * daily, so it is taken in full; diamonds are half, leaving the rest with the
 * balance. Making, labour, hallmarking and GST are NOT in the advance — they
 * fall due on the final invoice.
 */
export const ADVANCE_GOLD_PCT = 100
export const ADVANCE_DIAMOND_PCT = 50

export interface QuoteAdvance {
  gold_value: number
  diamond_value: number
  gold_pct: number
  diamond_pct: number
  /** Payable now, clamped to the grand total. */
  advance_due: number
  /** Everything else, including making charges and GST. */
  balance_due: number
}

export function computeQuoteAdvance(
  items: QuoteItemBreakdownInput[],
  marginPct: number,
  grandTotal: number,
  goldPct: number = ADVANCE_GOLD_PCT,
  diamondPct: number = ADVANCE_DIAMOND_PCT,
): QuoteAdvance {
  const list = Array.isArray(items) ? items : []

  let goldValue = 0
  let diamondValue = 0
  for (const item of list) {
    // GST treatment is irrelevant to the gold/diamond split, and 'exclusive'
    // keeps the components pre-tax — which is what the advance is taken on.
    const bd = buildItemBreakdown(item, marginPct, 'exclusive', 0)
    goldValue += bd.gold_val
    diamondValue += bd.dia_val
  }

  const total = Math.max(Number(grandTotal) || 0, 0)
  const raw = Math.round(
    goldValue * (Math.max(goldPct, 0) / 100) + diamondValue * (Math.max(diamondPct, 0) / 100),
  )
  // A quote can be discounted below its raw component cost; never ask for more
  // up front than the whole quote is worth.
  const advanceDue = Math.min(Math.max(raw, 0), total)

  return {
    gold_value: goldValue,
    diamond_value: diamondValue,
    gold_pct: goldPct,
    diamond_pct: diamondPct,
    advance_due: advanceDue,
    balance_due: total - advanceDue,
  }
}
