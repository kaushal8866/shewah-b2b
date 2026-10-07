/**
 * SHEWAH Editorial Scheduler & Reliability Controller (Phase 5)
 * Enforces owner publishing switch, global pause, Asia/Kolkata publish windows,
 * daily post quotas, double-publishing idempotency, outage catchup guard,
 * and broken-draft isolation.
 */

import crypto from 'crypto'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getBlogSettings } from './storage'
import { BlogSettings } from './types'
import { validateForPublication } from './validation'
import { recordBlogAudit } from './audit'

export interface ScheduledPublisherResult {
  processed: number
  success: boolean
  reason?: string
  message: string
  articleId?: string
  slug?: string
  blockers?: string[]
}

/**
 * Returns time details in Asia/Kolkata (IST = UTC+05:30).
 */
export function getKolkataTimeDetails(date: Date = new Date()): {
  timeStr: string // "HH:MM" in 24hr
  dateStr: string // "YYYY-MM-DD"
  startOfDayUTC: string
} {
  const timeFormatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const timeStr = timeFormatter.format(date)

  const dateFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const dateStr = dateFormatter.format(date)

  // 00:00:00 IST is 18:30:00 UTC previous day
  const startOfDayIST = new Date(`${dateStr}T00:00:00+05:30`).toISOString()

  return { timeStr, dateStr, startOfDayUTC: startOfDayIST }
}

/**
 * Check if the current time in Asia/Kolkata falls within the window [startTime, endTime].
 * Both startTime and endTime are in "HH:MM" format.
 */
export function isWithinPublishWindow(
  currentISTTime: string,
  startTime: string = '09:00',
  endTime: string = '20:00'
): boolean {
  return currentISTTime >= startTime && currentISTTime <= endTime
}

/**
 * Executes a single scheduled publication pass.
 * Guarded against double publishing, outage catchup floods, and broken drafts.
 */
