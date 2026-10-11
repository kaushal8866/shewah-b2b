import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { validateBlogApiAccess } from '@/lib/blog/auth'
import {
  validateUrlSafety,
  validateHeroMediaSafety,
  containsCredentialOrSignedUrlLeak,
} from '@/lib/blog/safety'
import { recordBlogAudit } from '@/lib/blog/audit'
import {
  MAX_BLOG_IMAGE_BYTES,
  uploadPrivateDraftMedia,
} from '@/lib/blog/media'
import { AI_ILLUSTRATION_DISCLAIMER, BlogMediaSourceType, BlogMediaPlacement } from '@/lib/blog/types'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST(req: NextRequest) {
  // Validate token authenticity, expiry, revocation, rate limit, and global automation pause
  const access = await validateBlogApiAccess(req, {
    maxBytes: MAX_BLOG_IMAGE_BYTES + 256_000, // allow multipart headers around 5 MB binary
  })
  if (!access.authorized || !access.auth) {
    return access.response!
  }
  const auth = access.auth

  // Enforce scope: requires blog:draft:write (which covers draft media in the documented draft model)
  // or explicit blog:image:upload, or owner session.
  const canUploadDraftMedia =
    auth.isOwner ||
    auth.scopes.includes('blog:draft:write') ||
    auth.scopes.includes('blog:image:upload')

  if (!canUploadDraftMedia) {
    return NextResponse.json(
      {
        error: 'Forbidden: Missing required scope "blog:draft:write" or "blog:image:upload".',
        currentScopes: auth.scopes,
      },
      { status: 403, headers: { 'Cache-Control': 'no-store' } }
    )
  }

  const contentType = req.headers.get('content-type') || ''
  const requestId = crypto.randomUUID()
  const idempotencyKey = req.headers.get('idempotency-key')

  // ── Mode A: JSON Asset Registration & Pre-Flight Validation ────────────────
  if (contentType.includes('application/json')) {
    let body: any
    try {
      body = await req.json()
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON payload.' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      )
    }

    const { url, altText, rightsNote, caption, sourceType, width, height } = body

    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { error: 'Asset "url" is required.' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      )
    }

    const leakCheck = containsCredentialOrSignedUrlLeak(url)
    if (leakCheck.leaked) {
      return NextResponse.json(
        { error: leakCheck.reason },
        { status: 422, headers: { 'Cache-Control': 'no-store' } }
      )
    }

    // SSRF & Protocol Safety Check
    const urlCheck = validateUrlSafety(url)
    if (!urlCheck.safe) {
      await recordBlogAudit({
        actorType: auth.actorType,
        actorId: auth.actorId,
        operation: 'upload_media',
        outcome: 'failure',
        requestId,
        errorMessage: `SSRF Blocked: ${urlCheck.reason}`,
      })

      return NextResponse.json(
        { error: 'Unsafe image URL destination', details: urlCheck.reason },
        { status: 422, headers: { 'Cache-Control': 'no-store' } }
      )
    }

    // Media metadata validation
    const violations = validateHeroMediaSafety({
      url,
      altText,
      rightsNote,
      caption,
      width: typeof width === 'number' ? width : undefined,
      height: typeof height === 'number' ? height : undefined,
    })

    const blockers = violations.filter((v) => v.severity === 'blocker')
    if (blockers.length > 0) {
      return NextResponse.json(
        {
          error: 'Media validation failed',
          blockers: blockers.map((b) => b.message),
        },
        { status: 422, headers: { 'Cache-Control': 'no-store' } }
      )
    }

    const mediaId = `ext-${crypto.createHash('sha256').update(url).digest('hex').slice(0, 24)}`

    await recordBlogAudit({
      actorType: auth.actorType,
      actorId: auth.actorId,
      operation: 'upload_media',
      outcome: 'success',
      requestId,
      diffSummary: { action: 'registered_asset_url', mediaId, url, altText, sourceType },
    })

    return NextResponse.json(
      {
        success: true,
        mediaId,
        url,
        stableUrl: url,
        altText: altText || null,
        rightsNote: rightsNote || null,
        caption: caption || null,
        sourceType: sourceType || 'studio_photography',
        requestId,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  }

  // ── Mode B: Multipart First-Party Private Draft Media Upload ───────────────
  if (contentType.includes('multipart/form-data')) {
    let formData: FormData
    try {
      formData = await req.formData()
    } catch {
      return NextResponse.json(
        { error: 'Invalid multipart form data.' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      )
    }

    const file = formData.get('file')
    if (!file || typeof (file as any).arrayBuffer !== 'function') {
      return NextResponse.json(
        { error: 'No image file provided in "file" field.' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      )
    }

    const fileObj = file as File
    if (fileObj.size > MAX_BLOG_IMAGE_BYTES) {
      return NextResponse.json(
        {
          error: `File size exceeds 5 MB limit (received ${(fileObj.size / (1024 * 1024)).toFixed(2)} MB).`,
        },
        { status: 413, headers: { 'Cache-Control': 'no-store' } }
      )
    }

    const altText = ((formData.get('alt_text') || formData.get('altText')) as string | null)?.trim() || ''
    const rawCaption = ((formData.get('caption') as string | null) || '').trim()
    const rightsNote = ((formData.get('rights_note') || formData.get('rightsNote')) as string | null)?.trim() || ''
    const rawSourceType = ((formData.get('source_type') || formData.get('sourceType')) as string | null)?.trim() || 'ai_illustration'
    const sourceType: BlogMediaSourceType =
      rawSourceType === 'catalogue_product' || rawSourceType === 'studio_photography'
        ? rawSourceType
        : 'ai_illustration'

    const rawPosition = ((formData.get('position') as string | null) || 'after_section_1').trim() as BlogMediaPlacement
    const isHero = formData.get('is_hero') === 'true' || formData.get('isHero') === 'true'
    const articleId = ((formData.get('article_id') || formData.get('articleId')) as string | null)?.trim() || null

    const caption =
      sourceType === 'ai_illustration' && !rawCaption.toLowerCase().includes('ai-generated illustration')
        ? rawCaption
          ? `${rawCaption} — ${AI_ILLUSTRATION_DISCLAIMER}`
          : AI_ILLUSTRATION_DISCLAIMER
        : rawCaption

    const arrayBuffer = await fileObj.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const uploadResult = await uploadPrivateDraftMedia({
      buffer,
      declaredMime: fileObj.type || '',
      originalFilename: fileObj.name || '',
      actorType: auth.actorType,
      actorId: auth.actorId,
      articleId,
      idempotencyKey,
    })

    if (!uploadResult.success || !uploadResult.media) {
      return NextResponse.json(
        { error: uploadResult.error || 'Media upload validation failed.' },
        { status: uploadResult.status || 400, headers: { 'Cache-Control': 'no-store' } }
      )
    }

    const m = uploadResult.media
    return NextResponse.json(
      {
        success: true,
        mediaId: m.mediaId,
        storageKey: m.storageKey,
        url: m.stableUrl,
        stableUrl: m.stableUrl,
        mimeType: m.mimeType,
        sizeBytes: m.sizeBytes,
        width: m.width || null,
        height: m.height || null,
        sha256: m.sha256,
        reusedExisting: Boolean(m.reusedExisting),
        altText: altText || null,
        caption: caption || null,
        rightsNote:
          rightsNote ||
          (sourceType === 'ai_illustration'
            ? 'SHEWAH Editorial Concept Illustration (Non-Catalogue)'
            : '© SHEWAH Atelier'),
        sourceType,
        position: rawPosition,
        isHero,
        isPrivateDraftMedia: true,
        requestId,
      },
      {
        status: m.reusedExisting ? 200 : 201,
        headers: { 'Cache-Control': 'no-store' },
      }
    )
  }

  return NextResponse.json(
    { error: 'Unsupported Content-Type. Use multipart/form-data or application/json.' },
    { status: 415, headers: { 'Cache-Control': 'no-store' } }
  )
}
