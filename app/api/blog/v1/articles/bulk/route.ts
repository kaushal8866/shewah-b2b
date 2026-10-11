import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import crypto from 'crypto'
import { validateBlogApiAccess } from '@/lib/blog/auth'
import { executeBulkArticleAction } from '@/lib/blog/storage'
import type { BulkArticleAction } from '@/lib/blog/types'

const ALLOWED_BULK_ACTIONS = new Set<BulkArticleAction>([
  'publish',
  'unpublish',
  'set_draft',
  'set_in_review',
  'archive',
  'delete',
])

export async function POST(req: NextRequest) {
  // Strictly owner-only: assistant tokens cannot run bulk publish/unpublish/delete/archive operations
  const access = await validateBlogApiAccess(req, { requireOwner: true, maxBytes: 64_000 })
  if (!access.authorized || !access.auth) {
    return access.response!
  }
  const auth = access.auth

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { error: 'Bad Request: Invalid JSON body' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    )
  }

  const action = String(body?.action || '').trim() as BulkArticleAction
  const articleIds = Array.isArray(body?.articleIds) ? body.articleIds : []

  if (!ALLOWED_BULK_ACTIONS.has(action)) {
    return NextResponse.json(
      {
        error: `Unsupported bulk action "${action}". Allowed actions: publish, unpublish, set_draft, set_in_review, archive, delete.`,
      },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    )
  }

  if (articleIds.length === 0 || articleIds.length > 50) {
    return NextResponse.json(
      { error: 'Please select between 1 and 50 articles for a bulk action.' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    )
  }

  const requestId = req.headers.get('x-request-id') || crypto.randomUUID()

  const result = await executeBulkArticleAction(
    articleIds,
    action,
    {
      type: auth.actorType,
      id: auth.actorId,
      hasPublishScope: true,
    },
    requestId
  )

  if (!result.success || !result.data) {
    const status =
      result.error?.code === 'FORBIDDEN'
        ? 403
        : result.error?.code === 'VALIDATION_FAILED'
          ? 422
          : 500
    return NextResponse.json(
      { error: result.error?.message || 'Bulk action failed.' },
      { status, headers: { 'Cache-Control': 'no-store' } }
    )
  }

  // Revalidate public storefront caches for all affected slugs
  try {
    revalidatePath('/blog')
    revalidatePath('/sitemap.xml')
    for (const slug of result.data.affectedSlugs) {
      if (slug) {
        revalidatePath(`/blog/${slug}`)
      }
    }
  } catch {
    // Non-fatal in dev/test contexts
  }

  return NextResponse.json(
    {
      success: result.data.succeededCount > 0 && result.data.failedCount === 0,
      partialSuccess: result.data.succeededCount > 0 && result.data.failedCount > 0,
      ...result.data,
      requestId,
    },
    { status: 200, headers: { 'Cache-Control': 'no-store' } }
  )
}
