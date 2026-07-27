/**
 * Shewah — single source of truth for metal purity and density.
 *
 * Before this module the same physical constants were defined four times and
 * disagreed with each other:
 *
 *   • lib/karat.ts        KARAT_FACTORS      14K = 0.60
 *   • lib/pricing.ts      PURITY_MULTIPLIERS 14K = 0.585   (file was dead code)
 *   • app/api/ready-to-ship/route.ts (inline) 14K = 0.60
 *   • lib/karat.ts DENSITY_FACTORS vs lib/cadWeight.ts ALLOY_DENSITY, which
 *     disagreed by up to 8.2% and in opposite directions for 18K white.
 *
 * Everything now derives from here. Do not redefine these anywhere else.
 */

// ── Purity ─────────────────────────────────────────────────────────────────

/**
 * Gold purity as millesimal fineness — the BIS hallmark standard, i.e. what
 * the metal is actually assayed and stamped at. These are deliberately NOT the
 * arithmetic k/24 ratios: a 14K piece is hallmarked 585, not 583.
 *
 *   916 · 750 · 585 · 417 · 375
 *
 * The previous values (14K = 0.60, 10K = 0.42, 9K = 0.38) were rounded up and
 * overstated billed gold content — 14K by ~2.9%.
 *
 * Gold only. Silver and platinum live in METAL_PURITY below; they were
 * previously mixed into this map keyed as 925/950, which meant
 * `pureGoldMass(w, 'silver_925')` happily returned 92.5% of the weight as
 * *pure gold*.
 */
export const KARAT_FACTORS: Record<number, number> = {
  24: 1,
  22: 0.916,
  18: 0.750,
  14: 0.585,
  10: 0.417,
  9:  0.375,
}

/** Non-gold precious metals, by their own fineness. */
export const METAL_PURITY: Record<string, number> = {
  silver_925:   0.925,
  silver_999:   0.999,
  platinum_950: 0.950,
}

export const SELLABLE_KARATS = [22, 18, 14, 10, 9] as const
export type SellableKarat = typeof SELLABLE_KARATS[number]

/** Karats that may appear in data but are not sold as finished pieces. */
export const ALL_KARATS = [24, 22, 18, 14, 10, 9] as const

export function isKnownKarat(k: number): boolean {
  return Object.prototype.hasOwnProperty.call(KARAT_FACTORS, k)
}

// ── Density ────────────────────────────────────────────────────────────────

/**
 * Density in g/cm³ per karat and alloy colour, used to convert a weight
 * between karats at constant volume (the same mould).
 *
 * Direction matters and the two previous tables contradicted each other:
 * nickel-based white gold is *less* dense than the yellow alloy at the same
 * karat, because nickel and zinc are lighter than the copper/silver they
 * replace. lib/karat.ts had 18K white DENSER than 18K yellow, which is wrong.
 *
 * NOTE FOR THE BUSINESS: these are standard published jewellery-alloy figures.
 * Alloy recipes vary between refiners, so if you have measured densities from
 * your own castings, replace the values here — this is the only place they
 * live, and every karat conversion and CAD weight estimate reads from it.
 */
export const ALLOY_DENSITY: Record<string, Record<string, number>> = {
  // Pure gold has no colour variants.
  '24K': { yellow: 19.32 },
  '22K': { yellow: 17.70, white: 17.30, rose: 17.60 },
  '18K': { yellow: 15.55, white: 14.80, rose: 15.15 },
  '14K': { yellow: 13.10, white: 12.80, rose: 13.00 },
  '10K': { yellow: 11.60, white: 11.30, rose: 11.50 },
  // 9K previously fell back to 10K densities in lib/cadWeight.ts.
  '9K':  { yellow: 11.30, white: 11.10, rose: 11.25 },
  silver_925:   { default: 10.36 },
  silver_999:   { default: 10.49 },
  platinum_950: { default: 20.10 },
}

export type MetalColor = 'yellow' | 'white' | 'rose'

/**
 * Resolve a density, falling back along colour then karat rather than
 * returning a silent 0. Returns null when nothing sensible applies so callers
 * can decide, instead of quietly pricing against a wrong number.
 */
export function densityFor(karat: string, color: string = 'yellow'): number | null {
  const row = ALLOY_DENSITY[karat]
  if (!row) return null
  return row[color] ?? row.yellow ?? row.default ?? null
}
