import { describe, it, expect } from 'vitest'
import {
  parseKaratNumber,
  getHallmarkLabel,
  resolveBaseProductWeight,
  formatDiamondGrade,
  computeRowDiamondWeight,
  computeTotalDiamondCarats,
  resolveDefaultRingSize,
} from '../d2cProductDetail'

describe('D2C Product Detail Specs & Karat Resolution', () => {
  it('parses karat numbers correctly from diverse database product representations', () => {
    expect(parseKaratNumber({ gold_karat: 14 })).toBe(14)
    expect(parseKaratNumber({ gold_karat: '14k' })).toBe(14)
    expect(parseKaratNumber({ gold_karat: '14K' })).toBe(14)
    expect(parseKaratNumber({ gold_karat: '9kt' })).toBe(9)
    expect(parseKaratNumber({ gold_karat: '22K' })).toBe(22)
    expect(parseKaratNumber({ gold_karat: '24K' })).toBe(24)
    expect(parseKaratNumber({ d2c_details: { karat: 10 } })).toBe(10)
    expect(parseKaratNumber({ d2c_details: { gold_karat: '14K' } })).toBe(14)
    // Default fallback is 18
    expect(parseKaratNumber({})).toBe(18)
    expect(parseKaratNumber({ gold_karat: null })).toBe(18)
  })

  it('generates compliant assay hallmark descriptions for all karats and precious metals', () => {
    // Silver
    expect(getHallmarkLabel(0, true, false, 'US')).toBe('Certified Assay 925 / 925 Sterling Silver')
    expect(getHallmarkLabel(0, true, false, 'IN')).toBe('Certified Assay 925 / BIS Hallmark with HUID')

    // Platinum
    expect(getHallmarkLabel(18, false, true, 'US')).toBe('Certified Assay Pt950 Hallmark')
    expect(getHallmarkLabel(18, false, true, 'IN')).toBe('Certified Assay Pt950 Hallmark')

    // 9K
    expect(getHallmarkLabel(9, false, false, 'US')).toBe('Certified Assay 375 / Solid 9K Gold')
    expect(getHallmarkLabel(9, false, false, 'IN')).toBe('Certified Assay 375 / BIS 375 with HUID')

    // 10K
    expect(getHallmarkLabel(10, false, false, 'US')).toBe('Certified Assay 417 / Solid 10K Gold')
    expect(getHallmarkLabel(10, false, false, 'IN')).toBe('Certified Assay 417 / BIS 417 with HUID')

    // 14K
    expect(getHallmarkLabel(14, false, false, 'US')).toBe('Certified Assay 585 / Solid 14K Gold')
    expect(getHallmarkLabel(14, false, false, 'IN')).toBe('Certified Assay 585 / BIS 585 with HUID')

    // 18K
    expect(getHallmarkLabel(18, false, false, 'US')).toBe('Certified Assay 750 / Solid 18K Gold')
    expect(getHallmarkLabel(18, false, false, 'IN')).toBe('Certified Assay 750 / BIS Hallmark with HUID')

    // 22K
    expect(getHallmarkLabel(22, false, false, 'US')).toBe('Certified Assay 916 / Solid 22K Gold')
    expect(getHallmarkLabel(22, false, false, 'IN')).toBe('Certified Assay 916 / BIS 916 with HUID')
  })

  it('resolves product base metal weights accurately without assuming 18K', () => {
    // SH-106 sample (14K earring, gold_weight_14k = 0.896)
    const sh106 = {
      code: 'SH-106',
      gold_karat: '14K',
      gold_weight_14k: 0.896,
      gold_weight_18k: null,
    }
    expect(resolveBaseProductWeight(sh106, 14, false)).toBe(0.9)

    // Silver piece
    const silverPiece = {
      code: 'SH-200',
      metal_type: 'silver',
      metal_weights: { silver_925_default: 4.25 },
    }
    expect(resolveBaseProductWeight(silverPiece, 0, true)).toBe(4.3)

    // Canary SH-004 Tennis Necklace preserved at 29.0g
    expect(resolveBaseProductWeight({ code: 'SH-004' }, 18, false)).toBe(29.0)

    // Canary SH-003 Tanmaniya preserved at 8.6g
    expect(resolveBaseProductWeight({ code: 'SH-003' }, 18, false)).toBe(8.6)
  })

  it('formats diamond grade text strictly from stored attributes without inventing defaults', () => {
    // SH-590: stored color 'EF', quality 'VVS'
    expect(formatDiamondGrade('EF', 'VVS')).toBe('E-F / VVS')
    expect(formatDiamondGrade('E-F', 'VVS')).toBe('E-F / VVS')
    expect(formatDiamondGrade('ef', 'vvs')).toBe('E-F / VVS')

    // Only color stored
    expect(formatDiamondGrade('EF', null)).toBe('E-F')
    expect(formatDiamondGrade('D-F', undefined)).toBe('D-F')

    // Only clarity stored
    expect(formatDiamondGrade(null, 'VS1')).toBe('VS1')
    expect(formatDiamondGrade('', 'VVS-VS')).toBe('VVS-VS')

    // Neither stored: returns null (does NOT invent D-F / VS+)
    expect(formatDiamondGrade(null, null)).toBeNull()
    expect(formatDiamondGrade('', '')).toBeNull()
  })

  it('computes individual diamond row weights correctly distinguishing per-stone vs combined total', () => {
    // Single stone
    expect(computeRowDiamondWeight({ pieces: 1, weight: 2.0 })).toBe(2.0)

    // Modern catalogue combined totals (SH-590 series)
    // SH-594 side: 24 pieces totaling 0.51 ct
    expect(computeRowDiamondWeight({ pieces: 24, weight: 0.51, size_label: null })).toBe(0.51)
    // SH-591 side: 12 pieces totaling 0.20 ct
    expect(computeRowDiamondWeight({ pieces: 12, weight: 0.2, size_label: null })).toBe(0.2)
    // SH-592 side: 2 pieces totaling 0.70 ct
    expect(computeRowDiamondWeight({ pieces: 2, weight: 0.7, size_label: null })).toBe(0.7)
    // SH-593 center: 6 pieces totaling 1.50 ct
    expect(computeRowDiamondWeight({ pieces: 6, weight: 1.5, size_label: null })).toBe(1.5)

    // Legacy melee rows with per-stone weight
    // SH-003: 260 pieces at 0.005 ct each -> 1.30 ct
    expect(computeRowDiamondWeight({ pieces: 260, weight: 0.005, size_label: '1.0mm' })).toBe(1.3)
    // SH-511: 26 pieces at 0.008 ct each -> 0.208 ct
    expect(Number(computeRowDiamondWeight({ pieces: 26, weight: 0.008, size_label: '1.2mm' }).toFixed(3))).toBe(0.208)
  })

  it('computes total diamond carats across all diamond rows without omitting side stones or inflating totals', () => {
    // SH-590: Pear Solitaire (1.00 ct)
    const sh590 = {
      code: 'SH-590',
      diamond_weight: 1,
      diamond_specs: [
        { role: 'center', pieces: 1, weight: 1, shape: 'pear' },
      ],
    }
    expect(computeTotalDiamondCarats(sh590)).toBe(1.00)

    // SH-591: Round with Hidden Halo (center 1.00 + sides 0.20 = 1.20 ct)
    const sh591 = {
      code: 'SH-591',
      diamond_weight: 1,
      diamond_specs: [
        { role: 'center', pieces: 1, weight: 1, shape: 'round' },
        { role: 'side', pieces: 12, weight: 0.2, shape: 'round' },
      ],
    }
    expect(computeTotalDiamondCarats(sh591)).toBe(1.20)

    // SH-592: Oval Three Stone (center 2.00 + sides 0.70 = 2.70 ct)
    const sh592 = {
      code: 'SH-592',
      diamond_weight: 2,
      diamond_specs: [
        { role: 'center', pieces: 1, weight: 2, shape: 'oval' },
        { role: 'side', pieces: 2, weight: 0.7, shape: 'tapered baguette' },
      ],
    }
    expect(computeTotalDiamondCarats(sh592)).toBe(2.70)

    // SH-593: Six Stone Bypass (1.50 ct total across 6 center stones)
    const sh593 = {
      code: 'SH-593',
      diamond_weight: 1.5,
      diamond_specs: [
        { role: 'center', pieces: 6, weight: 1.5, shape: 'round' },
      ],
    }
    expect(computeTotalDiamondCarats(sh593)).toBe(1.50)

    // SH-594: Oval with Round & Marquise Sides (center 2.00 + sides 0.51 = 2.51 ct)
    const sh594 = {
      code: 'SH-594',
      diamond_weight: 2,
      diamond_specs: [
        { role: 'center', pieces: 1, weight: 2, shape: 'oval' },
        { role: 'side', pieces: 24, weight: 0.51, shape: 'mixed' },
      ],
    }
    expect(computeTotalDiamondCarats(sh594)).toBe(2.51)

    // SH-595: Oval Seven Stone (center 1.00 + sides 0.12 = 1.12 ct)
    const sh595 = {
      code: 'SH-595',
      diamond_weight: 1,
      diamond_specs: [
        { role: 'center', pieces: 1, weight: 1, shape: 'oval' },
        { role: 'side', pieces: 6, weight: 0.12, shape: 'mixed' },
      ],
    }
    expect(computeTotalDiamondCarats(sh595)).toBe(1.12)

    // SH-003: Tanmaniya Heritage Suite (2.41 ct)
    const sh003 = {
      code: 'SH-003',
      diamond_specs: [
        { pieces: 260, weight: 0.005, size_label: '1.0mm' },
        { pieces: 221, weight: 0.005, size_label: '1.0mm' },
      ],
    }
    expect(computeTotalDiamondCarats(sh003)).toBe(2.41)

    // SH-004: Royal Diamond Tennis Necklace (5.50 ct)
    expect(computeTotalDiamondCarats({ code: 'SH-004' })).toBe(5.50)

    // Fallback to diamond_weight when diamond_specs is absent
    expect(computeTotalDiamondCarats({ diamond_weight: 1.75 })).toBe(1.75)
    expect(computeTotalDiamondCarats({})).toBeNull()
  })

  it('resolves ring size defaults accurately linking stored manufacturing size to public size selector', () => {
    const availableSizes = ['US 4', 'US 4.5', 'US 5', 'US 5.5', 'US 6', 'US 6.5', 'US 7', 'US 7.5', 'US 8', 'US 8.5', 'US 9']

    // 17.9 mm inner diameter (manufacturing default for all current rings = Indian 16)
    // Must map to US 7.5 (NOT hardcoded US 5!)
    const res179 = resolveDefaultRingSize(17.9, availableSizes)
    expect(res179.defaultSize).toBe('US 7.5')
    expect(res179.manufacturingSizeLabel).toContain('17.9 mm')
    expect(res179.manufacturingSizeLabel).toContain('Indian 16')
    expect(res179.manufacturingSizeLabel).toContain('US 7.5')

    // 16.5 mm inner diameter (Indian 11) maps to US 6
    const res165 = resolveDefaultRingSize(16.5, availableSizes)
    expect(res165.defaultSize).toBe('US 6')
    expect(res165.manufacturingSizeLabel).toContain('16.5 mm')

    // String format: 'US 7'
    const resUs7 = resolveDefaultRingSize('US 7', availableSizes)
    expect(resUs7.defaultSize).toBe('US 7')

    // Null/undefined fallback: defaults sensibly to US 7.5 or US 7 (never arbitrary US 5)
    const resNull = resolveDefaultRingSize(null, availableSizes)
    expect(resNull.defaultSize).toBe('US 7.5')
    expect(resNull.manufacturingSizeLabel).toBeNull()
  })
})
