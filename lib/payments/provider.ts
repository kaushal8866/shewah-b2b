/**
 * Payment Provider Factory & Security Guard
 * File: lib/payments/provider.ts
 *
 * Implements payment gateway abstraction using native fetch for Stripe REST API
 * (no external Stripe SDK dependency required) and an environment-guarded
 * test gateway for local development and CI testing.
 */

import crypto from 'crypto'
import {
  PaymentGateway,
  CreatePaymentSessionParams,
  PaymentSessionResult,
  WebhookVerificationResult,
} from './types'

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production'
}

class TestPaymentGateway implements PaymentGateway {
  constructor() {
    if (isProduction()) {
      throw new Error(
        'CRITICAL SECURITY ALERT: TestPaymentGateway is strictly prohibited in production environments.'
      )
    }
  }

  async createSession(params: CreatePaymentSessionParams): Promise<PaymentSessionResult> {
    if (isProduction()) {
      throw new Error('Test payment gateway cannot be invoked in production.')
    }
    const simulatedSessionId = `test_sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const redirectUrl = `${params.successUrl}?session_id=${simulatedSessionId}&mode=test`
    return {
      sessionId: simulatedSessionId,
      provider: 'test',
      redirectUrl,
    }
  }

  async verifyWebhook(payload: string | Buffer): Promise<WebhookVerificationResult> {
    if (isProduction()) {
      return { isValid: false, error: 'Test webhook verification forbidden in production' }
    }
    try {
      const data = typeof payload === 'string' ? JSON.parse(payload) : JSON.parse(payload.toString())
      return {
        isValid: true,
        orderId: data.orderId,
        orderNumber: data.orderNumber,
        paymentReference: data.paymentReference || `test_ref_${Date.now()}`,
        amountPaid: data.amount,
        currency: data.currency,
        rawEvent: data,
      }
    } catch (e: any) {
      return { isValid: false, error: e?.message || 'Invalid test webhook payload' }
    }
  }
}

class StripeRestPaymentGateway implements PaymentGateway {
  private secretKey: string
  private webhookSecret?: string

  constructor(secretKey: string, webhookSecret?: string) {
    this.secretKey = secretKey
    this.webhookSecret = webhookSecret
  }

  async createSession(params: CreatePaymentSessionParams): Promise<PaymentSessionResult> {
    const url = 'https://api.stripe.com/v1/checkout/sessions'
    
    // Convert params to URL-encoded form data for Stripe API
    const formData = new URLSearchParams()
    formData.append('payment_method_types[0]', 'card')
    formData.append('mode', 'payment')
    formData.append('customer_email', params.customerEmail)
    formData.append('success_url', `${params.successUrl}?session_id={CHECKOUT_SESSION_ID}`)
    formData.append('cancel_url', params.cancelUrl)

    formData.append('line_items[0][price_data][currency]', params.currency.toLowerCase())
    formData.append('line_items[0][price_data][product_data][name]', `Shewah Order ${params.orderNumber}`)
    formData.append('line_items[0][price_data][product_data][description]', 'Fine Jewellery & Bespoke Commission')
    formData.append('line_items[0][price_data][unit_amount]', String(Math.round(params.amount * 100)))
    formData.append('line_items[0][quantity]', '1')

    formData.append('metadata[orderId]', params.orderId)
    formData.append('metadata[orderNumber]', params.orderNumber)
    if (params.metadata) {
      for (const [k, v] of Object.entries(params.metadata)) {
        formData.append(`metadata[${k}]`, v)
      }
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    })

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}))
      throw new Error(`Stripe API error: ${errJson?.error?.message || res.statusText}`)
    }

    const session = await res.json()
    return {
      sessionId: session.id,
      provider: 'stripe',
      redirectUrl: session.url || params.successUrl,
    }
  }

  async verifyWebhook(payload: string | Buffer, signature: string): Promise<WebhookVerificationResult> {
    if (!this.webhookSecret) {
      return { isValid: false, error: 'STRIPE_WEBHOOK_SECRET is not configured' }
    }

    try {
      const rawPayload = typeof payload === 'string' ? payload : payload.toString('utf8')
      
      // Parse stripe-signature header: t=timestamp,v1=signature
      const parts = signature.split(',').reduce<Record<string, string>>((acc, item) => {
        const [k, v] = item.split('=')
        if (k && v) acc[k.trim()] = v.trim()
        return acc
      }, {})

      const timestamp = parts.t
      const expectedSig = parts.v1
      if (!timestamp || !expectedSig) {
        return { isValid: false, error: 'Malformed stripe-signature header' }
      }

      // Compute HMAC-SHA256 signature
      const signedPayload = `${timestamp}.${rawPayload}`
      const hmac = crypto.createHmac('sha256', this.webhookSecret).update(signedPayload).digest('hex')

      if (hmac !== expectedSig) {
        return { isValid: false, error: 'Stripe webhook signature mismatch' }
      }

      const event = JSON.parse(rawPayload)
      if (event.type === 'checkout.session.completed') {
        const session = event.data?.object || {}
        return {
          isValid: true,
          orderId: session.metadata?.orderId,
          orderNumber: session.metadata?.orderNumber,
          paymentReference: session.payment_intent || session.id,
          amountPaid: (session.amount_total || 0) / 100,
          currency: (session.currency || 'usd').toUpperCase(),
          rawEvent: event,
        }
      }

      return { isValid: true, rawEvent: event }
    } catch (err: any) {
      return { isValid: false, error: err.message || 'Failed to verify stripe webhook' }
    }
  }
}

/**
 * Payment Gateway Factory
 */
export function getPaymentGateway(): PaymentGateway {
  const stripeSecret = process.env.STRIPE_SECRET_KEY
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  const paymentMode = process.env.PAYMENT_MODE || (stripeSecret ? 'stripe' : 'test')

  if (paymentMode === 'stripe') {
    if (!stripeSecret) {
      throw new Error('STRIPE_SECRET_KEY must be provided when PAYMENT_MODE=stripe')
    }
    return new StripeRestPaymentGateway(stripeSecret, webhookSecret)
  }

  if (isProduction()) {
    throw new Error('Production environment must configure a live payment provider (e.g. Stripe).')
  }

  return new TestPaymentGateway()
}
