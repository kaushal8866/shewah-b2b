// Karat purity lens over the catalog and order edges. All gold movements in
// the float ledger settle in 24kt-pure grams. See Task #71.
//
// Purity and density constants now live in lib/metalPhysics.ts — the single
// source of truth. They are re-exported here so the ~30 existing
// `import { KARAT_FACTORS } from '@/lib/karat'` call sites keep working.

import {
  KARAT_FACTORS,
  METAL_PURITY,
  SELLABLE_KARATS,
  ALLOY_DENSITY,
  densityFor,
  type SellableKarat,
} from './metalPhysics'

export { KARAT_FACTORS, METAL_PURITY, SELLABLE_KARATS, densityFor }
export type { SellableKarat }

// Round to 4 decimals — gold weights in this app are stored at 4dp throughout.
function r4(n: number) {
  return Math.round(n * 10000) / 10000
}

// REMOVED: deriveAllKaratWeights().
// It converted between karats by holding 24kt-pure mass constant, while
// convertKaratWeight() below converts by holding volume constant. For 10g of
// 22K → 18K the two returned 12.213g and 8.802g — a 39% divergence for the
// same stated operation. Constant volume is the correct model here (the piece
// is cast from one mould, so its volume is fixed and its weight follows the
// alloy density), and it is what the live pricing path already used.
// deriveAllKaratWeights had no callers.

/** Convert a gross weight at any karat to the equivalent 24kt-pure mass. */
export function pure24kt(grossWeight: number, karat: number): number {
  const f = KARAT_FACTORS[karat] ?? 0
  return r4((grossWeight || 0) * f)
}

/**
 * Compute trade price + MRP for every sellable karat using the current 24kt
 * rate, the per-karat retail labour, and the product's diamond/making/IGI
 * costs. Same shape across the catalog admin, gold-rate page, and retailer
 * portal so prices match everywhere.
 *
 * Per-karat 24kt-pure billed mass = netGoldWeight × KARAT_FACTORS[k]. The
 * gold cost differs honestly across karats because lower-purity karats bill
 * less 24kt-equivalent gold for the same finished piece.
 */


export type KaratPrice = {
  karat: number
  /**
   * GROSS weight of the finished piece at this karat, in grams — NOT the
   * 24kt-pure mass. The doc comment here previously claimed "24kt-pure billed
   * mass", contradicting both the code and every consumer (which display it as
   * "Gross weight" and store it as gold_weight). `pureWeight` below is the
   * 24kt-equivalent the gold cost is actually billed on.
   */
  weight: number
  /** 24kt-pure mass billed at this karat (g) = weight × KARAT_FACTORS[karat]. */
  pureWeight: number
  goldCost: number
  labourCost: number
  cogs: number
  trade: number
  mrp: number
  /** True when the minimum-margin floor had to lift `trade` above raw COGS. */
  marginFloorApplied: boolean
}

/**
 * Per-karat 24kt-pure content for a single net-gold-weight input.
 * Returned as { 22, 18, 14, 10, 9 } in grams, rounded to 4dp.
 */
export function pureMassByKarat(netGoldWeight: number): Record<number, number> {
  const w = netGoldWeight || 0
  const out: Record<number, number> = {}
  for (const k of SELLABLE_KARATS) out[k] = r4(w * KARAT_FACTORS[k])
  return out
}

/** Default minimum gross weight labour is billed on. Mirrors the per-partner
 *  `min_labour_grams` column, whose own default is 1g. */
export const DEFAULT_MIN_LABOUR_GRAMS = 1

/**
 * Default minimum gross margin over COGS, as a percentage.
 *
 * Markup deliberately applies only to diamond cost — gold, labour, making,
 * hallmarking and IGI are quoted transparently. The side effect is that an
 * item with no diamonds priced at exactly COGS, i.e. zero margin. This floor
 * stops that without changing the transparent-metal pricing story.
 *
 * Override per call, or globally via the `min_margin_pct` setting.
 */
