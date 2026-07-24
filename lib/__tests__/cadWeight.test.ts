import { describe, it, expect } from 'vitest'
import {
  getStoneVolume,
  getStoneSeatVolume,
  getNetVolume,
  getCircumferenceForSize,
  scaleWeightBySize,
  getAlloyDensity,
} from '../cadWeight'

describe('stone seat volume', () => {
  it('converts carats to volume at diamond density', () => {
    // 1ct = 0.2g; 0.2 / 3.52 g/cm³
    expect(getStoneVolume(1)).toBeCloseTo(0.0568, 4)
  })

  it('treats an explicit zero pieces as zero, not one', () => {
    // `d.pieces || 1` counted 0 as 1, adding a phantom stone's seat volume and
    // understating net metal.
    const none = getStoneSeatVolume([{ weight: 0.5, pieces: 0, setting_type: 'prong' }])
    expect(none).toBe(0)
  })

  it('still defaults to one piece when pieces is absent', () => {
    const implied = getStoneSeatVolume([{ weight: 0.5, setting_type: 'prong' }])
    const explicit = getStoneSeatVolume([{ weight: 0.5, pieces: 1, setting_type: 'prong' }])
    expect(implied).toBe(explicit)
    expect(implied).toBeGreaterThan(0)
  })

  it('scales with piece count and setting factor', () => {
    const one = getStoneSeatVolume([{ weight: 0.5, pieces: 1, setting_type: 'prong' }])
    const four = getStoneSeatVolume([{ weight: 0.5, pieces: 4, setting_type: 'prong' }])
    expect(four).toBeCloseTo(one * 4, 6)

    // bezel (0.60) removes more metal than prong (0.25)
    const bezel = getStoneSeatVolume([{ weight: 0.5, pieces: 1, setting_type: 'bezel' }])
    expect(bezel).toBeGreaterThan(one)
  })
})

describe('net volume', () => {
  it('never goes negative', () => {
    expect(getNetVolume(1, 5, 0, 0)).toBe(0)
  })

  it('subtracts seats, hollows and gallery cuts', () => {
    expect(getNetVolume(1, 0.1, 0.2, 0.05)).toBeCloseTo(0.65, 6)
  })
})

describe('size scaling', () => {
  it('scales ring weight by circumference ratio', () => {
    const bigger = scaleWeightBySize(5, 12, 20, 'ring')
    expect(bigger).toBeGreaterThan(5)
  })

  it('leaves non-sized categories alone', () => {
    expect(scaleWeightBySize(5, 12, 20, 'pendant')).toBe(5)
  })

  it('reads bangle sizes as inches.annas', () => {
    // 2.4 = 2 + 4/16 = 2.25in
    const c = getCircumferenceForSize('2.4', 'bangle')
    expect(c).toBeCloseTo(2.25 * 25.4 * Math.PI, 3)
  })
})

describe('alloy density comes from the shared table', () => {
  it('falls back to yellow when a colour is unknown', () => {
    expect(getAlloyDensity('18K', 'chartreuse')).toBe(getAlloyDensity('18K', 'yellow'))
  })

  it('handles silver and platinum explicitly', () => {
    expect(getAlloyDensity('silver_925', '')).toBe(10.36)
    expect(getAlloyDensity('silver_999', '')).toBe(10.49)
    expect(getAlloyDensity('platinum_950', '')).toBe(20.10)
  })

  it('resolves 24K without a colour variant', () => {
    expect(getAlloyDensity('24K', 'white')).toBe(19.32)
  })
})
