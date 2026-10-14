import crypto from 'crypto'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { recordBlogAudit as appendBlogAuditLog } from './audit'
import { ActorType } from './types'

export const MAX_BLOG_IMAGE_BYTES = 5 * 1024 * 1024 // 5 MB
export const PRIVATE_MEDIA_BUCKET = 'shewah-uploads'
export const PRIVATE_MEDIA_PREFIX = 'blog-draft-media'

export type AllowedImageMime = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/avif'

export interface ValidatedImageBinary {
  valid: boolean
  error?: string
  detectedMime?: AllowedImageMime
  extension?: 'jpg' | 'png' | 'webp' | 'avif'
  width?: number
  height?: number
  sha256?: string
  sanitizedBuffer?: Buffer
}

const ALLOWED_MIMES: readonly AllowedImageMime[] = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
]

/**
 * Inspects file magic-byte signatures, MIME type, size limit, and embedded script/polyglot patterns.
 * Rejects SVG, HTML, executables, disguised files, and oversized buffers.
 */
export function validateAndSanitizeImageBinary(
  buffer: Buffer,
  declaredMime: string,
  originalFilename?: string
): ValidatedImageBinary {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    return { valid: false, error: 'Image file is empty or unreadable.' }
  }

  if (buffer.length < 12) {
    return { valid: false, error: 'File is too small to be a valid image.' }
  }

  if (buffer.length > MAX_BLOG_IMAGE_BYTES) {
    return {
      valid: false,
      error: `Image exceeds maximum file size of 5 MB (${buffer.length} bytes received).`,
    }
  }

  const normalizedMime = (declaredMime || '').toLowerCase().trim()

  // Explicitly block SVG, XML, HTML, JS, or executable extensions/MIME types
  if (
    normalizedMime.includes('svg') ||
    normalizedMime.includes('xml') ||
    normalizedMime.includes('html') ||
    normalizedMime.includes('javascript') ||
    normalizedMime.includes('x-msdownload') ||
    normalizedMime.includes('x-executable') ||
    normalizedMime.includes('application/')
  ) {
    return {
      valid: false,
      error: `Disallowed MIME type "${normalizedMime}". Only JPEG, PNG, WebP, and AVIF images are permitted.`,
    }
  }

  if (originalFilename) {
    const lowerName = originalFilename.toLowerCase()
    if (
      lowerName.endsWith('.svg') ||
      lowerName.endsWith('.svgz') ||
      lowerName.endsWith('.html') ||
      lowerName.endsWith('.htm') ||
      lowerName.endsWith('.js') ||
      lowerName.endsWith('.mjs') ||
      lowerName.endsWith('.exe') ||
      lowerName.endsWith('.sh') ||
      lowerName.endsWith('.php')
    ) {
      return {
        valid: false,
        error: 'Disallowed file extension. SVG, HTML, and executable files are strictly prohibited.',
      }
    }
  }

  // Check for executable / script headers in the first 512 bytes
  const headAscii = buffer.subarray(0, Math.min(buffer.length, 512)).toString('utf8').toLowerCase()
  if (
    headAscii.includes('<svg') ||
    headAscii.includes('<?xml') ||
    headAscii.includes('<!doctype') ||
    headAscii.includes('<html') ||
    headAscii.includes('<script') ||
    (buffer[0] === 0x4d && buffer[1] === 0x5a) || // MZ Windows PE executable
    (buffer[0] === 0x7f && buffer[1] === 0x45 && buffer[2] === 0x4c && buffer[3] === 0x46) || // ELF binary
    (buffer[0] === 0x23 && buffer[1] === 0x21) // #! shebang script
  ) {
    return {
      valid: false,
      error: 'Disallowed file content: SVG, XML, HTML, or executable signatures detected.',
    }
  }

  // Scan entire binary for embedded script/event-handler polyglots
  const fullLatin1 = buffer.toString('latin1').toLowerCase()
  if (
    fullLatin1.includes('<script') ||
    fullLatin1.includes('javascript:') ||
    fullLatin1.includes('onerror=') ||
    fullLatin1.includes('onload=') ||
    fullLatin1.includes('<svg')
  ) {
    return {
      valid: false,
      error: 'Security violation: image binary contains embedded script or active markup patterns.',
    }
  }

  // Magic-byte signature detection
  let detectedMime: AllowedImageMime | null = null
  let extension: 'jpg' | 'png' | 'webp' | 'avif' | null = null

  // 1. JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    detectedMime = 'image/jpeg'
    extension = 'jpg'
  }
  // 2. PNG: 89 50 4E 47 0D 0A 1A 0A
  else if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    detectedMime = 'image/png'
    extension = 'png'
  }
  // 3. WebP: "RIFF" (0..3) + "WEBP" (8..11)
  else if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    detectedMime = 'image/webp'
    extension = 'webp'
  }
  // 4. AVIF: ISO BMFF 'ftyp' at bytes 4..7 and major/compatible brand 'avif' or 'avis'
  else if (
    buffer[4] === 0x66 &&
    buffer[5] === 0x74 &&
    buffer[6] === 0x79 &&
    buffer[7] === 0x70
  ) {
    const ftypWindow = buffer.subarray(8, Math.min(buffer.length, 32)).toString('ascii')
    if (ftypWindow.includes('avif') || ftypWindow.includes('avis')) {
      detectedMime = 'image/avif'
      extension = 'avif'
    }
  }

  if (!detectedMime || !extension) {
    return {
      valid: false,
      error: 'Unrecognized or invalid file magic-byte signature. Allowed formats: JPEG, PNG, WebP, AVIF.',
    }
  }

  // Ensure declared MIME (if provided) matches the actual magic-byte signature
  const normalizedDeclared = normalizedMime === 'image/jpg' ? 'image/jpeg' : normalizedMime
  if (normalizedDeclared && !ALLOWED_MIMES.includes(normalizedDeclared as AllowedImageMime)) {
    return {
      valid: false,
      error: `Unsupported declared MIME type "${declaredMime}". Allowed: image/jpeg, image/png, image/webp, image/avif.`,
    }
  }
  if (normalizedDeclared && normalizedDeclared !== detectedMime) {
    return {
      valid: false,
      error: `MIME type mismatch: declared "${normalizedDeclared}" does not match file magic-byte signature "${detectedMime}".`,
    }
  }

  // Sanitize metadata (strip EXIF/comments where safe) and extract dimensions
  const sanitizedBuffer = stripImageMetadata(buffer, detectedMime)
  const dimensions = extractImageDimensions(sanitizedBuffer, detectedMime)
  const sha256 = crypto.createHash('sha256').update(sanitizedBuffer).digest('hex')

  return {
    valid: true,
    detectedMime,
    extension,
    width: dimensions?.width,
    height: dimensions?.height,
    sha256,
    sanitizedBuffer,
  }
}

