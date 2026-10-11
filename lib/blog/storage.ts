import crypto from 'crypto'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import {
  BlogArticle,
  BlogRevision,
  BlogSettings,
  BlogStatus,
  BlogMediaAttachment,
  BlogStructuredBody,
  AI_ILLUSTRATION_DISCLAIMER,
  canTransitionStatus,
  calculateReadingTime,
  generateSlug,
  validateSlug,
  computeContentHash,
  ActorType,
} from './types'
import { validateDraftPayload, validateForPublication, sanitizeMarkdown } from './validation'
import { recordBlogAudit } from './audit'
import { getKolkataTimeDetails } from './scheduler'

/**
 * Documented Server Policy on Daily New-Draft Counting & Deletion:
 * - New draft creation counts rows in `blog_articles` whose `created_at` falls within the current
 *   `Asia/Kolkata` calendar day `[startOfDayUTC, endOfDayUTC)`.
 * - The blog API does not expose hard deletion of articles; soft lifecycle transitions (such as
 *   archiving an article to `status = 'archived'` or updating a draft via PATCH) preserve the
 *   `blog_articles` row and therefore DO NOT free up or refund a daily new-draft slot.
 * - Idempotent retries (`Idempotency-Key`), draft updates (`PATCH`), media uploads (`POST /media`),
 *   and article reads (`GET`) never insert into `blog_articles` and never consume a slot.
 */
export const DRAFT_QUOTA_DELETION_POLICY =
  'archived_drafts_remain_counted_in_asia_kolkata_day;no_public_hard_delete_endpoint'

export interface CreateDraftParams {
  title: string
  slug?: string
  excerpt?: string | null
  bodyMarkdown: string
  bodyStructured?: Record<string, any> | null
  images?: BlogMediaAttachment[]
  category: string
  tags?: string[]
  authorDisplayName?: string
  heroImageUrl?: string | null
  heroImageAlt?: string | null
  heroImageCaption?: string | null
  heroImageRights?: string | null
  seoTitle?: string | null
  metaDescription?: string | null
  canonicalUrlPolicy?: 'default' | 'custom'
  canonicalUrlCustom?: string | null
  sourceReferences?: any[]
  editorialSource?: 'internal' | 'external_assistant' | 'import'
  externalContentId?: string | null
  actorType: ActorType
  actorId: string
  requestId?: string | null
  idempotencyKey?: string | null
  now?: Date
}

export interface UpdateDraftParams {
  articleId: string
  expectedLockVersion: number // Optimistic concurrency lock
  title?: string
  slug?: string
  excerpt?: string | null
  bodyMarkdown?: string
  bodyStructured?: Record<string, any> | null
  images?: BlogMediaAttachment[]
  category?: string
  tags?: string[]
  authorDisplayName?: string
  heroImageUrl?: string | null
  heroImageAlt?: string | null
  heroImageCaption?: string | null
  heroImageRights?: string | null
  seoTitle?: string | null
  metaDescription?: string | null
  canonicalUrlPolicy?: 'default' | 'custom'
  canonicalUrlCustom?: string | null
  sourceReferences?: any[]
  changeSummary?: string | null
  actorType: ActorType
  actorId: string
  requestId?: string | null
}

export interface StorageResult<T> {
  success: boolean
  data?: T
  error?: {
    code:
      | 'NOT_FOUND'
      | 'CONFLICT'
      | 'VALIDATION_FAILED'
      | 'FORBIDDEN'
      | 'DAILY_QUOTA_EXCEEDED'
      | 'DATABASE_ERROR'
    message: string
    details?: any
  }
}

// In-process serialization lock for concurrent createDraftArticle calls
let draftCreationMutex: Promise<void> = Promise.resolve()

async function withDraftCreationLock<T>(fn: () => Promise<T>): Promise<T> {
  let release!: () => void
  const nextLock = new Promise<void>((resolve) => {
    release = resolve
  })
  const previousLock = draftCreationMutex
  draftCreationMutex = previousLock.then(() => nextLock)
  await previousLock
  try {
    return await fn()
  } finally {
    release()
  }
}

/**
 * Normalizes attached images and constructs the structured body payload stored in `blog_revisions.body_structured`.
 */
