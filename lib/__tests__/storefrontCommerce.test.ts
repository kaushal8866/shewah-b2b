import { describe, it, expect, vi, beforeEach } from 'vitest'
import { trackEvent, type D2CEventName } from '../analytics'
import { MARKETS, getMarket } from '../markets'
import { DEFAULT_NON_EMPTY_CATEGORIES, KNOWN_CATEGORIES } from '../categories'

describe('Storefront Commerce Architecture & Analytics', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    // Mock window and dataLayer
    ;(global as any).window = {
      dataLayer: [],
      fbq: vi.fn(),
    }
  })

  it('supports all 19 standardized D2C analytics events', () => {
    const events: D2CEventName[] = [
      'homepage_view',
      'hero_cta_click',
      'category_click',
      'collection_click',
      'style_click',
      'shape_click',
      'diamond_type_click',
      'product_impression',
      'product_click',
      'wishlist_add',
      'search_open',
      'search_submit',
      'market_change',
      'consultation_click',
      'add_to_cart',
      'cart_open',
      'checkout_start',
      'purchase',
      'business_click',
    ]

    expect(events.length).toBe(19)

    events.forEach((evt) => {
      expect(() => {
        trackEvent(evt, { testKey: 'val', market: 'US' })
      }).not.toThrow()
    })

    // Verify window.dataLayer received the events
    const dataLayer = (global as any).window.dataLayer
    expect(dataLayer.length).toBe(19)
    expect(dataLayer[0].event).toBe('shewah_homepage_view')
    expect(dataLayer[dataLayer.length - 1].event).toBe('shewah_business_click')
  })

  it('safely handles environments without window (SSR)', () => {
    const originalWindow = (global as any).window
    delete (global as any).window

    expect(() => {
      trackEvent('homepage_view', { ssr: true })
    }).not.toThrow()

    ;(global as any).window = originalWindow
  })

  it('maps multi-market currency configurations correctly', () => {
    const usMarket = getMarket('US')
    expect(usMarket.currency).toBe('USD')
    expect(usMarket.currencySymbol).toBe('$')

    const inMarket = getMarket('IN')
    expect(inMarket.currency).toBe('INR')
    expect(inMarket.currencySymbol).toBe('₹')
    expect(inMarket.taxRate).toBe(0.03) // 3% GST on jewellery in India

    const gbMarket = getMarket('GB')
    expect(gbMarket.currency).toBe('GBP')
    expect(gbMarket.currencySymbol).toBe('£')
  })

  it('never contains empty categories in default catalogue navigation', () => {
    DEFAULT_NON_EMPTY_CATEGORIES.forEach((cat) => {
      expect(cat.count).toBeGreaterThan(0)
      expect(cat.href).toMatch(/^\/jewellery\?category=/)
    })

    // Confirm that known categories exist in dictionary
    expect(KNOWN_CATEGORIES['necklaces']).toBeDefined()
    expect(KNOWN_CATEGORIES['earrings']).toBeDefined()
    expect(KNOWN_CATEGORIES['rings']).toBeDefined()
  })

  it('validates verified routes are all relative or legitimate protocols', () => {
    const verifiedRoutes = [
      '/',
      '/jewellery',
      '/jewellery?category=necklaces',
      '/jewellery?category=earrings',
      '/jewellery?style=solitaire',
      '/jewellery?style=statement',
      '/jewellery?shape=heart',
      '/jewellery?shape=emerald',
      '/consultation',
      '/bespoke',
      '/craftsmanship',
      '/diamonds',
      '/about',
      '/contact',
      '/care',
      '/ring-size-guide',
      '/shipping',
      '/returns',
      '/warranty',
      '/business',
    ]

    verifiedRoutes.forEach((route) => {
      expect(route.startsWith('/')).toBe(true)
      expect(route).not.toContain(' ')
    })
  })
})
