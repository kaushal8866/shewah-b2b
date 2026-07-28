import { describe, it, expect } from 'vitest'
import { normaliseProduct } from '../adapters/shopify'
import { isBlockedHost, assertFetchable } from '../http'

/**
 * Fixture shaped on a real giva.co /products.json response (28 Jul 2026), with
 * prices as strings, tags as an array, and grams on the variant.
 */
const fixture = {
  id: 7712345678901,
  handle: 'silver-heart-beat-squad-set',
  title: 'Silver Heart Beat Squad Set',
  product_type: 'Set',
  tags: ['925_Silver', 'Category_Sets', 'Best suited for women'],
  images: [{ src: 'https://cdn.shopify.com/s/files/1/a.jpg' }, { src: 'https://cdn.shopify.com/s/files/1/b.jpg' }],
  variants: [
    { price: '5199.00', compare_at_price: '6499.00', available: true, grams: 4.2 },
  ],
}

describe('normaliseProduct', () => {
  it('maps a well-formed product', () => {
    const d = normaliseProduct(fixture, 'https://giva.co')!
    expect(d.external_id).toBe('7712345678901')
    expect(d.title).toBe('Silver Heart Beat Squad Set')
    expect(d.price_local).toBe(5199)
    expect(d.compare_at_price).toBe(6499)
    expect(d.available).toBe(true)
    expect(d.grams).toBe(4.2)
    expect(d.variant_count).toBe(1)
    expect(d.tags).toHaveLength(3)
    expect(d.image_urls).toHaveLength(2)
    expect(d.source_url).toBe('https://giva.co/products/silver-heart-beat-squad-set')
  })

  it('keeps the raw payload for later re-extraction, minus the variants array', () => {
    // Extractors get versioned and re-run against history; last week cannot be
    // re-fetched, so the input is the only way to fix a bug retroactively.
    const d = normaliseProduct(fixture, 'https://giva.co')!
    const raw = d.raw as any
    expect(raw.title).toBe(fixture.title)
    expect(raw.tags).toEqual(fixture.tags)
    expect(raw.variants).toBeUndefined()
  })

  it('summarises variants rather than storing them', () => {
    // Measured: variants are 96% of a Limelight product (99 per design). Kept
    // verbatim weekly that is 6.5 GB/year against a 500 MB database.
    const d = normaliseProduct({
      ...fixture,
      variants: [
        { price: '9499.00', available: true, grams: 2.1 },
        { price: '18999.00', available: false, grams: 4.8 },
        { price: '13999.00', available: true, grams: 3.4 },
      ],
    }, 'https://x.co')!
    expect((d.raw as any).variant_summary).toEqual({
      count: 3, available_count: 2, price_min: 9499, price_max: 18999, grams_min: 2.1,
    })
  })

  it('takes the LOWEST variant price, and the compare_at from that same variant', () => {
    const d = normaliseProduct({
      ...fixture,
      variants: [
        { price: '18999.00', compare_at_price: '24999.00', available: true },
        { price: '9499.00', compare_at_price: null, available: true },
        { price: '13999.00', compare_at_price: '15999.00', available: true },
      ],
    }, 'https://x.co')!
    expect(d.price_local).toBe(9499)
    // Not 24999 — the discount flag must describe the same item as the price.
    expect(d.compare_at_price).toBeNull()
    expect(d.variant_count).toBe(3)
  })

  it('treats a design as available when ANY variant is', () => {
    // One sold-out ring size is not an out-of-stock design. Getting this wrong
    // manufactures a restock transition every single week.
    const d = normaliseProduct({
      ...fixture,
      variants: [
        { price: '100', available: false },
        { price: '200', available: true },
      ],
    }, 'https://x.co')!
    expect(d.available).toBe(true)
  })

  it('reports unavailable only when every variant is', () => {
    const d = normaliseProduct({
      ...fixture,
      variants: [{ price: '100', available: false }, { price: '200', available: false }],
    }, 'https://x.co')!
    expect(d.available).toBe(false)
  })

  it('handles missing grams, images and compare_at without inventing values', () => {
    const d = normaliseProduct({
      id: 5, title: 'Plain Band', handle: 'plain-band',
      variants: [{ price: '2500' }],
    }, 'https://x.co')!
    expect(d.grams).toBeNull()
    expect(d.compare_at_price).toBeNull()
    expect(d.image_urls).toEqual([])
    expect(d.product_type).toBeNull()
    expect(d.available).toBe(false)
  })

  it('treats grams=0 as unpublished, not as a weight', () => {
    // Shopify defaults grams to 0 when the merchant never set one — measured
    // at 100% of Starkle variants and 87% of Limelight's. Storing it verbatim
    // asserts a gold ring weighs nothing and poisons the cost-teardown proxy.
    const d = normaliseProduct({
      ...fixture, variants: [{ price: '100', available: true, grams: 0 }],
    }, 'https://x.co')!
    expect(d.grams).toBeNull()
    expect((d.raw as any).variant_summary.grams_min).toBeNull()
  })

  it('finds a real weight on a sibling variant when the cheapest has none', () => {
    const d = normaliseProduct({
      ...fixture, variants: [
        { price: '100', available: true, grams: 0 },
        { price: '900', available: true, grams: 5.5 },
      ],
    }, 'https://x.co')!
    expect(d.grams).toBe(5.5)
  })

  it('parses a comma-separated tag string as well as an array', () => {
    const d = normaliseProduct({ ...fixture, tags: 'Gold, 18K , Bridal' }, 'https://x.co')!
    expect(d.tags).toEqual(['Gold', '18K', 'Bridal'])
  })

  it('returns null price rather than NaN when the price is unparseable', () => {
    // A NaN reaching the database is indistinguishable from a genuinely
    // unpriced item, forever.
    const d = normaliseProduct({
      ...fixture, variants: [{ price: 'Contact us', available: true }],
    }, 'https://x.co')!
    expect(d.price_local).toBeNull()
  })

  it('skips a product with no id — identity is non-negotiable', () => {
    expect(normaliseProduct({ title: 'No id', variants: [] }, 'https://x.co')).toBeNull()
  })

  it('skips a product with no title', () => {
    expect(normaliseProduct({ id: 9, title: '   ', variants: [] }, 'https://x.co')).toBeNull()
  })

  it('survives a malformed product rather than throwing', () => {
    // One bad record must not cost the other 2,000 in the same catalogue.
    expect(() => normaliseProduct({} as any, 'https://x.co')).not.toThrow()
    expect(() => normaliseProduct({ id: 1, title: 'x', variants: null } as any, 'https://x.co')).not.toThrow()
    expect(normaliseProduct({ id: 1, title: 'x', variants: null } as any, 'https://x.co')!.variant_count).toBe(0)
  })

  it('falls back to the base URL when there is no handle', () => {
    const d = normaliseProduct({ id: 3, title: 'X', variants: [] }, 'https://x.co/')!
    expect(d.source_url).toBe('https://x.co/')
    expect(d.handle).toBeNull()
  })
})