export const DEFAULT_MIN_MARGIN_PCT = 10

export type KaratPriceInputs = {
  netGoldWeight: number                    // single net-gold input (g)
  rate24k: number                          // ₹/g of 24kt
  retailLabour: Record<number, number>     // ₹/g per karat
  diamondCost: number                      // ₹
  makingCharges: number                    // ₹
  igiCost: number                          // ₹
  marginMult?: number                      // default 1.28
  mrpMult?: number                         // default 1.40
  metalWeights?: MetalWeights
  color?: string                           // Reference alloy color
  minLabourGrams?: number                  // default 1 — see above
  minMarginPct?: number                    // default 10 — see above
}

export function computeKaratPricing(inp: KaratPriceInputs): KaratPrice[] {
  const margin = inp.marginMult ?? 1.28
  const mrpM = inp.mrpMult ?? 1.40
  const color = inp.color || 'yellow'
  const minLabourG = inp.minLabourGrams ?? DEFAULT_MIN_LABOUR_GRAMS
  const minMargin = Math.max(inp.minMarginPct ?? DEFAULT_MIN_MARGIN_PCT, 0) / 100

  return SELLABLE_KARATS.map(k => {
    let gross = 0
    if (inp.metalWeights && Object.keys(inp.metalWeights).length > 0) {
      gross = getMetalWeight(inp.metalWeights, `${k}K`, color)
    }
    if (gross <= 0) {
      gross = convertKaratWeight(inp.netGoldWeight || 0, '22K', color, `${k}K`, color) || inp.netGoldWeight || 0
    }
    const pureWeight = pureGoldMass(gross, `${k}K`)

    const goldCost = Math.round(pureWeight * (inp.rate24k || 0))
    const labourPerG = inp.retailLabour[k] || 0
    // Labour is billed on at least `minLabourGrams` — a karigar's minimum
    // charge. Previously hardcoded as Math.max(gross, 1).
    const labourCost = Math.round(labourPerG * Math.max(gross, minLabourG))
    const cogs = goldCost + labourCost + (inp.diamondCost || 0) + (inp.makingCharges || 0) + (inp.igiCost || 0)

    // Trade: metal cost, labour cost, making charges and igi cert charges are transparent. Only diamond cost is marked up.
    const rawTrade = Math.round(goldCost + labourCost + ((inp.diamondCost || 0) * margin) + (inp.makingCharges || 0) + (inp.igiCost || 0))

    // Floor: never sell below COGS + minMargin. Binds on low/zero-diamond items.
    const tradeFloor = Math.round(cogs * (1 + minMargin))
    const marginFloorApplied = tradeFloor > rawTrade
    const trade = marginFloorApplied ? tradeFloor : rawTrade

    // MRP: MRP Markup applies only to the B2B marked up diamond price.
    const rawMrp = Math.round(goldCost + labourCost + ((inp.diamondCost || 0) * margin * mrpM) + (inp.makingCharges || 0) + (inp.igiCost || 0))
    // MRP must never fall below the trade price it is derived from.
    const mrp = Math.max(rawMrp, trade)

    return { karat: k, weight: gross, pureWeight, goldCost, labourCost, cogs, trade, mrp, marginFloorApplied }
  })
}

export function startsFrom(pricing: KaratPrice[]): KaratPrice | null {
  if (!pricing.length) return null
  return pricing.reduce((min, p) => (p.trade > 0 && (min === null || p.trade < min.trade) ? p : min), null as KaratPrice | null)
}

const LEGACY_GOLD_KARATS: Record<string, number> = {
  gold_22k: KARAT_FACTORS[22],
  gold_18k: KARAT_FACTORS[18],
  gold_14k: KARAT_FACTORS[14],
  gold_10k: KARAT_FACTORS[10],
  gold_9k:  KARAT_FACTORS[9],
}

