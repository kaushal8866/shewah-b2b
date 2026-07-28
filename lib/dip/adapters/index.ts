import type { DipPlatform } from '../types'
import type { BrandAdapter } from './types'
import { shopifyAdapter } from './shopify'

/**
 * Adapter lookup by platform.
 *
 * 'crawlee' lands here in slice 2, for the ~15 watchlist brands that 404 or 403
 * a plain fetch. Those rows are seeded `is_active=false` so the gap is visible
 * in the data rather than only in a document.
 */
const ADAPTERS: Partial<Record<DipPlatform, BrandAdapter>> = {
  shopify: shopifyAdapter,
}

export function getAdapter(platform: DipPlatform): BrandAdapter | null {
  return ADAPTERS[platform] ?? null
}

export type { BrandAdapter, AdapterOutput } from './types'
