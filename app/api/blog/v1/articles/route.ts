import { NextRequest, NextResponse } from 'next/server'
import { authenticateBlogRequest, checkRateLimit } from '@/lib/blog/auth'
import { createDraftArticle, getBlogSettings } from '@/lib/blog/storage'
import { checkIdempotency, saveIdempotencyRecord } from '@/lib/blog/idempotency'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import crypto from 'crypto'

export async function GET(req: NextRequest) {
  const auth = await authenticateBlogRequest(req)
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!auth.scopes.includes('blog:read')) {
    return NextResponse.json({ error: 'Forbidden: Missing "blog:read" scope' }, { status: 403 })
  }

  if (!checkRateLimit(auth.actorId)) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
  }

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

export async function POST(req: NextRequest) {
  const auth = await authenticateBlogRequest(req)
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!auth.scopes.includes('blog:draft:write')) {
    return NextResponse.json({ error: 'Forbidden: Missing "blog:draft:write" scope' }, { status: 403 })
  }

  if (!checkRateLimit(auth.actorId)) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
  }

  const idempotencyKey = req.headers.get('idempotency-key')
  if (!idempotencyKey) {
    return NextResponse.json(
      { error: 'Bad Request: "Idempotency-Key" header is required for article creation.' },
      { status: 400 }
    )
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Bad Request: Invalid JSON body' }, { status: 400 })
  }

  // Idempotency check
  const idemp = await checkIdempotency(idempotencyKey, auth.actorId, 'create_article', body)
  if (idemp.isDuplicate) {
    if (idemp.isConflict) {
      return NextResponse.json(
        { error: 'Conflict: Idempotency-Key has already been used with different request parameters.' },
        { status: 409 }
      )
    }
    return NextResponse.json(idemp.cachedResponse?.body, {
      status: idemp.cachedResponse?.status || 200,
      headers: { 'X-Idempotent-Replay': 'true' },
    })
  }

  const requestId = crypto.randomUUID()

  const result = await createDraftArticle({
    title: body.title,
    slug: body.slug,
    excerpt: body.excerpt,
    bodyMarkdown: body.bodyMarkdown,
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
      result.error?.code === 'CONFLICT'
        ? 409
        : result.error?.code === 'VALIDATION_FAILED'
        ? 422
        : result.error?.code === 'FORBIDDEN'
        ? 403
        : 500

    return NextResponse.json({ error: result.error?.message, details: result.error?.details }, { status })
  }

  const responsePayload = {
    success: true,
    articleId: result.data.article.id,
    slug: result.data.article.slug,
    revisionNumber: result.data.revision.revision_number,
    status: result.data.article.status,
    lockVersion: result.data.article.lock_version,
    requestId,
  }

  await saveIdempotencyRecord(idempotencyKey, auth.actorId, 'create_article', body, 201, responsePayload)

  return NextResponse.json(responsePayload, { status: 201 })
}
