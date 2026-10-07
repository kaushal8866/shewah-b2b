import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import {
  ALLOWED_STATUS_TRANSITIONS,
  canTransitionStatus,
  calculateReadingTime,
  generateSlug,
  validateSlug,
  computeContentHash,
  BlogStatus,
} from '../types'
import {
  sanitizeMarkdown,
  isSafeUrl,
  validateDraftPayload,
  validateForPublication,
} from '../validation'

describe('Blog Editorial Model & State Machine', () => {
  describe('Status Transition Graph', () => {
    it('allows valid forward and review transitions', () => {
      expect(canTransitionStatus('draft', 'in_review')).toBe(true)
      expect(canTransitionStatus('in_review', 'scheduled')).toBe(true)
      expect(canTransitionStatus('in_review', 'published')).toBe(true)
      expect(canTransitionStatus('scheduled', 'published')).toBe(true)
    })

    it('allows unpublishing and archiving from published state', () => {
      expect(canTransitionStatus('published', 'in_review')).toBe(true)
      expect(canTransitionStatus('published', 'archived')).toBe(true)
    })

    it('rejects illegal transitions that skip lifecycle gates', () => {
      // Draft cannot jump directly to published without review/validation
      expect(canTransitionStatus('draft', 'published')).toBe(false)
      // Draft cannot jump directly to scheduled without review
      expect(canTransitionStatus('draft', 'scheduled')).toBe(false)
      // Archived cannot jump directly to published
      expect(canTransitionStatus('archived', 'published')).toBe(false)
    })

    it('allows self-transitions', () => {
      const statuses: BlogStatus[] = ['draft', 'in_review', 'scheduled', 'published', 'archived']
      for (const s of statuses) {
        expect(canTransitionStatus(s, s)).toBe(true)
      }
    })
  })

  describe('Reading Time Calculation', () => {
    it('returns minimum 1 minute for short text or empty input', () => {
      expect(calculateReadingTime('')).toBe(1)
      expect(calculateReadingTime('Short sentence.')).toBe(1)
      expect(calculateReadingTime('   ')).toBe(1)
    })

    it('calculates accurate reading time at ~200 wpm', () => {
      const words100 = new Array(100).fill('gemstone').join(' ')
      expect(calculateReadingTime(words100)).toBe(1) // 100/200 = 0.5 -> ceil = 1

      const words350 = new Array(350).fill('diamond').join(' ')
      expect(calculateReadingTime(words350)).toBe(2) // 350/200 = 1.75 -> ceil = 2

      const words650 = new Array(650).fill('atelier').join(' ')
      expect(calculateReadingTime(words650)).toBe(4) // 650/200 = 3.25 -> ceil = 4
    })

    it('ignores HTML tags when computing word count', () => {
      const htmlText = '<div class="atelier"><p>' + new Array(100).fill('craftsmanship').join(' ') + '</p></div>'
      expect(calculateReadingTime(htmlText)).toBe(1)
    })
  })

  describe('Slug Generation & Validation', () => {
    it('generates clean URL slugs from titles', () => {
      expect(generateSlug('The Architectural Solitaire: A Guide to Diamond Cuts')).toBe(
        'the-architectural-solitaire-a-guide-to-diamond-cuts'
      )
      expect(generateSlug('18K Gold vs. 14K Gold: Which Purity to Choose?')).toBe(
        '18k-gold-vs-14k-gold-which-purity-to-choose'
      )
      expect(generateSlug('   Surat Diamond Bourse & Lab-Grown Diamonds!   ')).toBe(
        'surat-diamond-bourse-lab-grown-diamonds'
      )
    })

    it('validates compliant and non-compliant slugs', () => {
      expect(validateSlug('lab-grown-diamonds-guide')).toBe(true)
      expect(validateSlug('solid-18k-gold-craftsmanship')).toBe(true)

      // Invalid
      expect(validateSlug('')).toBe(false)
      expect(validateSlug('ab')).toBe(false) // too short (< 3)
      expect(validateSlug('-leading-hyphen')).toBe(false)
      expect(validateSlug('trailing-hyphen-')).toBe(false)
      expect(validateSlug('Uppercase-Not-Allowed')).toBe(false)
      expect(validateSlug('spaces in slug')).toBe(false)
      expect(validateSlug('special_chars$here')).toBe(false)
    })
  })

  describe('Content Integrity Hash', () => {
    it('produces deterministic SHA-256 hashes', () => {
      const payload = {
        title: 'Understanding Diamond Fluoresence',
        bodyMarkdown: 'Fluorescence in diamonds is the visible light emitted...',
        sources: [{ title: 'GIA Research', sourceName: 'GIA', checkedAt: '2026-09-01' }],
        excerpt: 'A comprehensive study on UV fluorescence.',
      }

      const hash1 = computeContentHash(payload)
      const hash2 = computeContentHash(payload)
      expect(hash1).toBe(hash2)
      expect(hash1).toHaveLength(64)
    })

    it('changes hash when any content field changes', () => {
      const base = {
        title: 'Title',
        bodyMarkdown: 'Content here.',
        sources: [],
      }
      const modified = {
        title: 'Title',
        bodyMarkdown: 'Content here. (Updated edit)',
        sources: [],
      }
      expect(computeContentHash(base)).not.toBe(computeContentHash(modified))
    })
  })

  describe('Content Safety & Markdown Sanitization', () => {
    it('strips executable script and iframe tags', () => {
      const malicious = 'Safe text <script>alert("xss")</script> more text <iframe src="evil.com"></iframe> ending.'
      const sanitized = sanitizeMarkdown(malicious)
      expect(sanitized).not.toContain('<script>')
      expect(sanitized).not.toContain('alert')
      expect(sanitized).not.toContain('<iframe>')
      expect(sanitized).toContain('Safe text')
      expect(sanitized).toContain('ending.')
    })

    it('neutralizes dangerous protocol links in markdown', () => {
      const malicious = 'Click [here](javascript:stealCookies()) or [here](data:text/html;base64,...)'
      const sanitized = sanitizeMarkdown(malicious)
      expect(sanitized).not.toContain('javascript:')
      expect(sanitized).not.toContain('data:')
      expect(sanitized).toContain('[here](#)')
    })

    it('validates URL safety', () => {
      expect(isSafeUrl('https://shewah.co/diamonds')).toBe(true)
      expect(isSafeUrl('http://example.com/source')).toBe(true)
      expect(isSafeUrl('javascript:void(0)')).toBe(false)
      expect(isSafeUrl('data:text/html,bad')).toBe(false)
      expect(isSafeUrl('invalid-url')).toBe(false)
    })
  })

  describe('Validation Engine', () => {
    const validDraft = {
      title: 'A Guide to Lab-Grown Diamonds vs Natural Diamonds',
      slug: 'guide-lab-grown-diamonds-vs-natural',
      bodyMarkdown: 'Lab-grown diamonds share identical physical, chemical, and optical properties with mined diamonds. Crafted in high-pressure ateliers, each gemstone undergoes precise laser cutting and certification by reputable gemological laboratories like IGI and GIA. Whether set in solid 18K gold or platinum, modern lab-grown solitaires offer extraordinary brilliance and craftsmanship with complete traceability.',
      category: 'education',
      heroImageUrl: 'https://images.unsplash.com/photo-1605100804763-247f67b3557e',
      heroImageAlt: 'Macro view of certified brilliant cut diamond',
      heroImageRights: 'Licensed studio photography via Unsplash',
      authorDisplayName: 'SHEWAH Master Gemologist',
      seoTitle: 'Lab-Grown vs Natural Diamonds: The Essential Guide | SHEWAH',
      metaDescription: 'Discover the scientific differences, valuation factors, and ethical considerations between lab-grown and mined natural diamonds.',
      sourceReferences: [
        {
          title: 'IGI Lab Grown Diamond Grading Standards',
          sourceName: 'International Gemological Institute',
          url: 'https://www.igi.org',
          checkedAt: '2026-09-15',
        },
        {
          title: 'GIA Diamond Origin and Grading Overview',
          sourceName: 'Gemological Institute of America',
          url: 'https://www.gia.edu',
          checkedAt: '2026-09-15',
        },
      ],
    }

    it('approves a well-formed draft payload', () => {
      const res = validateDraftPayload(validDraft)
      expect(res.valid).toBe(true)
      expect(res.blockers).toHaveLength(0)
    })

    it('blocks drafts with missing title or invalid category', () => {
      const invalid = { ...validDraft, title: '', category: 'unapproved-category' }
      const res = validateDraftPayload(invalid)
      expect(res.valid).toBe(false)
      expect(res.blockers.some((b) => b.includes('Title is required'))).toBe(true)
      expect(res.blockers.some((b) => b.includes('not in the allowed list'))).toBe(true)
    })

    it('strictly enforces publication requirements', () => {
      // Incomplete draft attempting to publish
      const incomplete = {
        title: 'Short title',
        bodyMarkdown: 'Too short to publish.',
        category: 'education',
      }
      const res = validateForPublication(incomplete)
      expect(res.valid).toBe(false)
      expect(res.blockers.some((b) => b.includes('approved URL slug'))).toBe(true)
      expect(res.blockers.some((b) => b.includes('approved hero image'))).toBe(true)
      expect(res.blockers.some((b) => b.includes('author display name'))).toBe(true)
      expect(res.blockers.some((b) => b.includes('SEO title'))).toBe(true)
      expect(res.blockers.some((b) => b.includes('meta description'))).toBe(true)
      expect(res.blockers.some((b) => b.includes('verified primary source'))).toBe(true)
    })

    it('approves complete article for publication', () => {
      const res = validateForPublication(validDraft)
      expect(res.valid).toBe(true)
      expect(res.blockers).toHaveLength(0)
    })
  })

  describe('Database Migration Scripts Validation', () => {
    it('migration SQL script exists and contains all required blog tables', () => {
      const migrationPath = path.join(process.cwd(), 'scripts/migrate_blog_infrastructure.sql')
      expect(fs.existsSync(migrationPath)).toBe(true)

      const sql = fs.readFileSync(migrationPath, 'utf8')
      expect(sql).toContain('create table if not exists blog_articles')
      expect(sql).toContain('create table if not exists blog_revisions')
      expect(sql).toContain('create table if not exists blog_audit_logs')
      expect(sql).toContain('create table if not exists blog_settings')
      expect(sql).toContain('create table if not exists blog_api_tokens')
      expect(sql).toContain('create table if not exists blog_idempotency_records')
      expect(sql).toContain('create table if not exists blog_slug_redirects')
      expect(sql).toContain('lock_version')
      expect(sql).toContain('live_revision_id')
      expect(sql).toContain('current_revision_id')
      expect(sql).toContain('external_content_id')
    })

    it('rollback SQL script exists and safely cleans up all blog tables', () => {
      const rollbackPath = path.join(process.cwd(), 'scripts/rollback_blog_infrastructure.sql')
      expect(fs.existsSync(rollbackPath)).toBe(true)

      const sql = fs.readFileSync(rollbackPath, 'utf8')
      expect(sql).toContain('drop table if exists blog_idempotency_records cascade')
      expect(sql).toContain('drop table if exists blog_audit_logs cascade')
      expect(sql).toContain('drop table if exists blog_api_tokens cascade')
      expect(sql).toContain('drop table if exists blog_slug_redirects cascade')
      expect(sql).toContain('drop table if exists blog_settings cascade')
      expect(sql).toContain('drop table if exists blog_articles cascade')
      expect(sql).toContain('drop table if exists blog_revisions cascade')
    })
  })
})