export async function runScheduledBlogPublisher(options?: {
  forceNow?: boolean
  requestId?: string
}): Promise<ScheduledPublisherResult> {
  const requestId = options?.requestId || crypto.randomUUID()
  const settings: BlogSettings = await getBlogSettings()

  // ── GATE 1: Global Automation Pause ────────────────────────────────────────
  if (settings.is_automation_paused) {
    return {
      processed: 0,
      success: false,
      reason: 'automation_paused',
      message: 'Blog automation is globally paused by the atelier owner.',
    }
  }

  // ── GATE 2: Production Publishing Switch ───────────────────────────────────
  // When publication_mode is NOT 'auto_publish' (e.g. 'draft_only' or 'review_first'),
  // scheduled auto-release is prohibited.
  if (settings.publication_mode !== 'auto_publish') {
    return {
      processed: 0,
      success: false,
      reason: 'draft_only_mode',
      message: `Publishing switch is set to "${settings.publication_mode}". Scheduled automatic publishing is disabled.`,
    }
  }

  const now = new Date()
  const { timeStr, startOfDayUTC } = getKolkataTimeDetails(now)

  // ── GATE 3: Publish Window (Asia/Kolkata) ──────────────────────────────────
  if (!options?.forceNow) {
    const inWindow = isWithinPublishWindow(
      timeStr,
      settings.publish_window_start_time || '09:00',
      settings.publish_window_end_time || '20:00'
    )

    if (!inWindow) {
      return {
        processed: 0,
        success: false,
        reason: 'outside_publish_window',
        message: `Current IST time (${timeStr}) is outside the configured publication window (${settings.publish_window_start_time} - ${settings.publish_window_end_time} Asia/Kolkata).`,
      }
    }
  }

  // ── GATE 4: Daily Post Limit (Max new posts per day in Asia/Kolkata) ───────
  const { count: publishedTodayCount, error: countErr } = await supabaseAdmin
    .from('blog_articles')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'published')
    .gte('published_at', startOfDayUTC)

  if (!countErr && typeof publishedTodayCount === 'number') {
    if (publishedTodayCount >= (settings.max_daily_new_posts || 1)) {
      return {
        processed: 0,
        success: false,
        reason: 'daily_cap_reached',
        message: `Daily publication quota (${settings.max_daily_new_posts} post/day) has already been reached for today in Asia/Kolkata.`,
      }
    }
  }

  // ── GATE 5: Query Due Scheduled Articles (Outage Catchup Guard) ────────────
  // We query strictly 1 article (earliest scheduled_at) to prevent flood storms
  // if the server was offline or cron was delayed.
  const { data: dueArticles, error: queryErr } = await supabaseAdmin
    .from('blog_articles')
    .select('*, blog_revisions!current_revision_id(*)')
    .eq('status', 'scheduled')
    .lte('scheduled_at', now.toISOString())
    .order('scheduled_at', { ascending: true })
    .limit(1)

  if (queryErr) {
    return {
      processed: 0,
      success: false,
      reason: 'database_error',
      message: `Failed to query scheduled articles: ${queryErr.message}`,
    }
  }

  if (!dueArticles || dueArticles.length === 0) {
    return {
      processed: 0,
      success: true,
      message: 'No scheduled articles are currently due for release.',
    }
  }

  const target = dueArticles[0]
  const rev = Array.isArray(target.blog_revisions) ? target.blog_revisions[0] : target.blog_revisions

  if (!rev) {
    // Current revision missing - mark review required
    await supabaseAdmin
      .from('blog_articles')
      .update({
        status: 'in_review',
        lock_version: target.lock_version + 1,
        updated_at: now.toISOString(),
      })
      .eq('id', target.id)
      .eq('lock_version', target.lock_version)

    await recordBlogAudit({
      articleId: target.id,
      actorType: 'cron',
      actorId: 'scheduler',
      operation: 'publish',
      outcome: 'failure',
      requestId,
      errorMessage: 'Scheduled article had no valid revision attached; reverted to in_review.',
    })

    return {
      processed: 1,
      success: false,
      articleId: target.id,
      reason: 'missing_revision',
      message: 'Scheduled article had no revision snapshot; transitioned to in_review.',
    }
  }

  // ── GATE 6: Full Publication Validation ───────────────────────────────────
  // Never auto-publish on a broken draft!
  const validation = validateForPublication(
    {
      title: rev.title,
      slug: target.slug,
      excerpt: rev.excerpt,
      bodyMarkdown: rev.body_markdown,
      category: rev.category,
      authorDisplayName: rev.author_display_name,
      heroImageUrl: rev.hero_image_url,
      heroImageAlt: rev.hero_image_alt,
      heroImageCaption: rev.hero_image_caption,
      heroImageRights: rev.hero_image_rights,
      seoTitle: rev.seo_title,
      metaDescription: rev.meta_description,
      sourceReferences: rev.source_references,
    },
    settings.allowed_categories
  )

  if (!validation.valid) {
    // Demote to in_review so it is not repeatedly retried in a broken loop
    await supabaseAdmin
      .from('blog_articles')
      .update({
        status: 'in_review',
        lock_version: target.lock_version + 1,
        updated_at: now.toISOString(),
      })
      .eq('id', target.id)
      .eq('lock_version', target.lock_version)

    await recordBlogAudit({
      articleId: target.id,
      revisionId: rev.id,
      actorType: 'cron',
      actorId: 'scheduler',
      operation: 'publish',
      outcome: 'failure',
      requestId,
      errorMessage: `Scheduled release rejected by validation: ${validation.blockers.join('; ')}`,
    })

    return {
      processed: 1,
      success: false,
      articleId: target.id,
      slug: target.slug,
      reason: 'validation_failed',
      blockers: validation.blockers,
      message: `Scheduled release failed publication validation; reverted to in_review. Blockers: ${validation.blockers.join(', ')}`,
    }
  }

  // ── GATE 7: Atomic Publish Transition (Optimistic Lock) ───────────────────
  // Guard against concurrent execution or double-publishing
  const { data: updated, error: updateErr } = await supabaseAdmin
    .from('blog_articles')
    .update({
      status: 'published',
      live_revision_id: rev.id,
      published_at: now.toISOString(),
      updated_at: now.toISOString(),
      lock_version: target.lock_version + 1,
    })
    .eq('id', target.id)
    .eq('status', 'scheduled')
    .eq('lock_version', target.lock_version)
    .select()
    .single()

  if (updateErr || !updated) {
    return {
      processed: 1,
      success: false,
      articleId: target.id,
      reason: 'concurrency_conflict',
      message: 'Article status or lock version changed concurrently. Skipped to prevent duplicate publish.',
    }
  }

  // Record durable audit entry for the scheduled release
  await recordBlogAudit({
    articleId: target.id,
    revisionId: rev.id,
    actorType: 'cron',
    actorId: 'scheduler',
    operation: 'publish',
    outcome: 'success',
    requestId,
    diffSummary: {
      action: 'scheduled_release',
      slug: target.slug,
      scheduledAt: target.scheduled_at,
      publishedAt: now.toISOString(),
    },
  })

  return {
    processed: 1,
    success: true,
    articleId: target.id,
    slug: target.slug,
    message: `Successfully released scheduled article "${target.title}" to public storefront.`,
  }
}
