import { describe, it, expect, beforeEach, vi } from 'vitest'
import crypto from 'crypto'

const mockState = {
  articles: [] as any[],
  revisions: [] as any[],
  auditLogs: [] as any[],
}

vi.mock('@/lib/supabaseAdmin', () => {
  function buildQuery(table: string) {
    const filters: Array<(row: any) => boolean> = []
    let selectOpts: any = {}
    let orderSpec: { col: string; ascending: boolean } | null = null
    let limitCount: number | null = null

    const getTableRows = (): any[] => {
      if (table === 'blog_articles') return mockState.articles
      if (table === 'blog_revisions') return mockState.revisions
      if (table === 'blog_audit_logs') return mockState.auditLogs
      return []
    }

    const execute = () => {
      const rows = getTableRows()
      const matched = rows.filter((r) => filters.every((f) => f(r)))
      let result = [...matched]
      if (orderSpec) {
        const { col, ascending } = orderSpec
        result.sort((a, b) => {
          const va = a[col] ?? ''
          const vb = b[col] ?? ''
          if (va < vb) return ascending ? -1 : 1
          if (va > vb) return ascending ? 1 : -1
          return 0
        })
      }
      if (limitCount !== null) {
        result = result.slice(0, limitCount)
      }
      return { data: result, count: matched.length, error: null }
    }

    const chain: any = {
      select(_cols = '*', opts?: any) {
        selectOpts = opts || {}
        return chain
      },
      eq(col: string, val: any) {
        filters.push((r) => r[col] === val)
        return chain
      },
      neq(col: string, val: any) {
        filters.push((r) => r[col] !== val)
        return chain
      },
      not(col: string, op: string, val: any) {
        if (op === 'is') {
          filters.push((r) => r[col] !== val)
        }
        return chain
      },
      in(col: string, vals: any[]) {
        filters.push((r) => vals.includes(r[col]))
        return chain
      },
      ilike(col: string, val: string) {
        const pattern = val.replace(/%/g, '.*')
        const re = new RegExp(pattern, 'i')
        filters.push((r) => re.test(String(r[col] ?? '')))
        return chain
      },
      filter(col: string, op: string, val: any) {
        if (col.includes('->>')) {
          const [field, key] = col.split('->>')
          filters.push((r) => r[field]?.[key] === val)
        } else if (op === 'eq') {
          filters.push((r) => r[col] === val)
        }
        return chain
      },
      or(clause: string) {
        const parts = clause.split(',')
        filters.push((r) => {
          return parts.some((p) => {
            const [col, op, val] = p.split('.')
            if (op === 'ilike') {
              const pattern = (val || '').replace(/%/g, '.*')
              const re = new RegExp(pattern, 'i')
              return re.test(String(r[col] ?? ''))
            }
            return false
          })
        })
        return chain
      },
      order(col: string, opts?: { ascending?: boolean }) {
        orderSpec = { col, ascending: opts?.ascending !== false }
        return chain
      },
      limit(n: number) {
        limitCount = n
        return chain
      },
      single() {
        const res = execute()
        const row = Array.isArray(res.data) ? res.data[0] : res.data
        return Promise.resolve({ data: row || null, error: row ? null : { message: 'Not found' } })
      },
      maybeSingle() {
        const res = execute()
        const row = Array.isArray(res.data) ? res.data[0] : res.data
        return Promise.resolve({ data: row || null, error: null })
      },
      then(resolve: any, reject: any) {
        return Promise.resolve(execute()).then(resolve, reject)
      },
    }

    return chain
  }

  return {
    supabaseAdmin: {
      from: (table: string) => buildQuery(table),
    },
  }
})

import { lookupBlogMediaRecord } from '../media'

