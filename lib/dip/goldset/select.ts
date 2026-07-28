/**
 * Choosing which designs go into the frozen evaluation set.
 *
 * Two things this has to get right, both of which are easy to get wrong:
 *
 *  1. Identifying rings. 'EARRING' contains 'ring'. A substring match fills
 *     the gold set with earrings and then measures the extractor against a
 *     category it was never meant to be tested on.
 *
 *  2. Spread. Taking the first 40 rows gives 40 near-identical solitaires from
 *     one price band, and an extractor that scores 95% on those tells you
 *     nothing about the rest of the catalogue.
 */

export interface Candidate {
  design_id: string
  brand_id: string
  brand_name: string
  title: string
  product_type: string | null
  price_local: number | null
  image_url: string | null
  /** Every image on the latest snapshot; the first few are shown for labelling. */
  all_image_urls: string[]
  snapshot_id: string
}

/** Words that contain 'ring' but are not rings. */
const NOT_RINGS = ['earring', 'ear ring', 'ear-ring', 'nose ring', 'toe ring', 'keyring', 'key ring']

/** Words in a title that indicate a ring when product_type is blank. */
const RING_WORDS = ['ring', 'band', 'solitaire']

/**
 * Is this design a finger ring?
 *
 * `product_type` is authoritative where present — but it is blank on 89% of
 * Starkle's catalogue, so the title is the fallback for that brand.
 */
export function isRing(title: string, productType: string | null): boolean {
  const type = (productType ?? '').trim().toLowerCase()
  const name = (title ?? '').trim().toLowerCase()

  // Anything explicitly an earring is out, whichever field says so.
  if (NOT_RINGS.some(w => type.includes(w) || name.includes(w))) return false

  if (type) {
    // 'RING', 'Rings' — anchored, so 'EARRING' cannot match even without the
    // exclusion above.
    return /^rings?$/.test(type)
  }

  // No product_type: fall back to whole words in the title, so 'Earring'
  // and 'Bring' cannot match.
  return RING_WORDS.some(w => new RegExp(`\\b${w}s?\\b`).test(name))
}

/**
 * Pick `size` candidates spread across price, and across both brands.
 *
 * Proportional by brand so the smaller catalogue is represented without
 * dominating, then evenly spaced through the price-sorted list rather than
 * randomly sampled — random gives an uneven spread at n=40, and the point of
 * the set is coverage, not statistical purity.
 */
export function stratify(candidates: Candidate[], size: number): Candidate[] {
  const priced = candidates.filter(c => c.price_local !== null && c.price_local > 0)
  if (priced.length === 0) return []

  const byBrand = new Map<string, Candidate[]>()
  for (const c of priced) {
    const list = byBrand.get(c.brand_id) ?? []
    list.push(c)
    byBrand.set(c.brand_id, list)
  }

  const total = priced.length
  const picked: Candidate[] = []

  const brands = Array.from(byBrand.entries())
  brands.forEach(([, list], index) => {
    // Proportional share, but never fewer than 5 from a brand that has any —
    // a brand contributing two designs cannot show a brand-specific failure.
    const share = Math.max(5, Math.round((list.length / total) * size))
    // Last brand absorbs the rounding so the total lands on `size`.
    const remaining = size - picked.length
    const take = index === brands.length - 1 ? remaining : Math.min(share, remaining)
    if (take <= 0) return

    const sorted = [...list].sort((a, b) => (a.price_local! - b.price_local!))
    const step = sorted.length / take
    for (let i = 0; i < take && picked.length < size; i++) {
      const candidate = sorted[Math.min(sorted.length - 1, Math.floor(i * step))]
      if (candidate && !picked.some(p => p.design_id === candidate.design_id)) {
        picked.push(candidate)
      }
    }
  })

  return picked.slice(0, size)
}
