/**
 * Client-Side D2C Analytics Event Tracker
 * File: lib/analytics.ts
 *
 * Provides a unified, type-safe event dispatch pipeline for Google Tag Manager,
 * Meta Pixel (fbq), and internal telemetry without crashing on ad-blockers.
 */

export type D2CAnalyticsEvent =
  | 'homepage_view'
  | 'hero_cta_click'
  | 'category_click'
  | 'collection_click'
  | 'style_click'
  | 'shape_click'
  | 'diamond_type_click'
  | 'product_impression'
  | 'product_click'
  | 'wishlist_add'
  | 'search_open'
  | 'search_submit'
  | 'market_change'
  | 'consultation_click'
  | 'add_to_cart'
  | 'cart_open'
  | 'checkout_start'
  | 'purchase'
  | 'business_click'

export type D2CEventName = D2CAnalyticsEvent

export interface EventPayload {
  eventName: D2CAnalyticsEvent
  properties?: Record<string, any>
  timestamp?: number
}

declare global {
  interface Window {
    dataLayer?: any[]
    fbq?: (...args: any[]) => void
  }
}

export function trackEvent(eventName: D2CAnalyticsEvent, properties: Record<string, any> = {}) {
  if (typeof window === 'undefined') return

  const payload: EventPayload = {
    eventName,
    properties: {
      ...properties,
      url: typeof window !== 'undefined' && window.location ? window.location.href : '',
      path: typeof window !== 'undefined' && window.location ? window.location.pathname : '',
    },
    timestamp: Date.now(),
  }

  try {
    // 1. Google Tag Manager / dataLayer push
    if (Array.isArray(window.dataLayer)) {
      window.dataLayer.push({
        event: `shewah_${eventName}`,
        ...payload.properties,
      })
    }

    // 2. Meta Pixel mapping where applicable
    if (typeof window.fbq === 'function') {
      if (eventName === 'homepage_view') {
        window.fbq('track', 'PageView')
      } else if (eventName === 'product_click' || eventName === 'product_impression') {
        window.fbq('track', 'ViewContent', {
          content_name: properties.productName || properties.title,
          content_ids: properties.productId ? [properties.productId] : undefined,
          value: properties.price,
          currency: properties.currency,
        })
      } else if (eventName === 'add_to_cart') {
        window.fbq('track', 'AddToCart', {
          content_name: properties.productName,
          value: properties.price,
          currency: properties.currency,
        })
      } else if (eventName === 'checkout_start') {
        window.fbq('track', 'InitiateCheckout', {
          num_items: properties.itemCount,
          value: properties.totalAmount,
          currency: properties.currency,
        })
      } else if (eventName === 'purchase') {
        window.fbq('track', 'Purchase', {
          value: properties.totalAmount,
          currency: properties.currency,
          order_id: properties.orderNumber || properties.orderId,
        })
      } else if (eventName === 'consultation_click') {
        window.fbq('trackCustom', 'ConsultationInitiated', payload.properties)
      }
    }

    // 3. Custom DOM dispatch for local listener extensions
    window.dispatchEvent(
      new CustomEvent('shewah:analytics', {
        detail: payload,
      })
    )
  } catch (err) {
    // Fail silently in customer browser without interrupting user actions
    console.debug('[Analytics] Dispatch skipped:', err)
  }
}