describe('Blog Media Lookup & Restoration Regression Suite', () => {
  beforeEach(() => {
    mockState.articles = []
    mockState.revisions = []
    mockState.auditLogs = []
  })

  it('rejects invalid or traversal media IDs immediately', async () => {
    const invalidRes = await lookupBlogMediaRecord('invalid/../traversal')
    expect(invalidRes.found).toBe(false)
    expect(invalidRes.isPublishedLive).toBe(false)
  })

  it('resolves published hero images even when beyond older 200 upload logs', async () => {
    const heroMediaId = '166c7165-3d81-44ab-8dec-50255b257a2a'
    const heroStorageKey = `blog-draft-media/2026/10/${heroMediaId}.jpg`
    const articleId = 'f9a504a6-672a-4f13-9805-13014b1b1d63'
    const revisionId = 'b218b0db-8576-4c4e-985e-581fb63c1c77'

    // Simulate audit log exists
    mockState.auditLogs.push({
      id: crypto.randomUUID(),
      operation: 'upload_media',
      outcome: 'success',
      created_at: '2026-10-13T04:36:58Z',
      diff_summary: {
        mediaId: heroMediaId,
        storageKey: heroStorageKey,
        mimeType: 'image/jpeg',
      },
    })

    // Simulate published article
    mockState.articles.push({
      id: articleId,
      status: 'published',
      live_revision_id: revisionId,
      hero_image_url: `/api/blog/v1/media/${heroMediaId}`,
    })

    // Simulate live revision with body_structured
    mockState.revisions.push({
      id: revisionId,
      article_id: articleId,
      hero_image_url: `/api/blog/v1/media/${heroMediaId}`,
      body_structured: {
        images: [
          {
            mediaId: heroMediaId,
            storageKey: heroStorageKey,
            mimeType: 'image/jpeg',
            isHero: true,
          },
        ],
      },
    })

    const record = await lookupBlogMediaRecord(heroMediaId)
    expect(record.found).toBe(true)
    expect(record.storageKey).toBe(heroStorageKey)
    expect(record.mimeType).toBe('image/jpeg')
    expect(record.isPublishedLive).toBe(true)
  })

  it('resolves published body images and recovers storageKey and live publication status', async () => {
    const bodyMediaId = '8a92debe-cbb2-476a-8059-14cad21003ab'
    const bodyStorageKey = `blog-draft-media/2026/10/${bodyMediaId}.jpg`
    const articleId = 'f9a504a6-672a-4f13-9805-13014b1b1d63'
    const revisionId = 'b218b0db-8576-4c4e-985e-581fb63c1c77'

    mockState.auditLogs.push({
      id: crypto.randomUUID(),
      operation: 'upload_media',
      outcome: 'success',
      created_at: '2026-10-13T04:37:04Z',
      diff_summary: {
        mediaId: bodyMediaId,
        storageKey: bodyStorageKey,
        mimeType: 'image/jpeg',
      },
    })

    mockState.articles.push({
      id: articleId,
      status: 'published',
      live_revision_id: revisionId,
      hero_image_url: '/api/blog/v1/media/other-hero-id',
    })

    mockState.revisions.push({
      id: revisionId,
      article_id: articleId,
      hero_image_url: '/api/blog/v1/media/other-hero-id',
      body_markdown: `Here is the body image: ![](/api/blog/v1/media/${bodyMediaId})`,
      body_structured: {
        images: [
          {
            mediaId: bodyMediaId,
            storageKey: bodyStorageKey,
            mimeType: 'image/jpeg',
            isHero: false,
          },
        ],
      },
    })

    const record = await lookupBlogMediaRecord(bodyMediaId)
    expect(record.found).toBe(true)
    expect(record.storageKey).toBe(bodyStorageKey)
    expect(record.isPublishedLive).toBe(true)
  })

  it('keeps unattached draft media strictly private (isPublishedLive = false)', async () => {
    const draftMediaId = '77777777-7777-4777-8777-777777777777'
    const draftStorageKey = `blog-draft-media/2026/11/${draftMediaId}.jpg`

    mockState.auditLogs.push({
      id: crypto.randomUUID(),
      operation: 'upload_media',
      outcome: 'success',
      created_at: new Date().toISOString(),
      diff_summary: {
        mediaId: draftMediaId,
        storageKey: draftStorageKey,
        mimeType: 'image/jpeg',
      },
    })

    const record = await lookupBlogMediaRecord(draftMediaId)
    expect(record.found).toBe(true)
    expect(record.storageKey).toBe(draftStorageKey)
    expect(record.isPublishedLive).toBe(false)
  })

  it('recovers storageKey from revision if audit log is pruned', async () => {
    const heroMediaId = '22222222-2222-4222-8222-222222222222'
    const heroStorageKey = `blog-draft-media/2026/10/${heroMediaId}.jpg`
    const articleId = 'article-pruned-audit'
    const revisionId = 'revision-pruned-audit'

    // No audit log present!
    mockState.articles.push({
      id: articleId,
      status: 'published',
      live_revision_id: revisionId,
      hero_image_url: `/api/blog/v1/media/${heroMediaId}`,
    })

    mockState.revisions.push({
      id: revisionId,
      article_id: articleId,
      hero_image_url: `/api/blog/v1/media/${heroMediaId}`,
      body_structured: {
        images: [
          {
            mediaId: heroMediaId,
            storageKey: heroStorageKey,
            mimeType: 'image/jpeg',
            isHero: true,
          },
        ],
      },
    })

    const record = await lookupBlogMediaRecord(heroMediaId)
    expect(record.found).toBe(true)
    expect(record.storageKey).toBe(heroStorageKey)
    expect(record.isPublishedLive).toBe(true)
  })
})
