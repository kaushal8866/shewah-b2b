import { describe, it, expect } from 'vitest'
import {
  filterNonEmptyCategories,
  DEFAULT_NON_EMPTY_CATEGORIES,
  KNOWN_CATEGORIES,
  PREFERRED_CATEGORY_ORDER,
  normalizeCategoryKey,
  getDbCategoriesForQuery,
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

  it('normalizes singular, plural, and aliases to canonical category keys', () => {
    expect(normalizeCategoryKey('Ring')).toBe('rings')
    expect(normalizeCategoryKey('rings')).toBe('rings')
    expect(normalizeCategoryKey('Earring')).toBe('earrings')
    expect(normalizeCategoryKey('earrings')).toBe('earrings')
    expect(normalizeCategoryKey('EARRINGS')).toBe('earrings')
    expect(normalizeCategoryKey('Pendant')).toBe('necklaces')
    expect(normalizeCategoryKey('Mangalsutra')).toBe('necklaces')
    expect(normalizeCategoryKey('Necklace')).toBe('necklaces')
    expect(normalizeCategoryKey('necklaces')).toBe('necklaces')
    expect(normalizeCategoryKey('Bracelet')).toBe('bracelets')
    expect(normalizeCategoryKey('bracelets')).toBe('bracelets')

    // DB queries
    expect(getDbCategoriesForQuery('earring')).toEqual(['Earring', 'earring', 'Earrings', 'earrings'])
    expect(getDbCategoriesForQuery('earrings')).toEqual(['Earring', 'earring', 'Earrings', 'earrings'])
    expect(getDbCategoriesForQuery('pendant')).toContain('Pendant')
    expect(getDbCategoriesForQuery('pendant')).toContain('Necklace')
  })

  it('aggregates singular and plural variants into a single category tab without duplicate tabs', () => {
    const counts = {
      Earring: 2,
      earrings: 3,
      Ring: 1,
      rings: 2,
      Pendant: 4,
      Mangalsutra: 1,
      necklaces: 2,
    }

    const visible = filterNonEmptyCategories(counts)
    const visibleKeys = visible.map((c) => c.key)

    // Must not have duplicate tabs like 'Earring' next to 'earrings'
    expect(visibleKeys).toEqual(['rings', 'necklaces', 'earrings'])
    expect(visible.find((c) => c.key === 'earrings')?.count).toBe(5)
    expect(visible.find((c) => c.key === 'rings')?.count).toBe(3)
    expect(visible.find((c) => c.key === 'necklaces')?.count).toBe(7)
  })
})
