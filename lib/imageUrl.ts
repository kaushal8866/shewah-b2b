/**
 * Optimizes Cloudinary image URLs by injecting automatic format (WebP/AVIF),
 * automatic quality compression, and bounded width transformations.
 * Leaves non-Cloudinary or already-transformed URLs untouched.
 */
export function optimizeCloudinaryUrl(
  rawUrl: string | null | undefined,
  maxWidth = 800
): string | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null
  const trimmed = rawUrl.trim()
  if (!trimmed) return null

  if (!trimmed.includes('res.cloudinary.com/') || !trimmed.includes('/image/upload/')) {
    return trimmed
  }

  // Avoid double-injecting transformations if already present
  const [, afterUpload] = trimmed.split('/image/upload/')
  if (!afterUpload) return trimmed
  if (afterUpload.startsWith('f_') || afterUpload.startsWith('q_') || afterUpload.startsWith('w_')) {
    return trimmed
  }

  const transform = `f_auto,q_auto,w_${maxWidth},c_limit`
  return trimmed.replace('/image/upload/', `/image/upload/${transform}/`)
}
