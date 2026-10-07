import { NextRequest, NextResponse } from 'next/server'
import { validateBlogApiAccess } from '@/lib/blog/auth'
import { getBlogSettings } from '@/lib/blog/storage'

export async function GET(req: NextRequest) {
  const access = await validateBlogApiAccess(req, { requiredScope: 'blog:read' })
  if (!access.authorized || !access.auth) {
    return access.response!
  }
  const auth = access.auth

  const settings = await getBlogSettings()

  return NextResponse.json({
    authenticated: true,
    actorType: auth.actorType,
    actorId: auth.actorId,
    displayName: auth.displayName,
    scopes: auth.scopes,
    isOwner: auth.isOwner,
    publicationMode: settings.publication_mode,
    isAutomationPaused: settings.is_automation_paused,
    maxDailyNewPosts: settings.max_daily_new_posts,
    allowedCategories: settings.allowed_categories,
    publishWindowStartTime: settings.publish_window_start_time,
    publishWindowEndTime: settings.publish_window_end_time,
    timezone: settings.timezone,
    schemaVersion: '1.0.0',
    brandName: 'SHEWAH',
    canonicalBaseUrl: 'https://shewah.co/blog',
  })
}