/**
 * Strips EXIF/APP1-APP15/COM segments from JPEG and text/EXIF chunks from PNG.
 */
export function stripImageMetadata(buffer: Buffer, mime: AllowedImageMime): Buffer {
  try {
    if (mime === 'image/jpeg') {
      // Verify SOI (FF D8)
      if (buffer[0] !== 0xff || buffer[1] !== 0xd8) return buffer
      const chunks: Buffer[] = [buffer.subarray(0, 2)]
      let offset = 2
      while (offset + 4 <= buffer.length) {
        if (buffer[offset] !== 0xff) {
          // Reached compressed data or malformed marker; copy remainder
          chunks.push(buffer.subarray(offset))
          break
        }
        const marker = buffer[offset + 1]
        // SOS (Start of Scan = DA) or EOI (D9): copy the rest of the stream
        if (marker === 0xda || marker === 0xd9) {
          chunks.push(buffer.subarray(offset))
          break
        }
        // Standalone markers without length
        if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
          chunks.push(buffer.subarray(offset, offset + 2))
          offset += 2
          continue
        }
        const segLen = buffer.readUInt16BE(offset + 2)
        if (segLen < 2 || offset + 2 + segLen > buffer.length) {
          chunks.push(buffer.subarray(offset))
          break
        }
        // Strip APP1..APP15 (E1..EF, including EXIF/XMP) and COM (FE)
        const isMetadataSegment = (marker >= 0xe1 && marker <= 0xef) || marker === 0xfe
        if (!isMetadataSegment) {
          chunks.push(buffer.subarray(offset, offset + 2 + segLen))
        }
        offset += 2 + segLen
      }
      return Buffer.concat(chunks)
    }

    if (mime === 'image/png') {
      if (buffer.length < 33) return buffer
      const chunks: Buffer[] = [buffer.subarray(0, 8)] // PNG signature
      let offset = 8
      const stripChunkTypes = new Set(['tEXt', 'zTXt', 'iTXt', 'eXIf', 'tIME'])
      while (offset + 12 <= buffer.length) {
        const length = buffer.readUInt32BE(offset)
        const type = buffer.subarray(offset + 4, offset + 8).toString('ascii')
        const totalChunkLen = 12 + length
        if (offset + totalChunkLen > buffer.length) {
          chunks.push(buffer.subarray(offset))
          break
        }
        if (!stripChunkTypes.has(type)) {
          chunks.push(buffer.subarray(offset, offset + totalChunkLen))
        }
        offset += totalChunkLen
        if (type === 'IEND') break
      }
      return Buffer.concat(chunks)
    }
  } catch {
    // Fallback to original verified buffer if stripping encounters unexpected structure
  }
  return buffer
}

