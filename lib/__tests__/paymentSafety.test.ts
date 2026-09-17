import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { getPaymentGateway } from '../payments/provider'

describe('Payment Safety & Environment Guards (lib/payments)', () => {
  const originalEnv = process.env.NODE_ENV
  const originalMode = process.env.PAYMENT_MODE

  afterEach(() => {
    ;(process.env as any).NODE_ENV = originalEnv
    process.env.PAYMENT_MODE = originalMode
  })

  it('provides the test gateway in development/test mode', async () => {
    ;(process.env as any).NODE_ENV = 'test'
    delete process.env.PAYMENT_MODE
    delete process.env.STRIPE_SECRET_KEY

    const gateway = getPaymentGateway()
    const session = await gateway.createSession({
      orderId: 'ord_123',
      orderNumber: 'SH-D2C-2026-001',
      amount: 1500,
      currency: 'USD',
      customerEmail: 'test@example.com',
      customerName: 'Test Client',
      successUrl: 'http://localhost:5000/order-confirmation/ord_123',
      cancelUrl: 'http://localhost:5000/checkout',
    })

    expect(session.provider).toBe('test')
    expect(session.sessionId).toContain('test_sess_')
    expect(session.redirectUrl).toContain('mode=test')
  })

  it('verifies simulated webhook payload correctly in test mode', async () => {
    ;(process.env as any).NODE_ENV = 'test'
    const gateway = getPaymentGateway()
    const mockPayload = JSON.stringify({
      orderId: 'ord_123',
      orderNumber: 'SH-D2C-2026-001',
      amount: 1500,
      currency: 'USD',
    })

    const result = await gateway.verifyWebhook(mockPayload, 'test_signature')
    expect(result.isValid).toBe(true)
    expect(result.orderId).toBe('ord_123')
    expect(result.amountPaid).toBe(1500)
    expect(result.currency).toBe('USD')
  })

  it('rejects test gateway in production mode with a hard error', () => {
    ;(process.env as any).NODE_ENV = 'production'
    delete process.env.PAYMENT_MODE
    delete process.env.STRIPE_SECRET_KEY

    expect(() => getPaymentGateway()).toThrow(/Production environment must configure a live payment provider/)
  })

  it('supports concierge wire payment gateway in both development and production', async () => {
    ;(process.env as any).NODE_ENV = 'production'
    const gateway = getPaymentGateway('concierge_wire')
    const session = await gateway.createSession({
      orderId: 'ord_wire_123',
      orderNumber: 'SH-D2C-2026-W01',
      amount: 250000,
      currency: 'INR',
      customerEmail: 'client@example.com',
      customerName: 'High Net Client',
      successUrl: 'https://shewah.co/order-confirmation/ord_wire_123',
      cancelUrl: 'https://shewah.co/checkout',
      paymentMethod: 'concierge_wire',
    })

    expect(session.provider).toBe('concierge_wire')
    expect(session.redirectUrl).toContain('payment_method=wire')
    expect(session.sessionId).toContain('wire_ord_wire_123')
  })
})
