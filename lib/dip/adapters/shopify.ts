import { fetchJson } from '../http'
import type { DipBrand, RawDesign } from '../types'
import type { AdapterOutput, BrandAdapter } from './types'

/**
 * Shopify storefronts, via the public /products.json endpoint.
 *
 * Verified 28 Jul 2026 against giva.co, limelightdiamonds.com and starkle.in.
 * robots.txt on all three permits it — the disallows are /cart, /checkout,
 * /account, /admin and filtered collection URLs.
 *
 * Most of the watchlist is NOT Shopify: BlueStone, CaratLane, Melorra, Angara,
 * Vrai, Cullen and Moi Moi all 404 here, and Brilliant Earth and Clean Origin
 * return 403. Those need the Crawlee adapter (slice 2), not this one.
 */

const PAGE_SIZE = 250       // Shopify's maximum
const MAX_PAGES = 60        // 15,000 designs; a guard against a pagination loop

/** Shape of the parts of the payload we rely on. Everything else lands in `raw`. */
interface ShopifyVariant {
  price?: string | number | null
  compare_at_price?: string | number | null
  available?: boolean
  grams?: number | null
}

interface ShopifyProduct {
  id?: number | string
  handle?: string
  title?: string
  product_type?: string
  tags?: string[] | string
  images?: Array<{ src?: string }>
  variants?: ShopifyVariant[]
}

/**
 * Shopify sends prices as strings ("5199.00"). Parse defensively: a NaN that
 * reaches the database becomes a null price forever, and nothing downstream can
 * tell that apart from a genuinely unpriced item.
 */
function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null

  const stripped = String(value).replace(/[^0-9.\-]/g, '')
  // Number('') is 0, not NaN. Without this check a "Price on request" listing
  // enters the corpus at zero and silently drags down every price statistic
  // computed from it — worse than having no row at all.
  if (!/\d/.test(stripped)) return null

  const n = Number(stripped)
  return Number.isFinite(n) ? n : null
}

/**
 * Normalise one product. Returns null for anything unusable rather than
 * throwing — one malformed product must not cost us the other 2,000.
 */
export function normaliseProduct(
  product: ShopifyProduct,
  baseUrl: string,
): RawDesign | null {
  // Identity is non-negotiable. Without a stable id we cannot match this design
  // across snapshots, which is the entire point of the corpus.
  const externalId = product?.id === 0 || product?.id ? String(product.id) : null
  if (!externalId) return null

  const title = typeof product.title === 'string' ? product.title.trim() : ''
  if (!title) return null

  const variants = Array.isArray(product.variants) ? product.variants : []

  // Lowest listed price across variants — the entry price is what a shopper
  // compares, and it is the figure that stays meaningful when a merchant adds
  // or removes carat options between snapshots.
  const prices = variants.map(v => toNumber(v?.price)).filter((n): n is number => n !== null)
  const priceLocal = prices.length > 0 ? Math.min(...prices) : null

  // Take compare_at from the variant that set the lowest price, so the discount
  // flag describes the same item as the price rather than a different variant.
  const cheapest = prices.length > 0
    ? variants.find(v => toNumber(v?.price) === priceLocal)
    : undefined
  const compareAt = toNumber(cheapest?.compare_at_price)

  // A design is available if ANY variant is. Shopify marks each separately, and
  // one sold-out ring size does not mean the design is out of stock — treating
  // it as such would produce phantom restock transitions every week.
  const available = variants.some(v => v?.available === true)

  const grams = toNumber(cheapest?.grams)

  const tags = Array.isArray(product.tags)
    ? product.tags.filter((t): t is string => typeof t === 'string')
    : typeof product.tags === 'string'
      ? product.tags.split(',').map(t => t.trim()).filter(Boolean)
      : []

  const imageUrls = Array.isArray(product.images)
    ? product.images
        .map(img => img?.src)
        .filter((s): s is string => typeof s === 'string' && s.length > 0)
    : []

  const handle = typeof product.handle === 'string' && product.handle ? product.handle : null

  return {
    external_id: externalId,
    handle,
    title,
    product_type: typeof product.product_type === 'string' && product.product_type
      ? product.product_type
      : null,
    source_url: handle
      ? `${baseUrl.replace(/\/$/, '')}/products/${handle}`
      : baseUrl,
    price_local: priceLocal,
    // Shopify's products.json does not carry a currency code. It is the
    // storefront's own, so it is recorded per brand rather than guessed here.
    currency: '',
    compare_at_price: compareAt,
    available,
    variant_count: variants.length,
    grams,
    tags,
    image_urls: imageUrls,
    raw: trimRaw(product),
  }
}