export function normalizeGoldMaterialType(mt: string): {
  material_type: string
  factor: number
  wasLegacy: boolean
} {
  const f = LEGACY_GOLD_KARATS[mt]
  if (f != null) return { material_type: 'gold_24k', factor: f, wasLegacy: true }
  return { material_type: mt, factor: 1, wasLegacy: false }
}

export type MetalColor = 'yellow' | 'white' | 'rose'
export type SilverGrade = '925' | '999'
export type GoldKarat = '24K' | '22K' | '18K' | '14K' | '10K' | '9K'
export type PlatinumGrade = '950'
export type MetalKey = 
  | `${GoldKarat}_${MetalColor}`
  | `silver_925_default`
  | `silver_999_default`
  | `platinum_950_default`

export type MetalWeights = Partial<Record<MetalKey, number>>

/**
 * Alloy densities now live in lib/metalPhysics.ts, shared with lib/cadWeight.ts
 * which previously carried its own contradictory copy. Re-exported under the
 * original name for existing call sites.
 */
export const DENSITY_FACTORS = ALLOY_DENSITY

/**
 * Converts a known weight from one karat+color to another using density ratios.
 * Returns 0 if either density lookup fails or weight is 0/negative.
 * Result is rounded to 3 decimal places (milligram precision).
 */
export function convertKaratWeight(
  weight: number,
  fromKarat: string,
  fromColor: string,
  toKarat: string,
  toColor: string,
): number {
  if (!weight || weight <= 0) return 0
  const fromDensity = DENSITY_FACTORS[fromKarat]?.[fromColor]
  const toDensity   = DENSITY_FACTORS[toKarat]?.[toColor]
  if (!fromDensity || !toDensity) return 0
  const volume = weight / fromDensity
  return parseFloat((volume * toDensity).toFixed(3))
}

/**
 * Given one reference weight + its karat + color,
 * returns a MetalWeights object with computed weights for ALL
 * karat × color combinations defined in DENSITY_FACTORS.
 *
 * Silver keys use 'default' internally but are stored as:
 *   silver_925_default
 *   silver_999_default
 */
export function computeAllMetalWeights(
  referenceWeight: number,
  fromKarat: string,
  fromColor: string,
): MetalWeights {
  const result: MetalWeights = {}
  for (const [karat, colors] of Object.entries(DENSITY_FACTORS)) {
    for (const color of Object.keys(colors)) {
      const key = `${karat}_${color}` as MetalKey
      result[key] = convertKaratWeight(referenceWeight, fromKarat, fromColor, karat, color)
    }
  }
  return result
}

/**
 * Reads a specific weight from a MetalWeights object.
 * For gold: getMetalWeight(weights, '18K', 'yellow')
 * For silver: getMetalWeight(weights, 'silver_925', 'default')
 */
export function getMetalWeight(
  weights: MetalWeights,
  karat: string,
  color: string,
): number {
  const key = `${karat}_${color}` as MetalKey
  return weights[key] ?? 0
}

/**
 * Returns the pure 24K gold mass (in grams) contained in a piece
 * given its gross weight at a specific karat.
 * Used for: gold_cost = pureGoldMass × rate_24K
 *
 * Gold only. Passing a silver or platinum grade returns 0 rather than a
 * plausible-looking number: previously `pureGoldMass(w, 'silver_925')` parsed
 * "925", found the 925 entry that used to sit in the gold purity table, and
 * returned 92.5% of the weight as *pure gold* — silver billed at the gold rate.
 */
export function pureGoldMass(grossWeight: number, karat: string): number {
  const key = String(karat).toLowerCase()
  if (key.includes('silver') || key.includes('platinum')) {
    console.warn(`[karat] pureGoldMass called with non-gold metal "${karat}" — returning 0`)
    return 0
  }
  const karatNum = parseInt(String(karat).replace(/[^\d]/g, '')) || 24
  return parseFloat(((grossWeight || 0) * (KARAT_FACTORS[karatNum] ?? 0)).toFixed(4))
}

