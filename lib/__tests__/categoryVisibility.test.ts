import { describe, it, expect } from 'vitest'
import {
  filterNonEmptyCategories,
  DEFAULT_NON_EMPTY_CATEGORIES,
  KNOWN_CATEGORIES,
  PREFERRED_CATEGORY_ORDER,
} from '../categories'

describe('D2C Category Visibility & Empty Category Exclusion', () => {
  it('strictly excludes categories that have 0 published pieces', () => {
    const counts = {
      rings: 2,
      necklaces: 5,
      earrings: 2,
      bracelets: 0,
      mens: 0,
    }

    const visible = filterNonEmptyCategories(counts)
    const visibleKeys = visible.map((c) => c.key)

    expect(visibleKeys).toContain('rings')
    expect(visibleKeys).toContain('necklaces')
    expect(visibleKeys).toContain('earrings')

    // Empty categories must NOT be in the result
    expect(visibleKeys).not.toContain('bracelets')
    expect(visibleKeys).not.toContain('mens')
    expect(visible.length).toBe(3)
  })

  it('automatically surfaces a previously empty category once inventory is published', () => {
    const updatedCounts = {
      rings: 2,
      necklaces: 5,
      earrings: 2,
      bracelets: 1, // A piece is now published
      mens: 0,
    }

    const visible = filterNonEmptyCategories(updatedCounts)
    const visibleKeys = visible.map((c) => c.key)

    expect(visibleKeys).toContain('bracelets')
    expect(visible.find((c) => c.key === 'bracelets')?.count).toBe(1)
    expect(visible.find((c) => c.key === 'bracelets')?.label).toBe('Tennis Bracelets')
    expect(visibleKeys).not.toContain('mens')
  })

  it('DEFAULT_NON_EMPTY_CATEGORIES fallback contains zero empty categories', () => {
    expect(DEFAULT_NON_EMPTY_CATEGORIES.length).toBeGreaterThan(0)
    for (const cat of DEFAULT_NON_EMPTY_CATEGORIES) {
      expect(cat.count).toBeGreaterThan(0)
      expect(cat.key).not.toBe('bracelets')
      expect(cat.key).not.toBe('mens')
      expect(cat.href).toContain(`/jewellery?category=${cat.key}`)
      expect(cat.label.length).toBeGreaterThan(0)
    }
  })

  it('KNOWN_CATEGORIES provides verified routing hrefs and titles', () => {
    for (const [key, meta] of Object.entries(KNOWN_CATEGORIES)) {
      expect(meta.key).toBe(key)
      expect(meta.href).toBe(`/jewellery?category=${key}`)
      expect(meta.label).toBeDefined()
    }
  })

  it('respects PREFERRED_CATEGORY_ORDER hierarchy', () => {
    const counts = {
      earrings: 3,
      rings: 2,
      necklaces: 4,
    }

    const visible = filterNonEmptyCategories(counts)
    expect(visible.map((c) => c.key)).toEqual(['rings', 'necklaces', 'earrings'])
  })
})
