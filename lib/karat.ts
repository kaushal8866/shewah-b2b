// Single source of truth for karat purity factors and per-karat conversions.
// All gold movements in the float ledger settle in 24kt-pure grams; karat is
// only the lens used at the catalog and order edges. See Task #71.

export const KARAT_FACTORS: Record<number, number> = {
  24: 1,
  22: 0.916,
  18: 0.75,
  14: 0.60,
  10: 0.42,
  9: 0.38,
}

export const SELLABLE_KARATS = [22, 18, 14, 10, 9] as const
export type SellableKarat = typeof SELLABLE_KARATS[number]

// Round to 4 decimals — gold weights in this app are stored at 4dp throughout.
function r4(n: number) {
  return Math.round(n * 10000) / 10000
}

/**
 * Given the gross weight of a piece at one karat, return the gross weight at
 * every other karat for the same physical piece (i.e. holding 24kt-pure mass
 * constant).
 */
export function deriveAllKaratWeights(grossWeight: number, fromKarat: number): Record<number, number> {
  const fromF = KARAT_FACTORS[fromKarat]
  if (!fromF || !grossWeight || grossWeight <= 0) {
    return Object.fromEntries(SELLABLE_KARATS.map(k => [k, 0])) as Record<number, number>
  }
  const pureMass = grossWeight * fromF
  const out: Record<number, number> = {}
  for (const k of SELLABLE_KARATS) out[k] = r4(pureMass / KARAT_FACTORS[k])
  return out
}

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
}

export type KaratPrice = {
  karat: number
  weight: number          // 24kt-pure billed mass at this karat (g)
  goldCost: number
  labourCost: number
  cogs: number
  trade: number
  mrp: number
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

export function computeKaratPricing(inp: KaratPriceInputs): KaratPrice[] {
  const margin = inp.marginMult ?? 1.28
  const mrpM = inp.mrpMult ?? 1.40
  return SELLABLE_KARATS.map(k => {
    let w = 0
    if (inp.metalWeights) {
      const gross = getMetalWeight(inp.metalWeights, `${k}K`, 'yellow')
      w = pureGoldMass(gross, `${k}K`)
    } else {
      w = r4((inp.netGoldWeight || 0) * KARAT_FACTORS[k])
    }
    const goldCost = Math.round(w * (inp.rate24k || 0))
    const labourPerG = inp.retailLabour[k] || 0
    const labourCost = Math.round(labourPerG * Math.max(w, 1))
    const cogs = goldCost + labourCost + (inp.diamondCost || 0) + (inp.makingCharges || 0) + (inp.igiCost || 0)
    const trade = Math.round(cogs * margin)
    const mrp = Math.round(trade * mrpM)
    return { karat: k, weight: w, goldCost, labourCost, cogs, trade, mrp }
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
export type MetalKey = 
  | `${GoldKarat}_${MetalColor}`
  | `silver_925_default`
  | `silver_999_default`

export type MetalWeights = Partial<Record<MetalKey, number>>

/**
 * DENSITY_FACTORS
 * Physical density (g/cm³) per karat and alloy color.
 * Source: standard metallurgical references for jewelry alloys.
 * Yellow gold: Au-Cu-Ag alloy. White gold: Au-Ni-Cu-Zn alloy (nickel-based).
 * Rose gold: Au-Cu alloy (higher copper). Silver: Au content = 0.
 *
 * 24K has no white/rose variant — pure gold is always yellow.
 * Silver has no color variant — use 'default' key.
 */
export const DENSITY_FACTORS: Record<string, Record<string, number>> = {
  '24K': {
    yellow: 19.32,
  },
  '22K': {
    yellow: 17.70,
    white:  17.30,
    rose:   17.50,
  },
  '18K': {
    yellow: 15.58,
    white:  15.70,
    rose:   15.90,
  },
  '14K': {
    yellow: 13.07,
    white:  13.40,
    rose:   13.70,
  },
  '10K': {
    yellow: 11.57,
    white:  11.90,
    rose:   12.00,
  },
  '9K': {
    yellow: 11.00,
    white:  11.20,
    rose:   11.30,
  },
  'silver_925': {
    default: 10.36,
  },
  'silver_999': {
    default: 10.49,
  },
}

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
 */
export function pureGoldMass(grossWeight: number, karat: string): number {
  const karatNum = parseInt(karat.replace(/[^\d]/g, '')) || 24
  return parseFloat(((grossWeight || 0) * (KARAT_FACTORS[karatNum] ?? 0)).toFixed(4))
}

