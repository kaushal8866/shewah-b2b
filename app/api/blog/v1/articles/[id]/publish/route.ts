import { NextRequest, NextResponse } from 'next/server'
import { authenticateBlogRequest, checkRateLimit } from '@/lib/blog/auth'
import { publishArticle } from '@/lib/blog/storage'
import { revalidatePath } from 'next/cache'

interface Params {
  params: {
    id: string
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  const auth = await authenticateBlogRequest(req)
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check publish scope
  const hasPublishScope = auth.scopes.includes('blog:publish')
  if (!hasPublishScope && !auth.isOwner) {
    return NextResponse.json(
      { error: 'Forbidden: Missing "blog:publish" scope. Publishing must be explicitly enabled by atelier owner.' },
      { status: 403 }
    )
  }

  if (!checkRateLimit(auth.actorId)) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
  }

  const requestId = req.headers.get('x-request-id') || undefined

  const result = await publishArticle(
    params.id,
    {
      type: auth.actorType,
      id: auth.actorId,
      hasPublishScope,
    },
    requestId
  )

  if (!result.success || !result.data) {
    const status =
      result.error?.code === 'FORBIDDEN'
        ? 403
        : result.error?.code === 'NOT_FOUND'
        ? 404
        : result.error?.code === 'VALIDATION_FAILED'
        ? 422
        : 500

    return NextResponse.json({ error: result.error?.message, details: result.error?.details }, { status })
  }

  // Revalidate public caches
  try {
    revalidatePath('/blog')
    revalidatePath(`/blog/${result.data.slug}`)
    revalidatePath('/sitemap.xml')
  } catch (err) {
    // Non-fatal
  }

  return NextResponse.json({
    success: true,
    articleId: result.data.id,
    slug: result.data.slug,
    status: result.data.status,
    publishedAt: result.data.published_at,
    canonicalUrl: `https://shewah.co/blog/${result.data.slug}`,
  })
}
