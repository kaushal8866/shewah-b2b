import { SourceReference, HeroMedia, validateSlug } from './types'

export interface ValidationResult {
  valid: boolean
  blockers: string[]
  warnings: string[]
}

const DISALLOWED_HTML_TAGS = [
  'script',
  'iframe',
  'embed',
  'object',
  'form',
  'input',
  'button',
  'link',
  'style',
  'meta',
  'svg',
  'base',
]

const DANGEROUS_PROTOCOLS = ['javascript:', 'data:', 'vbscript:', 'file:']

/**
 * Sanitize untrusted Markdown/text input: strips hazardous tags and protocol attributes.
 */
export function sanitizeMarkdown(input: string): string {
  if (!input) return ''
  let sanitized = input

  // Remove dangerous tags and their content
  for (const tag of DISALLOWED_HTML_TAGS) {
    const regex = new RegExp(`<${tag}[^>]*>[\\s\\S]*?<\\/${tag}>`, 'gi')
    sanitized = sanitized.replace(regex, '')
    const selfClosing = new RegExp(`<${tag}[^>]*\\/?>`, 'gi')
    sanitized = sanitized.replace(selfClosing, '')
  }

  // Remove inline event handlers (onload, onerror, onclick, etc.)
  sanitized = sanitized.replace(/\s+on\w+\s*=\s*(["'])[\s\S]*?\1/gi, '')
  sanitized = sanitized.replace(/\s+on\w+\s*=\s*[^\s>]+/gi, '')

  // Remove dangerous URI schemes in markdown links [text](javascript:...)
  sanitized = sanitized.replace(
    /\[([^\]]*)\]\((javascript|data|vbscript|file):[^)]*\)/gi,
    '[$1](#)'
  )

  return sanitized
}

/**
 * Validate URL string safety (must be valid http: or https:).
 */
export function isSafeUrl(urlStr?: string | null): boolean {
  if (!urlStr) return true
  try {
    const parsed = new URL(urlStr)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:'
  } catch {
    return false
  }
}

export interface ArticleDraftInput {
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
  sourceReferences?: SourceReference[]
  externalContentId?: string | null
}

/**
 * Validate draft creation or update payload.
 * Returns blockers that prevent saving a draft at all.
 */
export function validateDraftPayload(
  payload: Partial<ArticleDraftInput>,
  allowedCategories: string[] = ['education', 'craftsmanship', 'style-guides', 'materials', 'diamonds']
): ValidationResult {
  const blockers: string[] = []
  const warnings: string[] = []

  // Title validation
  if (!payload.title || typeof payload.title !== 'string' || payload.title.trim().length < 5) {
    blockers.push('Title is required and must be at least 5 characters.')
  } else if (payload.title.length > 250) {
    blockers.push('Title must not exceed 250 characters.')
  }

  // Slug validation (if provided)
  if (payload.slug && !validateSlug(payload.slug)) {
    blockers.push('Slug must be lowercase alphanumeric with hyphens (3 to 120 characters).')
  }

  // Body markdown validation
  if (!payload.bodyMarkdown || typeof payload.bodyMarkdown !== 'string' || payload.bodyMarkdown.trim().length < 20) {
    blockers.push('Article body must be at least 20 characters.')
  } else if (payload.bodyMarkdown.length > 150000) {
    blockers.push('Article body exceeds maximum allowed size (150,000 characters).')
  }

  // Category validation
  if (payload.category && !allowedCategories.includes(payload.category)) {
    blockers.push(`Category "${payload.category}" is not in the allowed list: ${allowedCategories.join(', ')}`)
  }

  // Hero Image URL safety
  if (payload.heroImageUrl && !isSafeUrl(payload.heroImageUrl)) {
    blockers.push('Hero image URL must be a valid HTTP or HTTPS URL.')
  }

  // Source references validation
  if (payload.sourceReferences && Array.isArray(payload.sourceReferences)) {
    payload.sourceReferences.forEach((ref, index) => {
      if (!ref.title || !ref.sourceName) {
        blockers.push(`Source reference #${index + 1} must include both a title and source name.`)
      }
      if (ref.url && !isSafeUrl(ref.url)) {
        blockers.push(`Source reference #${index + 1} URL "${ref.url}" is not a safe HTTP/HTTPS link.`)
      }
      if (ref.checkedAt) {
        const d = new Date(ref.checkedAt)
        if (isNaN(d.getTime())) {
          blockers.push(`Source reference #${index + 1} checkedAt date is invalid.`)
        }
      }
    })
  }

  // Check for dangerous patterns in body
  for (const proto of DANGEROUS_PROTOCOLS) {
    if (payload.bodyMarkdown && payload.bodyMarkdown.toLowerCase().includes(proto)) {
      blockers.push(`Article content contains prohibited protocol pattern: "${proto}".`)
    }
  }

  // Editorial warnings (non-blocking for drafts, but surfaced for quality)
  if (payload.heroImageUrl && (!payload.heroImageAlt || payload.heroImageAlt.trim().length < 5)) {
    warnings.push('Hero image is missing descriptive alt text for accessibility and SEO.')
  }

  if (payload.heroImageUrl && !payload.heroImageRights) {
    warnings.push('Hero image is missing an editorial rights/attribution note.')
  }

  if (!payload.sourceReferences || payload.sourceReferences.length === 0) {
    warnings.push('No research source references provided. Educational articles should include primary citations.')
  }

  if (payload.bodyMarkdown && (
    payload.bodyMarkdown.includes('guaranteed return') ||
    payload.bodyMarkdown.includes('investment promise') ||
    payload.bodyMarkdown.includes('#1 jewellery')
  )) {
    warnings.push('Content contains claims regarding investment returns or unsubstantiated superlatives.')
  }

  return {
    valid: blockers.length === 0,
    blockers,
    warnings,
  }
}

/**
 * Strict publication validation: must pass all criteria to be released to consumers.
 */
export function validateForPublication(
  article: Partial<ArticleDraftInput>,
  allowedCategories: string[] = ['education', 'craftsmanship', 'style-guides', 'materials', 'diamonds']
): ValidationResult {
  const base = validateDraftPayload(article, allowedCategories)
  const blockers = [...base.blockers]
  const warnings = [...base.warnings]

  if (!article.slug) {
    blockers.push('Publication requires an approved URL slug.')
  }

  if (!article.heroImageUrl) {
    blockers.push('Publication requires an approved hero image.')
  } else if (!article.heroImageAlt || article.heroImageAlt.trim().length < 5) {
    blockers.push('Publication requires descriptive hero image alt text.')
  }

  if (!article.authorDisplayName || article.authorDisplayName.trim().length < 3) {
    blockers.push('Publication requires an author display name.')
  }

  if (!article.seoTitle || article.seoTitle.trim().length < 10) {
    blockers.push('Publication requires an SEO title (minimum 10 characters).')
  }

  if (!article.metaDescription || article.metaDescription.trim().length < 30) {
    blockers.push('Publication requires a meta description (minimum 30 characters).')
  }

  if (!article.bodyMarkdown || article.bodyMarkdown.trim().length < 300) {
    blockers.push('Publication requires full body text (minimum 300 characters).')
  }

  if (!article.sourceReferences || article.sourceReferences.length === 0) {
    blockers.push('Publication requires at least one verified primary source reference.')
  }

  return {
    valid: blockers.length === 0,
    blockers,
    warnings,
  }
}
