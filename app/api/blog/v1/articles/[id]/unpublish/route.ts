import { NextRequest, NextResponse } from 'next/server'
import { authenticateBlogRequest } from '@/lib/blog/auth'
import { unpublishArticle } from '@/lib/blog/storage'
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

  // Unpublishing is strictly owner or authorized staff initially
  if (!auth.isOwner && !auth.scopes.includes('blog:owner')) {
    return NextResponse.json(
      { error: 'Forbidden: Unpublishing requires atelier owner authority.' },
      { status: 403 }
    )
  }

  const result = await unpublishArticle(params.id, {
    type: auth.actorType,
    id: auth.actorId,
  })

  if (!result.success || !result.data) {
    return NextResponse.json({ error: result.error?.message }, { status: 400 })
  }

  try {
    revalidatePath('/blog')
    revalidatePath(`/blog/${result.data.slug}`)
    revalidatePath('/sitemap.xml')
  } catch {}

  return NextResponse.json({
    success: true,
    articleId: result.data.id,
    status: result.data.status,
  })
}