/**
 * Extracts pixel width and height from PNG, JPEG, or WebP headers.
 */
export function extractImageDimensions(
  buffer: Buffer,
  mime: AllowedImageMime
): { width: number; height: number } | null {
  try {
    if (mime === 'image/png' && buffer.length >= 24) {
      const width = buffer.readUInt32BE(16)
      const height = buffer.readUInt32BE(20)
      if (width > 0 && height > 0) return { width, height }
    }

    if (mime === 'image/jpeg') {
      let offset = 2
      while (offset + 9 <= buffer.length) {
        if (buffer[offset] !== 0xff) break
        const marker = buffer[offset + 1]
        if (marker === 0xda || marker === 0xd9) break
        const segLen = buffer.readUInt16BE(offset + 2)
        if (segLen < 2 || offset + 2 + segLen > buffer.length) break
        // SOF0..SOF3, SOF5..SOF7, SOF9..SOF11, SOF13..SOF15
        if (
          (marker >= 0xc0 && marker <= 0xc3) ||
          (marker >= 0xc5 && marker <= 0xc7) ||
          (marker >= 0xc9 && marker <= 0xcb) ||
          (marker >= 0xcd && marker <= 0xcf)
        ) {
          const height = buffer.readUInt16BE(offset + 5)
          const width = buffer.readUInt16BE(offset + 7)
          if (width > 0 && height > 0) return { width, height }
        }
        offset += 2 + segLen
      }
    }

    if (mime === 'image/webp' && buffer.length >= 30) {
      const chunkHeader = buffer.subarray(12, 16).toString('ascii')
      if (chunkHeader === 'VP8 ' && buffer.length >= 30) {
        const width = buffer.readUInt16LE(26) & 0x3fff
        const height = buffer.readUInt16LE(28) & 0x3fff
        if (width > 0 && height > 0) return { width, height }
      } else if (chunkHeader === 'VP8L' && buffer.length >= 25) {
        const b0 = buffer[21]
        const b1 = buffer[22]
        const b2 = buffer[23]
        const b3 = buffer[24]
        const width = 1 + (((b1 & 0x3f) << 8) | b0)
        const height = 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6))
        if (width > 0 && height > 0) return { width, height }
      } else if (chunkHeader === 'VP8X' && buffer.length >= 30) {
        const width = 1 + buffer.readUIntLE(24, 3)
        const height = 1 + buffer.readUIntLE(27, 3)
        if (width > 0 && height > 0) return { width, height }
      }
    }
  } catch {
    // Ignore dimension parsing errors
  }
  return null
}

/**
 * Generates a safe, non-traversable object storage key and stable mediaId.
 * User-supplied filenames are NEVER interpolated into storage keys.
 */
export function generateSafeDraftMediaKey(
  extension: 'jpg' | 'png' | 'webp' | 'avif',
  options?: { now?: Date; mediaId?: string }
): { mediaId: string; storageKey: string; stableUrl: string } {
  const now = options?.now || new Date()
  const year = now.getUTCFullYear()
  const month = String(now.getUTCMonth() + 1).padStart(2, '0')
  const rawId = options?.mediaId || crypto.randomUUID()
  const safeMediaId = rawId.toLowerCase().replace(/[^a-f0-9-]/g, '')
  if (!/^[a-f0-9-]{8,64}$/.test(safeMediaId)) {
    throw new Error('Invalid media identifier generated.')
  }
  const safeExt = ['jpg', 'png', 'webp', 'avif'].includes(extension) ? extension : 'webp'
  const storageKey = `${PRIVATE_MEDIA_PREFIX}/${year}/${month}/${safeMediaId}.${safeExt}`
  const stableUrl = `/api/blog/v1/media/${safeMediaId}`
  return { mediaId: safeMediaId, storageKey, stableUrl }
}

