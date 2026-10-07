import { NextRequest, NextResponse } from 'next/server'
import { authenticateBlogRequest, checkRateLimit } from '@/lib/blog/auth'
import { updateDraftArticle } from '@/lib/blog/storage'
import { checkIdempotency, saveIdempotencyRecord } from '@/lib/blog/idempotency'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import crypto from 'crypto'

interface Params {
  params: {
    id: string
  }
}

export async function GET(req: NextRequest, { params }: Params) {
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

  const { data: article, error: articleErr } = await supabaseAdmin
    .from('blog_articles')
    .select('*')
    .eq('id', params.id)
    .single()

  if (articleErr || !article) {
    return NextResponse.json({ error: 'Article not found' }, { status: 404 })
  }

  // Fetch current working revision and live revision
  const [currentRevRes, liveRevRes, revisionsList] = await Promise.all([
    article.current_revision_id
      ? supabaseAdmin.from('blog_revisions').select('*').eq('id', article.current_revision_id).single()
      : Promise.resolve({ data: null }),
    article.live_revision_id
      ? supabaseAdmin.from('blog_revisions').select('*').eq('id', article.live_revision_id).single()
      : Promise.resolve({ data: null }),
    supabaseAdmin
      .from('blog_revisions')
      .select('id, revision_number, change_summary, created_by_actor_type, created_by_actor_id, created_at, content_hash')
      .eq('article_id', params.id)
      .order('revision_number', { ascending: false }),
  ])

  return NextResponse.json({
    article,
    currentRevision: currentRevRes.data,
    liveRevision: liveRevRes.data,
    revisionsHistory: revisionsList.data || [],
  })
}

export async function PATCH(req: NextRequest, { params }: Params) {
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
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Bad Request: Invalid JSON body' }, { status: 400 })
  }

  // If-Match or expectedLockVersion header/body
  const ifMatchHeader = req.headers.get('if-match')
  const expectedLockVersion = ifMatchHeader ? parseInt(ifMatchHeader.replace(/"/g, ''), 10) : body.expectedLockVersion

  if (typeof expectedLockVersion !== 'number' || isNaN(expectedLockVersion)) {
    return NextResponse.json(
      { error: 'Precondition Required: "If-Match" header or "expectedLockVersion" field is required for optimistic concurrency.' },
      { status: 412 }
    )
  }

  // Optional idempotency check for external automated callers
  if (idempotencyKey) {
    const idemp = await checkIdempotency(idempotencyKey, auth.actorId, `update_article_${params.id}`, body)
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
  }

  const requestId = crypto.randomUUID()

  const result = await updateDraftArticle({
    articleId: params.id,
    expectedLockVersion,
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
    changeSummary: body.changeSummary,
    actorType: auth.actorType,
    actorId: auth.actorId,
    requestId,
  })

  if (!result.success || !result.data) {
    const status =
      result.error?.code === 'CONFLICT'
        ? 409
        : result.error?.code === 'NOT_FOUND'
        ? 404
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
    lockVersion: result.data.article.lock_version,
    status: result.data.article.status,
    requestId,
  }

  if (idempotencyKey) {
    await saveIdempotencyRecord(idempotencyKey, auth.actorId, `update_article_${params.id}`, body, 200, responsePayload)
  }

  return NextResponse.json(responsePayload, { status: 200 })
}
