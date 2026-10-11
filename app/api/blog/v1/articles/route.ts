import { NextRequest, NextResponse } from 'next/server'
import { validateBlogApiAccess } from '@/lib/blog/auth'
import { createDraftArticle, getBlogSettings } from '@/lib/blog/storage'
import { checkIdempotency, saveIdempotencyRecord } from '@/lib/blog/idempotency'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import crypto from 'crypto'

export async function GET(req: NextRequest) {
  const access = await validateBlogApiAccess(req, { requiredScope: 'blog:read' })
  if (!access.authorized || !access.auth) {
    return access.response!
  }
  const auth = access.auth

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const category = searchParams.get('category')
  const search = searchParams.get('search')
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)))
  const offset = (page - 1) * limit

  let query = supabaseAdmin
    .from('blog_articles')
    .select(`
      id,
      slug,
      title,
      excerpt,
      category,
      tags,
      author_display_name,
      hero_image_url,
      reading_time_minutes,
      status,
      lock_version,
      editorial_source,
      external_content_id,
      created_at,
      updated_at,
      published_at,
      scheduled_at
    `, { count: 'exact' })

  if (status) query = query.eq('status', status)
  if (category) query = query.eq('category', category)
  if (search) query = query.ilike('title', `%${search.trim()}%`)

  query = query.order('updated_at', { ascending: false }).range(offset, offset + limit - 1)

  const { data: articles, count, error } = await query

  if (error) {
    return NextResponse.json({ error: 'Database error', details: error.message }, { status: 500 })
  }

  return NextResponse.json({
    articles: articles || [],
    pagination: {
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    },
  })
}

const FORBIDDEN_ARTICLE_PAYLOAD_KEYS = new Set([
  'status',
  'published_at',
  'scheduled_at',
  'live_revision_id',
  'is_published',
  'publish',
  'schedule',
  'permissions',
  'role',
  'scopes',
  'token',
])

export async function POST(req: NextRequest) {
  const access = await validateBlogApiAccess(req, { requiredScope: 'blog:draft:write', maxBytes: 512_000 })
  if (!access.authorized || !access.auth) {
    return access.response!
  }
  const auth = access.auth

  const idempotencyKey = req.headers.get('idempotency-key')
  if (!idempotencyKey) {
    return NextResponse.json(
      { error: 'Bad Request: "Idempotency-Key" header is required for article creation.' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    )
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { error: 'Bad Request: Invalid JSON body' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    )
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json(
      { error: 'Bad Request: Payload must be a JSON object.' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    )
  }

  for (const key of Object.keys(body)) {
    if (FORBIDDEN_ARTICLE_PAYLOAD_KEYS.has(key)) {
      return NextResponse.json(
        { error: `Forbidden field "${key}": draft creation cannot set publication status, scheduling, or permissions.` },
        { status: 422, headers: { 'Cache-Control': 'no-store' } }
      )
    }
  }

  // Idempotency check (runs before createDraftArticle so retries with same Idempotency-Key never consume a second daily slot)
  const idemp = await checkIdempotency(idempotencyKey, auth.actorId, 'create_article', body)
  if (idemp.isDuplicate) {
    if (idemp.isConflict) {
      return NextResponse.json(
        { error: 'Conflict: Idempotency-Key has already been used with different request parameters.' },
        { status: 409, headers: { 'Cache-Control': 'no-store' } }
      )
    }
    return NextResponse.json(idemp.cachedResponse?.body, {
      status: idemp.cachedResponse?.status || 200,
      headers: { 'X-Idempotent-Replay': 'true', 'Cache-Control': 'no-store' },
    })
  }

  const requestId = crypto.randomUUID()

  const result = await createDraftArticle({
    title: body.title,
    slug: body.slug,
    excerpt: body.excerpt,
    bodyMarkdown: body.bodyMarkdown,
    bodyStructured: body.bodyStructured,
    images: Array.isArray(body.images) ? body.images : undefined,
    category: body.category,
    tags: body.tags,
    authorDisplayName: body.authorDisplayName,
    heroImageUrl: body.heroImageUrl,
    heroImageAlt: body.heroImageAlt,
    heroImageCaption: body.heroImageCaption,
    heroImageRights: body.heroImageRights,
    seoTitle: body.seoTitle,
    metaDescription: body.metaDescription,
    sourceReferences: body.sourceReferences,
    editorialSource: auth.actorType === 'assistant_token' ? 'external_assistant' : 'internal',
    externalContentId: body.externalContentId,
    actorType: auth.actorType,
    actorId: auth.actorId,
    requestId,
    idempotencyKey,
  })

  if (!result.success || !result.data) {
    const status =
      result.error?.code === 'DAILY_QUOTA_EXCEEDED'
        ? 429
        : result.error?.code === 'CONFLICT'
          ? 409
          : result.error?.code === 'VALIDATION_FAILED'
            ? 422
            : result.error?.code === 'FORBIDDEN'
              ? 403
              : 500

    return NextResponse.json(
      {
        error: result.error?.message,
        code: result.error?.code,
        details: result.error?.details,
      },
      { status, headers: { 'Cache-Control': 'no-store' } }
    )
  }

  const structured = result.data.revision.body_structured as Record<string, any> | null
  const attachedImages = Array.isArray(structured?.images) ? structured.images : []

  const responsePayload = {
    success: true,
    articleId: result.data.article.id,
    slug: result.data.article.slug,
    externalContentId: result.data.article.external_content_id || null,
    revisionNumber: result.data.revision.revision_number,
    status: result.data.article.status,
    liveRevisionId: result.data.article.live_revision_id ?? null,
    lockVersion: result.data.article.lock_version,
    imagesCount: attachedImages.length,
    imagesPending: Boolean(structured?.imagesPending ?? attachedImages.length < 3),
    requestId,
  }

  await saveIdempotencyRecord(idempotencyKey, auth.actorId, 'create_article', body, 201, responsePayload)

  return NextResponse.json(responsePayload, {
    status: 201,
    headers: { 'Cache-Control': 'no-store' },
  })
}

