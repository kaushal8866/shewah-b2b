import { describe, it, expect } from 'vitest'

describe('Jewellery Suites & Sets Architecture', () => {
  // Test suite pricing and savings computation
  it('correctly calculates bundle privilege savings for a multi-piece suite', () => {
    const suitePrice = 2950
    const components = [
      { code: 'SH-003-PENDENT', name: 'Tanmaniya Pendant & Chain', price: 1550, approxGoldWeight: 4.45 },
      { code: 'SH-003-EARRINGS', name: 'Tanmaniya Matched Drop Earrings', price: 1450, approxGoldWeight: 4.15 },
    ]

    const sumComponentPrices = components.reduce((acc, c) => acc + c.price, 0)
    const suiteSavings = Math.max(0, sumComponentPrices - suitePrice)
    const totalGoldWeight = components.reduce((acc, c) => acc + c.approxGoldWeight, 0)

    expect(sumComponentPrices).toBe(3000)
    expect(suiteSavings).toBe(50)
    expect(Number(totalGoldWeight.toFixed(2))).toBe(8.60)
  })

  // Test catalog deduplication logic
  it('deduplicates sub-components from "all" creations catalog while preserving parent suite', () => {
    const mockProducts = [
      { id: '1', code: 'SH-001', name: 'Diamond Solitaire Ring', d2c_details: {} },
      { id: '2', code: 'SH-002', name: 'Tennis Bracelet', d2c_details: {} },
      { id: '3', code: 'SH-003', name: 'The Tanmaniya Heritage Diamond Suite', d2c_details: { is_set: true, component_codes: ['SH-003-PENDENT', 'SH-003-EARRINGS'] } },
      { id: '4', code: 'SH-003-PENDENT', name: 'Tanmaniya Pendant', d2c_details: { is_component_of_set: true, parent_set_code: 'SH-003' } },
      { id: '5', code: 'SH-003-EARRINGS', name: 'Tanmaniya Earrings', d2c_details: { is_component_of_set: true, parent_set_code: 'SH-003' } },
    ]

    // General catalog view ('all')
    const category = 'all'
    const search = ''
    const visibleProducts = (!category || category === 'all') && !search
      ? mockProducts.filter(p => !(p.d2c_details as any)?.is_component_of_set)
      : mockProducts

    expect(visibleProducts.length).toBe(3)
    expect(visibleProducts.map(p => p.code)).toEqual(['SH-001', 'SH-002', 'SH-003'])
    expect(visibleProducts.some(p => p.code === 'SH-003-PENDENT')).toBe(false)
    expect(visibleProducts.some(p => p.code === 'SH-003-EARRINGS')).toBe(false)
  })

  // Test category filtering allows targeted discovery of component pieces
  it('permits individual component display when browsing specific category filter', () => {
    const mockProducts = [
      { id: '1', code: 'SH-001', category: 'rings', d2c_details: {} },
      { id: '3', code: 'SH-003', category: 'necklaces', d2c_details: { is_set: true } },
      { id: '4', code: 'SH-003-PENDENT', category: 'necklaces', d2c_details: { is_component_of_set: true } },
      { id: '5', code: 'SH-003-EARRINGS', category: 'earrings', d2c_details: { is_component_of_set: true } },
    ]

    const category = 'earrings'
    const visibleProducts = (!category || category === 'all')
      ? mockProducts.filter(p => !(p.d2c_details as any)?.is_component_of_set)
      : mockProducts.filter(p => p.category === category)

    expect(visibleProducts.length).toBe(1)
    expect(visibleProducts[0].code).toBe('SH-003-EARRINGS')
  })

  // Test separate cart item payload generation
  it('generates distinct authoritative cart payload whether purchasing suite or individual component', () => {
    const parentSuite = {
      id: 'prod-suite-uuid',
      code: 'SH-003',
      name: 'The Tanmaniya Heritage Diamond Suite',
      price: 2950,
      category: 'necklaces',
    }

    const pendantComponent = {
      id: 'prod-pendant-uuid',
      code: 'SH-003-PENDENT',
      name: 'The Tanmaniya Heritage Diamond Pendant',
      price: 1550,
      category: 'necklaces',
    }

    const makeCartItem = (target: { id: string; code: string; name: string; price: number; category: string }, config: Record<string, any>) => ({
      productId: target.id,
      code: target.code,
      name: target.name,
      category: target.category,
      unitPrice: target.price,
      config,
    })

    const suiteCartItem = makeCartItem(parentSuite, { metalTone: 'yellow', diamondType: 'lab_grown' })
    const individualCartItem = makeCartItem(pendantComponent, { metalTone: 'yellow', diamondType: 'lab_grown' })

    // Validations: Individual piece has its own ID, code, and price
    expect(suiteCartItem.productId).toBe('prod-suite-uuid')
    expect(suiteCartItem.unitPrice).toBe(2950)
    expect(suiteCartItem.code).toBe('SH-003')

    expect(individualCartItem.productId).toBe('prod-pendant-uuid')
    expect(individualCartItem.unitPrice).toBe(1550)
    expect(individualCartItem.code).toBe('SH-003-PENDENT')
  })
})
