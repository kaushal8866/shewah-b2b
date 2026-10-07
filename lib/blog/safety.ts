/**
 * SHEWAH Editorial Content & Media Safety System (Phase 4)
 * Enforces SSRF prevention, media validation, Markdown sanitization,
 * prompt-injection defense, hidden-text detection, British/Indian English spelling,
 * unverified certification claim checks, and strict D2C / Trade topic isolation.
 */

import { SourceReference, HeroMedia } from './types'

export interface SafetyViolation {
  field: string
  rule: string
  message: string
  severity: 'blocker' | 'warning'
}

export interface SafetyCheckResult {
  passed: boolean
  violations: SafetyViolation[]
  sanitizedBody: string
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. SSRF & URL SAFETY
// ─────────────────────────────────────────────────────────────────────────────

const BLOCKED_SCHEMES = new Set(['javascript:', 'data:', 'file:', 'ftp:', 'blob:', 'vbscript:', 'ws:', 'wss:'])

/**
 * Checks if an IP or hostname falls into private, loopback, or cloud-metadata ranges.
 */
function isPrivateOrLocalHost(hostname: string): boolean {
  const lower = hostname.toLowerCase().trim()

  // Loopback / internal hostnames
  if (
    lower === 'localhost' ||
    lower.endsWith('.local') ||
    lower.endsWith('.internal') ||
    lower === 'metadata.google.internal' ||
    lower === 'instance-data'
  ) {
    return true
  }

  // IPv6 loopback and link-local
  if (lower === '::1' || lower === '[::1]' || lower.startsWith('fe80:') || lower.startsWith('[fe80:')) {
    return true
  }

  // Check IPv4 dotted-decimal or numeric representations
  // Strip IPv6 brackets if present
  const cleanHost = lower.replace(/^\[|\]$/g, '')

  // Decimal representation check (e.g. 2130706433 is 127.0.0.1)
  if (/^\d+$/.test(cleanHost)) {
    const num = parseInt(cleanHost, 10)
    if (num >= 0 && num <= 4294967295) {
      // Decode to IPv4
      const p1 = (num >>> 24) & 255
      const p2 = (num >>> 16) & 255
      const p3 = (num >>> 8) & 255
      const p4 = num & 255
      return isPrivateIpv4(p1, p2, p3, p4)
    }
  }

  // Hex representation check (e.g. 0x7f000001)
  if (/^0x[0-9a-f]+$/i.test(cleanHost)) {
    const num = parseInt(cleanHost, 16)
    if (num >= 0 && num <= 4294967295) {
      const p1 = (num >>> 24) & 255
      const p2 = (num >>> 16) & 255
      const p3 = (num >>> 8) & 255
      const p4 = num & 255
      return isPrivateIpv4(p1, p2, p3, p4)
    }
  }

  const parts = cleanHost.split('.')
  if (parts.length === 4 && parts.every((p) => /^\d+$/.test(p))) {
    const [p1, p2, p3, p4] = parts.map((p) => parseInt(p, 10))
    if (p1 > 255 || p2 > 255 || p3 > 255 || p4 > 255) return true
    return isPrivateIpv4(p1, p2, p3, p4)
  }

  return false
}

function isPrivateIpv4(p1: number, p2: number, p3: number, p4: number): boolean {
  // 127.0.0.0/8 (Loopback)
  if (p1 === 127) return true
  // 10.0.0.0/8 (Private-Use)
  if (p1 === 10) return true
  // 172.16.0.0/12 (Private-Use 172.16 - 172.31)
  if (p1 === 172 && p2 >= 16 && p2 <= 31) return true
  // 192.168.0.0/16 (Private-Use)
  if (p1 === 192 && p2 === 168) return true
  // 169.254.0.0/16 (Link-Local / AWS/GCP Metadata 169.254.169.254)
  if (p1 === 169 && p2 === 254) return true
  // 0.0.0.0/8 ("This" Network)
  if (p1 === 0) return true
  // 224.0.0.0/4 (Multicast)
  if (p1 >= 224 && p1 <= 239) return true
  // 240.0.0.0/4 (Reserved)
  if (p1 >= 240) return true

  return false
}

const BLOCKED_INTERNAL_PORTS = new Set([
  21, 22, 23, 25, 53, 110, 143, 389, 445, 1433, 1521, 2049, 2375, 2376, 3306,
  5432, 6379, 8080, 8443, 9200, 11211, 27017,
])

/**
 * Validates a URL for SSRF hazards, dangerous schemes, and intranet leakage.
 */
export function validateUrlSafety(urlString: string): { safe: boolean; reason?: string } {
  if (!urlString || typeof urlString !== 'string') {
    return { safe: false, reason: 'URL string is required.' }
  }

  let parsed: URL
  try {
    parsed = new URL(urlString)
  } catch {
    return { safe: false, reason: 'Malformed URL format.' }
  }

  // Scheme enforcement
  if (BLOCKED_SCHEMES.has(parsed.protocol.toLowerCase())) {
    return { safe: false, reason: `Disallowed protocol scheme: ${parsed.protocol}` }
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { safe: false, reason: 'Only HTTP and HTTPS URLs are permitted.' }
  }

  // SSRF Host checks
  if (isPrivateOrLocalHost(parsed.hostname)) {
    return { safe: false, reason: `Forbidden destination: target resolves to internal, private or link-local address (${parsed.hostname}).` }
  }

  // Port checks
  if (parsed.port) {
    const portNum = parseInt(parsed.port, 10)
    if (BLOCKED_INTERNAL_PORTS.has(portNum)) {
      return { safe: false, reason: `Forbidden port number: ${portNum} is a restricted internal service port.` }
    }
  }

  return { safe: true }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. HERO MEDIA SAFETY VALIDATION
// ─────────────────────────────────────────────────────────────────────────────

export interface MediaSafetyParams {
  url?: string | null
  altText?: string | null
  caption?: string | null
  rightsNote?: string | null
  width?: number | null
  height?: number | null
  fileSizeBytes?: number | null
  mimeType?: string | null
}

const ALLOWED_IMAGE_FORMATS = new Set(['jpg', 'jpeg', 'png', 'webp', 'avif'])
const ALLOWED_IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024 // 5 MB

const GENERIC_ALT_STRINGS = new Set([
  'image', 'photo', 'picture', 'hero', 'hero image', 'banner', 'banner image',
  'blog image', 'test', 'placeholder', 'shewah', 'shewah jewellery',
])

export function validateHeroMediaSafety(params: MediaSafetyParams): SafetyViolation[] {
  const violations: SafetyViolation[] = []

  if (!params.url) {
    violations.push({
      field: 'heroImageUrl',
      rule: 'required',
      message: 'Hero image URL is required.',
      severity: 'blocker',
    })
    return violations
  }

  const urlCheck = validateUrlSafety(params.url)
  if (!urlCheck.safe) {
    violations.push({
      field: 'heroImageUrl',
      rule: 'ssrf_protection',
      message: urlCheck.reason || 'Hero image URL is unsafe or invalid.',
      severity: 'blocker',
    })
  }

  // File extension check from URL path if extension is present
  try {
    const pathname = new URL(params.url).pathname.toLowerCase()
    const lastSlash = pathname.lastIndexOf('/')
    const filename = lastSlash !== -1 ? pathname.slice(lastSlash + 1) : pathname
    const dotIndex = filename.lastIndexOf('.')
    if (dotIndex !== -1) {
      const ext = filename.slice(dotIndex + 1)
      if (!ALLOWED_IMAGE_FORMATS.has(ext)) {
        violations.push({
          field: 'heroImageUrl',
          rule: 'image_format',
          message: `Image format .${ext} is not allowed. Supported formats: ${Array.from(ALLOWED_IMAGE_FORMATS).join(', ')}.`,
          severity: 'blocker',
        })
      }
    }
  } catch {
    // Malformed URL caught by urlCheck
  }

  // MIME check if provided
  if (params.mimeType && !ALLOWED_IMAGE_MIMES.has(params.mimeType.toLowerCase())) {
    violations.push({
      field: 'heroImage',
      rule: 'mime_type',
      message: `MIME type "${params.mimeType}" is not an accepted image format.`,
      severity: 'blocker',
    })
  }

  // File size check if provided
  if (params.fileSizeBytes && params.fileSizeBytes > MAX_IMAGE_SIZE_BYTES) {
    violations.push({
      field: 'heroImage',
      rule: 'file_size',
      message: `Image file size (${(params.fileSizeBytes / (1024 * 1024)).toFixed(1)} MB) exceeds maximum allowed 5 MB.`,
      severity: 'blocker',
    })
  }

  // Dimensions & Aspect ratio if provided
  if (params.width && params.height) {
    if (params.width < 800 || params.height < 450) {
      violations.push({
        field: 'heroImage',
        rule: 'min_dimensions',
        message: `Hero image dimensions (${params.width}x${params.height}px) must be at least 800x450px.`,
        severity: 'blocker',
      })
    }
    if (params.width > 3840 || params.height > 2160) {
      violations.push({
        field: 'heroImage',
        rule: 'max_dimensions',
        message: `Hero image dimensions (${params.width}x${params.height}px) exceed maximum allowed 3840x2160px.`,
        severity: 'blocker',
      })
    }
    const ratio = params.width / params.height
    if (ratio < 0.9 || ratio > 2.5) {
      violations.push({
        field: 'heroImage',
        rule: 'aspect_ratio',
        message: `Hero image aspect ratio (${ratio.toFixed(2)}) must be between 1:1 and 21:9.`,
        severity: 'blocker',
      })
    }
  }

  // Alt text check
  const alt = (params.altText || '').trim()
  if (!alt || alt.length < 10) {
    violations.push({
      field: 'heroImageAlt',
      rule: 'alt_length',
      message: 'Hero image alt text must be at least 10 characters and describe the visual subject.',
      severity: 'blocker',
    })
  } else if (alt.length > 200) {
    violations.push({
      field: 'heroImageAlt',
      rule: 'alt_length_max',
      message: 'Hero image alt text must not exceed 200 characters.',
      severity: 'blocker',
    })
  } else if (GENERIC_ALT_STRINGS.has(alt.toLowerCase())) {
    violations.push({
      field: 'heroImageAlt',
      rule: 'alt_descriptive',
      message: `Alt text "${alt}" is too generic. Please provide an editorial description of the piece or craftsmanship.`,
      severity: 'blocker',
    })
  }

  // Rights / License note check
  const rights = (params.rightsNote || '').trim()
  if (!rights || rights.length < 5) {
    violations.push({
      field: 'heroImageRights',
      rule: 'rights_note',
      message: 'Hero image must include a license or attribution note (e.g. "© SHEWAH Atelier" or source license).',
      severity: 'blocker',
    })
  }

  return violations
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. MARKDOWN & HTML SANITIZATION & TRACKING PIXEL DEFENSE
// ─────────────────────────────────────────────────────────────────────────────

const DISALLOWED_HTML_ELEMENTS = [
  'script', 'iframe', 'embed', 'object', 'style', 'form', 'input', 'button',
  'link', 'meta', 'svg', 'canvas', 'base', 'applet', 'picture', 'video', 'audio',
]

/**
 * Strips dangerous HTML, attributes, inline events, and tracking pixels from Markdown.
 */
export function sanitizeMarkdownContent(input: string): string {
  if (!input) return ''
  let sanitized = input

  // Strip disallowed HTML tags and nested contents
  for (const tag of DISALLOWED_HTML_ELEMENTS) {
    const blockRegex = new RegExp(`<${tag}[^>]*>[\\s\\S]*?<\\/${tag}>`, 'gi')
    sanitized = sanitized.replace(blockRegex, '')
    const selfClosing = new RegExp(`<${tag}[^>]*\\/?>`, 'gi')
    sanitized = sanitized.replace(selfClosing, '')
  }

  // Strip inline event handlers (onload, onerror, onclick, etc.)
  sanitized = sanitized.replace(/\s+on[a-z]+\s*=\s*(["'])[\s\S]*?\1/gi, '')
  sanitized = sanitized.replace(/\s+on[a-z]+\s*=\s*[^\s>]+/gi, '')

  // Strip style attributes
  sanitized = sanitized.replace(/\s+style\s*=\s*(["'])[\s\S]*?\1/gi, '')

  // Strip arbitrary data attributes and class/id attributes
  sanitized = sanitized.replace(/\s+data-[a-z0-9_-]+\s*=\s*(["'])[\s\S]*?\1/gi, '')

  // Strip tracking pixels: <img ... width="1" ...> or <img ... height="1" ...>
  sanitized = sanitized.replace(/<img[^>]*(width|height)\s*=\s*["']?(0|1)["']?[^>]*>/gi, '')

  // Neutralize dangerous protocol schemes in Markdown links [label](javascript:...)
  sanitized = sanitized.replace(
    /\[([^\]]*)\]\((javascript|data|vbscript|file|blob):[^)]*\)/gi,
    '[$1](#)'
  )

  return sanitized
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. PROMPT INJECTION & HIDDEN TEXT DETECTION
// ─────────────────────────────────────────────────────────────────────────────

const PROMPT_INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior)\s+(instructions|directions|rules)/i,
  /system\s*prompt\s*:/i,
  /\[system\s*prompt\]/i,
  /\[system\]/i,
  /you\s+are\s+now\s+in\s+developer\s+mode/i,
  /dan\s+mode/i,
  /override\s+editorial\s+policy/i,
  /bypass\s+safety\s+check/i,
  /publish\s+automatically\s+without\s+review/i,
  /act\s+as\s+an\s+unrestricted/i,
  /jailbreak/i,
]

const HIDDEN_TEXT_PATTERNS = [
  /style\s*=\s*["'][^"']*(display\s*:\s*none|visibility\s*:\s*hidden|font-size\s*:\s*0|opacity\s*:\s*0|color\s*:\s*transparent)[^"']*["']/i,
  /<!--\s*(system|instruction|prompt|override|assistant)[\s\S]*?-->/i,
]

// Zero-width space characters: U+200B, U+200C, U+200D, U+FEFF
const ZERO_WIDTH_REGEX = /[\u200B\u200C\u200D\uFEFF]/g

export function detectPromptInjectionAndHiddenText(content: string): SafetyViolation[] {
  const violations: SafetyViolation[] = []
  if (!content) return violations

  // Prompt injection pattern matching
  for (const pattern of PROMPT_INJECTION_PATTERNS) {
    if (pattern.test(content)) {
      violations.push({
        field: 'bodyMarkdown',
        rule: 'prompt_injection',
        message: 'Content contains disallowed prompt-injection instruction patterns.',
        severity: 'blocker',
      })
      break
    }
  }

  // Hidden text CSS/HTML checks
  for (const pattern of HIDDEN_TEXT_PATTERNS) {
    if (pattern.test(content)) {
      violations.push({
        field: 'bodyMarkdown',
        rule: 'hidden_text',
        message: 'Content contains hidden text techniques or suspicious system-instruction HTML comments.',
        severity: 'blocker',
      })
      break
    }
  }

  // Zero-width characters flood detection
  const matches = content.match(ZERO_WIDTH_REGEX)
  if (matches && matches.length > 5) {
    violations.push({
      field: 'bodyMarkdown',
      rule: 'zero_width_obfuscation',
      message: `Content contains excessive zero-width characters (${matches.length} detected), indicating obfuscation.`,
      severity: 'blocker',
    })
  }

  return violations
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. EDITORIAL STANDARDS, SPELLING, CLAIMS & TRADE SEPARATION
// ─────────────────────────────────────────────────────────────────────────────

// American English word blacklist for consumer copy
const AMERICAN_SPELLING_MAP: Record<string, string> = {
  jewelry: 'jewellery',
  jeweler: 'jeweller',
  jewelers: 'jewellers',
}

// B2B & Wholesale topic terms that must never leak into consumer D2C articles
const TRADE_LEAKAGE_TERMS = [
  'b2b',
  'wholesale pricing',
  'bulk discount',
  'margin multiplier',
  'keystone markup',
  'moq',
  'minimum order quantity',
  'karigar rate',
  'casting labor per gram',
  'dealer catalog',
  'retailer login',
  'reseller tier',
  'aurora erp',
  'trade portal',
  'wholesale catalog',
]

// Medical / Pseudoscience claims
const HEALTH_CLAIMS_PATTERNS = [
  /\b(cures|heals)\s+(arthritis|cancer|disease|infection)\b/i,
  /\b(healing\s+crystals?|chakra\s+healing)\b/i,
  /\b(detoxifies\s+the\s+body|medicinal\s+powers?)\b/i,
  /\btherapeutic\s+vibrations\b/i,
]

// Fake reviews / testimonials in editorial text
const FAKE_REVIEW_PATTERNS = [
  /\bverified\s+buyer\s+says\b/i,
  /\bcustomer\s+review\s*:/i,
  /\bcustomer\s+testimonial\s*:/i,
  /\b5\s+stars\s+from\s+[a-z]+/i,
  /\b\d+\/\d+\s+stars\b/i,
]

// Certification claims requiring primary source citations
const CERTIFICATION_CLAIMS = [
  { term: 'gia', label: 'GIA (Gemological Institute of America)' },
  { term: 'igi', label: 'IGI (International Gemological Institute)' },
  { term: 'hrd', label: 'HRD Antwerp' },
  { term: 'bis hallmarking', label: 'BIS Hallmarking' },
  { term: 'bis hallmarked', label: 'BIS Hallmarking' },
]

export function checkEditorialClaimsAndSeparation(
  bodyMarkdown: string,
  sources: SourceReference[] = []
): SafetyViolation[] {
  const violations: SafetyViolation[] = []
  if (!bodyMarkdown) return violations

  const lowerText = bodyMarkdown.toLowerCase()

  // 1. British/Indian English spelling enforcement
  for (const [american, british] of Object.entries(AMERICAN_SPELLING_MAP)) {
    const wordRegex = new RegExp(`\\b${american}\\b`, 'i')
    if (wordRegex.test(bodyMarkdown)) {
      violations.push({
        field: 'bodyMarkdown',
        rule: 'british_english_spelling',
        message: `Use British/Indian spelling "${british}" instead of American "${american}" for SHEWAH customer copy.`,
        severity: 'blocker',
      })
    }
  }

  // 2. Trade / B2B Leakage Prevention
  for (const tradeTerm of TRADE_LEAKAGE_TERMS) {
    const termRegex = new RegExp(`\\b${tradeTerm}\\b`, 'i')
    if (termRegex.test(bodyMarkdown)) {
      violations.push({
        field: 'bodyMarkdown',
        rule: 'trade_separation',
        message: `Article mentions wholesale/trade concept "${tradeTerm}". D2C articles must not leak B2B or manufacturing terms.`,
        severity: 'blocker',
      })
    }
  }

  // 3. Health & Medical Claims Block
  for (const pattern of HEALTH_CLAIMS_PATTERNS) {
    if (pattern.test(bodyMarkdown)) {
      violations.push({
        field: 'bodyMarkdown',
        rule: 'unsubstantiated_health_claim',
        message: 'Content contains unsubstantiated medicinal, therapeutic, or gemstone-healing health claims.',
        severity: 'blocker',
      })
      break
    }
  }

  // 4. Fake Customer Reviews Block
  for (const pattern of FAKE_REVIEW_PATTERNS) {
    if (pattern.test(bodyMarkdown)) {
      violations.push({
        field: 'bodyMarkdown',
        rule: 'fabricated_reviews',
        message: 'Consumer journal articles must not simulate fake customer testimonials or star ratings.',
        severity: 'blocker',
      })
      break
    }
  }

  // 5. Certification Claims Evidence Check
  for (const cert of CERTIFICATION_CLAIMS) {
    const certRegex = new RegExp(`\\b${cert.term}\\b`, 'i')
    if (certRegex.test(lowerText)) {
      // Must be substantiated by at least one source mentioning the certification organization
      const hasEvidence = sources.some((s) => {
        const fullSource = `${s.title} ${s.sourceName} ${s.url || ''}`.toLowerCase()
        return fullSource.includes(cert.term) || fullSource.includes(cert.label.toLowerCase())
      })

      if (!hasEvidence) {
        violations.push({
          field: 'sourceReferences',
          rule: 'unverified_certification_claim',
          message: `Article references ${cert.label} certification, but no verified primary source citation for ${cert.label} was provided.`,
          severity: 'blocker',
        })
      }
    }
  }

  return violations
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. COMPREHENSIVE SUBMISSION SAFETY INSPECTOR
// ─────────────────────────────────────────────────────────────────────────────

export interface FullArticleSubmission {
  title: string
  slug?: string
  bodyMarkdown: string
  category: string
  tags?: string[]
  heroImageUrl?: string | null
  heroImageAlt?: string | null
  heroImageCaption?: string | null
  heroImageRights?: string | null
  sourceReferences?: SourceReference[]
}

export function inspectSubmissionSafety(
  submission: FullArticleSubmission,
  allowedCategories: string[] = ['education', 'craftsmanship', 'style-guides', 'materials', 'diamonds', 'care-guide', 'buying-guide', 'styling']
): SafetyCheckResult {
  const violations: SafetyViolation[] = []

  // Category taxonomy check
  if (submission.category) {
    const catLower = submission.category.toLowerCase().trim()
    if (!allowedCategories.includes(catLower)) {
      violations.push({
        field: 'category',
        rule: 'category_taxonomy',
        message: `Category "${submission.category}" is not in the allowed list: ${allowedCategories.join(', ')}`,
        severity: 'blocker',
      })
    }
  }

  // Media safety check
  if (submission.heroImageUrl) {
    const mediaViolations = validateHeroMediaSafety({
      url: submission.heroImageUrl,
      altText: submission.heroImageAlt,
      caption: submission.heroImageCaption,
      rightsNote: submission.heroImageRights,
    })
    violations.push(...mediaViolations)
  }

  // URL safety check for source references
  if (submission.sourceReferences && Array.isArray(submission.sourceReferences)) {
    submission.sourceReferences.forEach((source, index) => {
      if (source.url) {
        const urlSafety = validateUrlSafety(source.url)
        if (!urlSafety.safe) {
          violations.push({
            field: `sourceReferences[${index}].url`,
            rule: 'ssrf_protection',
            message: `Source #${index + 1} URL "${source.url}" is unsafe: ${urlSafety.reason}`,
            severity: 'blocker',
          })
        }
      }
    })
  }

  // Markdown sanitization
  const sanitized = sanitizeMarkdownContent(submission.bodyMarkdown || '')

  // Prompt injection & hidden text check
  const injectionViolations = detectPromptInjectionAndHiddenText(submission.bodyMarkdown || '')
  violations.push(...injectionViolations)

  // Editorial claims, spelling, and trade separation check
  const claimViolations = checkEditorialClaimsAndSeparation(
    submission.bodyMarkdown || '',
    submission.sourceReferences || []
  )
  violations.push(...claimViolations)

  // Title checks
  if (submission.title) {
    const titleViolations = detectPromptInjectionAndHiddenText(submission.title)
    violations.push(...titleViolations)

    for (const [american, british] of Object.entries(AMERICAN_SPELLING_MAP)) {
      if (new RegExp(`\\b${american}\\b`, 'i').test(submission.title)) {
        violations.push({
          field: 'title',
          rule: 'british_english_spelling',
          message: `Title must use British/Indian spelling "${british}" instead of "${american}".`,
          severity: 'blocker',
        })
      }
    }
  }

  const blockers = violations.filter((v) => v.severity === 'blocker')

  return {
    passed: blockers.length === 0,
    violations,
    sanitizedBody: sanitized,
  }
}
