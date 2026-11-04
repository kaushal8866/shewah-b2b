import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchProductDetail } from '../d2cProductDetail'
import { supabaseAdmin } from '../supabaseAdmin'
import * as d2cPricing from '../d2cPricing'

vi.mock('../supabaseAdmin', () => {
  return {
    supabaseAdmin: {
      from: vi.fn(),
    },
  }
})

describe('fetchProductDetail API & Public Data Hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('omits raw numeric prices and returns "Price on request" for unauthenticated public sessions', async () => {
    const mockProduct = {
      id: 'sh-594-id',
      code: 'SH-594',
      name: 'The Empress Oval Solitaire',
      slug: 'sh-594',
      d2c_status: 'published',
      is_active: true,
      category: 'Ring',
      diamond_specs: [
        { role: 'center', pieces: 1, weight: 2.0, shape: 'oval' },
        { role: 'side', pieces: 24, weight: 0.51, shape: 'round' },
      ],
      attributes: { ring_size: 17.9 },
      d2c_crafting_lead_days: null,
    }

    vi.spyOn(supabaseAdmin, 'from').mockReturnValue({
      select: vi.fn().mockReturnValue({
        or: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: mockProduct }),
            }),
          }),
        }),
      }),
    } as any)

    vi.spyOn(d2cPricing, 'resolveProductMarketPrice').mockResolvedValue({
      unitPrice: 1170,
      compareAtPrice: 1450,
      formattedPrice: '$1,170',
      currency: 'USD',
      currencySymbol: '$',
      taxModel: 'exclusive',
      taxRate: 0,
      taxAmount: 0,
      taxLabel: 'Sales Tax',
      isInclusive: false,
      isAvailable: true,
      label: null,
    })

    // Public request (isTradeSession = false)
    const result = await fetchProductDetail('sh-594', 'US', false)

    expect(result).not.toBeNull()
    expect(result?.code).toBe('SH-594')
    // Price fields must NOT leak wholesale/retail numbers to public scrapers
    expect(result?.price.isAvailable).toBe(false)
    expect(result?.price.label).toBe('Price on request')
    expect(result?.price.amount).toBeUndefined()
    expect(result?.price.formatted).toBeUndefined()
    expect(result?.price.compareAt).toBeUndefined()

    // Crafting lead time and estimated delivery window when lead days is null
    expect(result?.craftingLeadDays).toBeNull()
    expect('estimatedDeliveryWindow' in (result || {})).toBe(false)
  })

  it('exposes full price details to authenticated trade sessions', async () => {
    const mockProduct = {
      id: 'sh-594-id',
      code: 'SH-594',
      name: 'The Empress Oval Solitaire',
      slug: 'sh-594',
      d2c_status: 'published',
      is_active: true,
      category: 'Ring',
      diamond_specs: [
        { role: 'center', pieces: 1, weight: 2.0, shape: 'oval' },
        { role: 'side', pieces: 24, weight: 0.51, shape: 'round' },
      ],
      attributes: { ring_size: 17.9 },
      d2c_crafting_lead_days: null,
    }

    vi.spyOn(supabaseAdmin, 'from').mockReturnValue({
      select: vi.fn().mockReturnValue({
        or: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: mockProduct }),
            }),
          }),
        }),
      }),
    } as any)

    vi.spyOn(d2cPricing, 'resolveProductMarketPrice').mockResolvedValue({
      unitPrice: 1170,
      compareAtPrice: 1450,
      formattedPrice: '$1,170',
      currency: 'USD',
      currencySymbol: '$',
      taxModel: 'exclusive',
      taxRate: 0,
      taxAmount: 0,
      taxLabel: 'Sales Tax',
      isInclusive: false,
      isAvailable: true,
      label: null,
    })

    // Authenticated trade request (isTradeSession = true)
    const result = await fetchProductDetail('sh-594', 'US', true)

    expect(result).not.toBeNull()
    expect(result?.price.isAvailable).toBe(true)
    expect(result?.price.amount).toBe(1170)
    expect(result?.price.formatted).toBe('$1,170')
    expect(result?.price.compareAt).toBe(1450)
  })

  it('includes estimatedDeliveryWindow only when d2c_crafting_lead_days is positive', async () => {
    const mockProductWithLead = {
      id: 'sh-594-id',
      code: 'SH-594',
      name: 'The Empress Oval Solitaire',
      slug: 'sh-594',
      d2c_status: 'published',
      is_active: true,
      category: 'Ring',
      d2c_crafting_lead_days: 10,
    }

    vi.spyOn(supabaseAdmin, 'from').mockReturnValue({
      select: vi.fn().mockReturnValue({
        or: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: mockProductWithLead }),
            }),
          }),
        }),
      }),
    } as any)

    vi.spyOn(d2cPricing, 'resolveProductMarketPrice').mockResolvedValue({
      unitPrice: 1170,
      compareAtPrice: 1450,
      formattedPrice: '$1,170',
      currency: 'USD',
      currencySymbol: '$',
      taxModel: 'exclusive',
      taxRate: 0,
      taxAmount: 0,
      taxLabel: 'Sales Tax',
      isInclusive: false,
      isAvailable: true,
      label: null,
    })

    const result = await fetchProductDetail('sh-594', 'US', false)

    expect(result?.craftingLeadDays).toBe(10)
    expect(result?.estimatedDeliveryWindow).toBeDefined()
    expect(typeof result?.estimatedDeliveryWindow).toBe('string')
  })
})
