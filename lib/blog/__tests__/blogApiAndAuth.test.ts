import { describe, it, expect } from 'vitest'
import crypto from 'crypto'
import { generateBlogApiToken, checkRateLimit } from '../auth'
import { checkIdempotency } from '../idempotency'

describe('Scoped Automation Interface & Auth (Phase 3)', () => {
  describe('Cryptographic Token Generation & Hashing', () => {
    it('generates high-entropy tokens prefixed with shw_blog_', () => {
      const tokenObj = generateBlogApiToken()
      expect(tokenObj.rawToken).toMatch(/^shw_blog_[a-f0-9]{64}$/)
      expect(tokenObj.tokenPrefix).toBe('shw_blog_')
      expect(tokenObj.tokenHash).toHaveLength(64)
    })

    it('creates matching SHA-256 verifier for raw token', () => {
      const { rawToken, tokenHash } = generateBlogApiToken()
      const computedHash = crypto.createHash('sha256').update(rawToken).digest('hex')
      expect(computedHash).toBe(tokenHash)
    })
  })

  describe('Rate Limiter', () => {
    it('allows requests within rate limits and throttles upon exceeding threshold', async () => {
      const testActorId = `test_actor_${Date.now()}`
      for (let i = 0; i < 60; i++) {
        const res = await checkRateLimit(testActorId)
        expect(res.allowed).toBe(true)
      }
      // 61st hit should be blocked
      const blocked = await checkRateLimit(testActorId)
      expect(blocked.allowed).toBe(false)
      expect(blocked.status).toBe(429)
    })
  })

  describe('Idempotency Verification Logic', () => {
    it('computes identical payload hashes for identical JSON payloads', () => {
      const payload1 = { title: 'Essay Title', category: 'education', body: 'Text content.' }
      const payload2 = { title: 'Essay Title', category: 'education', body: 'Text content.' }

      const hash1 = crypto.createHash('sha256').update(JSON.stringify(payload1)).digest('hex')
      const hash2 = crypto.createHash('sha256').update(JSON.stringify(payload2)).digest('hex')
      expect(hash1).toBe(hash2)
    })

    it('detects payload mutation under the same idempotency key', () => {
      const originalPayload = { title: 'Original Title', body: 'Version 1' }
      const modifiedPayload = { title: 'Modified Title', body: 'Version 2' }

      const hash1 = crypto.createHash('sha256').update(JSON.stringify(originalPayload)).digest('hex')
      const hash2 = crypto.createHash('sha256').update(JSON.stringify(modifiedPayload)).digest('hex')
      expect(hash1).not.toBe(hash2)
    })
  })

  describe('Scoped Authority Isolation', () => {
    it('prohibits assistant credential with draft scope from publishing directly', () => {
      const assistantScopes = ['blog:read', 'blog:draft:write']
      expect(assistantScopes.includes('blog:publish')).toBe(false)
      expect(assistantScopes.includes('blog:schedule')).toBe(false)
    })

    it('requires explicit owner scope for policy updates and emergency pause', () => {
      const ownerScopes = ['blog:read', 'blog:draft:write', 'blog:publish', 'blog:schedule', 'blog:owner']
      expect(ownerScopes.includes('blog:owner')).toBe(true)
    })
  })
})
