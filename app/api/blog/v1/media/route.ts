import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { validateBlogApiAccess } from '@/lib/blog/auth'
import { validateUrlSafety, validateHeroMediaSafety } from '@/lib/blog/safety'
import { recordBlogAudit } from '@/lib/blog/audit'

export const runtime = 'nodejs'
export const maxDuration = 30

const MAX_IMAGE_BYTES = 5 * 1024 * 1024 // 5 MB
const ALLOWED_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
const ALLOWED_EXTS = new Set(['jpg', 'jpeg', 'png', 'webp', 'avif'])

export async function POST(req: NextRequest) {
  const access = await validateBlogApiAccess(req, {
    requiredScope: 'blog:media:upload',
    maxBytes: MAX_IMAGE_BYTES,
  })
  if (!access.authorized || !access.auth) {
    return access.response!
  }
  const auth = access.auth

  const contentType = req.headers.get('content-type') || ''
  const requestId = crypto.randomUUID()

  // ── Mode A: JSON Asset Registration & Pre-Flight Validation ────────────────
  if (contentType.includes('application/json')) {
    let body: any
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload.' }, { status: 400 })
    }

    const { url, altText, rightsNote, caption, width, height } = body

    if (!url) {
      return NextResponse.json({ error: 'Asset "url" is required.' }, { status: 400 })
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
        { status: 422 }
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
        { status: 422 }
      )
    }

    await recordBlogAudit({
      actorType: auth.actorType,
      actorId: auth.actorId,
      operation: 'upload_media',
      outcome: 'success',
      requestId,
      diffSummary: { action: 'registered_asset_url', url, altText },
    })

    return NextResponse.json({
      success: true,
      url,
      altText: altText || null,
      rightsNote: rightsNote || null,
      caption: caption || null,
      requestId,
    })
  }

  // ── Mode B: Multipart Form Upload ──────────────────────────────────────────
  if (contentType.includes('multipart/form-data')) {
    let formData: FormData
    try {
      formData = await req.formData()
    } catch {
      return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
    }

    const file = formData.get('file')
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'No image file provided.' }, { status: 400 })
    }

    const altText = (formData.get('alt_text') as string | null) || null
    const rightsNote = (formData.get('rights_note') as string | null) || null
    const caption = (formData.get('caption') as string | null) || null

    // Check size limit
    if (file.size > MAX_IMAGE_BYTES) {
      return NextResponse.json(
        { error: `File size exceeds 5 MB limit (received ${(file.size / (1024 * 1024)).toFixed(1)} MB).` },
        { status: 413 }
      )
    }

    // Check MIME type
    if (!ALLOWED_MIMES.has(file.type.toLowerCase())) {
      return NextResponse.json(
        { error: `File type "${file.type}" is not an allowed image format (JPEG, PNG, WebP, AVIF).` },
        { status: 415 }
      )
    }

    // Check file extension
    const ext = (file.name.split('.').pop() || '').toLowerCase()
    if (!ALLOWED_EXTS.has(ext)) {
      return NextResponse.json(
        { error: `File extension .${ext} is not allowed.` },
        { status: 415 }
      )
    }

    // Cloudinary upload with isolated folder 'shewah_blog' and unique asset ID
    const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
    const UPLOAD_PRESET = process.env.CLOUDINARY_UPLOAD_PRESET || process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET

    if (!CLOUD_NAME || !UPLOAD_PRESET) {
      return NextResponse.json(
        { error: 'Media storage is not configured on this environment.' },
        { status: 500 }
      )
    }

    const isolatedPublicId = `shewah_blog/blog_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`

    const uploadData = new FormData()
    uploadData.append('file', file)
    uploadData.append('upload_preset', UPLOAD_PRESET)
    uploadData.append('public_id', isolatedPublicId)
    uploadData.append('folder', 'shewah_blog')
    // Disallow overwriting existing assets
    uploadData.append('overwrite', 'false')

    let uploadRes: Response
    try {
      uploadRes = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
        { method: 'POST', body: uploadData }
      )
    } catch (e: any) {
      await recordBlogAudit({
        actorType: auth.actorType,
        actorId: auth.actorId,
        operation: 'upload_media',
        outcome: 'failure',
        requestId,
        errorMessage: `Storage network error: ${e?.message || e}`,
      })
      return NextResponse.json({ error: 'Could not contact media storage server.' }, { status: 502 })
    }

    if (!uploadRes.ok) {
      const errJson = await uploadRes.json().catch(() => ({}))
      const msg = (errJson as any)?.error?.message || `Upload failed with status ${uploadRes.status}`
      await recordBlogAudit({
        actorType: auth.actorType,
        actorId: auth.actorId,
        operation: 'upload_media',
        outcome: 'failure',
        requestId,
        errorMessage: msg,
      })
      return NextResponse.json({ error: msg }, { status: 502 })
    }

    const uploaded = await uploadRes.json()
    const secureUrl = uploaded.secure_url

    await recordBlogAudit({
      actorType: auth.actorType,
      actorId: auth.actorId,
      operation: 'upload_media',
      outcome: 'success',
      requestId,
      diffSummary: {
        publicId: uploaded.public_id,
        bytes: uploaded.bytes,
        format: uploaded.format,
        width: uploaded.width,
        height: uploaded.height,
      },
    })

    return NextResponse.json({
      success: true,
      url: secureUrl,
      publicId: uploaded.public_id,
      format: uploaded.format,
      width: uploaded.width,
      height: uploaded.height,
      altText: altText || null,
      rightsNote: rightsNote || null,
      caption: caption || null,
      requestId,
    }, { status: 201 })
  }

  return NextResponse.json({ error: 'Unsupported Content-Type.' }, { status: 415 })
}