/**
 * Reduce a product to what is worth keeping forever.
 *
 * Measured 28 Jul 2026: a Limelight product is 130 KB, of which **96% is the
 * variants array** — 99 near-identical objects, one per size × carat
 * combination. Kept verbatim every week that is 6.5 GB/year across three
 * brands, against a 500 MB database.
 *
 * The variants are not discarded blindly: everything the corpus reads from them
 * (price floor and ceiling, availability, weight, ladder width) is summarised
 * first. What's dropped is 99 repetitions of the same design.
 */
export function trimRaw(product: ShopifyProduct): Record<string, unknown> {
  const { variants, ...rest } = product ?? {}
  const list = Array.isArray(variants) ? variants : []
  const prices = list.map(v => toNumber(v?.price)).filter((n): n is number => n !== null)

  return {
    ...rest,
    // A summary, not the array. Preserves the price ladder — how wide a range
    // one design spans is itself a signal — without the repetition.
    variant_summary: {
      count: list.length,
      available_count: list.filter(v => v?.available === true).length,
      price_min: prices.length ? Math.min(...prices) : null,
      price_max: prices.length ? Math.max(...prices) : null,
      grams_min: (() => {
        const g = list.map(v => toNumber(v?.grams)).filter((n): n is number => n !== null)
        return g.length ? Math.min(...g) : null
      })(),
    },
  }
}

/** Currency by market. products.json omits it; the storefront's own applies. */
function currencyForMarket(market: DipBrand['market']): string {
  switch (market) {
    case 'IN': return 'INR'
    case 'AU': return 'AUD'
    case 'US': return 'USD'
  }
}

export const shopifyAdapter: BrandAdapter = {
  platform: 'shopify',

  async fetch(brand: DipBrand): Promise<AdapterOutput> {
    const base = brand.base_url.replace(/\/$/, '')
    const currency = currencyForMarket(brand.market)

    const designs: RawDesign[] = []
    const seen = new Set<string>()
    const skippedPages: number[] = []
    let httpStatus: number | null = null
    let truncated: string | null = null

    for (let page = 1; page <= MAX_PAGES; page++) {
      const url = `${base}/products.json?limit=${PAGE_SIZE}&page=${page}`
      const res = await fetchJson<{ products?: ShopifyProduct[] }>(url)
      httpStatus = res.status

      if (!res.ok) {
        // Page 1 failing means the brand is unreadable — a hard failure the
        // caller reports.
        if (page === 1) {
          throw new Error(`products.json failed: ${res.error ?? `HTTP ${res.status}`}`)
        }
        // A later page failing does NOT mean the catalogue ends there.
        // Observed live: limelightdiamonds.com 500s on page 9 while pages 8 and
        // 10 both serve 250 products. Stopping cost 3,500 designs and reported
        // it as a mere truncation. Skip the bad page, record the gap, continue.
        skippedPages.push(page)
        if (skippedPages.length > 5) {
          truncated = `gave up after ${skippedPages.length} failed pages (${skippedPages.join(', ')})`
          break
        }
        continue
      }

      const products = Array.isArray(res.data?.products) ? res.data!.products! : []
      if (products.length === 0) break

      for (const product of products) {
        const design = normaliseProduct(product, base)
        if (!design) continue
        // Shopify paginates by offset; a concurrent catalogue edit can shift
        // items and repeat one across pages. Deduplicate on identity.
        if (seen.has(design.external_id)) continue
        seen.add(design.external_id)
        designs.push({ ...design, currency })
      }

      if (products.length < PAGE_SIZE) break

      if (page === MAX_PAGES) {
        truncated = `hit the ${MAX_PAGES}-page cap (${MAX_PAGES * PAGE_SIZE} designs)`
      }
    }

    // A page we could not read is a hole in this week's catalogue. Say so: a
    // silent gap looks exactly like a competitor delisting 250 designs, which
    // is precisely the kind of false signal the corpus exists to avoid.
    if (skippedPages.length > 0 && !truncated) {
      truncated = `skipped ${skippedPages.length} unreadable page(s): ${skippedPages.join(', ')}`
    }

    return { designs, http_status: httpStatus, truncated_reason: truncated }
  },
}