export function buildNormalizedStructuredBody(
  images?: BlogMediaAttachment[],
  existingStructured?: Record<string, any> | null
): BlogStructuredBody {
  const rawImages = Array.isArray(images)
    ? images
    : Array.isArray(existingStructured?.images)
      ? (existingStructured?.images as BlogMediaAttachment[])
      : []

  let heroAssigned = false
  const normalizedImages: BlogMediaAttachment[] = rawImages.slice(0, 5).map((img, idx) => {
    const isHero = Boolean(img.isHero) && !heroAssigned
    if (isHero) heroAssigned = true

    let caption = (img.caption || '').trim()
    if (
      img.sourceType === 'ai_illustration' &&
      !caption.toLowerCase().includes('ai-generated illustration')
    ) {
      caption = caption
        ? `${caption} — ${AI_ILLUSTRATION_DISCLAIMER}`
        : AI_ILLUSTRATION_DISCLAIMER
    }

    return {
      mediaId: String(img.mediaId || `media-${idx + 1}`).trim(),
      storageKey: img.storageKey ?? null,
      url: String(img.url || '').trim(),
      altText: String(img.altText || '').trim(),
      caption,
      sourceType: img.sourceType || 'studio_photography',
      rightsNote: String(img.rightsNote || '').trim(),
      isHero,
      position: img.position || (isHero ? 'hero_only' : 'after_section_1'),
      order: typeof img.order === 'number' && img.order > 0 ? img.order : idx + 1,
      mimeType: img.mimeType,
      sizeBytes: img.sizeBytes,
      width: img.width,
      height: img.height,
      catalogueProduct:
        img.sourceType === 'catalogue_product' && img.catalogueProduct
          ? {
              productId: img.catalogueProduct.productId,
              productCode: String(img.catalogueProduct.productCode || '').trim(),
              productName: String(img.catalogueProduct.productName || '').trim(),
              productSlug: String(img.catalogueProduct.productSlug || '').trim(),
              productUrl: String(img.catalogueProduct.productUrl || '').trim(),
              productImageUrl: String(img.catalogueProduct.productImageUrl || '').trim(),
            }
          : null,
    }
  })

  // Sort by order and re-index 1..N
  normalizedImages.sort((a, b) => a.order - b.order)
  normalizedImages.forEach((img, idx) => {
    img.order = idx + 1
  })

  // If images exist and none was marked isHero, mark the first one as hero
  if (normalizedImages.length > 0 && !normalizedImages.some((i) => i.isHero)) {
    normalizedImages[0].isHero = true
  }

  return {
    ...(existingStructured || {}),
    version: 1,
    images: normalizedImages,
    imagesPending: normalizedImages.length < 3,
    recommendedImageCount: { min: 3, max: 5 },
  }
}

/**
 * Counts how many articles have been created in the current Asia/Kolkata calendar day.
 */
export async function getDailyNewDraftCountInKolkata(now: Date = new Date()): Promise<{
  count: number
  dateStr: string
  startOfDayUTC: string
  endOfDayUTC: string
  articleIds: string[]
}> {
  const { dateStr, startOfDayUTC, endOfDayUTC } = getKolkataTimeDetails(now)

  try {
    const baseSelect = supabaseAdmin
      .from('blog_articles')
      .select('id, created_at', { count: 'exact' })
    if (!baseSelect || typeof (baseSelect as any).gte !== 'function') {
      return { count: 0, dateStr, startOfDayUTC, endOfDayUTC, articleIds: [] }
    }

    let query: any = baseSelect.gte('created_at', startOfDayUTC)
    if (query && typeof query.lt === 'function') {
      query = query.lt('created_at', endOfDayUTC)
    }
    if (query && typeof query.order === 'function') {
      query = query.order('created_at', { ascending: true })
    }

    const res = await query
    const rows = Array.isArray(res?.data) ? res.data : []
    const count =
      typeof res?.count === 'number'
        ? res.count
        : rows.length
    const articleIds = rows.map((r: any) => String(r.id)).filter(Boolean)

    return { count, dateStr, startOfDayUTC, endOfDayUTC, articleIds }
  } catch {
    return { count: 0, dateStr, startOfDayUTC, endOfDayUTC, articleIds: [] }
  }
}

/**
 * Get current blog system settings.
 */