/**
 * Validates that a storageKey or mediaId is free of path traversal or injection characters.
 */
export function isSafeMediaStorageKey(storageKey: string): boolean {
  if (!storageKey || typeof storageKey !== 'string') return false
  if (storageKey.includes('..') || storageKey.includes('\\') || storageKey.includes('\0')) return false
  return /^blog-draft-media\/\d{4}\/\d{2}\/[a-f0-9-]{8,64}\.(jpg|png|webp|avif)$/.test(storageKey)
}

export function isValidMediaId(mediaId: string): boolean {
  if (!mediaId || typeof mediaId !== 'string') return false
  return /^[a-f0-9-]{8,64}$/.test(mediaId)
}

/**
 * Uploads validated & sanitized image binary to private Supabase storage (`shewah-uploads`)
 * or reuses an existing upload when the same actor uploads identical content (SHA-256 deduplication),
 * preventing duplicate orphan files on partial draft-save failures.
 */
export async function uploadPrivateDraftMedia(params: {
  buffer: Buffer
  declaredMime: string
  originalFilename?: string
  actorType: ActorType
  actorId: string
  articleId?: string | null
  idempotencyKey?: string | null
}): Promise<{
  success: boolean
  status?: number
  error?: string
  media?: {
    mediaId: string
    storageKey: string
    stableUrl: string
    mimeType: AllowedImageMime
    sizeBytes: number
    width?: number
    height?: number
    sha256: string
    reusedExisting?: boolean
  }
}> {
  const validation = validateAndSanitizeImageBinary(
    params.buffer,
    params.declaredMime,
    params.originalFilename
  )
  if (!validation.valid || !validation.sanitizedBuffer || !validation.detectedMime || !validation.extension || !validation.sha256) {
    return {
      success: false,
      status: 400,
      error: validation.error || 'Invalid image file.',
    }
  }

  // Check if identical SHA-256 was already uploaded recently in blog_audit_logs to avoid duplicate orphan files on retry
  try {
    const { data: existingLogs } = await supabaseAdmin
      .from('blog_audit_logs')
      .select('diff_summary, payload_hash')
      .eq('operation', 'upload_media')
      .eq('outcome', 'success')
      .eq('payload_hash', validation.sha256)
      .order('created_at', { ascending: false })
      .limit(1)

    const existingSummary = existingLogs?.[0]?.diff_summary as Record<string, any> | undefined
    if (
      existingSummary?.mediaId &&
      existingSummary?.storageKey &&
      isSafeMediaStorageKey(existingSummary.storageKey)
    ) {
      return {
        success: true,
        status: 200,
        media: {
          mediaId: existingSummary.mediaId,
          storageKey: existingSummary.storageKey,
          stableUrl: `/api/blog/v1/media/${existingSummary.mediaId}`,
          mimeType: validation.detectedMime,
          sizeBytes: validation.sanitizedBuffer.length,
          width: validation.width ?? existingSummary.width,
          height: validation.height ?? existingSummary.height,
          sha256: validation.sha256,
          reusedExisting: true,
        },
      }
    }
  } catch {
    // Proceed with fresh upload if audit lookup fails
  }

  const { mediaId, storageKey, stableUrl } = generateSafeDraftMediaKey(validation.extension)

  const { error: uploadError } = await supabaseAdmin.storage
    .from(PRIVATE_MEDIA_BUCKET)
    .upload(storageKey, validation.sanitizedBuffer, {
      contentType: validation.detectedMime,
      upsert: false,
    })

  if (uploadError) {
    await appendBlogAuditLog({
      articleId: params.articleId || null,
      actorType: params.actorType,
      actorId: params.actorId,
      operation: 'upload_media',
      outcome: 'failure',
      idempotencyKey: params.idempotencyKey || null,
      payloadHash: validation.sha256,
      errorMessage: `Storage upload failed: ${uploadError.message}`,
    })
    return {
      success: false,
      status: 502,
      error: 'Failed to store private draft media.',
    }
  }

  const mediaSummary = {
    mediaId,
    storageKey,
    stableUrl,
    mimeType: validation.detectedMime,
    sizeBytes: validation.sanitizedBuffer.length,
    width: validation.width || null,
    height: validation.height || null,
    sha256: validation.sha256,
    articleId: params.articleId || null,
  }

  await appendBlogAuditLog({
    articleId: params.articleId || null,
    actorType: params.actorType,
    actorId: params.actorId,
    operation: 'upload_media',
    outcome: 'success',
    idempotencyKey: params.idempotencyKey || null,
    payloadHash: validation.sha256,
    diffSummary: mediaSummary,
  })

  return {
    success: true,
    status: 201,
    media: {
      mediaId,
      storageKey,
      stableUrl,
      mimeType: validation.detectedMime,
      sizeBytes: validation.sanitizedBuffer.length,
      width: validation.width,
      height: validation.height,
      sha256: validation.sha256,
      reusedExisting: false,
    },
  }
}

