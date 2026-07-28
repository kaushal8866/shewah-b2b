import { describe, it, expect } from 'vitest'
import { isRing, stratify, type Candidate } from '../goldset/select'
import { VOCAB, GOLD_FIELDS, FIELD_HELP } from '../attributes/vocabulary'

describe('isRing', () => {
  it('accepts an explicit ring product_type', () => {
    expect(isRing('Regalora Diamond Ring', 'RING')).toBe(true)
    expect(isRing('Basic Diamond Band', 'Rings')).toBe(true)
  })

  it('rejects earrings — the trap', () => {
    // 'EARRING' contains 'ring'. A substring match fills the gold set with
    // earrings and measures the extractor on a category it was never for.
    expect(isRing('Solitaire Drop', 'EARRING')).toBe(false)
    expect(isRing('Hoop', 'Earrings')).toBe(false)
    expect(isRing('Diamond Earring Set', '')).toBe(false)
    expect(isRing('Nose Ring', '')).toBe(false)
  })

  it('rejects other categories outright', () => {
    expect(isRing('Tennis Bracelet', 'Bracelet')).toBe(false)
    expect(isRing('Solitaire Pendant', 'PENDANT')).toBe(false)
    expect(isRing('Layered Chain', 'NECKLACE')).toBe(false)
  })

  it('falls back to the title when product_type is blank', () => {
    // Starkle leaves product_type empty on 89% of its catalogue.
    expect(isRing('Basic Diamond Band', '')).toBe(true)
    expect(isRing('Classic Solitaire', null)).toBe(true)
    expect(isRing('Eternity Ring', null)).toBe(true)
  })

  it('matches whole words only in the title fallback', () => {
    expect(isRing('Bring It Collection', '')).toBe(false)
    expect(isRing('Herringbone Chain', '')).toBe(false)
    expect(isRing('Bandana Charm', '')).toBe(false)
  })

  it('does not crash on empty input', () => {
    expect(isRing('', '')).toBe(false)
    expect(isRing('', null)).toBe(false)
  })
})

function candidate(id: string, brand: string, price: number): Candidate {
  return {
    design_id: id, brand_id: brand, brand_name: brand, title: `Ring ${id}`,
    product_type: 'RING', price_local: price, image_url: `https://x/${id}.jpg`,
    all_image_urls: [`https://x/${id}.jpg`, `https://x/${id}-2.jpg`],
    snapshot_id: `s-${id}`,
  }
}

describe('stratify', () => {
  const limelight = Array.from({ length: 300 }, (_, i) => candidate(`L${i}`, 'lime', 10_000 + i * 500))
  const starkle = Array.from({ length: 60 }, (_, i) => candidate(`S${i}`, 'stark', 20_000 + i * 300))

  it('returns exactly the requested size', () => {
    expect(stratify([...limelight, ...starkle], 40)).toHaveLength(40)
  })

  it('includes both brands', () => {
    const picked = stratify([...limelight, ...starkle], 40)
    const brands = new Set(picked.map(p => p.brand_id))
    expect(brands.has('lime')).toBe(true)
    expect(brands.has('stark')).toBe(true)
  })

  it('gives a small brand a usable floor', () => {
    // Proportionally Starkle would get ~7 of 40; a brand with two designs in
    // the set cannot reveal a brand-specific failure.
    const picked = stratify([...limelight, ...starkle], 40)
    expect(picked.filter(p => p.brand_id === 'stark').length).toBeGreaterThanOrEqual(5)
  })

  it('spreads across the price range rather than clustering', () => {
    // Taking the first 40 rows gives 40 near-identical pieces from one band.
    const picked = stratify(limelight, 40)
    const prices = picked.map(p => p.price_local!)
    expect(Math.min(...prices)).toBeLessThan(20_000)
    expect(Math.max(...prices)).toBeGreaterThan(140_000)
  })

  it('never repeats a design', () => {
    const picked = stratify([...limelight, ...starkle], 40)
    expect(new Set(picked.map(p => p.design_id)).size).toBe(picked.length)
  })

  it('drops unpriced candidates rather than sorting them as zero', () => {
    const withNulls = [...limelight.slice(0, 10), { ...candidate('X', 'lime', 0), price_local: null }]
    expect(stratify(withNulls, 5).every(c => c.price_local !== null)).toBe(true)
  })

  it('copes with fewer candidates than requested', () => {
    expect(stratify(limelight.slice(0, 3), 40)).toHaveLength(3)
    expect(stratify([], 40)).toEqual([])
  })
})

describe('vocabulary', () => {
  it('offers "unsure" on every labelled field', () => {
    // A labeller forced to choose produces a confident wrong label, which
    // silently penalises an extractor that was right.
    for (const field of GOLD_FIELDS) {
      expect(VOCAB[field]).toContain('unsure')
    }
  })

  it('documents every labelled field', () => {
    // The model gets the same definitions. Without that, disagreement
    // measures vocabulary rather than vision.
    for (const field of GOLD_FIELDS) {
      expect(FIELD_HELP[field]).toBeTruthy()
    }
  })

  it('has no duplicate terms within a dimension', () => {
    for (const field of GOLD_FIELDS) {
      expect(new Set(VOCAB[field]).size).toBe(VOCAB[field].length)
    }
  })
})
