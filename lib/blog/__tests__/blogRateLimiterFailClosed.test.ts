import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import {
  checkRateLimit,
  validateBlogApiAccess,
  checkInMemoryRateLimit,
} from '../auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import * as storage from '../storage'

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}))

describe('Fail-Closed Rate Limiter & Serverless Isolation Tests', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    vi.restoreAllMocks()
    vi.mocked(getServerSession).mockResolvedValue(null)
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  // ── 1. Deployed Environment Fail-Closed Guarantees ────────────────────────
  describe('1. Fail-Closed on Outages in Deployed Environments', () => {
    it('returns 503 Service Unavailable when the database has an outage in Vercel preview/production', async () => {
      // Simulate Vercel Preview environment
      process.env.VERCEL = '1'
      process.env.VERCEL_ENV = 'preview'

      // Mock database failure (outage / 500 error from Supabase)
      vi.spyOn(supabaseAdmin, 'from').mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            abortSignal: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'Database connection failed: 503 Service Unavailable', code: 'PGRST000' },
              }),
            }),
          }),
        }),
      } as any)

      const result = await checkRateLimit('external_assistant_token_1')

      // MUST FAIL CLOSED: not allowed, returns 503
      expect(result.allowed).toBe(false)
      expect(result.status).toBe(503)
      expect(result.error).toContain('Rate limiting service temporarily unavailable')
    })

    it('returns 503 Service Unavailable when blog_rate_limits table is missing in preview/production', async () => {
      process.env.VERCEL = '1'
      process.env.VERCEL_ENV = 'preview'

      // Mock table missing error (PostgreSQL 42P01: relation does not exist)
      vi.spyOn(supabaseAdmin, 'from').mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            abortSignal: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'relation "blog_rate_limits" does not exist', code: '42P01' },
              }),
            }),
          }),
        }),
      } as any)

      const result = await checkRateLimit('external_assistant_token_2')

      expect(result.allowed).toBe(false)
      expect(result.status).toBe(503)
      expect(result.error).toContain('Rate limiting service temporarily unavailable')
    })

    it('returns 503 Service Unavailable upon query timeout/abort in deployed environment', async () => {
      process.env.VERCEL = '1'
      process.env.VERCEL_ENV = 'preview'

      // Mock abort / timeout exception
      vi.spyOn(supabaseAdmin, 'from').mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            abortSignal: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockRejectedValue(new Error('The operation was aborted due to timeout')),
            }),
          }),
        }),
      } as any)

      const result = await checkRateLimit('external_assistant_token_3')

      expect(result.allowed).toBe(false)
      expect(result.status).toBe(503)
      expect(result.error).toContain('Rate limiting service temporarily unavailable')
    })
  })

  // ── 2. Multi-Worker & Cold-Start Shared Allowance ─────────────────────────
  describe('2. Multi-Worker / Cold-Start Shared Allowance Simulation', () => {
    it('shares allowance across separate simulated serverless instances via persistent store', async () => {
      process.env.VERCEL = '1'
      process.env.VERCEL_ENV = 'preview'

      // Shared simulated database row across distinct lambda workers
      let sharedDbCount = 0
      const windowStart = new Date().toISOString()

      vi.spyOn(supabaseAdmin, 'from').mockImplementation((table: string) => {
        if (table === 'blog_rate_limits') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                abortSignal: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockImplementation(() => {
                    return Promise.resolve({
                      data: sharedDbCount > 0 ? { count: sharedDbCount, window_start: windowStart } : null,
                      error: null,
                    })
                  }),
                }),
              }),
            }),
            insert: vi.fn().mockImplementation(() => {
              sharedDbCount = 1
              return Promise.resolve({ error: null })
            }),
            update: vi.fn().mockImplementation((payload: any) => {
              if (payload.count !== undefined) {
                sharedDbCount = payload.count
              }
              return {
                eq: vi.fn().mockResolvedValue({ error: null }),
              }
            }),
          } as any
        }
        return {} as any
      })

      // Worker 1 (Cold Start Lambda Instance A) sends 30 requests
      for (let i = 0; i < 30; i++) {
        const res = await checkRateLimit('shared_actor_uuid')
        expect(res.allowed).toBe(true)
      }
      expect(sharedDbCount).toBe(30)

      // Worker 2 (Cold Start Lambda Instance B) sends 30 requests
      for (let i = 0; i < 30; i++) {
        const res = await checkRateLimit('shared_actor_uuid')
        expect(res.allowed).toBe(true)
      }
      expect(sharedDbCount).toBe(60)

      // 61st request from Worker 3 (Lambda Instance C) MUST BE THROTTLED
      const throttled = await checkRateLimit('shared_actor_uuid')
      expect(throttled.allowed).toBe(false)
      expect(throttled.status).toBe(429)
      expect(throttled.error).toContain('Too many requests')
    })
  })

  // ── 3. Owner Recovery Path & Authentication Precedence ────────────────────
  describe('3. Owner Recovery Path & Auth Precedence', () => {
    it('rejects unauthenticated requests with 401 without querying rate limit tables', async () => {
      const fromSpy = vi.spyOn(supabaseAdmin, 'from')

      const unauthReq = new NextRequest('https://shewah.co/api/blog/v1/articles', {
        headers: {},
      })

      const access = await validateBlogApiAccess(unauthReq, { requiredScope: 'blog:read' })
      expect(access.authorized).toBe(false)
      expect(access.response?.status).toBe(401)

      // Rate limit table must NOT be queried for unauthenticated requests
      const rateLimitTableCalls = fromSpy.mock.calls.filter(c => c[0] === 'blog_rate_limits')
      expect(rateLimitTableCalls.length).toBe(0)
    })

    it('exempts Atelier Owner from rate limiter to ensure emergency recovery access', async () => {
      process.env.VERCEL = '1'
      process.env.VERCEL_ENV = 'preview'

      vi.spyOn(storage, 'getBlogSettings').mockResolvedValue({
        id: 'default',
        is_blog_enabled: true,
        is_automation_paused: false,
        publication_mode: 'draft_only',
        max_daily_new_posts: 1,
        allowed_categories: ['education'],
        publish_window_start_time: '09:00',
        publish_window_end_time: '20:00',
        timezone: 'Asia/Kolkata',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })

      // Even if database rate limiter is in full outage (mocked error)
      vi.spyOn(supabaseAdmin, 'from').mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            abortSignal: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'Database connection failed', code: 'PGRST000' },
              }),
            }),
          }),
        }),
      } as any)

      // Create an owner request (NextAuth master session)
      const ownerReq = new NextRequest('https://shewah.co/api/blog/v1/settings', {
        headers: {
          // In real NextAuth, session cookie is parsed by getServerSession
        },
      })

      // Mock getServerSession returning master owner
      vi.mocked(getServerSession).mockResolvedValue({
        user: {
          id: 'owner_user_uuid',
          role: 'master',
          displayName: 'Atelier Master',
        },
      } as any)

      // The owner retains an emergency recovery path
      const access = await validateBlogApiAccess(ownerReq, { requireOwner: true })
      // Even during external rate limiter outage, owner can administer settings
      expect(access.authorized).toBe(true)
      expect(access.auth?.isOwner).toBe(true)
    })
  })
})
