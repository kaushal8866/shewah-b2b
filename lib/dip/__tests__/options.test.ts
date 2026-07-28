import { describe, it, expect } from 'vitest'
import { parseKarat, parseGoldColour, parseOptions } from '../attributes/options'

/**
 * Every value asserted here was observed live on 28 Jul 2026 across
 * limelightdiamonds.com, starkle.in and giva.co.
 */

describe('parseKarat', () => {
  it('handles every spelling seen in the wild', () => {
    expect(parseKarat('18 KT')).toBe(18)
    expect(parseKarat('14 KT')).toBe(14)
    expect(parseKarat('9 KT')).toBe(9)
    expect(parseKarat('18k')).toBe(18)
    expect(parseKarat('18K')).toBe(18)
    expect(parseKarat('14k')).toBe(14)
    expect(parseKarat('22K')).toBe(22)
  })

  it('rejects a number that is not a real karat', () => {
    // A parse that yields 15K means the parse is wrong, not that 15K exists.
    expect(parseKarat('15K')).toBeNull()
    expect(parseKarat('99 KT')).toBeNull()
  })

  it('returns null rather than guessing from a bare number', () => {
    expect(parseKarat('18')).toBeNull()
    expect(parseKarat('Size 14')).toBeNull()
    expect(parseKarat('')).toBeNull()
  })
})

describe('parseGoldColour', () => {
  it('maps both the long and short forms', () => {
    expect(parseGoldColour('Yellow Gold')).toBe('yellow')
    expect(parseGoldColour('Yellow')).toBe('yellow')
    expect(parseGoldColour('Rose Gold')).toBe('rose')
    expect(parseGoldColour('Rose')).toBe('rose')
    expect(parseGoldColour('White Gold')).toBe('white')
    expect(parseGoldColour('White')).toBe('white')
  })

  it('takes the colour out of a compound value', () => {
    // Observed: 'White | 6.5-7 inch / 165.1-177.8mm (adjustable)'
    expect(parseGoldColour('White | 6.5-7 inch / 165.1-177.8mm (adjustable)')).toBe('white')
    expect(parseGoldColour('Blue | 6.5-7 inch (adjustable)')).toBeNull()
  })

  it('drops values that are not gold colours at all', () => {
    // These are bead and gemstone colours on silver lines, or finishes.
    // Mapping them to a gold colour would put fiction in the corpus.
    expect(parseGoldColour('Black')).toBeNull()
    expect(parseGoldColour('Multi')).toBeNull()
    expect(parseGoldColour('Pale Gold')).toBeNull()
    expect(parseGoldColour('Pale Yellow')).toBeNull()
    expect(parseGoldColour('Black & Rose')).toBeNull()
    expect(parseGoldColour('Gold')).toBeNull()
  })
})

describe('parseOptions', () => {
  const limelight = {
    options: [
      { name: 'Purity', position: 1, values: ['14 KT', '18 KT', '9 KT'] },
      { name: 'Color', position: 2, values: ['Yellow Gold', 'Rose Gold', 'White Gold'] },
      { name: 'Size', position: 3, values: ['14', '10', '8'] },
    ],
  }

  it('reads a full karat x colour matrix', () => {
    const p = parseOptions(limelight)
    expect(p.karat_options).toEqual([9, 14, 18])
    expect(p.colour_options).toEqual(['rose', 'white', 'yellow'])
    expect(p.source_paths).toEqual(['raw.options[0]', 'raw.options[1]'])
  })

  it('accepts the British spelling', () => {
    // 'Colour' appears on 23 products; a Color-only match would lose them.
    const p = parseOptions({ options: [{ name: 'Colour', values: ['Rose Gold'] }] })
    expect(p.colour_options).toEqual(['rose'])
  })

  it('ignores Shopify\'s "Title" placeholder', () => {
    // Inserted on 740 products that have no real options. Treating it as data
    // would attach meaning to a placeholder.
    const p = parseOptions({ options: [{ name: 'Title', values: ['Default Title'] }] })
    expect(p.karat_options).toEqual([])
    expect(p.colour_options).toEqual([])
  })

  it('does not mistake bead colour for metal colour', () => {
    // 'Bead Color and Size' contains 'color'. A substring match files bead
    // colours as gold colours.
    const p = parseOptions({ options: [{ name: 'Bead Color and Size', values: ['White', 'Black'] }] })
    expect(p.colour_options).toEqual([])
  })

  it('handles a design offered in one karat only', () => {
    const p = parseOptions({ options: [{ name: 'Purity', values: ['18K'] }] })
    expect(p.karat_options).toEqual([18])
  })

  it('returns empty sets, never nulls, when there are no options', () => {
    expect(parseOptions({}).karat_options).toEqual([])
    expect(parseOptions({ options: [] }).colour_options).toEqual([])
    expect(parseOptions(null).karat_options).toEqual([])
    expect(parseOptions(undefined).source_paths).toEqual([])
  })

  it('survives malformed option entries', () => {
    expect(() => parseOptions({ options: [null, { name: 'Purity' }, { values: ['18K'] }] } as any)).not.toThrow()
    const p = parseOptions({ options: [{ name: 'Purity', values: null }] } as any)
    expect(p.karat_options).toEqual([])
  })

  it('deduplicates across repeated values', () => {
    const p = parseOptions({
      options: [{ name: 'Purity', values: ['18 KT', '18k', '18K'] }],
    })
    expect(p.karat_options).toEqual([18])
  })
})
