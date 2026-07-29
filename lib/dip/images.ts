/**
 * Product image URLs, sized for use.
 *
 * ONE definition, shared by the extractor, the gold set and the verification
 * sheet — they must send identical bytes or the human is judging a different
 * image from the one the model saw.
 *
 * MEASURED on a real Shopify PNG (28 Jul 2026):
 *
 *   original                1,359 KB
 *   &width=800                805 KB
 *   &width=500                333 KB
 *   &width=500&format=jpg      36 KB   <-- 22x smaller than width alone
 *
 * `width` alone barely helps because these are PNGs: the pixels shrink but the
 * lossless encoding does not. `format=jpg` is what actually reduces the
 * payload, and it was worth finding — the extractor had been sending ~800 KB
 * per image to Gemini, which inflated token counts, cost, and consumption of
 * the free-tier daily quota that kept halting the pilot.
 *
 * 600px is comfortably enough for the model to read a setting; the constraint
 * on this task is image content, not resolution — many primaries are lifestyle
 * shots where the detail is absent at any size.
 */

const WIDTH = 600

/** The image variant string recorded on an extraction run, for reproducibility. */
export const IMAGE_VARIANT = `width=${WIDTH}&format=jpg`

export function sizedImageUrl(url: string): string {
  if (!url.includes('cdn.shopify.com') && !url.includes('/cdn/shop/')) return url
  const sep = url.includes('?') ? '&' : '?'
  return `${url}${sep}width=${WIDTH}&format=jpg`
}
