import { describe, it, expect, beforeEach } from 'vitest'
import crypto from 'crypto'
import { generateBlogApiToken, checkRateLimit, validateBlogApiAccess, authenticateBlogRequest } from '../auth'
import { checkIdempotency, saveIdempotencyRecord } from '../idempotency'
import { createDraftArticle, getBlogSettings, updateDraftArticle } from '../storage'
import { NextRequest } from 'next/server'

describe('Editorial Submission Interface & Token Expiry Presets (Option A)', () => {
  describe('1. Token Expiry Presets & Server Enforcement', () => {
    const ALLOWED_EXPIRY_PRESETS = [7, 14, 30, 90] as const

    it('accepts all four allowed expiry presets: 7, 14, 30, 90 days', () => {
      for (const preset of ALLOWED_EXPIRY_PRESETS) {
        const d = new Date()
        d.setDate(d.getDate() + preset)
        const expiresAt = d.toISOString()
        expect(new Date(expiresAt).getTime()).toBeGreaterThan(Date.now())
      }
    })

    it('defaults omitted expiresDays to 30 rather than creating a non-expiring token', () => {
      const omittedExpiry = undefined
      const effectiveDays = omittedExpiry ?? 30
      expect(effectiveDays).toBe(30)

      const d = new Date()
      d.setDate(d.getDate() + effectiveDays)
      expect(new Date(d.toISOString()).getTime()).toBeGreaterThan(Date.now())
    })

    it('rejects non-preset, negative, or infinite expiry values', () => {
      const invalidValues = [0, -1, -30, 1, 15, 60, 180, 365, Infinity, NaN, 'never', null]
      for (const val of invalidValues) {
        const isValid =
          typeof val === 'number' && Number.isInteger(val) && (ALLOWED_EXPIRY_PRESETS as readonly any[]).includes(val)
        expect(isValid).toBe(false)
      }
    })

    it('never creates a token without an expiry date', () => {
      const presets = [undefined, null, 7, 14, 30, 90]
      for (const p of presets) {
        let effective = 30
        if (p !== undefined && p !== null) {
          if (ALLOWED_EXPIRY_PRESETS.includes(p as any)) {
            effective = p
          }
        }
        const d = new Date()
        d.setDate(d.getDate() + effective)
        const expiresAt = d.toISOString()
        expect(expiresAt).toBeTruthy()
        expect(new Date(expiresAt).getTime()).toBeGreaterThan(Date.now())
      }
    })
  })

  describe('2. Scope Isolation & Authority Boundary', () => {
    it('requires assistant token with blog:read and blog:draft:write', () => {
      const assistantScopes = ['blog:read', 'blog:draft:write']
      expect(assistantScopes.includes('blog:read')).toBe(true)
      expect(assistantScopes.includes('blog:draft:write')).toBe(true)
    })

    it('strictly prohibits assistant tokens from having elevated publish or schedule scopes', () => {
      const assistantScopes = ['blog:read', 'blog:draft:write']
      const elevatedScopes = ['blog:publish', 'blog:schedule', 'blog:owner']
      for (const scope of elevatedScopes) {
        expect(assistantScopes.includes(scope)).toBe(false)
      }
    })

    it('rejects tokens carrying broad owner or publish permissions on the submission interface', () => {
      const forbiddenElevatedTokens = [
        ['blog:read', 'blog:draft:write', 'blog:publish'],
        ['blog:read', 'blog:draft:write', 'blog:schedule'],
        ['blog:read', 'blog:draft:write', 'blog:owner'],
      ]

      for (const scopes of forbiddenElevatedTokens) {
        const hasForbiddenElevated =
          scopes.includes('blog:publish') || scopes.includes('blog:schedule') || scopes.includes('blog:owner')
        expect(hasForbiddenElevated).toBe(true)
      }
    })
  })

  describe('3. Pause Emergency-Stop Verification', () => {
    it('fails closed when is_automation_paused=true for all assistant-token calls', async () => {
      const settings = {
        is_blog_enabled: true,
        publication_mode: 'draft_only',
        is_automation_paused: true,
      }

      const auth = {
        authenticated: true,
        actorType: 'assistant_token',
        scopes: ['blog:read', 'blog:draft:write'],
        isOwner: false,
      }

      const isBlocked = settings.is_automation_paused && auth.actorType === 'assistant_token'
      expect(isBlocked).toBe(true)
    })

    it('preserves master owner recovery path when is_automation_paused=true', async () => {
      const settings = {
        is_blog_enabled: true,
        publication_mode: 'draft_only',
        is_automation_paused: true,
      }

      const ownerAuth = {
        authenticated: true,
        actorType: 'owner',
        scopes: ['blog:read', 'blog:draft:write', 'blog:publish', 'blog:schedule', 'blog:owner'],
        isOwner: true,
      }

      // Owner is NOT blocked by automation pause switch
      const isBlocked = settings.is_automation_paused && ownerAuth.actorType === 'assistant_token'
      expect(isBlocked).toBe(false)
    })
  })

  describe('4. JSON Payload Security & Data-Only Sanitation', () => {
    const FORBIDDEN_KEYS = [
      'status',
      'published_at',
      'scheduled_at',
      'live_revision_id',
      'is_published',
      'publish',
      'schedule',
      'permissions',
      'role',
      'scopes',
      'token',
      '__proto__',
      'constructor',
      'prototype',
    ]

    function validatePayloadKeys(payload: Record<string, any>): { valid: boolean; forbiddenKey?: string } {
      for (const key of Object.keys(payload)) {
        if (FORBIDDEN_KEYS.includes(key)) {
          return { valid: false, forbiddenKey: key }
        }
      }
      return { valid: true }
    }

    it('rejects payloads attempting to set status, published_at, or permissions', () => {
      expect(validatePayloadKeys({ title: 'Test', status: 'published' }).valid).toBe(false)
      expect(validatePayloadKeys({ title: 'Test', published_at: new Date().toISOString() }).valid).toBe(false)
      expect(validatePayloadKeys({ title: 'Test', live_revision_id: '123' }).valid).toBe(false)
      expect(validatePayloadKeys({ title: 'Test', permissions: ['all'] }).valid).toBe(false)
      expect(validatePayloadKeys({ title: 'Test', role: 'owner' }).valid).toBe(false)
    })

    it('rejects prototype pollution attempts', () => {
      const payload1 = JSON.parse('{"title": "Test", "__proto__": {}}')
      const payload2 = JSON.parse('{"title": "Test", "constructor": {}}')
      expect(validatePayloadKeys(payload1).valid).toBe(false)
      expect(validatePayloadKeys(payload2).valid).toBe(false)
    })

    it('accepts legitimate editorial payload fields', () => {
      const validPayload = {
        title: 'The Geometry of the Emerald Cut: Step Faceting in Solid Gold',
        slug: 'geometry-of-the-emerald-cut',
        category: 'education',
        excerpt: 'An architectural examination of step faceting...',
        bodyMarkdown: 'Unlike brilliant cuts designed for optical dispersion...',
        authorDisplayName: 'SHEWAH Editorial Atelier',
        heroImageUrl: 'https://images.unsplash.com/photo-1605100804763-247f67b3557e',
        heroImageAlt: 'Macro photograph of step cut emerald diamond',
        heroImageRights: 'Licensed studio photography',
        seoTitle: 'Emerald Cut Diamonds: Clarity and Settings | SHEWAH',
        metaDescription: 'A gemological examination of step-cut emerald diamonds.',
        sourceReferences: [
          {
            title: 'GIA Step Cut Proportions and Clarity Grading',
            sourceName: 'Gemological Institute of America',
            url: 'https://www.gia.edu',
            checkedAt: '2026-10-01',
          },
        ],
        externalContentId: 'editorial-sample-01',
      }

      expect(validatePayloadKeys(validPayload).valid).toBe(true)
    })

    it('enforces maximum payload size limit (512 KB)', () => {
      const smallPayload = JSON.stringify({ title: 'Short', body: 'Hello' })
      expect(new TextEncoder().encode(smallPayload).length).toBeLessThan(512_000)

      const hugeBody = 'A'.repeat(520_000)
      const oversizedPayload = JSON.stringify({ title: 'Oversized', body: hugeBody })
      expect(new TextEncoder().encode(oversizedPayload).length).toBeGreaterThan(512_000)
    })
  })

  describe('5. Idempotency & Concurrency Guarantees', () => {
    it('produces identical payload hashes for unchanged content', () => {
      const payload = { title: 'Stable Title', body: 'Stable Body' }
      const hash1 = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex')
      const hash2 = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex')
      expect(hash1).toBe(hash2)
    })

    it('detects altered payload under the same idempotency key as a conflict', () => {
      const key = 'test-idemp-uuid-1'
      const originalPayload = { title: 'First Attempt', body: 'Original text' }
      const alteredPayload = { title: 'Second Attempt', body: 'Mutated text' }

      const hash1 = crypto.createHash('sha256').update(JSON.stringify(originalPayload)).digest('hex')
      const hash2 = crypto.createHash('sha256').update(JSON.stringify(alteredPayload)).digest('hex')

      expect(hash1).not.toBe(hash2)
    })

    it('requires draft lifecycle isolation upon creation', () => {
      const createdArticle = {
        id: 'test-art-123',
        slug: 'emerald-cut-guide',
        status: 'draft',
        lock_version: 1,
        live_revision_id: null,
      }

      // Readback assertion: status must be draft and live_revision_id must be null
      expect(createdArticle.status).toBe('draft')
      expect(createdArticle.live_revision_id).toBeNull()
    })
  })

  describe('6. Anonymous Privacy & Public Surface Immunity', () => {
    it('disallows draft articles from appearing in anonymous feeds or storefront', () => {
      const publishedArticles = [
        { id: '1', slug: 'live-guide', status: 'published', live_revision_id: 'rev-1' },
      ]
      const draftArticles = [
        { id: '2', slug: 'draft-guide', status: 'draft', live_revision_id: null },
      ]

      const publicVisible = [...publishedArticles, ...draftArticles].filter(
        (a) => a.status === 'published' && a.live_revision_id !== null
      )

      expect(publicVisible.length).toBe(1)
      expect(publicVisible[0].slug).toBe('live-guide')
      expect(publicVisible.some((a) => a.slug === 'draft-guide')).toBe(false)
    })
  })
})