export async function getBlogSettings(): Promise<BlogSettings> {
  const { data, error } = await supabaseAdmin
    .from('blog_settings')
    .select('*')
    .eq('id', 'default')
    .single()

  if (error || !data) {
    // Default safe fallback if database table not yet populated
    return {
      id: 'default',
      is_blog_enabled: true,
      publication_mode: 'draft_only',
      is_automation_paused: false,
      max_daily_new_posts: 10,
      allowed_categories: ['education', 'craftsmanship', 'style-guides', 'materials', 'diamonds', 'care-guide', 'buying-guide', 'styling'],
      publish_window_start_time: '09:00',
      publish_window_end_time: '20:00',
      timezone: 'Asia/Kolkata',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
  }

  return {
    ...data,
    is_blog_enabled: data.is_blog_enabled !== undefined ? Boolean(data.is_blog_enabled) : true,
    max_daily_new_posts:
      typeof data.max_daily_new_posts === 'number' && data.max_daily_new_posts > 0
        ? data.max_daily_new_posts
        : 10,
  } as BlogSettings
}

/**
 * Create a new draft article and its initial immutable revision (revision 1).
 * Enforces server-side daily new-draft capacity in the configured Asia/Kolkata calendar day.
 */
export async function createDraftArticle(
  params: CreateDraftParams
): Promise<StorageResult<{ article: BlogArticle; revision: BlogRevision }>> {
  return withDraftCreationLock(async () => {
    const settings = await getBlogSettings()

    if (settings.is_blog_enabled === false) {
      return {
        success: false,
        error: { code: 'FORBIDDEN', message: 'Blog system is currently disabled by the atelier owner.' },
      }
    }

    if (settings.is_automation_paused && params.actorType === 'assistant_token') {
      return {
        success: false,
        error: { code: 'FORBIDDEN', message: 'Blog automation is currently paused by the atelier owner.' },
      }
    }

    // Normalize structured body & attached images
    const structuredBody = buildNormalizedStructuredBody(params.images, params.bodyStructured)
    const heroAttachment = structuredBody.images.find((img) => img.isHero) || structuredBody.images[0]

    const effectiveHeroUrl = params.heroImageUrl ?? heroAttachment?.url ?? null
    const effectiveHeroAlt = params.heroImageAlt?.trim() || heroAttachment?.altText || null
    const effectiveHeroCaption = params.heroImageCaption?.trim() || heroAttachment?.caption || null
    const effectiveHeroRights = params.heroImageRights?.trim() || heroAttachment?.rightsNote || null

    // Sanitize Markdown content
    const cleanBody = sanitizeMarkdown(params.bodyMarkdown)

    // Validate draft inputs
    const validation = validateDraftPayload(
      {
        title: params.title,
        slug: params.slug,
        bodyMarkdown: cleanBody,
        bodyStructured: structuredBody,
        images: structuredBody.images,
        category: params.category,
        heroImageUrl: effectiveHeroUrl,
        heroImageAlt: effectiveHeroAlt,
        heroImageCaption: effectiveHeroCaption,
        heroImageRights: effectiveHeroRights,
        sourceReferences: params.sourceReferences,
      },
      settings.allowed_categories
    )

    if (!validation.valid) {
      await recordBlogAudit({
        actorType: params.actorType,
        actorId: params.actorId,
        operation: 'create_draft',
        outcome: 'failure',
        requestId: params.requestId,
        errorMessage: validation.blockers.join('; '),
      })
      return {
        success: false,
        error: { code: 'VALIDATION_FAILED', message: validation.blockers.join(' '), details: validation },
      }
    }

    const finalSlug = params.slug ? params.slug.toLowerCase().trim() : generateSlug(params.title)
    if (!validateSlug(finalSlug)) {
      return {
        success: false,
        error: { code: 'VALIDATION_FAILED', message: `Generated slug "${finalSlug}" is not a valid URL slug.` },
      }
    }

    // Check slug uniqueness
    const { data: existingSlug } = await supabaseAdmin
      .from('blog_articles')
      .select('id')
      .eq('slug', finalSlug)
      .maybeSingle()

    if (existingSlug) {
      return {
        success: false,
        error: { code: 'CONFLICT', message: `An article with slug "${finalSlug}" already exists.` },
      }
    }

    // Check externalContentId uniqueness if provided
    if (params.externalContentId) {
      const { data: existingExt } = await supabaseAdmin
        .from('blog_articles')
        .select('id, slug')
        .eq('external_content_id', params.externalContentId)
        .maybeSingle()

      if (existingExt) {
        return {
          success: false,
          error: {
            code: 'CONFLICT',
            message: `Article with externalContentId "${params.externalContentId}" already exists (slug: ${existingExt.slug}).`,
          },
        }
      }
    }

    // Enforce Daily New Draft Quota in Asia/Kolkata calendar day
    const maxDailyLimit = Math.max(1, settings.max_daily_new_posts || 10)
    const nowDate = params.now || new Date()
    const quotaBefore = await getDailyNewDraftCountInKolkata(nowDate)
    if (quotaBefore.count >= maxDailyLimit) {
      await recordBlogAudit({
        actorType: params.actorType,
        actorId: params.actorId,
        operation: 'create_draft',
        outcome: 'failure',
        requestId: params.requestId,
        idempotencyKey: params.idempotencyKey,
        errorMessage: `Daily new draft limit of ${maxDailyLimit} reached for Asia/Kolkata date ${quotaBefore.dateStr}.`,
      })
      return {
        success: false,
        error: {
          code: 'DAILY_QUOTA_EXCEEDED',
          message: `Daily new draft capacity of ${maxDailyLimit} articles has been reached for ${quotaBefore.dateStr} (Asia/Kolkata). Existing drafts remain intact; retry tomorrow after 00:00 IST or update an existing draft.`,
          details: {
            maxDailyNewPosts: maxDailyLimit,
            currentDailyCount: quotaBefore.count,
            dateAsiaKolkata: quotaBefore.dateStr,
            timezone: 'Asia/Kolkata',
          },
        },
      }
    }

    const readingTime = calculateReadingTime(cleanBody)
    const contentHash = computeContentHash({
      title: params.title,
      bodyMarkdown: cleanBody,
      sources: params.sourceReferences,
      excerpt: params.excerpt,
    })

    // 1. Insert article shell
    const insertPayload: Record<string, any> = {
      slug: finalSlug,
      title: params.title.trim(),
      excerpt: params.excerpt?.trim() ?? null,
      category: params.category,
      tags: params.tags ?? [],
      author_display_name: params.authorDisplayName?.trim() || 'SHEWAH Editorial Atelier',
      hero_image_url: effectiveHeroUrl,
      hero_image_alt: effectiveHeroAlt,
      hero_image_caption: effectiveHeroCaption,
      hero_image_rights: effectiveHeroRights,
      seo_title: params.seoTitle?.trim() ?? null,
      meta_description: params.metaDescription?.trim() ?? null,
      canonical_url_policy: params.canonicalUrlPolicy ?? 'default',
      canonical_url_custom: params.canonicalUrlCustom ?? null,
      source_references: params.sourceReferences ?? [],
      reading_time_minutes: readingTime,
      status: 'draft',
      editorial_source: params.editorialSource ?? 'internal',
      external_content_id: params.externalContentId ?? null,
      lock_version: 1,
    }
    if (params.now) {
      insertPayload.created_at = params.now.toISOString()
    }

    const { data: articleRow, error: articleErr } = await supabaseAdmin
      .from('blog_articles')
      .insert(insertPayload)
      .select()
      .single()

    if (articleErr || !articleRow) {
      return {
        success: false,
        error: { code: 'DATABASE_ERROR', message: articleErr?.message || 'Failed to insert article record.' },
      }
    }

    // Post-insert rank check to guard against cross-instance concurrent bursts exceeding maxDailyLimit
    const quotaAfter = await getDailyNewDraftCountInKolkata(nowDate)
    const insertedRank = quotaAfter.articleIds.indexOf(String(articleRow.id))
    if (
      (insertedRank !== -1 && insertedRank >= maxDailyLimit) ||
      (insertedRank === -1 && quotaAfter.count > maxDailyLimit)
    ) {
      // Roll back only this excess 11th+ draft so the first 10 drafts remain completely intact
      await supabaseAdmin.from('blog_articles').delete().eq('id', articleRow.id)
      return {
        success: false,
        error: {
          code: 'DAILY_QUOTA_EXCEEDED',
          message: `Concurrent daily new draft limit of ${maxDailyLimit} reached for ${quotaAfter.dateStr} (Asia/Kolkata).`,
          details: {
            maxDailyNewPosts: maxDailyLimit,
            dateAsiaKolkata: quotaAfter.dateStr,
            timezone: 'Asia/Kolkata',
          },
        },
      }
    }

    // 2. Insert initial revision (rev 1)
    const { data: revRow, error: revErr } = await supabaseAdmin
      .from('blog_revisions')
      .insert({
        article_id: articleRow.id,
        revision_number: 1,
        title: articleRow.title,
        excerpt: articleRow.excerpt,
        body_markdown: cleanBody,
        body_structured: structuredBody,
        category: articleRow.category,
        tags: articleRow.tags,
        author_display_name: articleRow.author_display_name,
        hero_image_url: articleRow.hero_image_url,
        hero_image_alt: articleRow.hero_image_alt,
        hero_image_caption: articleRow.hero_image_caption,
        hero_image_rights: articleRow.hero_image_rights,
        seo_title: articleRow.seo_title,
        meta_description: articleRow.meta_description,
        source_references: articleRow.source_references,
        reading_time_minutes: readingTime,
        content_hash: contentHash,
        created_by_actor_type: params.actorType,
        created_by_actor_id: params.actorId,
        change_summary: 'Initial draft created',
      })
      .select()
      .single()

    if (revErr || !revRow) {
      return {
        success: false,
        error: { code: 'DATABASE_ERROR', message: revErr?.message || 'Failed to insert initial revision.' },
      }
    }

    // 3. Link current_revision_id
    await supabaseAdmin
      .from('blog_articles')
      .update({ current_revision_id: revRow.id })
      .eq('id', articleRow.id)

    articleRow.current_revision_id = revRow.id

    await recordBlogAudit({
      articleId: articleRow.id,
      revisionId: revRow.id,
      actorType: params.actorType,
      actorId: params.actorId,
      operation: 'create_draft',
      outcome: 'success',
      requestId: params.requestId,
      idempotencyKey: params.idempotencyKey,
      payloadHash: contentHash,
    })

    return {
      success: true,
      data: { article: articleRow as BlogArticle, revision: revRow as BlogRevision },
    }
  })
}

/**
 * Update an existing draft using optimistic locking.
 * Enforces revision isolation: live_revision_id is untouched, and does NOT consume a daily new-draft slot.
 */
export async function updateDraftArticle(
  params: UpdateDraftParams
): Promise<StorageResult<{ article: BlogArticle; revision: BlogRevision }>> {
  const settings = await getBlogSettings()

  if (settings.is_blog_enabled === false) {
    return {
      success: false,
      error: { code: 'FORBIDDEN', message: 'Blog system is currently disabled by the atelier owner.' },
    }
  }

  if (settings.is_automation_paused && params.actorType === 'assistant_token') {
    return {
      success: false,
      error: { code: 'FORBIDDEN', message: 'Blog automation is currently paused by the atelier owner.' },
    }
  }

  // 1. Fetch current article
  const { data: currentArticle, error: fetchErr } = await supabaseAdmin
    .from('blog_articles')
    .select('*')
    .eq('id', params.articleId)
    .single()

  if (fetchErr || !currentArticle) {
    return {
      success: false,
      error: { code: 'NOT_FOUND', message: `Article with ID "${params.articleId}" not found.` },
    }
  }

  // 2. Check optimistic concurrency lock
  if (currentArticle.lock_version !== params.expectedLockVersion) {
    return {
      success: false,
      error: {
        code: 'CONFLICT',
        message: `Concurrency conflict: current article lock version is ${currentArticle.lock_version}, but client expected ${params.expectedLockVersion}.`,
      },
    }
  }

  // 3. Slug rename policy: if article is published and slug changed, record redirect
  const newSlug = params.slug ? params.slug.toLowerCase().trim() : currentArticle.slug
  if (newSlug !== currentArticle.slug) {
    if (!validateSlug(newSlug)) {
      return {
        success: false,
        error: { code: 'VALIDATION_FAILED', message: `New slug "${newSlug}" is not a valid URL slug.` },
      }
    }

    // Check slug collision
    const { data: slugInUse } = await supabaseAdmin
      .from('blog_articles')
      .select('id')
      .eq('slug', newSlug)
      .neq('id', params.articleId)
      .maybeSingle()

    if (slugInUse) {
      return {
        success: false,
        error: { code: 'CONFLICT', message: `Slug "${newSlug}" is already in use by another article.` },
      }
    }

    // If live, record 301 redirect
    if (currentArticle.status === 'published') {
      await supabaseAdmin.from('blog_slug_redirects').upsert({
        old_slug: currentArticle.slug,
        new_slug: newSlug,
      })
    }
  }

  // 4. Merge fields
  const latestRevSnapshot = await getLatestRevisionSnapshot(currentArticle.current_revision_id)
  const cleanBody = params.bodyMarkdown ? sanitizeMarkdown(params.bodyMarkdown) : undefined
  const title = params.title?.trim() ?? currentArticle.title
  const bodyMarkdown = cleanBody ?? latestRevSnapshot.bodyMarkdown
  const category = params.category ?? currentArticle.category
  const excerpt = params.excerpt !== undefined ? params.excerpt : currentArticle.excerpt
  const tags = params.tags ?? currentArticle.tags
  const authorDisplayName = params.authorDisplayName?.trim() ?? currentArticle.author_display_name

  const structuredBody = buildNormalizedStructuredBody(
    params.images,
    params.bodyStructured !== undefined ? params.bodyStructured : latestRevSnapshot.bodyStructured
  )
  const heroAttachment = structuredBody.images.find((img) => img.isHero) || structuredBody.images[0]

  const heroImageUrl =
    params.heroImageUrl !== undefined
      ? params.heroImageUrl
      : heroAttachment?.url ?? currentArticle.hero_image_url
  const heroImageAlt =
    params.heroImageAlt !== undefined
      ? params.heroImageAlt
      : heroAttachment?.altText ?? currentArticle.hero_image_alt
  const heroImageCaption =
    params.heroImageCaption !== undefined
      ? params.heroImageCaption
      : heroAttachment?.caption ?? currentArticle.hero_image_caption
  const heroImageRights =
    params.heroImageRights !== undefined
      ? params.heroImageRights
      : heroAttachment?.rightsNote ?? currentArticle.hero_image_rights
  const seoTitle = params.seoTitle !== undefined ? params.seoTitle : currentArticle.seo_title
  const metaDescription = params.metaDescription !== undefined ? params.metaDescription : currentArticle.meta_description
  const sourceReferences = params.sourceReferences ?? currentArticle.source_references

  // Validate merged draft
  const validation = validateDraftPayload(
    {
      title,
      slug: newSlug,
      bodyMarkdown,
      bodyStructured: structuredBody,
      images: structuredBody.images,
      category,
      heroImageUrl,
      heroImageAlt,
      heroImageCaption,
      heroImageRights,
      sourceReferences,
    },
    settings.allowed_categories
  )

  if (!validation.valid) {
    await recordBlogAudit({
      articleId: params.articleId,
      actorType: params.actorType,
      actorId: params.actorId,
      operation: 'update_draft',
      outcome: 'failure',
      requestId: params.requestId,
      errorMessage: validation.blockers.join('; '),
    })
    return {
      success: false,
      error: { code: 'VALIDATION_FAILED', message: validation.blockers.join(' '), details: validation },
    }
  }

  const readingTime = calculateReadingTime(bodyMarkdown)
  const contentHash = computeContentHash({ title, bodyMarkdown, sources: sourceReferences, excerpt })

  // 5. Query latest revision number
  const { data: latestRev } = await supabaseAdmin
    .from('blog_revisions')
    .select('revision_number')
    .eq('article_id', params.articleId)
    .order('revision_number', { ascending: false })
    .limit(1)
    .single()

  const nextRevNumber = (latestRev?.revision_number || 1) + 1

  // 6. Create new revision snapshot
  const { data: newRev, error: revErr } = await supabaseAdmin
    .from('blog_revisions')
    .insert({
      article_id: params.articleId,
      revision_number: nextRevNumber,
      title,
      excerpt,
      body_markdown: bodyMarkdown,
      body_structured: structuredBody,
      category,
      tags,
      author_display_name: authorDisplayName,
      hero_image_url: heroImageUrl,
      hero_image_alt: heroImageAlt,
      hero_image_caption: heroImageCaption,
      hero_image_rights: heroImageRights,
      seo_title: seoTitle,
      meta_description: metaDescription,
      source_references: sourceReferences,
      reading_time_minutes: readingTime,
      content_hash: contentHash,
      created_by_actor_type: params.actorType,
      created_by_actor_id: params.actorId,
      change_summary: params.changeSummary ?? `Revision ${nextRevNumber} update`,
    })
    .select()
    .single()

  if (revErr || !newRev) {
    return {
      success: false,
      error: { code: 'DATABASE_ERROR', message: revErr?.message || 'Failed to create revision snapshot.' },
    }
  }

  // 7. Update article root with new lock_version and current_revision_id.
  // CRITICAL: live_revision_id is PRESERVED!
  const nextLockVersion = currentArticle.lock_version + 1
  const { data: updatedArticle, error: updateErr } = await supabaseAdmin
    .from('blog_articles')
    .update({
      slug: newSlug,
      title,
      excerpt,
      category,
      tags,
      author_display_name: authorDisplayName,
      hero_image_url: heroImageUrl,
      hero_image_alt: heroImageAlt,
      hero_image_caption: heroImageCaption,
      hero_image_rights: heroImageRights,
      seo_title: seoTitle,
      meta_description: metaDescription,
      source_references: sourceReferences,
      reading_time_minutes: readingTime,
      current_revision_id: newRev.id,
      lock_version: nextLockVersion,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.articleId)
    .eq('lock_version', currentArticle.lock_version)
    .select()
    .single()

  if (updateErr || !updatedArticle) {
    return {
      success: false,
      error: { code: 'CONFLICT', message: 'Optimistic lock conflict during article update. Please retry.' },
    }
  }

  await recordBlogAudit({
    articleId: params.articleId,
    revisionId: newRev.id,
    actorType: params.actorType,
    actorId: params.actorId,
    operation: 'update_draft',
    outcome: 'success',
    requestId: params.requestId,
    payloadHash: contentHash,
  })

  return {
    success: true,
    data: { article: updatedArticle as BlogArticle, revision: newRev as BlogRevision },
  }
}

/**
 * Publish an article revision. Sets status = 'published', updates live_revision_id.
 */
export async function publishArticle(
  articleId: string,
  actor: { type: ActorType; id: string; hasPublishScope: boolean },
  requestId?: string | null
): Promise<StorageResult<BlogArticle>> {
  const settings = await getBlogSettings()

  if (settings.is_blog_enabled === false) {
    return {
      success: false,
      error: { code: 'FORBIDDEN', message: 'Blog system is currently disabled by the atelier owner.' },
    }
  }

  if (settings.is_automation_paused && actor.type === 'assistant_token') {
    return {
      success: false,
      error: { code: 'FORBIDDEN', message: 'Blog publishing is paused by the atelier owner.' },
    }
  }

  // Gated by owner policy: assistant token CANNOT publish if publication_mode is draft_only or review_first
  if (actor.type === 'assistant_token') {
    if (settings.publication_mode !== 'auto_publish') {
      return {
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: `Assistant cannot publish directly while publication mode is "${settings.publication_mode}". Owner review required.`,
        },
      }
    }
    if (!actor.hasPublishScope) {
      return {
        success: false,
        error: { code: 'FORBIDDEN', message: 'Provided token lacks the required "blog:publish" scope.' },
      }
    }
  }

  const { data: article } = await supabaseAdmin
    .from('blog_articles')
    .select('*, blog_revisions!current_revision_id(*)')
    .eq('id', articleId)
    .single()

  if (!article) {
    return { success: false, error: { code: 'NOT_FOUND', message: 'Article not found.' } }
  }

  const rev = Array.isArray(article.blog_revisions) ? article.blog_revisions[0] : article.blog_revisions
  if (!rev) {
    return { success: false, error: { code: 'VALIDATION_FAILED', message: 'No current revision found to publish.' } }
  }

  // Strict validation for publication
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
      heroImageCaption: rev.hero_image_caption,
      heroImageRights: rev.hero_image_rights,
      seoTitle: rev.seo_title,
      metaDescription: rev.meta_description,
      sourceReferences: rev.source_references,
    },
    settings.allowed_categories
  )

  if (!validation.valid) {
    await recordBlogAudit({
      articleId,
      revisionId: rev.id,
      actorType: actor.type,
      actorId: actor.id,
      operation: 'publish',
      outcome: 'failure',
      requestId,
      errorMessage: validation.blockers.join('; '),
    })
    return {
      success: false,
      error: { code: 'VALIDATION_FAILED', message: validation.blockers.join(' '), details: validation },
    }
  }

  const now = new Date().toISOString()
  const { data: publishedArticle, error: pubErr } = await supabaseAdmin
    .from('blog_articles')
    .update({
      status: 'published',
      live_revision_id: rev.id,
      published_at: article.published_at || now,
      updated_at: now,
      lock_version: article.lock_version + 1,
    })
    .eq('id', articleId)
    .select()
    .single()

  if (pubErr || !publishedArticle) {
    return {
      success: false,
      error: { code: 'DATABASE_ERROR', message: pubErr?.message || 'Failed to publish article.' },
    }
  }

  await recordBlogAudit({
    articleId,
    revisionId: rev.id,
    actorType: actor.type,
    actorId: actor.id,
    operation: 'publish',
    outcome: 'success',
    requestId,
  })

  return { success: true, data: publishedArticle as BlogArticle }
}