/**
 * Resolves a mediaId to its private storageKey and checks whether it is attached to a live published article.
 */
export async function lookupBlogMediaRecord(mediaId: string): Promise<{
  found: boolean
  storageKey?: string
  mimeType?: string
  isPublishedLive: boolean
}> {
  if (!isValidMediaId(mediaId)) {
    return { found: false, isPublishedLive: false }
  }

  // 1. Find storageKey from audit log and published articles in parallel
  let storageKey: string | undefined
  let mimeType: string | undefined

  const [{ data: logs }, { data: publishedArticles }] = await Promise.all([
    supabaseAdmin
      .from('blog_audit_logs')
      .select('diff_summary')
      .eq('operation', 'upload_media')
      .eq('outcome', 'success')
      .order('created_at', { ascending: false })
      .limit(200),
    supabaseAdmin
      .from('blog_articles')
      .select('id, status, live_revision_id, hero_image_url')
      .eq('status', 'published')
      .not('live_revision_id', 'is', null),
  ])

  if (Array.isArray(logs)) {
    for (const row of logs) {
      const summary = row?.diff_summary as Record<string, any> | undefined
      if (summary?.mediaId === mediaId && isSafeMediaStorageKey(summary.storageKey)) {
        storageKey = summary.storageKey
        mimeType = summary.mimeType
        break
      }
    }
  }

  // 2. Check if this mediaId is referenced by any published article's live revision
  let isPublishedLive = false

  if (Array.isArray(publishedArticles) && publishedArticles.length > 0) {
    const liveRevIds = publishedArticles
      .map((a) => a.live_revision_id)
      .filter((id): id is string => Boolean(id))

    for (const art of publishedArticles) {
      if (typeof art.hero_image_url === 'string' && art.hero_image_url.includes(mediaId)) {
        isPublishedLive = true
        break
      }
    }

    if (!isPublishedLive && liveRevIds.length > 0) {
      const { data: liveRevs } = await supabaseAdmin
        .from('blog_revisions')
        .select('id, hero_image_url, body_markdown, body_structured')
        .in('id', liveRevIds)

      if (Array.isArray(liveRevs)) {
        for (const rev of liveRevs) {
          const serialized = JSON.stringify({
            h: rev.hero_image_url,
            b: rev.body_markdown,
            s: rev.body_structured,
          })
          if (serialized.includes(mediaId)) {
            isPublishedLive = true
            if (!storageKey && Array.isArray(rev.body_structured?.images)) {
              const foundImg = rev.body_structured.images.find((img: any) => img?.mediaId === mediaId)
              if (foundImg?.storageKey && isSafeMediaStorageKey(foundImg.storageKey)) {
                storageKey = foundImg.storageKey
              }
            }
            break
          }
        }
      }
    }
  }

  // Also check draft revisions if storageKey wasn't in the last 200 audit logs
  if (!storageKey) {
    const { data: revs } = await supabaseAdmin
      .from('blog_revisions')
      .select('body_structured')
      .not('body_structured', 'is', null)
      .order('created_at', { ascending: false })
      .limit(100)

    if (Array.isArray(revs)) {
      for (const r of revs) {
        const imgs = (r.body_structured as any)?.images
        if (Array.isArray(imgs)) {
          const match = imgs.find((img: any) => img?.mediaId === mediaId)
          if (match?.storageKey && isSafeMediaStorageKey(match.storageKey)) {
            storageKey = match.storageKey
            mimeType = match.mimeType
            break
          }
        }
      }
    }
  }

  if (!storageKey) {
    return { found: false, isPublishedLive: false }
  }

  return { found: true, storageKey, mimeType, isPublishedLive }
}

/**
 * Safe Orphan Cleanup Policy:
 * - Never deletes any media referenced by ANY blog_articles or blog_revisions row (draft, in_review, scheduled, published, or archived).
 * - Never deletes any upload newer than `minAgeHours` (default 24h) so active drafting sessions cannot lose pending uploads.
 */
