import { NextRequest, NextResponse } from 'next/server'
import { validateBlogApiAccess } from '@/lib/blog/auth'
import { rollbackArticleRevision } from '@/lib/blog/storage'
import { revalidatePath } from 'next/cache'

interface Params {
  params: {
    id: string
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  const access = await validateBlogApiAccess(req, { requireOwner: true, maxBytes: 64_000 })
  if (!access.authorized || !access.auth) {
    return access.response!
  }
  const auth = access.auth

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Bad Request: Invalid JSON body' }, { status: 400 })
  }

  const { targetRevisionNumber } = body
  if (typeof targetRevisionNumber !== 'number') {
    return NextResponse.json(
      { error: 'Bad Request: "targetRevisionNumber" is required.' },
      { status: 400 }
    )
  }

  const result = await rollbackArticleRevision(
    params.id,
    targetRevisionNumber,
    {
      type: auth.actorType,
      id: auth.actorId,
    }
  )

  if (!result.success || !result.data) {
    return NextResponse.json({ error: result.error?.message }, { status: 400 })
  }

  try {
    revalidatePath('/blog')
    revalidatePath(`/blog/${result.data.article.slug}`)
    revalidatePath('/sitemap.xml')
  } catch {}

  return NextResponse.json({
    success: true,
    articleId: result.data.article.id,
    restoredToRevision: targetRevisionNumber,
    newRevisionNumber: result.data.revision.revision_number,
    status: result.data.article.status,
  })
}
