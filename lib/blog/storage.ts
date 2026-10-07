import crypto from 'crypto'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import {
  BlogArticle,
  BlogRevision,
  BlogSettings,
  BlogStatus,
  canTransitionStatus,
  calculateReadingTime,
  generateSlug,
  validateSlug,
  computeContentHash,
  ActorType,
} from './types'
import { validateDraftPayload, validateForPublication, sanitizeMarkdown } from './validation'
import { recordBlogAudit } from './audit'

export interface CreateDraftParams {
  title: string
  slug?: string
  excerpt?: string | null
  bodyMarkdown: string
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
}

export interface UpdateDraftParams {
  articleId: string
  expectedLockVersion: number // Optimistic concurrency lock
  title?: string
  slug?: string
  excerpt?: string | null
  bodyMarkdown?: string
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
    code: 'NOT_FOUND' | 'CONFLICT' | 'VALIDATION_FAILED' | 'FORBIDDEN' | 'DATABASE_ERROR'
    message: string
    details?: any
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
      publication_mode: 'draft_only',
      is_automation_paused: false,
      max_daily_new_posts: 1,
      allowed_categories: ['education', 'craftsmanship', 'style-guides', 'materials', 'diamonds'],
      publish_window_start_time: '09:00',
      publish_window_end_time: '20:00',
      timezone: 'Asia/Kolkata',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
  }

  return data as BlogSettings
}

/**
 * Create a new draft article and its initial immutable revision (revision 1).
 */
export async function createDraftArticle(params: CreateDraftParams): Promise<StorageResult<{ article: BlogArticle; revision: BlogRevision }>> {
  const settings = await getBlogSettings()

  if (settings.is_automation_paused && params.actorType === 'assistant_token') {
    return {
      success: false,
      error: { code: 'FORBIDDEN', message: 'Blog automation is currently paused by the atelier owner.' },
    }
  }

  // Sanitize Markdown content
  const cleanBody = sanitizeMarkdown(params.bodyMarkdown)

  // Validate draft inputs
  const validation = validateDraftPayload(
    {
      title: params.title,
      slug: params.slug,
      bodyMarkdown: cleanBody,
      category: params.category,
      heroImageUrl: params.heroImageUrl,
      sourceReferences: params.sourceReferences,
    },
    settings.allowed_categories
  )

  if (!validation.valid) {
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

  const readingTime = calculateReadingTime(cleanBody)
  const contentHash = computeContentHash({
    title: params.title,
    bodyMarkdown: cleanBody,
    sources: params.sourceReferences,
    excerpt: params.excerpt,
  })

  // 1. Insert article shell
  const { data: articleRow, error: articleErr } = await supabaseAdmin
    .from('blog_articles')
    .insert({
      slug: finalSlug,
      title: params.title.trim(),
      excerpt: params.excerpt?.trim() ?? null,
      category: params.category,
      tags: params.tags ?? [],
      author_display_name: params.authorDisplayName?.trim() || 'SHEWAH Editorial Atelier',
      hero_image_url: params.heroImageUrl ?? null,
      hero_image_alt: params.heroImageAlt?.trim() ?? null,
      hero_image_caption: params.heroImageCaption?.trim() ?? null,
      hero_image_rights: params.heroImageRights?.trim() ?? null,
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
    })
    .select()
    .single()

  if (articleErr || !articleRow) {
    return {
      success: false,
      error: { code: 'DATABASE_ERROR', message: articleErr?.message || 'Failed to insert article record.' },
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
}

/**
 * Update an existing draft using optimistic locking.
 * Enforces revision isolation: live_revision_id is untouched.
 */
export async function updateDraftArticle(params: UpdateDraftParams): Promise<StorageResult<{ article: BlogArticle; revision: BlogRevision }>> {
  const settings = await getBlogSettings()

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
  const cleanBody = params.bodyMarkdown ? sanitizeMarkdown(params.bodyMarkdown) : undefined
  const title = params.title?.trim() ?? currentArticle.title
  const bodyMarkdown = cleanBody ?? (await getLatestRevisionBody(currentArticle.current_revision_id))
  const category = params.category ?? currentArticle.category
  const excerpt = params.excerpt !== undefined ? params.excerpt : currentArticle.excerpt
  const tags = params.tags ?? currentArticle.tags
  const authorDisplayName = params.authorDisplayName?.trim() ?? currentArticle.author_display_name
  const heroImageUrl = params.heroImageUrl !== undefined ? params.heroImageUrl : currentArticle.hero_image_url
  const heroImageAlt = params.heroImageAlt !== undefined ? params.heroImageAlt : currentArticle.hero_image_alt
  const heroImageCaption = params.heroImageCaption !== undefined ? params.heroImageCaption : currentArticle.hero_image_caption
  const heroImageRights = params.heroImageRights !== undefined ? params.heroImageRights : currentArticle.hero_image_rights
  const seoTitle = params.seoTitle !== undefined ? params.seoTitle : currentArticle.seo_title
  const metaDescription = params.metaDescription !== undefined ? params.metaDescription : currentArticle.meta_description
  const sourceReferences = params.sourceReferences ?? currentArticle.source_references

  // Validate merged draft
  const validation = validateDraftPayload(
    { title, slug: newSlug, bodyMarkdown, category, heroImageUrl, sourceReferences },
    settings.allowed_categories
  )

  if (!validation.valid) {
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
      seoTitle: rev.seo_title,
      metaDescription: rev.meta_description,
      sourceReferences: rev.source_references,
    },
    settings.allowed_categories
  )

  if (!validation.valid) {
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

async function getLatestRevisionBody(revId?: string | null): Promise<string> {
  if (!revId) return ''
  const { data } = await supabaseAdmin.from('blog_revisions').select('body_markdown').eq('id', revId).maybeSingle()
  return data?.body_markdown || ''
}
