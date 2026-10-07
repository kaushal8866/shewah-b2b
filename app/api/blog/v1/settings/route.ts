import { NextRequest, NextResponse } from 'next/server'
import { validateBlogApiAccess } from '@/lib/blog/auth'
import { getBlogSettings } from '@/lib/blog/storage'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { recordBlogAudit } from '@/lib/blog/audit'

export async function GET(req: NextRequest) {
  const access = await validateBlogApiAccess(req, { requiredScope: 'blog:read' })
  if (!access.authorized || !access.auth) {
    return access.response!
  }

  const settings = await getBlogSettings()
  return NextResponse.json(settings)
}

export async function PATCH(req: NextRequest) {
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

  const updates: Record<string, any> = {
    updated_at: new Date().toISOString(),
  }

  if (typeof body.isBlogEnabled === 'boolean') {
    updates.is_blog_enabled = body.isBlogEnabled
  }

  if (body.publicationMode !== undefined) {
    if (!['draft_only', 'review_first', 'auto_publish'].includes(body.publicationMode)) {
      return NextResponse.json({ error: 'Invalid publicationMode' }, { status: 400 })
    }
    updates.publication_mode = body.publicationMode
  }

  if (typeof body.isAutomationPaused === 'boolean') {
    updates.is_automation_paused = body.isAutomationPaused
  }

  if (typeof body.maxDailyNewPosts === 'number' && body.maxDailyNewPosts >= 1 && body.maxDailyNewPosts <= 10) {
    updates.max_daily_new_posts = body.maxDailyNewPosts
  }

  if (Array.isArray(body.allowedCategories)) {
    updates.allowed_categories = body.allowedCategories
  }

  if (body.publishWindowStartTime) updates.publish_window_start_time = body.publishWindowStartTime
  if (body.publishWindowEndTime) updates.publish_window_end_time = body.publishWindowEndTime

  const { data: updated, error } = await supabaseAdmin
    .from('blog_settings')
    .update(updates)
    .eq('id', 'default')
    .select()
    .single()

  if (error || !updated) {
    return NextResponse.json({ error: error?.message || 'Failed to update settings' }, { status: 500 })
  }

  await recordBlogAudit({
    actorType: auth.actorType,
    actorId: auth.actorId,
    operation: updates.is_automation_paused ? 'pause_automation' : 'resume_automation',
    outcome: 'success',
    diffSummary: updates,
  })

  return NextResponse.json(updated)
}
