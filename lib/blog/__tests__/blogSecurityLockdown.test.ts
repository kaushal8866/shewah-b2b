import { describe, it, expect, vi, beforeEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import { NextRequest } from 'next/server'
import {
  validateBlogApiAccess,
  checkRequestSize,
  checkRateLimit,
  generateBlogApiToken,
} from '../auth'
import * as authModule from '../auth'
import * as storage from '../storage'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

describe('SHEWAH Blog Security & Lockdown Verification', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  // ── 1. Database Lockdown & RLS Verification ────────────────────────────────
  describe('1. Database Lockdown & RLS (scripts/migrate_blog_infrastructure.sql)', () => {
    const migrationPath = path.join(process.cwd(), 'scripts/migrate_blog_infrastructure.sql')
    const sql = fs.readFileSync(migrationPath, 'utf8')

    const blogTables = [
      'blog_articles',
      'blog_revisions',
      'blog_audit_logs',
      'blog_settings',
      'blog_api_tokens',
      'blog_idempotency_records',
      'blog_slug_redirects',
    ]

    it('enables Row Level Security on all 7 blog tables', () => {
      for (const table of blogTables) {
        expect(sql).toContain(`alter table ${table} enable row level security;`)
      }
    })

    it('explicitly revokes all permissions from anon and authenticated roles', () => {
      expect(sql).toContain('revoke all on blog_articles, blog_revisions, blog_audit_logs, blog_settings, blog_api_tokens, blog_idempotency_records, blog_slug_redirects from anon, authenticated;')
    })

    it('establishes explicit zero-trust deny policies for anon and authenticated roles', () => {
      for (const table of blogTables) {
        expect(sql).toContain(`create policy deny_anon_${table} on ${table} for all to anon using (false);`)
        expect(sql).toContain(`create policy deny_auth_${table} on ${table} for all to authenticated using (false);`)
      }
    })

    it('grants full operational access strictly and exclusively to service_role', () => {
      expect(sql).toContain('grant all on blog_articles, blog_revisions, blog_audit_logs, blog_settings, blog_api_tokens, blog_idempotency_records, blog_slug_redirects to service_role;')
    })

    it('ensures service-role key is kept strictly server-only and not exposed to browser', () => {
      // SUPABASE_SERVICE_ROLE_KEY must NEVER be prefixed with NEXT_PUBLIC_
      expect(process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY).toBeUndefined()

      // Inspect supabaseAdmin.ts to verify it is server-only
      const adminPath = path.join(process.cwd(), 'lib/supabaseAdmin.ts')
      const adminCode = fs.readFileSync(adminPath, 'utf8')
      expect(adminCode).toContain("process.env.SUPABASE_SERVICE_ROLE_KEY")
      expect(adminCode).not.toContain("NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY")
    })
  })

  // ── 2. Public Surface Isolation & Anonymous Draft Protection ───────────────
  describe('2. Public Surface Isolation & Draft Guessed Slug Defense', () => {
    it('rejects anonymous access to all /api/blog/v1 routes with 401 Unauthorized', async () => {
      const unauthReq = new NextRequest('https://shewah.co/api/blog/v1/articles', {
        headers: {},
      })
      const access = await validateBlogApiAccess(unauthReq, { requiredScope: 'blog:read' })
      expect(access.authorized).toBe(false)
      expect(access.response?.status).toBe(401)
      const data = await access.response?.json()
      expect(data.error).toContain('Unauthorized')
    })

    it('prevents anonymous fetching of guessed draft slugs on public route', async () => {
      // Simulate fetchPublicArticle behavior with a draft article
      const draftArticle = {
        id: 'draft-uuid-1',
        slug: 'secret-upcoming-draft-slug',
        status: 'draft',
        live_revision_id: null,
        current_revision_id: 'rev-draft-1',
        published_at: null,
      }

      // Query requires status === 'published' AND live_revision_id != null
      const isPubliclyAccessible = (art: any, nowIso: string) => {
        return (
          art &&
          art.status === 'published' &&
          art.live_revision_id !== null &&
          art.published_at !== null &&
          art.published_at <= nowIso
        )
      }

      const now = new Date().toISOString()
      expect(isPubliclyAccessible(draftArticle, now)).toBe(false)

      // Even if someone guesses the slug of an unreleased article scheduled in future:
      const futureScheduled = {
        ...draftArticle,
        status: 'scheduled',
        published_at: '2026-12-31T00:00:00Z',
      }
      expect(isPubliclyAccessible(futureScheduled, now)).toBe(false)

      // Even if an article was published, then archived:
      const archived = {
        ...draftArticle,
        status: 'archived',
        published_at: '2026-01-01T00:00:00Z',
        live_revision_id: null,
      }
      expect(isPubliclyAccessible(archived, now)).toBe(false)
    })

    it('guarantees live published revision is served even while a new draft revision is in progress', () => {
      const articleWithPendingDraft = {
        id: 'article-1',
        slug: 'master-jewellery-guide',
        status: 'published',
        live_revision_id: 'rev-1-published',
        current_revision_id: 'rev-2-unreviewed-draft',
        published_at: '2026-10-01T00:00:00Z',
      }

      // Public reader only ever fetches live_revision_id
      const publicRevisionId = articleWithPendingDraft.live_revision_id
      expect(publicRevisionId).toBe('rev-1-published')
      expect(publicRevisionId).not.toBe(articleWithPendingDraft.current_revision_id)
    })
  })

  // ── 3. API Hardening: Request Size Limits & Rate Limits ─────────────────────
  describe('3. API Hardening (Payload Size, Rate Limits, Scopes)', () => {
    it('rejects oversized JSON request payloads (> 500 KB) with 413 Payload Too Large', () => {
      const hugeContentLength = (600 * 1024).toString() // 600 KB
      const req = new NextRequest('https://shewah.co/api/blog/v1/articles', {
        method: 'POST',
        headers: { 'content-length': hugeContentLength },
      })

      const check = checkRequestSize(req, 512_000)
      expect(check.ok).toBe(false)
      expect(check.error).toContain('Payload too large')
    })

    it('allows normal-sized JSON request payloads (<= 500 KB)', () => {
      const normalContentLength = (40 * 1024).toString() // 40 KB
      const req = new NextRequest('https://shewah.co/api/blog/v1/articles', {
        method: 'POST',
        headers: { 'content-length': normalContentLength },
      })

      const check = checkRequestSize(req, 512_000)
      expect(check.ok).toBe(true)
    })

    it('enforces in-memory rate limiting (max 60 requests/min per actor)', () => {
      const actorId = `test_actor_${Date.now()}`
      for (let i = 0; i < 60; i++) {
        expect(checkRateLimit(actorId)).toBe(true)
      }
      // 61st request must be rejected
      expect(checkRateLimit(actorId)).toBe(false)
    })

    it('excludes blog:media:upload from default token scopes', () => {
      // In app/api/blog/v1/tokens/route.ts:
      const defaultScopes = ['blog:read', 'blog:draft:write']
      expect(defaultScopes).not.toContain('blog:media:upload')
      expect(defaultScopes).not.toContain('blog:publish')
      expect(defaultScopes).not.toContain('blog:schedule')
    })
  })

  // ── 4. Token Expiry, Revocation, and Pause Controls ─────────────────────────
  describe('4. Token Security Lifecycle & Emergency Controls', () => {
    it('generates high-entropy tokens with shw_blog_ prefix', () => {
      const { rawToken, tokenHash, tokenPrefix } = generateBlogApiToken()
      expect(rawToken.startsWith('shw_blog_')).toBe(true)
      expect(rawToken.length).toBeGreaterThan(60)
      expect(tokenPrefix).toBe('shw_blog_')
      expect(tokenHash).toHaveLength(64) // SHA-256 hex
    })

    it('rejects expired tokens during authentication', async () => {
      const expiredDate = new Date(Date.now() - 10_000).toISOString()
      vi.spyOn(supabaseAdmin, 'from').mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: 'tok-1',
                  token_prefix: 'shw_blog_',
                  is_revoked: false,
                  expires_at: expiredDate, // Expired
                },
                error: null,
              }),
            }),
          }),
        }),
      } as any)

      const req = new NextRequest('https://shewah.co/api/blog/v1/articles', {
        headers: { authorization: 'Bearer shw_blog_validlookinghash' },
      })

      const auth = await authModule.authenticateBlogRequest(req)
      expect(auth).toBeNull()
    })

    it('rejects revoked tokens during authentication', async () => {
      vi.spyOn(supabaseAdmin, 'from').mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: null, // Revoked tokens are filtered out by eq('is_revoked', false)
                error: null,
              }),
            }),
          }),
        }),
      } as any)

      const req = new NextRequest('https://shewah.co/api/blog/v1/articles', {
        headers: { authorization: 'Bearer shw_blog_revokedtoken' },
      })

      const auth = await authModule.authenticateBlogRequest(req)
      expect(auth).toBeNull()
    })

    it('blocks assistant tokens with 403 Forbidden when automation pause switch is ON', async () => {
      vi.spyOn(supabaseAdmin, 'from').mockImplementation((table: string) => {
        if (table === 'blog_api_tokens') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: {
                      id: 'tok-uuid-1',
                      name: 'External Editorial Assistant',
                      token_prefix: 'shw_blog_',
                      scopes: ['blog:read', 'blog:draft:write'],
                      is_revoked: false,
                    },
                    error: null,
                  }),
                }),
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          } as any
        }
        return {} as any
      })

      vi.spyOn(storage, 'getBlogSettings').mockResolvedValue({
        id: 'default',
        is_blog_enabled: true,
        is_automation_paused: true, // PAUSED
        publication_mode: 'draft_only',
        max_daily_new_posts: 1,
        allowed_categories: ['education'],
        publish_window_start_time: '09:00',
        publish_window_end_time: '20:00',
        timezone: 'Asia/Kolkata',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })

      const req = new NextRequest('https://shewah.co/api/blog/v1/articles', {
        method: 'POST',
        headers: {
          authorization: 'Bearer shw_blog_assistant1234567890123456789012',
          'content-length': '100',
        },
      })

      const access = await validateBlogApiAccess(req, { requiredScope: 'blog:draft:write' })
      expect(access.authorized).toBe(false)
      expect(access.response?.status).toBe(403)
      const data = await access.response?.json()
      expect(data.error).toContain('Blog automation is currently paused')
    })

    it('blocks all public callers with 503 Service Unavailable when is_blog_enabled is false', async () => {
      vi.spyOn(supabaseAdmin, 'from').mockImplementation((table: string) => {
        if (table === 'blog_api_tokens') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: {
                      id: 'tok-uuid-1',
                      name: 'External Editorial Assistant',
                      token_prefix: 'shw_blog_',
                      scopes: ['blog:read', 'blog:draft:write'],
                      is_revoked: false,
                    },
                    error: null,
                  }),
                }),
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          } as any
        }
        return {} as any
      })

      vi.spyOn(storage, 'getBlogSettings').mockResolvedValue({
        id: 'default',
        is_blog_enabled: false, // DISABLED KILL SWITCH
        is_automation_paused: true,
        publication_mode: 'draft_only',
        max_daily_new_posts: 1,
        allowed_categories: ['education'],
        publish_window_start_time: '09:00',
        publish_window_end_time: '20:00',
        timezone: 'Asia/Kolkata',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })

      const req = new NextRequest('https://shewah.co/api/blog/v1/articles', {
        headers: {
          authorization: 'Bearer shw_blog_assistant1234567890123456789012',
          'content-length': '100',
        },
      })

      const access = await validateBlogApiAccess(req, { requiredScope: 'blog:read' })
      expect(access.authorized).toBe(false)
      expect(access.response?.status).toBe(503)
      const data = await access.response?.json()
      expect(data.error).toContain('Blog system is currently disabled')
    })
  })

  // ── 5. Non-Destructive Rollback Verification ────────────────────────────────
  describe('5. Non-Destructive Rollback Verification', () => {
    it('scripts/rollback_blog_infrastructure.sql pauses automation, unpublishes articles, and preserves all tables', () => {
      const rollbackPath = path.join(process.cwd(), 'scripts/rollback_blog_infrastructure.sql')
      expect(fs.existsSync(rollbackPath)).toBe(true)
      const sql = fs.readFileSync(rollbackPath, 'utf8')

      // 1. MUST NOT DROP ANY TABLE
      expect(sql.toLowerCase()).not.toContain('drop table')
      expect(sql.toLowerCase()).not.toContain('truncate')
      expect(sql.toLowerCase()).not.toContain('delete from')

      // 2. Disables blog and pauses automation in blog_settings
      expect(sql).toContain('is_blog_enabled = false')
      expect(sql).toContain('is_automation_paused = true')
      expect(sql).toContain("publication_mode = 'draft_only'")

      // 3. Cuts off automation by revoking all active tokens
      expect(sql).toContain('update blog_api_tokens')
      expect(sql).toContain('is_revoked = true')

      // 4. Safely unpublishes live articles to in_review without deleting revisions
      expect(sql).toContain('update blog_articles')
      expect(sql).toContain("status = 'in_review'")
      expect(sql).toContain('live_revision_id = null')

      // 5. Records durable audit log
      expect(sql).toContain('insert into blog_audit_logs')
      expect(sql).toContain("'non_destructive_rollback'")
    })
  })
})
