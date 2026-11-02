import { describe, it, expect } from 'vitest'
import { KARAT_FACTORS, METAL_PURITY, ALLOY_DENSITY, densityFor } from '../metalPhysics'
import { pureGoldMass, pure24kt, convertKaratWeight, computeKaratPricing } from '../karat'
import { getAlloyDensity } from '../cadWeight'

describe('purity is BIS hallmark fineness', () => {
  it('matches the millesimal stamps 916/750/585/417/375', () => {
    expect(KARAT_FACTORS[24]).toBe(1)
    expect(KARAT_FACTORS[22]).toBe(0.916)
    expect(KARAT_FACTORS[18]).toBe(0.750)
    expect(KARAT_FACTORS[14]).toBe(0.585)
    expect(KARAT_FACTORS[10]).toBe(0.417)
    expect(KARAT_FACTORS[9]).toBe(0.375)
  })

  it('no longer carries the rounded-up values that overstated gold content', () => {
    // 14K was 0.60 (+2.6% over 0.585), 10K was 0.42, 9K was 0.38.
    expect(KARAT_FACTORS[14]).not.toBe(0.60)
    expect(KARAT_FACTORS[10]).not.toBe(0.42)
    expect(KARAT_FACTORS[9]).not.toBe(0.38)
  })

  it('keeps silver and platinum out of the gold purity table', () => {
    // 925 / 950 used to sit in KARAT_FACTORS, so pureGoldMass(w,'silver_925')
    // returned 92.5% of the weight as pure GOLD.
    expect(KARAT_FACTORS[925 as number]).toBeUndefined()
    expect(KARAT_FACTORS[950 as number]).toBeUndefined()
    expect(METAL_PURITY.silver_925).toBe(0.925)
    expect(METAL_PURITY.platinum_950).toBe(0.950)
  })

  it('pureGoldMass refuses non-gold metals instead of billing them as gold', () => {
    expect(pureGoldMass(10, 'silver_925')).toBe(0)
    expect(pureGoldMass(10, 'platinum_950')).toBe(0)
    expect(pureGoldMass(10, '18K')).toBe(7.5)
  })

  it('bills 14K gold on 585, not 600', () => {
    // 10g of 14K at ₹7000/g of 24kt
    expect(pure24kt(10, 14)).toBe(5.85)
    expect(Math.round(pure24kt(10, 14) * 7000)).toBe(40950) // was 42000
  })
})

describe('one density table', () => {
  it('is shared by karat conversion and CAD weight estimation', () => {
    // Previously 18K white was 15.70 in karat.ts and 15.00 in cadWeight.ts.
    expect(getAlloyDensity('18K', 'white')).toBe(ALLOY_DENSITY['18K'].white)
    expect(getAlloyDensity('22K', 'yellow')).toBe(ALLOY_DENSITY['22K'].yellow)
    expect(getAlloyDensity('14K', 'rose')).toBe(ALLOY_DENSITY['14K'].rose)
  })

  it('makes nickel white gold lighter than yellow at the same karat', () => {
    // karat.ts previously had white DENSER than yellow, which is backwards.
    for (const k of ['22K', '18K', '14K', '10K', '9K']) {
      expect(ALLOY_DENSITY[k].white).toBeLessThan(ALLOY_DENSITY[k].yellow)
    }
  })

  it('gives 9K its own density rather than reusing 10K', () => {
    expect(ALLOY_DENSITY['9K'].yellow).not.toBe(ALLOY_DENSITY['10K'].yellow)
    expect(getAlloyDensity('9K', 'yellow')).toBe(ALLOY_DENSITY['9K'].yellow)
  })

  it('resolves silver and platinum through the shared table', () => {
    expect(getAlloyDensity('silver_925', '')).toBe(10.36)
    expect(getAlloyDensity('silver_999', '')).toBe(10.49)
    expect(densityFor('platinum_950')).toBe(20.10)
  })

  it('returns null for an unknown alloy rather than a plausible default', () => {
    expect(densityFor('30K')).toBeNull()
  })
})

describe('karat weight conversion is constant-volume', () => {
  it('converts by density ratio, so a lower karat weighs less from one mould', () => {
    // 10g of 22K yellow in an 18K yellow mould: 10 / 17.70 * 15.55
    const got = convertKaratWeight(10, '22K', 'yellow', '18K', 'yellow')
    expect(got).toBeCloseTo(8.785, 2)
    expect(got).toBeLessThan(10)
  })

  it('round-trips back to the original weight', () => {
    const to18 = convertKaratWeight(10, '22K', 'yellow', '18K', 'yellow')
    const back = convertKaratWeight(to18, '18K', 'yellow', '22K', 'yellow')
    expect(back).toBeCloseTo(10, 2)
  })
})

