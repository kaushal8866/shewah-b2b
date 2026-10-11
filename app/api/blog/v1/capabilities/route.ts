import { NextRequest, NextResponse } from 'next/server'
import { validateBlogApiAccess } from '@/lib/blog/auth'
import {
  getBlogSettings,
  getDailyNewDraftCountInKolkata,
  DRAFT_QUOTA_DELETION_POLICY,
} from '@/lib/blog/storage'
import { MAX_BLOG_IMAGE_BYTES } from '@/lib/blog/media'

export async function GET(req: NextRequest) {
  const access = await validateBlogApiAccess(req, { requiredScope: 'blog:read' })
  if (!access.authorized || !access.auth) {
    return access.response!
  }
  const auth = access.auth

  const [settings, dailyQuota] = await Promise.all([
    getBlogSettings(),
    getDailyNewDraftCountInKolkata(),
  ])

  const maxDaily = settings.max_daily_new_posts
  const canUploadDraftMedia =
    auth.isOwner ||
    auth.scopes.includes('blog:draft:write') ||
    auth.scopes.includes('blog:image:upload')

  return NextResponse.json(
    {
      authenticated: true,
      actorType: auth.actorType,
      actorId: auth.actorId,
      displayName: auth.displayName,
      scopes: auth.scopes,
      isOwner: auth.isOwner,
      publicationMode: settings.publication_mode,
      isAutomationPaused: settings.is_automation_paused,
      maxDailyNewPosts: maxDaily,
      currentDailyNewDrafts: dailyQuota.count,
      remainingDailyNewDrafts: Math.max(0, maxDaily - dailyQuota.count),
      currentDateAsiaKolkata: dailyQuota.dateStr,
      draftQuotaDeletionPolicy: DRAFT_QUOTA_DELETION_POLICY,
      canUploadDraftMedia,
      maxImagesPerDraft: 5,
      recommendedImagesPerDraft: { min: 3, max: 5 },
      maxImageUploadBytes: MAX_BLOG_IMAGE_BYTES,
      allowedCategories: settings.allowed_categories,
      publishWindowStartTime: settings.publish_window_start_time,
      publishWindowEndTime: settings.publish_window_end_time,
      timezone: settings.timezone,
      schemaVersion: '1.1.0',
      brandName: 'SHEWAH',
      canonicalBaseUrl: 'https://shewah.co/blog',
    },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}

