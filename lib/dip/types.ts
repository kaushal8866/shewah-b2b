/**
 * Design Intelligence Platform — corpus types (L0/L1).
 *
 * The DIP corpus is deliberately separate from the operational app. Its unit is
 * the competitor *design* observed over time, not anything Shewah sells. The
 * whole value is time-depth: a snapshot taken today cannot be taken again next
 * year, so ingest correctness matters more here than almost anywhere else in
 * the codebase — a week written wrong is a week lost.
 */

export type DipMarket = 'IN' | 'AU' | 'US'

/** How a brand's catalogue is read. Determines which adapter runs. */
export type DipPlatform = 'shopify' | 'crawlee' | 'manual'

/**
 * Whether a brand's output is comparable to Shewah's, or reference only.
 *
 * Matters because the spec excludes silver and moissanite as *product* while
 * permitting them as design reference. GIVA, for instance, is predominantly 925
 * silver — useful for silhouette and motif signal, misleading if its volume is
 * allowed to dominate a demand count.
 */
export type DipProductFocus = 'lgd_gold' | 'silver' | 'mixed'

export interface DipBrand {
  id: string
  name: string
  market: DipMarket
  platform: DipPlatform
  base_url: string
  is_active: boolean
  product_focus: DipProductFocus
  notes: string | null
}

/**
 * One design as an adapter returns it, before it touches the database.
 *
 * `external_id` is the identity anchor. For Shopify it is the numeric product
 * id, which is stable across retitles and relistings — this is what stops a
 * relisted SKU registering as a new launch and inflating `launch_rate`. Adapters
 * without a stable id must synthesise one deterministically and say so.
 */
export interface RawDesign {
  external_id: string
  handle: string | null
  title: string
  product_type: string | null
  source_url: string

  /** Lowest variant price, as listed. Null when no variant carries one. */
  price_local: number | null
  currency: string
  /** Shopify's strike-through price. Its presence is the discount signal. */
  compare_at_price: number | null
  available: boolean
  variant_count: number
  /** Metal weight in grams where the merchant publishes it. Feeds cost teardown. */
  grams: number | null

  tags: string[]
  image_urls: string[]

  /**
   * The untouched source object.
   *
   * Not redundant with the columns above. Extractors get versioned and re-run
   * against history (spec L2), and last week cannot be re-fetched — so the only
   * way to fix an extraction bug retroactively is to have kept the input.
   */
  raw: unknown
}

/** Outcome of one brand's ingest. Mirrors a `dip_ingest_runs` row. */
export interface IngestResult {
  brand_id: string
  brand_name: string
  status: 'success' | 'failed' | 'partial'
  http_status: number | null
  designs_seen: number
  designs_new: number
  snapshots_written: number
  error: string | null
  started_at: string
  finished_at: string
}
