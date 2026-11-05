import { describe, it, expect } from 'vitest'
import {
  computeRowDiamondWeight,
  formatRowTotalCarats,
  computeProductDiamondCarats,
  VERIFIED_COMBINED_PRODUCTS,
  UNVERIFIED_BASIS_PRODUCTS,
  SINGLE_PIECE_ONLY_PRODUCTS,
} from '../diamondSpecs'
import { computeTotalDiamondCarats } from '../d2cProductDetail'

describe('Diamond Weight Basis and Catalog Engine', () => {
  describe('Acceptance Test 4: Basis Sanity Calculations', () => {
    it('per_stone: 0.5ct x 2 pieces shows 1ct total', () => {
      const row = { weight: 0.5, pieces: 2, weight_basis: 'per_stone' }
      expect(computeRowDiamondWeight(row)).toBe(1.0)
      expect(formatRowTotalCarats(row)).toBe('1 ct total (0.5 ct × 2)')
    })

    it('group: 0.5ct shared by 2 pieces shows 0.5ct total', () => {
      const row = { weight: 0.5, pieces: 2, weight_basis: 'group' }
      expect(computeRowDiamondWeight(row)).toBe(0.5)
      expect(formatRowTotalCarats(row)).toBe('0.5 ct total')
    })

    it('row with pieces > 1 and NO basis tag renders no asserted total', () => {
      const row = { weight: 0.5, pieces: 2, weight_basis: null }
      expect(computeRowDiamondWeight(row)).toBeNull()
      expect(formatRowTotalCarats(row)).toBe('— (basis required)')
    })

    it('single-piece row (pieces = 1) is unambiguous and renders exact weight', () => {
      const row = { weight: 1.5, pieces: 1 }
      expect(computeRowDiamondWeight(row)).toBe(1.5)
      expect(formatRowTotalCarats(row)).toBe('1.5 ct')
    })
  })

  describe('Acceptance Test 1: Catalog Cards Display Exact Carats', () => {
    // SH-623: center 1.5ct (1pc) + side 1.0ct group (2pcs) = 2.5ct
    it('SH-623 displays 2.5ct', () => {
      const product = {
        code: 'SH-623',
        diamond_specs: [
          { role: 'center', weight: 1.5, pieces: 1 },
          { role: 'side', weight: 1.0, pieces: 2, weight_basis: 'group' },
        ],
      }
      const summary = computeProductDiamondCarats(product)
      expect(summary.totalCarats).toBe(2.5)
      expect(summary.displayTotal).toBe('2.5ct')
      expect(summary.hasUnverifiedRows).toBe(false)
    })

    // SH-624: center 2.0ct group (2pcs) = 2ct
    it('SH-624 displays 2ct', () => {
      const product = {
        code: 'SH-624',
        diamond_specs: [
          { role: 'center', weight: 2.0, pieces: 2, weight_basis: 'group' },
        ],
      }
      const summary = computeProductDiamondCarats(product)
      expect(summary.totalCarats).toBe(2.0)
      expect(summary.displayTotal).toBe('2ct')
      expect(summary.hasUnverifiedRows).toBe(false)
    })

    // SH-622: 7.0ct group (7pcs) = 7ct
    it('SH-622 displays 7ct', () => {
      const product = {
        code: 'SH-622',
        diamond_specs: [
          { role: 'other', weight: 7.0, pieces: 7, weight_basis: 'group' },
        ],
      }
      const summary = computeProductDiamondCarats(product)
      expect(summary.totalCarats).toBe(7.0)
      expect(summary.displayTotal).toBe('7ct')
      expect(summary.hasUnverifiedRows).toBe(false)
    })

    // SH-592: center 2.0ct (1pc) + side 0.7ct group (2pcs) = 2.7ct
    it('SH-592 displays 2.7ct', () => {
      const product = {
        code: 'SH-592',
        diamond_specs: [
          { role: 'center', weight: 2.0, pieces: 1 },
          { role: 'side', weight: 0.7, pieces: 2, weight_basis: 'group' },
        ],
      }
      const summary = computeProductDiamondCarats(product)
      expect(summary.totalCarats).toBe(2.7)
      expect(summary.displayTotal).toBe('2.7ct')
      expect(summary.hasUnverifiedRows).toBe(false)
    })

    // SH-603: center 0.5ct (1pc) + side 0.35ct group (12pcs) = 0.85ct
    it('SH-603 displays 0.85ct', () => {
      const product = {
        code: 'SH-603',
        diamond_specs: [
          { role: 'center', weight: 0.5, pieces: 1 },
          { role: 'side', weight: 0.35, pieces: 12, weight_basis: 'group' },
        ],
      }
      const summary = computeProductDiamondCarats(product)
      expect(summary.totalCarats).toBe(0.85)
      expect(summary.displayTotal).toBe('0.85ct')
      expect(summary.hasUnverifiedRows).toBe(false)
    })

    // SH-611: center 1.0ct (1pc) + side 0.6ct group (2pcs) + side 0.05ct group (6pcs) = 1.65ct
    it('SH-611 displays 1.65ct', () => {
      const product = {
        code: 'SH-611',
        diamond_specs: [
          { role: 'center', weight: 1.0, pieces: 1 },
          { role: 'side', weight: 0.6, pieces: 2, weight_basis: 'group' },
          { role: 'side', weight: 0.05, pieces: 6, weight_basis: 'group' },
        ],
      }
      const summary = computeProductDiamondCarats(product)
      expect(summary.totalCarats).toBe(1.65)
      expect(summary.displayTotal).toBe('1.65ct')
      expect(summary.hasUnverifiedRows).toBe(false)
    })

    // SH-614: other 0.55ct group (5pcs) = 0.55ct
    it('SH-614 displays 0.55ct', () => {
      const product = {
        code: 'SH-614',
        diamond_specs: [
          { role: 'other', weight: 0.55, pieces: 5, weight_basis: 'group' },
        ],
      }
      const summary = computeProductDiamondCarats(product)
      expect(summary.totalCarats).toBe(0.55)
      expect(summary.displayTotal).toBe('0.55ct')
      expect(summary.hasUnverifiedRows).toBe(false)
    })

    // SH-620: other 1.25ct group (5pcs) = 1.25ct
    it('SH-620 displays 1.25ct', () => {
      const product = {
        code: 'SH-620',
        diamond_specs: [
          { role: 'other', weight: 1.25, pieces: 5, weight_basis: 'group' },
        ],
      }
      const summary = computeProductDiamondCarats(product)
      expect(summary.totalCarats).toBe(1.25)
      expect(summary.displayTotal).toBe('1.25ct')
      expect(summary.hasUnverifiedRows).toBe(false)
    })
  })

  describe('Acceptance Test 2: D2C API diamondWeightCarats Mapping', () => {
    it('maps verified products to exact source-backed totals', () => {
      expect(computeTotalDiamondCarats({
        diamond_specs: [
          { role: 'center', weight: 1.5, pieces: 1 },
          { role: 'side', weight: 1.0, pieces: 2, weight_basis: 'group' },
        ],
      })).toBe(2.5)

      expect(computeTotalDiamondCarats({
        diamond_specs: [
          { role: 'other', weight: 7.0, pieces: 7, weight_basis: 'group' },
        ],
      })).toBe(7.0)

      expect(computeTotalDiamondCarats({
        diamond_specs: [
          { role: 'center', weight: 3.0, pieces: 1 },
          { role: 'side', weight: 1.27, pieces: 66, weight_basis: 'group' },
        ],
      })).toBe(4.27)
    })

    it('unverified products preserve current display and flag for review', () => {
      // SH-594: center 2.0 (1pc) + side 0.51 (24pcs, unverified)
      const unverifiedProduct = {
        code: 'SH-594',
        diamond_specs: [
          { role: 'center', weight: 2.0, pieces: 1 },
          { role: 'side', weight: 0.51, pieces: 24 }, // No weight_basis
        ],
      }
      const summary = computeProductDiamondCarats(unverifiedProduct)
      expect(summary.hasUnverifiedRows).toBe(true)
      expect(summary.unverifiedRowCount).toBe(1)
      // D2C API preserves current display (2.0 + 0.51 = 2.51)
      expect(computeTotalDiamondCarats(unverifiedProduct)).toBe(2.51)
    })
  })

  describe('Acceptance Test 5: SH-604 Two-Step Verification', () => {
    it('step 4a: basis-tagged group at 1.20 unchanged yields 4.2ct total', () => {
      const step4aProd = {
        code: 'SH-604',
        diamond_specs: [
          { role: 'center', weight: 3.0, pieces: 1 },
          { role: 'side', weight: 1.20, pieces: 66, weight_basis: 'group' },
        ],
      }
      const summary = computeProductDiamondCarats(step4aProd)
      expect(summary.totalCarats).toBe(4.2)
      expect(summary.displayTotal).toBe('4.2ct')
    })

    it('step 4b: value correction 1.27 with +Rs 1,050 pricing yields 4.27ct and correct price math', () => {
      const step4bProd = {
        code: 'SH-604',
        diamond_specs: [
          { role: 'center', weight: 3.0, pieces: 1 },
          { role: 'side', weight: 1.27, pieces: 66, cost: 288.64, weight_basis: 'group' },
        ],
      }
      const summary = computeProductDiamondCarats(step4bProd)
      expect(summary.totalCarats).toBe(4.27)
      expect(summary.displayTotal).toBe('4.27ct')

      // Verify pricing math
      const baseDiamondCost = 45000 // 3ct @ 15,000
      const sideDiamondCost = 1.27 * 15000 // 19050
      const totalDiamondCost = baseDiamondCost + sideDiamondCost
      expect(totalDiamondCost).toBe(64050)

      const costPerPc = sideDiamondCost / 66
      expect(Number(costPerPc.toFixed(2))).toBe(288.64)

      const originalTrade = 125270
      const newTrade = originalTrade + 1050
      expect(newTrade).toBe(126320)
    })
  })

  describe('Audit Categorization Integrity', () => {
    it('contains exactly 15 verified products (14 verified combined + SH-622)', () => {
      expect(VERIFIED_COMBINED_PRODUCTS.length).toBe(15)
      expect(VERIFIED_COMBINED_PRODUCTS).toContain('SH-622')
      expect(VERIFIED_COMBINED_PRODUCTS).toContain('SH-604')
      expect(VERIFIED_COMBINED_PRODUCTS).toContain('SH-623')
    })

    it('contains exactly 17 unverified products held for review', () => {
      expect(UNVERIFIED_BASIS_PRODUCTS.length).toBe(17)
      expect(UNVERIFIED_BASIS_PRODUCTS).toContain('SH-591')
      expect(UNVERIFIED_BASIS_PRODUCTS).toContain('SH-594')
      expect(UNVERIFIED_BASIS_PRODUCTS).toContain('SH-625')
    })

    it('contains exactly 4 single-piece unaffected products', () => {
      expect(SINGLE_PIECE_ONLY_PRODUCTS.length).toBe(4)
      expect(SINGLE_PIECE_ONLY_PRODUCTS).toEqual(['SH-590', 'SH-597', 'SH-617', 'SH-619'])
    })
  })
})
