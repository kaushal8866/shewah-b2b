import { NextRequest, NextResponse } from 'next/server'
import { validateBlogApiAccess } from '@/lib/blog/auth'
import { unpublishArticle } from '@/lib/blog/storage'
import { revalidatePath } from 'next/cache'

interface Params {
  params: {
    id: string
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  const access = await validateBlogApiAccess(req, { requireOwner: true })
  if (!access.authorized || !access.auth) {
    return access.response!
  }
  const auth = access.auth

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
