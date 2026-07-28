/**
 * Karat and gold colour, parsed from the Shopify `options` array.
 *
 * These are OBSERVED facts, not inferences. The merchant states them, so they
 * carry confidence 1 and no vision model is involved — asking a model for a
 * value we already hold exactly would only invite a confident wrong answer.
 *
 * Both are stored as offered SETS, never collapsed to a scalar. A design exists
 * across a karat x colour matrix; picking one would invent a fact the merchant
 * never stated.
 *
 * Every rule below was written against values sampled live on 28 Jul 2026
 * across Limelight, Starkle and GIVA — including the awkward ones.
 */

/** Karats that exist in this trade. Anything else is a parse error, not a karat. */
const KNOWN_KARATS = new Set([9, 10, 14, 18, 22, 24])

/**
 * Gold colours, by exact normalised value.
 *
 * An ALLOWLIST rather than a pattern, because the colour option is not always
 * about metal. Observed live: 'Black', 'Blue', 'Multi' (bead and gemstone
 * colours on GIVA's silver lines), and 'Pale Gold' / 'Pale Yellow' which are
 * finishes rather than a gold alloy. Guessing at those would put fiction into
 * the corpus; they are dropped instead.
 */
const GOLD_COLOURS: Record<string, string> = {
  'yellow gold': 'yellow',
  'yellow': 'yellow',
  'rose gold': 'rose',
  'rose': 'rose',
  'pink gold': 'rose',
  'white gold': 'white',
  'white': 'white',
  'two tone': 'two_tone',
  'two-tone': 'two_tone',
}

interface ShopifyOption {
  name?: string
  values?: string[]
}

/**
 * Is this option about metal purity?
 *
 * 'Title' is excluded explicitly: Shopify inserts it as the option name when a
 * product has no real options at all (observed on 740 products), so treating it
 * as data would attach meaning to a placeholder.
 */
function isPurityOption(name: string): boolean {
  const n = name.trim().toLowerCase()
  if (!n || n === 'title') return false
  return n.includes('purity') || n.includes('karat') || n.includes('carat') || n.includes('metal')
}

/**
 * Is this option about the METAL's colour?
 *
 * 'Bead Color and Size' contains 'color' but describes beads, not gold — a
 * naive substring match would file bead colours as metal colours.
 */
function isColourOption(name: string): boolean {
  const n = name.trim().toLowerCase()
  if (!n || n === 'title') return false
  if (n.includes('bead') || n.includes('stone') || n.includes('gem')) return false
  return n.includes('colour') || n.includes('color')
}

/**
 * Shopify option values sometimes concatenate two dimensions into one string —
 * observed: 'White | 6.5-7 inch / 165.1-177.8mm (adjustable)'. The colour is
 * the first segment; the rest is sizing.
 */
function firstSegment(value: string): string {
  return value.split('|')[0].trim()
}

/** Parse a purity value to a karat number, or null if it is not one. */
export function parseKarat(value: string): number | null {
  const cleaned = firstSegment(String(value ?? '')).toLowerCase()
  // '18 KT', '18k', '18K', '14 kt' -> the number preceding a k/kt marker.
  const m = cleaned.match(/(\d{1,2})\s*(?:k|kt|karat|carat)\b/)
  if (!m) return null
  const karat = Number(m[1])
  return KNOWN_KARATS.has(karat) ? karat : null
}

/** Parse a colour value to a canonical gold colour, or null if it is not one. */
export function parseGoldColour(value: string): string | null {
  const cleaned = firstSegment(String(value ?? '')).toLowerCase().replace(/\s+/g, ' ')
  return GOLD_COLOURS[cleaned] ?? null
}

export interface ParsedOptions {
  karat_options: number[]
  colour_options: string[]
  /** Which option names produced these, for the evidence trail. */
  source_paths: string[]
}

/**
 * Read karat and colour sets off a stored product payload.
 *
 * Accepts the trimmed `raw` written by the Shopify adapter — `options` survived
 * `trimRaw` (only `variants` was dropped), which is what makes backfilling the
 * existing 8,042 designs possible without re-crawling anything.
 */
export function parseOptions(raw: unknown): ParsedOptions {
  const options = (raw as { options?: ShopifyOption[] })?.options
  const list = Array.isArray(options) ? options : []

  const karats = new Set<number>()
  const colours = new Set<string>()
  const sourcePaths: string[] = []

  list.forEach((option, index) => {
    const name = typeof option?.name === 'string' ? option.name : ''
    const values = Array.isArray(option?.values) ? option.values : []
    if (values.length === 0) return

    if (isPurityOption(name)) {
      let hit = false
      for (const v of values) {
        const k = parseKarat(String(v))
        if (k !== null) { karats.add(k); hit = true }
      }
      if (hit) sourcePaths.push(`raw.options[${index}]`)
    }

    if (isColourOption(name)) {
      let hit = false
      for (const v of values) {
        const c = parseGoldColour(String(v))
        if (c !== null) { colours.add(c); hit = true }
      }
      if (hit) sourcePaths.push(`raw.options[${index}]`)
    }
  })

  // Array.from rather than spread: the repo's tsconfig target predates
  // downlevel iteration, and this is not the place to change it.
  return {
    karat_options: Array.from(karats).sort((a, b) => a - b),
    colour_options: Array.from(colours).sort(),
    source_paths: Array.from(new Set(sourcePaths)),
  }
}
