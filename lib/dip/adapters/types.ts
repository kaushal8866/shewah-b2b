import type { DipBrand, RawDesign } from '../types'

export interface AdapterOutput {
  designs: RawDesign[]
  /** Last HTTP status seen. Recorded on the run row for diagnosis. */
  http_status: number | null
  /**
   * Set when the catalogue was read only in part — a mid-pagination failure, or
   * the page cap being hit. The run is then `partial`, never `success`: a
   * truncated read that reports success would silently understate `launch_rate`
   * and corrupt `listing_survival` for every design past the cut.
   */
  truncated_reason: string | null
}

export interface BrandAdapter {
  platform: string
  fetch(brand: DipBrand): Promise<AdapterOutput>
}
