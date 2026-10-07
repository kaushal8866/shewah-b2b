import { NextRequest, NextResponse } from 'next/server'
import { authenticateBlogRequest, checkRateLimit } from '@/lib/blog/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { validateForPublication } from '@/lib/blog/validation'
import { getBlogSettings } from '@/lib/blog/storage'

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

  if (!auth.scopes.includes('blog:read') && !auth.scopes.includes('blog:draft:write')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!checkRateLimit(auth.actorId)) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
  }

  const { data: article } = await supabaseAdmin
    .from('blog_articles')
    .select('*, blog_revisions!current_revision_id(*)')
    .eq('id', params.id)
    .single()

  if (!article) {
    return NextResponse.json({ error: 'Article not found' }, { status: 404 })
  }

  const rev = Array.isArray(article.blog_revisions) ? article.blog_revisions[0] : article.blog_revisions
  if (!rev) {
    return NextResponse.json({ error: 'No working revision found for article' }, { status: 404 })
  }

  const settings = await getBlogSettings()

  const validation = validateForPublication(
    {
      title: rev.title,
      slug: article.slug,
      excerpt: rev.excerpt,
      bodyMarkdown: rev.body_markdown,
      category: rev.category,
      authorDisplayName: rev.author_display_name,
      heroImageUrl: rev.hero_image_url,
      heroImageAlt: rev.hero_image_alt,
      seoTitle: rev.seo_title,
      metaDescription: rev.meta_description,
      sourceReferences: rev.source_references,
    },
    settings.allowed_categories
  )

  return NextResponse.json({
    articleId: params.id,
    currentRevisionNumber: rev.revision_number,
    canPublish: validation.valid && (settings.publication_mode === 'auto_publish' || auth.isOwner),
    publicationMode: settings.publication_mode,
    validation,
  })
}