/**
 * Unpublish an article (returns to 'in_review' or 'archived' and clears live_revision_id).
 * Owner-only or authorized staff.
 */
export async function unpublishArticle(
  articleId: string,
  actor: { type: ActorType; id: string },
  newStatus: 'in_review' | 'archived' = 'in_review'
): Promise<StorageResult<BlogArticle>> {
  const { data: article } = await supabaseAdmin.from('blog_articles').select('*').eq('id', articleId).single()
  if (!article) {
    return { success: false, error: { code: 'NOT_FOUND', message: 'Article not found.' } }
  }

  if (article.status !== 'published') {
    return { success: false, error: { code: 'VALIDATION_FAILED', message: 'Article is not currently published.' } }
  }

  const { data: updated, error } = await supabaseAdmin
    .from('blog_articles')
    .update({
      status: newStatus,
      live_revision_id: null,
      updated_at: new Date().toISOString(),
      lock_version: article.lock_version + 1,
    })
    .eq('id', articleId)
    .select()
    .single()

  if (error || !updated) {
    return { success: false, error: { code: 'DATABASE_ERROR', message: error?.message || 'Failed to unpublish.' } }
  }

  await recordBlogAudit({
    articleId,
    actorType: actor.type,
    actorId: actor.id,
    operation: 'unpublish',
    outcome: 'success',
  })

  return { success: true, data: updated as BlogArticle }
}

