import { NextRequest, NextResponse } from 'next/server'
import { validateBlogApiAccess } from '@/lib/blog/auth'
import { publishArticle } from '@/lib/blog/storage'
import { revalidatePath } from 'next/cache'

interface Params {
  params: {
    id: string
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  const access = await validateBlogApiAccess(req, { requiredScope: 'blog:publish' })
  if (!access.authorized || !access.auth) {
    return access.response!
  }
  const auth = access.auth
  const hasPublishScope = auth.scopes.includes('blog:publish') || auth.isOwner

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
