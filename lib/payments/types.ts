/**
 * Payment Abstraction Types
 * File: lib/payments/types.ts
 */

import { CurrencyCode } from '../markets'

export type PaymentProviderType = 'stripe' | 'test'

export interface CreatePaymentSessionParams {
  orderId: string
  orderNumber: string
  amount: number // in major units (e.g. 2450 for $2450)
  currency: CurrencyCode
  customerEmail: string
  customerName: string
  successUrl: string
  cancelUrl: string
  metadata?: Record<string, string>
}

export interface PaymentSessionResult {
  sessionId: string
  provider: PaymentProviderType
  redirectUrl: string
  clientSecret?: string
}

export interface WebhookVerificationResult {
  isValid: boolean
  orderId?: string
  orderNumber?: string
  paymentReference?: string
  amountPaid?: number
  currency?: string
  rawEvent?: any
  error?: string
}

export interface PaymentGateway {
  createSession(params: CreatePaymentSessionParams): Promise<PaymentSessionResult>
  verifyWebhook(payload: string | Buffer, signature: string): Promise<WebhookVerificationResult>
}