/**
 * Rollback article to a previous known revision (Owner only).
 */
export async function rollbackArticleRevision(
  articleId: string,
  targetRevisionNumber: number,
  actor: { type: ActorType; id: string }
): Promise<StorageResult<{ article: BlogArticle; revision: BlogRevision }>> {
  const { data: article } = await supabaseAdmin.from('blog_articles').select('*').eq('id', articleId).single()
  if (!article) {
    return { success: false, error: { code: 'NOT_FOUND', message: 'Article not found.' } }
  }

  const { data: targetRev } = await supabaseAdmin
    .from('blog_revisions')
    .select('*')
    .eq('article_id', articleId)
    .eq('revision_number', targetRevisionNumber)
    .single()

  if (!targetRev) {
    return {
      success: false,
      error: { code: 'NOT_FOUND', message: `Revision #${targetRevisionNumber} not found for this article.` },
    }
  }

  // Create a new revision that copies the target revision's contents
  const { data: latestRev } = await supabaseAdmin
    .from('blog_revisions')
    .select('revision_number')
    .eq('article_id', articleId)
    .order('revision_number', { ascending: false })
    .limit(1)
    .single()

  const nextRevNumber = (latestRev?.revision_number || 1) + 1

  const { data: restoredRev, error: revErr } = await supabaseAdmin
    .from('blog_revisions')
    .insert({
      article_id: articleId,
      revision_number: nextRevNumber,
      title: targetRev.title,
      excerpt: targetRev.excerpt,
      body_markdown: targetRev.body_markdown,
      category: targetRev.category,
      tags: targetRev.tags,
      author_display_name: targetRev.author_display_name,
      hero_image_url: targetRev.hero_image_url,
      hero_image_alt: targetRev.hero_image_alt,
      hero_image_caption: targetRev.hero_image_caption,
      hero_image_rights: targetRev.hero_image_rights,
      seo_title: targetRev.seo_title,
      meta_description: targetRev.meta_description,
      source_references: targetRev.source_references,
      reading_time_minutes: targetRev.reading_time_minutes,
      content_hash: targetRev.content_hash,
      created_by_actor_type: actor.type,
      created_by_actor_id: actor.id,
      change_summary: `Rolled back to revision #${targetRevisionNumber}`,
    })
    .select()
    .single()

  if (revErr || !restoredRev) {
    return {
      success: false,
      error: { code: 'DATABASE_ERROR', message: revErr?.message || 'Failed to create rollback revision.' },
    }
  }

  const isPublished = article.status === 'published'
  const { data: updatedArticle, error: updateErr } = await supabaseAdmin
    .from('blog_articles')
    .update({
      title: targetRev.title,
      excerpt: targetRev.excerpt,
      category: targetRev.category,
      tags: targetRev.tags,
      author_display_name: targetRev.author_display_name,
      hero_image_url: targetRev.hero_image_url,
      hero_image_alt: targetRev.hero_image_alt,
      hero_image_caption: targetRev.hero_image_caption,
      hero_image_rights: targetRev.hero_image_rights,
      seo_title: targetRev.seo_title,
      meta_description: targetRev.meta_description,
      source_references: targetRev.source_references,
      reading_time_minutes: targetRev.reading_time_minutes,
      current_revision_id: restoredRev.id,
      live_revision_id: isPublished ? restoredRev.id : article.live_revision_id,
      lock_version: article.lock_version + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('id', articleId)
    .select()
    .single()

  if (updateErr || !updatedArticle) {
    return {
      success: false,
      error: { code: 'DATABASE_ERROR', message: updateErr?.message || 'Failed to update article on rollback.' },
    }
  }

  await recordBlogAudit({
    articleId,
    revisionId: restoredRev.id,
    actorType: actor.type,
    actorId: actor.id,
    operation: 'rollback',
    outcome: 'success',
    diffSummary: { restoredFromRevision: targetRevisionNumber, newRevision: nextRevNumber },
  })

  return {
    success: true,
    data: { article: updatedArticle as BlogArticle, revision: restoredRev as BlogRevision },
  }
}

/**
 * Public consumer article fetch: strictly queries published articles whose published_at is now or in the past.
 * Reads content from live_revision_id snapshot.
 */
export async function getPublicArticleBySlug(slug: string): Promise<{ article: BlogArticle; revision: BlogRevision } | null> {
  const settings = await getBlogSettings()
  if (settings.is_blog_enabled === false) return null

  const cleanSlug = slug.toLowerCase().trim()
  const now = new Date().toISOString()

  // First check if slug was redirected
  const { data: redirect } = await supabaseAdmin
    .from('blog_slug_redirects')
    .select('new_slug')
    .eq('old_slug', cleanSlug)
    .maybeSingle()

  const targetSlug = redirect ? redirect.new_slug : cleanSlug

  const { data: article } = await supabaseAdmin
    .from('blog_articles')
    .select('*')
    .eq('slug', targetSlug)
    .eq('status', 'published')
    .lte('published_at', now)
    .maybeSingle()

  if (!article || !article.live_revision_id) return null

  const { data: revision } = await supabaseAdmin
    .from('blog_revisions')
    .select('*')
    .eq('id', article.live_revision_id)
    .maybeSingle()

  if (!revision) return null

  return {
    article: article as BlogArticle,
    revision: revision as BlogRevision,
  }
}

async function getLatestRevisionSnapshot(
  revId?: string | null
): Promise<{ bodyMarkdown: string; bodyStructured: Record<string, any> | null }> {
  if (!revId) return { bodyMarkdown: '', bodyStructured: null }
  const { data } = await supabaseAdmin
    .from('blog_revisions')
    .select('body_markdown, body_structured')
    .eq('id', revId)
    .maybeSingle()
  return {
    bodyMarkdown: data?.body_markdown || '',
    bodyStructured: (data?.body_structured as Record<string, any>) || null,
  }
}

