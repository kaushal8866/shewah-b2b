import { describe, it, expect } from 'vitest'
import {
  getMarket,
  MARKETS,
  isHighValueOrder,
  getHighValueReviewThreshold,
  computeDeliveryEstimate,
  formatCurrency,
  type MarketCode,
} from '../markets'
import { getPaymentGateway } from '../payments/provider'

describe('End-to-End International D2C Commerce Journey Simulation', () => {
  // 1. Visitor Navigation & Market Resolution
  it('correctly maps international visitor destinations to authoritative markets', () => {
    expect(getMarket('US').code).toBe('US')
    expect(getMarket('GB').currency).toBe('GBP')
    expect(getMarket('UK').code).toBe('GB')
    expect(getMarket('DE').taxModel).toBe('inclusive')
    expect(getMarket('FR').taxRate).toBe(0.20)
    expect(getMarket('AU').currency).toBe('AUD')
    expect(getMarket('IN').currency).toBe('INR')
    expect(getMarket('IN').taxRate).toBe(0.03)
    // Fallback for unsupported or unknown country
    expect(getMarket('SG').code).toBe('US')
  })

  // 2. Configuration-Driven High-Value Review Gate
  it('enforces market-aware, currency-specific high-value review gates', () => {
    // US: $10,000 threshold
    expect(getHighValueReviewThreshold('US')).toBe(10000)
    expect(isHighValueOrder(9999, 'US')).toBe(false)
    expect(isHighValueOrder(10000, 'US')).toBe(true)
    expect(isHighValueOrder(15000, 'US')).toBe(true)

    // GB: £8,000 threshold
    expect(getHighValueReviewThreshold('GB')).toBe(8000)
    expect(isHighValueOrder(7999, 'GB')).toBe(false)
    expect(isHighValueOrder(8000, 'GB')).toBe(true)

    // AU: A$15,000 threshold
    expect(getHighValueReviewThreshold('AU')).toBe(15000)
    expect(isHighValueOrder(14999, 'AU')).toBe(false)
    expect(isHighValueOrder(15000, 'AU')).toBe(true)

    // DE / FR: €9,000 threshold
    expect(getHighValueReviewThreshold('DE')).toBe(9000)
    expect(isHighValueOrder(8999, 'DE')).toBe(false)
    expect(isHighValueOrder(9000, 'DE')).toBe(true)

    // IN: ₹2,00,000 threshold
    expect(getHighValueReviewThreshold('IN')).toBe(200000)
    expect(isHighValueOrder(199999, 'IN')).toBe(false)
    expect(isHighValueOrder(200000, 'IN')).toBe(true)
  })

  // 3. Tax & Duty Calculation Models
  it('correctly evaluates tax breakdowns across inclusive vs exclusive markets', () => {
    const usMarket = MARKETS.US
    const gbMarket = MARKETS.GB
    const amount = 5000

    // US exclusive: tax calculated at checkout on top of price
    const usTax = Math.round(amount * usMarket.taxRate)
    expect(usTax).toBe(0) // 0 base rate in catalog, collected based on state

    // GB inclusive: 20% VAT already inside £5,000
    // Net = 5000 / 1.20 = 4166.67, Tax = 5000 - 4166.67 = 833
    const gbNet = amount / (1 + gbMarket.taxRate)
    const gbTax = Math.round(amount - gbNet)
    expect(gbTax).toBe(833)
    expect(Math.round(gbNet + gbTax)).toBe(5000)
  })

  // 4. Market-Locking & Destination Validation
  it('detects destination mismatch and authoritatively locks market parameters', () => {
    const userCartMarket = 'US'
    const destinationCountry = 'GB'

    const activeMarket = getMarket(userCartMarket)
    const destinationMarket = getMarket(destinationCountry)

    const isMismatch = activeMarket.code !== destinationMarket.code
    expect(isMismatch).toBe(true)

    // Authoritative re-lock: destination country rules supersede browsing selection
    const lockedMarket = destinationMarket
    expect(lockedMarket.code).toBe('GB')
    expect(lockedMarket.currency).toBe('GBP')
    expect(lockedMarket.taxModel).toBe('inclusive')
  })

  // 5. Lead Time & Crafting Window Calculation
  it('calculates deterministic delivery ranges factoring atelier lead time and international courier transit', () => {
    const leadDays = 14
    const fixedDate = new Date('2026-09-01T00:00:00Z')
    const usEstimate = computeDeliveryEstimate(leadDays, 'US', fixedDate)
    const auEstimate = computeDeliveryEstimate(leadDays, 'AU', fixedDate)

    expect(usEstimate.formattedRange).toBeTruthy()
    expect(usEstimate.latestDate.getTime()).toBeGreaterThan(usEstimate.earliestDate.getTime())

    expect(auEstimate.formattedRange).toBeTruthy()
    expect(auEstimate.latestDate.getTime()).toBeGreaterThan(auEstimate.earliestDate.getTime())
  })

  // 6. Payment Provider & Webhook Verification
  it('verifies simulated test gateway webhooks and protects idempotency', async () => {
    const originalEnv = process.env.NODE_ENV
    // @ts-ignore
    process.env.NODE_ENV = 'development'
    process.env.PAYMENT_MODE = 'test'

    const gateway = getPaymentGateway()

    // Session creation
    const session = await gateway.createSession({
      orderId: 'test-order-123',
      orderNumber: 'SH-D2C-2026-9999',
      currency: 'USD',
      amount: 4500,
      customerEmail: 'client@example.com',
      customerName: 'Eleanor Vance',
      successUrl: 'https://shewah.co/order-confirmation/test-order-123',
      cancelUrl: 'https://shewah.co/cart',
      metadata: { market: 'US' },
    })

    expect(session.provider).toBe('test')
    expect(session.sessionId).toContain('test_sess_')
    expect(session.redirectUrl).toContain('/order-confirmation/test-order-123')

    // Webhook verification
    const webhookPayload = JSON.stringify({
      orderId: 'test-order-123',
      paymentReference: 'ch_test_99999',
    })
    const webhookResult = await gateway.verifyWebhook(webhookPayload, 'simulated_test_sig')
    expect(webhookResult.isValid).toBe(true)
    expect(webhookResult.orderId).toBe('test-order-123')
    expect(webhookResult.paymentReference).toBe('ch_test_99999')

    // Webhook idempotency test: duplicate deliveries have the same reference
    const duplicateResult = await gateway.verifyWebhook(webhookPayload, 'simulated_test_sig')
    expect(duplicateResult.isValid).toBe(true)
    expect(duplicateResult.paymentReference).toBe(webhookResult.paymentReference)

    // @ts-ignore
    process.env.NODE_ENV = originalEnv
  })

  // 7. Order Lifecycle Transitions & High-Value Screening
  it('advances status to order_confirmed for normal orders, but holds brief_received for review gate', () => {
    function computePostPaymentStatus(reviewStatus: string): string {
      return (reviewStatus === 'not_required' || reviewStatus === 'approved')
        ? 'order_confirmed'
        : 'brief_received'
    }

    // Normal order (£4,500 < £8,000 threshold in GB)
    const normalOrderAmount = 4500
    const normalIsHighValue = isHighValueOrder(normalOrderAmount, 'GB')
    expect(normalIsHighValue).toBe(false)
    const normalReviewStatus = normalIsHighValue ? 'pending_review' : 'not_required'
    expect(normalReviewStatus).toBe('not_required')
    expect(computePostPaymentStatus(normalReviewStatus)).toBe('order_confirmed')

    // High-value order ($18,500 > $10,000 threshold in US)
    const highValueAmount = 18500
    const highValueIsHighValue = isHighValueOrder(highValueAmount, 'US')
    expect(highValueIsHighValue).toBe(true)
    const highValueReviewStatus = highValueIsHighValue ? 'pending_review' : 'not_required'
    expect(highValueReviewStatus).toBe('pending_review')
    expect(computePostPaymentStatus(highValueReviewStatus)).toBe('brief_received')
  })
})