describe('computeKaratPricing', () => {
  const base = {
    netGoldWeight: 5,
    rate24k: 7000,
    retailLabour: { 22: 500, 18: 500, 14: 500, 10: 500, 9: 500 },
    diamondCost: 0,
    makingCharges: 0,
    igiCost: 0,
  }

  it('applies the margin floor when an item has no diamonds', () => {
    // Markup applies only to diamond cost, so with no diamonds raw trade would
    // equal COGS exactly — the leak this floor exists to stop.
    const rows = computeKaratPricing(base)
    for (const r of rows) {
      expect(r.marginFloorApplied).toBe(true)
      expect(r.trade).toBeGreaterThan(r.cogs)
      expect(r.trade).toBe(Math.round(r.cogs * 1.1))
    }
  })

  it('leaves diamond-bearing items on their normal markup', () => {
    const rows = computeKaratPricing({ ...base, diamondCost: 100000 })
    for (const r of rows) {
      expect(r.marginFloorApplied).toBe(false)
      expect(r.trade).toBeGreaterThan(r.cogs)
    }
  })

  it('honours an explicit minMarginPct', () => {
    const rows = computeKaratPricing({ ...base, minMarginPct: 25 })
    for (const r of rows) expect(r.trade).toBe(Math.round(r.cogs * 1.25))
  })

  it('reports gross and pure weight as distinct fields', () => {
    const row = computeKaratPricing(base).find(r => r.karat === 18)!
    expect(row.pureWeight).toBeCloseTo(row.weight * KARAT_FACTORS[18], 4)
    expect(row.pureWeight).toBeLessThan(row.weight)
  })

  it('bills labour on at least the minimum grams', () => {
    const tiny = { ...base, netGoldWeight: 0.4 }
    const withDefault = computeKaratPricing(tiny).find(r => r.karat === 18)!
    // Default floor of 1g means a 0.4g piece is still billed 1g of labour.
    expect(withDefault.labourCost).toBe(500)
    // Set the minimum to 0 and labour tracks the real weight instead.
    const noFloor = computeKaratPricing({ ...tiny, minLabourGrams: 0 }).find(r => r.karat === 18)!
    expect(noFloor.labourCost).toBeLessThan(500)
  })

  it('never lets MRP fall below trade', () => {
    const rows = computeKaratPricing(base)
    for (const r of rows) expect(r.mrp).toBeGreaterThanOrEqual(r.trade)
  })

  it('produces trade = mrp = cogs at every karat when zeroExtraMargin is enabled', () => {
    const rows = computeKaratPricing({ ...base, diamondCost: 15000, zeroExtraMargin: true })
    for (const r of rows) {
      expect(r.marginFloorApplied).toBe(false)
      expect(r.trade).toBe(r.cogs)
      expect(r.mrp).toBe(r.cogs)
    }
  })

  it('recomputeCatalogPrices dryRun correctly applies zero extra margin', async () => {
    const originalFetch = global.fetch
    try {
      global.fetch = (async (url: any, opts: any) => {
        const body = JSON.parse(opts?.body || '{}')
        if (body.table === 'gold_rates') {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              data: [{
                retail_labour_22k: 1100,
                retail_labour_18k: 1100,
                retail_labour_14k: 1100,
                retail_labour_10k: 1100,
                retail_labour_9k: 1500,
              }],
              error: null,
            })
          } as any
        }
        if (body.table === 'products') {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              data: [{
                id: 'ac594b0a-5d0a-48b9-ac69-67e8db45ff30',
                gold_weight_22k: 3.741,
                diamond_cost: 15000,
                making_charges: 0,
                igi_cert_cost: 0,
                trade_price: 75684,
                mrp_suggested: 80684,
                ref_karat: '18K',
                ref_color: 'white',
                metal_weights: {
                  '18K_white': 3.2,
                  '22K_white': 3.741,
                },
                d2c_details: { zero_extra_margin: true },
              }],
              error: null,
            })
          } as any
        }
        return { ok: false, status: 404, json: async () => ({}) } as any
      }) as any

      const { recomputeCatalogPrices } = await import('../supabase')
      const res = await recomputeCatalogPrices(14500, { dryRun: true, targetProductId: 'ac594b0a-5d0a-48b9-ac69-67e8db45ff30' })
      expect(res.updated).toBe(1)
      expect(res.results).toHaveLength(1)
      const r = res.results![0]
      expect(r.isZeroMargin).toBe(true)
      const p18 = r.pricing.find((k: any) => k.karat === 18)
      expect(p18.cogs).toBe(53320)
      expect(p18.trade).toBe(53320)
      expect(p18.mrp).toBe(53320)
      expect(p18.marginFloorApplied).toBe(false)
    } finally {
      global.fetch = originalFetch
    }
  })
})
