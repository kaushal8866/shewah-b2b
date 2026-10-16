import { describe, it, expect } from 'vitest'
import {
  parseKaratNumber,
  getHallmarkLabel,
  resolveBaseProductWeight,
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
})
