import {
  SourceReference,
  HeroMedia,
  BlogMediaAttachment,
  validateSlug,
} from './types'

export interface ValidationResult {
  valid: boolean
  blockers: string[]
  warnings: string[]
  imagesPending?: boolean
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

import {
  inspectSubmissionSafety,
  sanitizeMarkdownContent,
  validateUrlSafety,
  detectPromptInjectionAndHiddenText,
  checkEditorialClaimsAndSeparation,
} from './safety'

/**
 * Sanitize untrusted Markdown/text input: strips hazardous tags, inline styles, event handlers, and protocol attributes.
 */
export function sanitizeMarkdown(input: string): string {
  return sanitizeMarkdownContent(input)
}

/**
 * Validate URL string safety with private IP and SSRF protection.
 */
export function isSafeUrl(urlStr?: string | null): boolean {
  if (!urlStr) return true
  return validateUrlSafety(urlStr).safe
}

export interface ArticleDraftInput {
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
  sourceReferences?: SourceReference[]
  externalContentId?: string | null
}

/**
 * Validate draft creation or update payload.
 * Returns blockers that prevent saving a draft at all.
 * Note: Editorial text drafts remain saveable when images are pending (marked imagesPending: true).
 */
export function validateDraftPayload(
  payload: Partial<ArticleDraftInput>,
  allowedCategories: string[] = ['education', 'craftsmanship', 'style-guides', 'materials', 'diamonds', 'care-guide', 'buying-guide', 'styling']
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

  const attachedImages = Array.isArray(payload.images)
    ? payload.images
    : Array.isArray(payload.bodyStructured?.images)
      ? (payload.bodyStructured?.images as BlogMediaAttachment[])
      : undefined

  // Derive hero fields from attached images if heroImageUrl is not explicitly set
  const heroFromAttachments = Array.isArray(attachedImages)
    ? attachedImages.find((img) => img?.isHero) || attachedImages[0]
    : undefined

  const effectiveHeroUrl = payload.heroImageUrl || heroFromAttachments?.url || null
  const effectiveHeroAlt = payload.heroImageAlt || heroFromAttachments?.altText || null
  const effectiveHeroCaption = payload.heroImageCaption || heroFromAttachments?.caption || null
  const effectiveHeroRights = payload.heroImageRights || heroFromAttachments?.rightsNote || null

  // Comprehensive safety and policy inspection (SSRF, prompt injection, hidden text, British spelling, trade separation, claims, media attachments)
  const safetyResult = inspectSubmissionSafety(
    {
      title: payload.title || '',
      slug: payload.slug,
      bodyMarkdown: payload.bodyMarkdown || '',
      category: payload.category || '',
      heroImageUrl: effectiveHeroUrl,
      heroImageAlt: effectiveHeroAlt,
      heroImageCaption: effectiveHeroCaption,
      heroImageRights: effectiveHeroRights,
      sourceReferences: payload.sourceReferences,
      images: attachedImages,
    },
    allowedCategories
  )

  for (const violation of safetyResult.violations) {
    if (violation.severity === 'blocker') {
      blockers.push(violation.message)
    } else {
      warnings.push(violation.message)
    }
  }

  const imageCount = Array.isArray(attachedImages)
    ? attachedImages.length
    : effectiveHeroUrl
      ? 1
      : 0
  const imagesPending = imageCount < 3

  if (!effectiveHeroUrl && (!attachedImages || attachedImages.length === 0)) {
    warnings.push(
      'Images Pending: Draft has no images attached yet. Text draft can be saved, but 3–5 images and a hero image are required before publication.'
    )
  }

  // Editorial warnings (non-blocking for drafts, but surfaced for quality)
  if (effectiveHeroUrl && (!effectiveHeroAlt || effectiveHeroAlt.trim().length < 5)) {
    warnings.push('Hero image is missing descriptive alt text for accessibility and SEO.')
  }

  if (effectiveHeroUrl && !effectiveHeroRights) {
    warnings.push('Hero image is missing an editorial rights/attribution note.')
  }

  if (!payload.sourceReferences || payload.sourceReferences.length === 0) {
    warnings.push('No research source references provided. Educational articles should include primary citations.')
  }

  return {
    valid: blockers.length === 0,
    blockers,
    warnings,
    imagesPending,
  }
}

/**
 * Strict publication validation: must pass all criteria to be released to consumers.
 */
export function validateForPublication(
  article: Partial<ArticleDraftInput>,
  allowedCategories: string[] = ['education', 'craftsmanship', 'style-guides', 'materials', 'diamonds', 'care-guide', 'buying-guide', 'styling']
): ValidationResult {
  const base = validateDraftPayload(article, allowedCategories)
  const blockers = [...base.blockers]
  const warnings = [...base.warnings]

  const attachedImages = Array.isArray(article.images)
    ? article.images
    : Array.isArray(article.bodyStructured?.images)
      ? (article.bodyStructured?.images as BlogMediaAttachment[])
      : undefined

  const heroFromAttachments = Array.isArray(attachedImages)
    ? attachedImages.find((img) => img?.isHero) || attachedImages[0]
    : undefined

  const effectiveHeroUrl = article.heroImageUrl || heroFromAttachments?.url || null
  const effectiveHeroAlt = article.heroImageAlt || heroFromAttachments?.altText || null
  const effectiveHeroRights = article.heroImageRights || heroFromAttachments?.rightsNote || null

  if (!article.slug) {
    blockers.push('Publication requires an approved URL slug.')
  }

  if (!effectiveHeroUrl) {
    blockers.push('Publication requires an approved hero image.')
  } else if (!effectiveHeroAlt || effectiveHeroAlt.trim().length < 5) {
    blockers.push('Publication requires descriptive hero image alt text.')
  }

  if (effectiveHeroUrl && (!effectiveHeroRights || effectiveHeroRights.trim().length < 5)) {
    blockers.push('Publication requires an editorial rights/attribution note for the hero image.')
  }

  if (Array.isArray(attachedImages) && attachedImages.length > 0 && attachedImages.length < 3) {
    blockers.push(
      `Publication requires 3 to 5 images when structured media is used (currently ${attachedImages.length} attached; images pending).`
    )
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
    imagesPending: base.imagesPending,
  }
}