describe('SSRF guard', () => {
  it('blocks cloud metadata and loopback', () => {
    expect(isBlockedHost('169.254.169.254')).toBe(true)
    expect(isBlockedHost('metadata.google.internal')).toBe(true)
    expect(isBlockedHost('localhost')).toBe(true)
    expect(isBlockedHost('127.0.0.1')).toBe(true)
  })

  it('blocks RFC1918 ranges', () => {
    expect(isBlockedHost('10.0.0.5')).toBe(true)
    expect(isBlockedHost('172.16.4.4')).toBe(true)
    expect(isBlockedHost('172.31.255.1')).toBe(true)
    expect(isBlockedHost('192.168.1.1')).toBe(true)
  })

  it('permits ordinary public hosts, including 172.x outside the private block', () => {
    expect(isBlockedHost('giva.co')).toBe(false)
    expect(isBlockedHost('172.32.0.1')).toBe(false)
    expect(isBlockedHost('172.15.0.1')).toBe(false)
  })

  it('rejects non-https and internal hosts at the fetch boundary', () => {
    // base_url comes from a database row, so this guard cannot live at the
    // call site.
    expect(() => assertFetchable('http://giva.co/products.json')).toThrow(/https/)
    expect(() => assertFetchable('https://169.254.169.254/latest/meta-data')).toThrow(/Internal host/)
    expect(() => assertFetchable('not a url')).toThrow(/Unparseable/)
    expect(() => assertFetchable('https://giva.co/products.json')).not.toThrow()
  })
})
