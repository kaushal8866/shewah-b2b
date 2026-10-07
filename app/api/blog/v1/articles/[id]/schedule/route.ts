import { NextRequest, NextResponse } from 'next/server'
import { authenticateBlogRequest, checkRateLimit } from '@/lib/blog/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { validateForPublication } from '@/lib/blog/validation'
import { getBlogSettings } from '@/lib/blog/storage'
import { recordBlogAudit } from '@/lib/blog/audit'

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

  const hasScheduleScope = auth.scopes.includes('blog:schedule')
  if (!hasScheduleScope && !auth.isOwner) {
    return NextResponse.json(
      { error: 'Forbidden: Missing "blog:schedule" scope. Scheduling must be explicitly enabled.' },
      { status: 403 }
    )
  }

  if (!checkRateLimit(auth.actorId)) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Bad Request: Invalid JSON body' }, { status: 400 })
  }

  const { scheduledAt } = body
  if (!scheduledAt) {
    return NextResponse.json({ error: 'Bad Request: "scheduledAt" timestamp is required' }, { status: 400 })
  }

  const targetDate = new Date(scheduledAt)
  if (isNaN(targetDate.getTime()) || targetDate <= new Date()) {
    return NextResponse.json(
      { error: 'Bad Request: "scheduledAt" must be a valid future timestamp.' },
      { status: 400 }
    )
  }

  const settings = await getBlogSettings()
  if (settings.is_automation_paused && auth.actorType === 'assistant_token') {
    return {
      status: 403,
      error: 'Blog automation is currently paused by the atelier owner.',
    }
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
    return NextResponse.json({ error: 'No working revision found to schedule' }, { status: 404 })
  }

  // Pre-validate publication readiness before allowing schedule
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

  if (!validation.valid) {
    return NextResponse.json(
      { error: 'Cannot schedule unvalidated article', details: validation },
      { status: 422 }
    )
  }

  const { data: updated, error } = await supabaseAdmin
    .from('blog_articles')
    .update({
      status: 'scheduled',
      scheduled_at: targetDate.toISOString(),
      updated_at: new Date().toISOString(),
      lock_version: article.lock_version + 1,
    })
    .eq('id', params.id)
    .select()
    .single()

  if (error || !updated) {
    return NextResponse.json({ error: 'Failed to update schedule status' }, { status: 500 })
  }

  await recordBlogAudit({
    articleId: params.id,
    revisionId: rev.id,
    actorType: auth.actorType,
    actorId: auth.actorId,
    operation: 'schedule',
    outcome: 'success',
    diffSummary: { scheduledAt: targetDate.toISOString() },
  })

  return NextResponse.json({
    success: true,
    articleId: params.id,
    status: 'scheduled',
    scheduledAt: targetDate.toISOString(),
    timezone: settings.timezone,
  })
}
