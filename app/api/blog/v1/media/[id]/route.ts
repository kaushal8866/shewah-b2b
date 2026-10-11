import { NextRequest, NextResponse } from 'next/server'
import { validateBlogApiAccess } from '@/lib/blog/auth'
import {
  isValidMediaId,
  lookupBlogMediaRecord,
  PRIVATE_MEDIA_BUCKET,
} from '@/lib/blog/media'
import { containsCredentialOrSignedUrlLeak } from '@/lib/blog/safety'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'

interface Params {
  params: {
    id: string
  }
}

export async function GET(req: NextRequest, { params }: Params) {
  // Never allow bearer tokens or credentials in image URLs / query strings
  const fullUrl = req.url || ''
  if (containsCredentialOrSignedUrlLeak(fullUrl).leaked || req.nextUrl.searchParams.has('token')) {
    return NextResponse.json(
      { error: 'Bearer tokens and signed credentials are forbidden in media URLs.' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    )
  }

  const mediaId = (params?.id || '').trim().toLowerCase()
  if (!isValidMediaId(mediaId)) {
    return NextResponse.json(
      { error: 'Invalid media identifier.' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    )
  }

  const record = await lookupBlogMediaRecord(mediaId)
  if (!record.found || !record.storageKey) {
    return NextResponse.json(
      { error: 'Media asset not found.' },
      { status: 404, headers: { 'Cache-Control': 'no-store' } }
    )
  }

  // Unapproved draft media is strictly private: requires owner session or valid bearer token
  if (!record.isPublishedLive) {
    const access = await validateBlogApiAccess(req, { requiredScope: 'blog:read' })
    if (!access.authorized || !access.auth) {
      return (
        access.response ||
        NextResponse.json(
          { error: 'Unauthorized: Unapproved draft media requires owner or draft-reader authentication.' },
          { status: 401, headers: { 'Cache-Control': 'no-store' } }
        )
      )
    }
  }

  const { data: blob, error } = await supabaseAdmin.storage
    .from(PRIVATE_MEDIA_BUCKET)
    .download(record.storageKey)

  if (error || !blob) {
    return NextResponse.json(
      { error: 'Failed to retrieve media binary.' },
      { status: 404, headers: { 'Cache-Control': 'no-store' } }
    )
  }

  const arrayBuffer = await blob.arrayBuffer()
  const contentType = record.mimeType || blob.type || 'image/webp'

  return new NextResponse(Buffer.from(arrayBuffer), {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
      'Cache-Control': record.isPublishedLive
        ? 'public, max-age=86400, stale-while-revalidate=604800'
        : 'private, no-store, no-cache, must-revalidate',
    },
  })
}
