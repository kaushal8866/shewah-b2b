import crypto from 'crypto'

export type BlogStatus = 'draft' | 'in_review' | 'scheduled' | 'published' | 'archived'

export type EditorialSource = 'internal' | 'external_assistant' | 'import'

export type PublicationMode = 'draft_only' | 'review_first' | 'auto_publish'

export type CanonicalUrlPolicy = 'default' | 'custom'

export type ActorType = 'owner' | 'assistant_token' | 'cron' | 'system'

export type AuditOperation =
  | 'create_draft'
  | 'update_draft'
  | 'submit_review'
  | 'schedule'
  | 'publish'
  | 'unpublish'
  | 'rollback'
  | 'archive'
  | 'pause_automation'
  | 'resume_automation'
  | 'create_token'
  | 'revoke_token'
  | 'upload_media'

export type AuditOutcome = 'success' | 'failure' | 'conflict'

export interface SourceReference {
  title: string
  url?: string
  sourceName: string
  checkedAt: string // ISO date string (UTC)
  note?: string
}

export interface HeroMedia {
  url: string
  alt: string
  caption?: string
  rightsNote?: string
}

export interface BlogArticle {
  id: string
  slug: string
  title: string
  excerpt?: string | null
  category: string
  tags: string[]
  author_display_name: string
  hero_image_url?: string | null
  hero_image_alt?: string | null
  hero_image_caption?: string | null
  hero_image_rights?: string | null
  seo_title?: string | null
  meta_description?: string | null
  canonical_url_policy: CanonicalUrlPolicy
  canonical_url_custom?: string | null
  source_references: SourceReference[]
  reading_time_minutes: number
  status: BlogStatus
  current_revision_id?: string | null
  live_revision_id?: string | null
  editorial_source: EditorialSource
  external_content_id?: string | null
  lock_version: number
  created_at: string
  updated_at: string
  published_at?: string | null
  scheduled_at?: string | null
}

export interface BlogRevision {
  id: string
  article_id: string
  revision_number: number
  title: string
  excerpt?: string | null
  body_markdown: string
  body_structured?: Record<string, any> | null
  category: string
  tags: string[]
  author_display_name: string
  hero_image_url?: string | null
  hero_image_alt?: string | null
  hero_image_caption?: string | null
  hero_image_rights?: string | null
  seo_title?: string | null
  meta_description?: string | null
  source_references: SourceReference[]
  reading_time_minutes: number
  content_hash: string
  created_by_actor_type: ActorType
  created_by_actor_id: string
  change_summary?: string | null
  created_at: string
}

export interface BlogAuditLog {
  id: string
  article_id?: string | null
  revision_id?: string | null
  actor_type: ActorType
  actor_id: string
  operation: AuditOperation
  outcome: AuditOutcome
  request_id?: string | null
  idempotency_key?: string | null
  payload_hash?: string | null
  diff_summary?: Record<string, any> | null
  error_message?: string | null
  created_at: string
}

export interface BlogSettings {
  id: string
  is_blog_enabled: boolean // Non-destructive kill switch: disables public and API routes
  publication_mode: PublicationMode
  is_automation_paused: boolean
  max_daily_new_posts: number
  allowed_categories: string[]
  publish_window_start_time: string
  publish_window_end_time: string
  timezone: string
  created_at: string
  updated_at: string
}

export interface BlogApiToken {
  id: string
  name: string
  token_prefix: string
  token_hash: string
  scopes: string[]
  is_revoked: boolean
  expires_at?: string | null
  last_used_at?: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export interface BlogIdempotencyRecord {
  id: string
  idempotency_key: string
  actor_id: string
  operation: string
  payload_hash: string
  response_status: number
  response_body: Record<string, any>
  created_at: string
}

export interface BlogSlugRedirect {
  id: string
  old_slug: string
  new_slug: string
  created_at: string
}

/**
 * Strict allowed status transition state machine.
 */
export const ALLOWED_STATUS_TRANSITIONS: Record<BlogStatus, BlogStatus[]> = {
  draft: ['in_review', 'archived'],
  in_review: ['draft', 'scheduled', 'published', 'archived'],
  scheduled: ['in_review', 'draft', 'published', 'archived'],
  published: ['in_review', 'archived'], // unpublishing transitions to in_review or archived
  archived: ['draft', 'in_review'], // reviving an archived article
}

export function canTransitionStatus(from: BlogStatus, to: BlogStatus): boolean {
  if (from === to) return true
  const allowed = ALLOWED_STATUS_TRANSITIONS[from]
  return Array.isArray(allowed) && allowed.includes(to)
}

/**
 * Reading time calculation: standard ~200 words per minute, min 1 minute.
 */
export function calculateReadingTime(text: string): number {
  if (!text || typeof text !== 'string') return 1
  const clean = text.replace(/<[^>]+>/g, '').trim()
  if (!clean) return 1
  const words = clean.split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.ceil(words / 200))
}

/**
 * Validate slug format: lowercase alphanumeric and hyphens only, no leading/trailing hyphens.
 */
export function validateSlug(slug: string): boolean {
  if (!slug || typeof slug !== 'string') return false
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && slug.length >= 3 && slug.length <= 120
}

/**
 * Generate a clean URL slug from title.
 */
export function generateSlug(title: string): string {
  if (!title) return ''
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100)
}

/**
 * Compute SHA-256 content hash of revision payload.
 */
export function computeContentHash(payload: {
  title: string
  bodyMarkdown: string
  sources?: any[]
  excerpt?: string | null
}): string {
  const normalized = JSON.stringify({
    title: (payload.title || '').trim(),
    bodyMarkdown: (payload.bodyMarkdown || '').trim(),
    sources: payload.sources || [],
    excerpt: (payload.excerpt || '').trim(),
  })
  return crypto.createHash('sha256').update(normalized, 'utf8').digest('hex')
}