export async function cleanupOrphanDraftMedia(options?: {
  minAgeHours?: number
  dryRun?: boolean
  now?: Date
}): Promise<{
  scannedCount: number
  protectedCount: number
  eligibleOrphanKeys: string[]
  deletedKeys: string[]
}> {
  const minAgeHours = Math.max(1, options?.minAgeHours ?? 24)
  const dryRun = options?.dryRun ?? true
  const now = options?.now || new Date()
  const cutoffMs = now.getTime() - minAgeHours * 60 * 60 * 1000

  // 1. Collect all referenced mediaIds and storageKeys across all articles and revisions
  const protectedIdsAndKeys = new Set<string>()

  const { data: articles } = await supabaseAdmin
    .from('blog_articles')
    .select('hero_image_url')
  if (Array.isArray(articles)) {
    for (const a of articles) {
      if (typeof a.hero_image_url === 'string') {
        protectedIdsAndKeys.add(a.hero_image_url)
        const m = a.hero_image_url.match(/\/api\/blog\/v1\/media\/([a-f0-9-]+)/)
        if (m) protectedIdsAndKeys.add(m[1])
      }
    }
  }

  const { data: revisions } = await supabaseAdmin
    .from('blog_revisions')
    .select('hero_image_url, body_markdown, body_structured')
  if (Array.isArray(revisions)) {
    for (const rev of revisions) {
      if (typeof rev.hero_image_url === 'string') {
        protectedIdsAndKeys.add(rev.hero_image_url)
        const m = rev.hero_image_url.match(/\/api\/blog\/v1\/media\/([a-f0-9-]+)/)
        if (m) protectedIdsAndKeys.add(m[1])
      }
      if (typeof rev.body_markdown === 'string') {
        const matches = rev.body_markdown.matchAll(/\/api\/blog\/v1\/media\/([a-f0-9-]+)/g)
        for (const m of matches) {
          protectedIdsAndKeys.add(m[1])
        }
      }
      const imgs = (rev.body_structured as any)?.images
      if (Array.isArray(imgs)) {
        for (const img of imgs) {
          if (img?.mediaId) protectedIdsAndKeys.add(String(img.mediaId))
          if (img?.storageKey) protectedIdsAndKeys.add(String(img.storageKey))
          if (img?.url) {
            protectedIdsAndKeys.add(String(img.url))
            const m = String(img.url).match(/\/api\/blog\/v1\/media\/([a-f0-9-]+)/)
            if (m) protectedIdsAndKeys.add(m[1])
          }
        }
      }
    }
  }

  // 2. Scan upload_media audit logs to find unattached uploads older than cutoffMs
  const { data: uploadLogs } = await supabaseAdmin
    .from('blog_audit_logs')
    .select('diff_summary, created_at')
    .eq('operation', 'upload_media')
    .eq('outcome', 'success')

  const eligibleOrphanKeys: string[] = []
  let scannedCount = 0
  let protectedCount = 0

  if (Array.isArray(uploadLogs)) {
    for (const log of uploadLogs) {
      const summary = log?.diff_summary as Record<string, any> | undefined
      const mediaId = summary?.mediaId
      const storageKey = summary?.storageKey
      if (!mediaId || !storageKey || !isSafeMediaStorageKey(storageKey)) continue
      scannedCount++

      const createdAtMs = new Date(log.created_at).getTime()
      const isReferenced =
        protectedIdsAndKeys.has(mediaId) ||
        protectedIdsAndKeys.has(storageKey) ||
        protectedIdsAndKeys.has(`/api/blog/v1/media/${mediaId}`)

      if (isReferenced || createdAtMs > cutoffMs) {
        protectedCount++
        continue
      }

      if (!eligibleOrphanKeys.includes(storageKey)) {
        eligibleOrphanKeys.push(storageKey)
      }
    }
  }

  const deletedKeys: string[] = []
  if (!dryRun && eligibleOrphanKeys.length > 0) {
    const { error } = await supabaseAdmin.storage
      .from(PRIVATE_MEDIA_BUCKET)
      .remove(eligibleOrphanKeys)
    if (!error) {
      deletedKeys.push(...eligibleOrphanKeys)
    }
  }

  return {
    scannedCount,
    protectedCount,
    eligibleOrphanKeys,
    deletedKeys,
  }
}
