import { describe, it, expect, beforeEach, vi } from 'vitest'
import crypto from 'crypto'
import { NextRequest } from 'next/server'

// In-memory mock store for Supabase tables & storage bucket
const mockState = {
  settings: {
    id: 'default',
    is_blog_enabled: true,
    publication_mode: 'draft_only' as const,
    is_automation_paused: false,
    max_daily_new_posts: 10,
    allowed_categories: ['education', 'craftsmanship', 'style-guides', 'materials', 'diamonds'],
    publish_window_start_time: '09:00',
    publish_window_end_time: '20:00',
    timezone: 'Asia/Kolkata',
    updated_at: new Date().toISOString(),
  },
  articles: [] as any[],
  revisions: [] as any[],
  auditLogs: [] as any[],
  idempotencyRecords: [] as any[],
  storageObjects: new Map<string, { buffer: Buffer; mimeType: string }>(),
}

vi.mock('@/lib/supabaseAdmin', () => {
  function buildQuery(table: string) {
    const filters: Array<(row: any) => boolean> = []
    let selectOpts: any = {}
    let orderSpec: { col: string; ascending: boolean } | null = null
    let limitCount: number | null = null
    let pendingInsert: any = null
    let pendingUpdate: any = null
    let isDelete = false

    const getTableRows = (): any[] => {
      if (table === 'blog_settings') return [mockState.settings]
      if (table === 'blog_articles') return mockState.articles
      if (table === 'blog_revisions') return mockState.revisions
      if (table === 'blog_audit_logs') return mockState.auditLogs
      if (table === 'blog_idempotency_keys' || table === 'blog_idempotency_records') return mockState.idempotencyRecords
      return []
    }

    const execute = () => {
      const rows = getTableRows()
      if (pendingInsert !== null) {
        const items = Array.isArray(pendingInsert) ? pendingInsert : [pendingInsert]
        const inserted: any[] = []
        for (const item of items) {
          const row = {
            id: item.id || crypto.randomUUID(),
            created_at: item.created_at || new Date().toISOString(),
            updated_at: item.updated_at || new Date().toISOString(),
            ...item,
          }
          rows.push(row)
          inserted.push(row)
        }
        return { data: Array.isArray(pendingInsert) ? inserted : inserted[0], error: null }
      }

      const matched = rows.filter((r) => filters.every((f) => f(r)))

      if (pendingUpdate !== null) {
        for (const r of matched) {
          Object.assign(r, pendingUpdate)
        }
        return { data: matched, error: null }
      }

      if (isDelete) {
        for (const m of matched) {
          const idx = rows.indexOf(m)
          if (idx !== -1) rows.splice(idx, 1)
        }
        return { data: matched, error: null }
      }

      let result = [...matched]
      if (orderSpec) {
        const { col, ascending } = orderSpec
        result.sort((a, b) => {
          const va = a[col] ?? ''
          const vb = b[col] ?? ''
          if (va < vb) return ascending ? -1 : 1
          if (va > vb) return ascending ? 1 : -1
          const ia = String(a.id ?? '')
          const ib = String(b.id ?? '')
          return ascending ? ia.localeCompare(ib) : ib.localeCompare(ia)
        })
      }
      if (limitCount !== null) {
        result = result.slice(0, limitCount)
      }

      if (selectOpts?.head && selectOpts?.count === 'exact') {
        return { data: null, count: matched.length, error: null }
      }

      return { data: result, count: matched.length, error: null }
    }

    const chain: any = {
      select(_cols = '*', opts?: any) {
        selectOpts = opts || {}
        return chain
      },
      insert(payload: any) {
        pendingInsert = payload
        return chain
      },
      upsert(payload: any) {
        pendingInsert = payload
        return chain
      },
      update(payload: any) {
        pendingUpdate = payload
        return chain
      },
      delete() {
        isDelete = true
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
      gte(col: string, val: any) {
        filters.push((r) => r[col] >= val)
        return chain
      },
      lt(col: string, val: any) {
        filters.push((r) => r[col] < val)
        return chain
      },
      lte(col: string, val: any) {
        filters.push((r) => r[col] <= val)
        return chain
      },
      in(col: string, vals: any[]) {
        filters.push((r) => vals.includes(r[col]))
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
      storage: {
        from: (_bucket: string) => ({
          upload: async (key: string, buffer: Buffer, opts?: { contentType?: string }) => {
            mockState.storageObjects.set(key, {
              buffer: Buffer.from(buffer),
              mimeType: opts?.contentType || 'application/octet-stream',
            })
            return { data: { path: key }, error: null }
          },
          download: async (key: string) => {
            const obj = mockState.storageObjects.get(key)
            if (!obj) return { data: null, error: { message: 'Object not found' } }
            return {
              data: new Blob([new Uint8Array(obj.buffer)], { type: obj.mimeType }),
              error: null,
            }
          },
          remove: async (keys: string[]) => {
            for (const k of keys) mockState.storageObjects.delete(k)
            return { data: keys, error: null }
          },
        }),
      },
    },
  }
})

import { getKolkataTimeDetails } from '../scheduler'
import {
  createDraftArticle,
  updateDraftArticle,
  getDailyNewDraftCountInKolkata,
  DRAFT_QUOTA_DELETION_POLICY,
} from '../storage'
import {
  validateAndSanitizeImageBinary,
  uploadPrivateDraftMedia,
  cleanupOrphanDraftMedia,
} from '../media'
import {
  validateMediaAttachmentsSafety,
  containsCredentialOrSignedUrlLeak,
} from '../safety'
import { validateDraftPayload, validateForPublication } from '../validation'
import { AI_ILLUSTRATION_DISCLAIMER, BlogMediaAttachment } from '../types'
import { checkIdempotency, saveIdempotencyRecord } from '../idempotency'

// Helper to create valid minimal PNG buffer with optional tEXt/eXIf metadata chunks
function createMinimalPng(options?: { width?: number; height?: number; withTextMetadata?: string }): Buffer {
  const width = options?.width || 1000
  const height = options?.height || 625
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

  const makeChunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4)
    len.writeUInt32BE(data.length, 0)
    const typeBuf = Buffer.from(type, 'ascii')
    const crc = Buffer.alloc(4)
    crc.writeUInt32BE(0, 0)
    return Buffer.concat([len, typeBuf, data, crc])
  }

  const ihdrData = Buffer.alloc(13)
  ihdrData.writeUInt32BE(width, 0)
  ihdrData.writeUInt32BE(height, 4)
  ihdrData[8] = 8
  ihdrData[9] = 2
  const ihdr = makeChunk('IHDR', ihdrData)

  const chunks: Buffer[] = [signature, ihdr]
  if (options?.withTextMetadata) {
    chunks.push(makeChunk('tEXt', Buffer.from(options.withTextMetadata, 'utf8')))
    chunks.push(makeChunk('eXIf', Buffer.from('Exif\0\0GPS-Coordinates-Secret', 'utf8')))
  }
  chunks.push(makeChunk('IDAT', Buffer.from([0x78, 0x9c, 0x63, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01])))
  chunks.push(makeChunk('IEND', Buffer.alloc(0)))
  return Buffer.concat(chunks)
}

// Helper to create valid minimal JPEG buffer with optional APP1 EXIF segment
function createMinimalJpeg(options?: { width?: number; height?: number; withExif?: boolean }): Buffer {
  const width = options?.width || 1200
  const height = options?.height || 675
  // Valid JPEG starts with FF D8 FF (e.g. FF D8 FF E0 JFIF or FF D8 FF E1 or FF D8 FF DB)
  const soi = Buffer.from([0xff, 0xd8])
  const app0 = Buffer.from([
    0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00,
  ])
  const segments: Buffer[] = [soi, app0]

  if (options?.withExif) {
    const exifPayload = Buffer.from('Exif\0\0PrivateCameraSerial123456', 'ascii')
    const app1Header = Buffer.alloc(4)
    app1Header[0] = 0xff
    app1Header[1] = 0xe1 // APP1
    app1Header.writeUInt16BE(exifPayload.length + 2, 2)
    segments.push(app1Header, exifPayload)
  }

  // SOF0 (0xFFC0)
  const sof0 = Buffer.alloc(11)
  sof0[0] = 0xff
  sof0[1] = 0xc0
  sof0.writeUInt16BE(9, 2)
  sof0[4] = 8
  sof0.writeUInt16BE(height, 5)
  sof0.writeUInt16BE(width, 7)
  sof0[9] = 1

  // SOS (0xFFDA) + image scan bytes + EOI (0xFFD9)
  const sos = Buffer.from([0xff, 0xda, 0x00, 0x04, 0x00, 0x00, 0xaa, 0xbb, 0xff, 0xd9])
  segments.push(sof0, sos)
  return Buffer.concat(segments)
}

function createSampleValidImages(count: 3 | 4 | 5 = 3): BlogMediaAttachment[] {
  const list: BlogMediaAttachment[] = [
    {
      mediaId: '11111111-1111-4111-8111-111111111111',
      url: '/api/blog/v1/media/11111111-1111-4111-8111-111111111111',
      storageKey: 'blog-draft-media/2026/10/11111111-1111-4111-8111-111111111111.jpg',
      mimeType: 'image/jpeg',
      width: 1200,
      height: 675,
      sizeBytes: 42000,
      altText: 'Educational diagram comparing step-cut diamond facets under diffused studio lighting',
      caption: `Step-cut facet geometry diagram — ${AI_ILLUSTRATION_DISCLAIMER}`,
      sourceType: 'ai_illustration',
      rightsNote: '© SHEWAH Editorial Atelier (Concept Diagram)',
      isHero: true,
      position: 'hero_only',
      order: 1,
      catalogueProduct: null,
    },
    {
      mediaId: '22222222-2222-4222-8222-222222222222',
      url: '/api/blog/v1/media/22222222-2222-4222-8222-222222222222',
      storageKey: 'blog-draft-media/2026/10/22222222-2222-4222-8222-222222222222.png',
      mimeType: 'image/png',
      width: 900,
      height: 600,
      sizeBytes: 38000,
      altText: 'Cross-section illustration of 18K solid gold four-prong basket setting profile',
      caption: `Four-prong gallery cross-section — ${AI_ILLUSTRATION_DISCLAIMER}`,
      sourceType: 'ai_illustration',
      rightsNote: '© SHEWAH Editorial Atelier (Concept Diagram)',
      isHero: false,
      position: 'after_section_1',
      order: 2,
      catalogueProduct: null,
    },
    {
      mediaId: '33333333-3333-4333-8333-333333333333',
      url: '/api/blog/v1/media/33333333-3333-4333-8333-333333333333',
      storageKey: 'blog-draft-media/2026/10/33333333-3333-4333-8333-333333333333.jpg',
      mimeType: 'image/jpeg',
      width: 1000,
      height: 1000,
      sizeBytes: 51000,
      altText: 'Shewah Solitaire Ring in 18K Solid Yellow Gold from the verified catalogue',
      caption: 'Verified Shewah catalogue piece crafted to order in 18K solid gold.',
      sourceType: 'catalogue_product',
      rightsNote: '© SHEWAH Atelier Archive',
      isHero: false,
      position: 'after_section_2',
      order: 3,
      catalogueProduct: {
        productId: 'prod-001',
        productCode: 'SHW-RNG-001',
        productName: 'The Architectural Solitaire Ring',
        productSlug: 'architectural-solitaire-ring',
        productUrl: 'https://shewah.co/jewellery/architectural-solitaire-ring',
        productImageUrl: '/api/blog/v1/media/33333333-3333-4333-8333-333333333333',
      },
    },
  ]

  if (count >= 4) {
    list.push({
      mediaId: '44444444-4444-4444-8444-444444444444',
      url: '/api/blog/v1/media/44444444-4444-4444-8444-444444444444',
      storageKey: 'blog-draft-media/2026/10/44444444-4444-4444-8444-444444444444.jpg',
      mimeType: 'image/jpeg',
      width: 1000,
      height: 750,
      sizeBytes: 44000,
      altText: 'Studio macro photograph of 18K gold hallmark stamp inside ring shank',
      caption: 'BIS hallmark stamp inside a solid 18K gold band.',
      sourceType: 'studio_photography',
      rightsNote: '© SHEWAH Atelier Photography',
      isHero: false,
      position: 'after_section_3',
      order: 4,
      catalogueProduct: null,
    })
  }

  if (count === 5) {
    list.push({
      mediaId: '55555555-5555-4555-8555-555555555555',
      url: '/api/blog/v1/media/55555555-5555-4555-8555-555555555555',
      storageKey: 'blog-draft-media/2026/10/55555555-5555-4555-8555-555555555555.png',
      mimeType: 'image/png',
      width: 1000,
      height: 750,
      sizeBytes: 39000,
      altText: 'Diagram showing ultrasonic vs warm soapy water cleaning for solid gold jewellery',
      caption: `At-home care diagram — ${AI_ILLUSTRATION_DISCLAIMER}`,
      sourceType: 'ai_illustration',
      rightsNote: '© SHEWAH Editorial Atelier (Concept Diagram)',
      isHero: false,
      position: 'before_conclusion',
      order: 5,
      catalogueProduct: null,
    })
  }

  return list
}

const VALID_BODY_MARKDOWN = `
When selecting fine diamond jewellery, understanding the structural interplay between 18K solid gold settings and diamond cut proportions ensures lasting durability and optical brilliance across decades of daily wear.

## 1. Prong Geometry and Gallery Architecture

A well-engineered gallery supports the diamond pavilion while allowing light entry from multiple angles. Master goldsmiths shape each claw to grip the girdle securely without obscuring the table or crown facets. Structural balance in 18K solid gold prevents prong loosening under normal wear while maintaining a refined profile on the finger or neckline.

## 2. Evaluating Cut Proportions and Symmetry

Beyond carat weight, table percentage and crown angle govern how light returns through the top of the stone. Independent gemological grading reports document these exact millimetre measurements, enabling objective comparison between step-cut and brilliant-cut diamonds.

## 3. Long-Term Care for Solid 18K Gold

Routine inspection of claws and gentle cleaning with warm water and mild soap preserve the mirror polish of solid 18K gold settings. Storing individual pieces in separate fabric-lined compartments prevents diamond-on-gold abrasion.
`.trim()

describe('Shewah Blog Draft Capacity (10/day Asia/Kolkata) & Image Attachments (3-5)', () => {
  beforeEach(() => {
    mockState.articles.length = 0
    mockState.revisions.length = 0
    mockState.auditLogs.length = 0
    mockState.idempotencyRecords.length = 0
    mockState.storageObjects.clear()
    mockState.settings.max_daily_new_posts = 10
    mockState.settings.publication_mode = 'draft_only'
    mockState.settings.is_automation_paused = false
    mockState.settings.timezone = 'Asia/Kolkata'
  })

  describe('1. Daily New-Draft Capacity (10/day in Asia/Kolkata)', () => {
    it('computes Asia/Kolkata calendar day boundaries rather than UTC', () => {
      // 2026-10-11 23:59:00 IST is 2026-10-11 18:29:00 UTC
      const justBeforeMidnightIST = new Date('2026-10-11T18:29:00.000Z')
      // 2026-10-12 00:01:00 IST is 2026-10-11 18:31:00 UTC (same UTC date, next IST date!)
      const justAfterMidnightIST = new Date('2026-10-11T18:31:00.000Z')

      const day1 = getKolkataTimeDetails(justBeforeMidnightIST)
      const day2 = getKolkataTimeDetails(justAfterMidnightIST)

      expect(day1.dateStr).toBe('2026-10-11')
      expect(day2.dateStr).toBe('2026-10-12')
      expect(day1.startOfDayUTC).toBe('2026-10-10T18:30:00.000Z')
      expect(day1.endOfDayUTC).toBe('2026-10-11T18:30:00.000Z')
      expect(day2.startOfDayUTC).toBe('2026-10-11T18:30:00.000Z')
      expect(day2.endOfDayUTC).toBe('2026-10-12T18:30:00.000Z')
    })

    it('isolates draft counts across Asia/Kolkata midnight boundary', async () => {
      const preMidnightIST = new Date('2026-10-11T18:29:00.000Z') // Oct 11 23:59 IST
      const postMidnightIST = new Date('2026-10-11T18:31:00.000Z') // Oct 12 00:01 IST

      // Insert 10 drafts on Oct 11 IST (at 23:50 IST = 18:20 UTC)
      for (let i = 1; i <= 10; i++) {
        mockState.articles.push({
          id: `oct11-draft-${i}`,
          slug: `oct11-draft-${i}`,
          title: `Oct 11 Draft ${i}`,
          status: 'draft',
          created_at: '2026-10-11T18:20:00.000Z',
        })
      }

      const countBeforeMidnight = await getDailyNewDraftCountInKolkata(preMidnightIST)
      const countAfterMidnight = await getDailyNewDraftCountInKolkata(postMidnightIST)

      expect(countBeforeMidnight.count).toBe(10)
      expect(countAfterMidnight.count).toBe(0)
    })

    it('allows 10 new drafts in an Asia/Kolkata day and rejects the 11th without losing the existing 10', async () => {
      const createdIds: string[] = []
      for (let i = 1; i <= 10; i++) {
        const res = await createDraftArticle({
          title: `Atelier Diamond Craftsmanship Essay Number ${i}`,
          slug: `atelier-diamond-essay-${i}`,
          category: 'education',
          bodyMarkdown: VALID_BODY_MARKDOWN,
          images: createSampleValidImages(3),
          actorType: 'assistant_token',
          actorId: 'token-1',
        })
        expect(res.success).toBe(true)
        expect(res.data?.article.status).toBe('draft')
        createdIds.push(res.data!.article.id)
      }

      expect(createdIds).toHaveLength(10)
      expect(mockState.articles).toHaveLength(10)

      // 11th new draft in the same Asia/Kolkata day must be rejected with DAILY_QUOTA_EXCEEDED
      const eleventh = await createDraftArticle({
        title: 'Atelier Diamond Craftsmanship Essay Number 11',
        slug: 'atelier-diamond-essay-11',
        category: 'education',
        bodyMarkdown: VALID_BODY_MARKDOWN,
        images: createSampleValidImages(3),
        actorType: 'assistant_token',
        actorId: 'token-1',
      })

      expect(eleventh.success).toBe(false)
      expect(eleventh.error?.code).toBe('DAILY_QUOTA_EXCEEDED')
      expect(eleventh.error?.message).toContain('Daily new draft capacity of 10 articles has been reached')

      // All 10 existing drafts remain intact in storage
      expect(mockState.articles).toHaveLength(10)
      expect(mockState.articles.map((a) => a.id)).toEqual(createdIds)
    })

    it('handles concurrent submissions so 12 parallel requests result in exactly 10 accepted and 2 rejected', async () => {
      const promises = Array.from({ length: 12 }, (_, idx) => {
        const num = idx + 1
        return createDraftArticle({
          title: `Concurrent Gemology Guide Part ${num}`,
          slug: `concurrent-gemology-guide-${num}`,
          category: 'diamonds',
          bodyMarkdown: VALID_BODY_MARKDOWN,
          images: createSampleValidImages(3),
          actorType: 'assistant_token',
          actorId: 'token-concurrent',
        })
      })

      const results = await Promise.all(promises)
      const succeeded = results.filter((r) => r.success)
      const rejected = results.filter((r) => !r.success)

      expect(succeeded).toHaveLength(10)
      expect(rejected).toHaveLength(2)
      for (const rej of rejected) {
        expect(rej.error?.code).toBe('DAILY_QUOTA_EXCEEDED')
      }
      expect(mockState.articles).toHaveLength(10)
    })

    it('does not consume a second slot on idempotent retry or when updating a draft or uploading an image', async () => {
      const firstIdempotencyKey = 'idem-key-slot-1'
      const payload = {
        title: 'Idempotent Essay on Solid 18K Gold',
        slug: 'idempotent-essay-solid-18k-gold',
        category: 'materials',
        bodyMarkdown: VALID_BODY_MARKDOWN,
        images: createSampleValidImages(3),
        actorType: 'assistant_token' as const,
        actorId: 'token-1',
      }

      const firstRes = await createDraftArticle(payload)
      expect(firstRes.success).toBe(true)
      const firstDraftId = firstRes.data!.article.id

      await saveIdempotencyRecord(
        firstIdempotencyKey,
        'token-1',
        'create_draft',
        payload,
        201,
        {
          status: 'draft',
          articleId: firstDraftId,
          revisionNumber: 1,
        }
      )

      for (let i = 2; i <= 10; i++) {
        const r = await createDraftArticle({
          title: `Daily Slot Filler Article ${i}`,
          slug: `daily-slot-filler-${i}`,
          category: 'education',
          bodyMarkdown: VALID_BODY_MARKDOWN,
          images: createSampleValidImages(3),
          actorType: 'assistant_token',
          actorId: 'token-1',
        })
        expect(r.success).toBe(true)
      }

      expect((await getDailyNewDraftCountInKolkata()).count).toBe(10)

      // 1. Deliberate retry with the same Idempotency-Key returns cached 201 response without hitting quota error
      const idemCheck = await checkIdempotency(
        firstIdempotencyKey,
        'token-1',
        'create_draft',
        payload
      )
      expect(idemCheck.isDuplicate).toBe(true)
      expect(idemCheck.isConflict).toBe(false)
      expect(idemCheck.cachedResponse?.status).toBe(201)
      expect(idemCheck.cachedResponse?.body.articleId).toBe(firstDraftId)
      expect((await getDailyNewDraftCountInKolkata()).count).toBe(10)

      // 2. Updating an existing draft (PATCH) succeeds even when 10/10 new-draft slots are full
      const patchRes = await updateDraftArticle({
        articleId: firstDraftId,
        expectedLockVersion: 1,
        title: 'Idempotent Essay on Solid 18K Gold (Refined)',
        images: createSampleValidImages(4),
        changeSummary: 'Added 4th studio image',
        actorType: 'assistant_token',
        actorId: 'token-1',
      })
      expect(patchRes.success).toBe(true)
      expect(patchRes.data?.revision.revision_number).toBe(2)
      expect((await getDailyNewDraftCountInKolkata()).count).toBe(10)

      // 3. Uploading an image does not consume a daily article slot
      const pngBuffer = createMinimalPng()
      const uploadRes = await uploadPrivateDraftMedia({
        buffer: pngBuffer,
        declaredMime: 'image/png',
        originalFilename: 'diagram.png',
        actorId: 'token-1',
        actorType: 'assistant_token',
      })
      expect(uploadRes.success).toBe(true)
      expect((await getDailyNewDraftCountInKolkata()).count).toBe(10)

      // 4. Documented deletion/archiving policy is explicitly exported
      expect(DRAFT_QUOTA_DELETION_POLICY).toContain('archived_drafts_remain_counted_in_asia_kolkata_day')
    })
  })

  describe('2. First-Party Binary Image Validation & EXIF Sanitization', () => {
    it('validates real JPEG and PNG magic bytes and strips EXIF/text metadata', () => {
      const jpegWithExif = createMinimalJpeg({ width: 1400, height: 900, withExif: true })
      expect(jpegWithExif.toString('ascii')).toContain('PrivateCameraSerial123456')

      const jpegResult = validateAndSanitizeImageBinary(jpegWithExif, 'image/jpeg', 'photo.jpg')
      expect(jpegResult.valid).toBe(true)
      expect(jpegResult.detectedMime).toBe('image/jpeg')
      expect(jpegResult.width).toBe(1400)
      expect(jpegResult.height).toBe(900)
      expect(jpegResult.sanitizedBuffer?.toString('ascii')).not.toContain('PrivateCameraSerial123456')

      const pngWithMeta = createMinimalPng({
        width: 1024,
        height: 768,
        withTextMetadata: 'Author=SecretInternalPath',
      })
      expect(pngWithMeta.toString('utf8')).toContain('SecretInternalPath')
      expect(pngWithMeta.toString('utf8')).toContain('GPS-Coordinates-Secret')

      const pngResult = validateAndSanitizeImageBinary(pngWithMeta, 'image/png', 'diagram.png')
      expect(pngResult.valid).toBe(true)
      expect(pngResult.detectedMime).toBe('image/png')
      expect(pngResult.width).toBe(1024)
      expect(pngResult.height).toBe(768)
      expect(pngResult.sanitizedBuffer?.toString('utf8')).not.toContain('SecretInternalPath')
      expect(pngResult.sanitizedBuffer?.toString('utf8')).not.toContain('GPS-Coordinates-Secret')
    })

    it('rejects SVG, HTML, executables, MIME mismatches, script polyglots, and oversized (>5MB) files', () => {
      // SVG rejected
      const svgBuf = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')
      expect(validateAndSanitizeImageBinary(svgBuf, 'image/svg+xml', 'icon.svg').valid).toBe(false)
      expect(validateAndSanitizeImageBinary(svgBuf, 'image/png', 'fake.png').valid).toBe(false)

      // HTML rejected
      const htmlBuf = Buffer.from('<!DOCTYPE html><html><body>not an image</body></html>')
      expect(validateAndSanitizeImageBinary(htmlBuf, 'image/jpeg', 'page.jpg').valid).toBe(false)

      // Executable rejected
      const exeBuf = Buffer.from('MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00\xff\xff\x00\x00')
      expect(validateAndSanitizeImageBinary(exeBuf, 'image/jpeg', 'malware.exe').valid).toBe(false)

      // MIME mismatch (PNG bytes declared as image/jpeg)
      const validPng = createMinimalPng()
      const mismatch = validateAndSanitizeImageBinary(validPng, 'image/jpeg', 'mismatch.jpg')
      expect(mismatch.valid).toBe(false)
      expect(mismatch.error).toContain('MIME type mismatch')

      // Polyglot (valid JPEG header followed by embedded <script>)
      const polyglot = Buffer.concat([
        createMinimalJpeg(),
        Buffer.from('<script>fetch("https://evil.example")</script>'),
      ])
      const polyResult = validateAndSanitizeImageBinary(polyglot, 'image/jpeg', 'polyglot.jpg')
      expect(polyResult.valid).toBe(false)
      expect(polyResult.error).toContain('Disallowed file content')

      // Oversized (> 5 MB)
      const oversized = Buffer.alloc(5 * 1024 * 1024 + 100, 0xff)
      const overResult = validateAndSanitizeImageBinary(oversized, 'image/jpeg', 'huge.jpg')
      expect(overResult.valid).toBe(false)
      expect(overResult.error).toContain('Image exceeds maximum file size of 5 MB')
    })

    it('deduplicates identical image uploads by SHA-256 so retries never create orphan duplicates', async () => {
      const png = createMinimalPng({ width: 900, height: 600 })
      const first = await uploadPrivateDraftMedia({
        buffer: png,
        declaredMime: 'image/png',
        originalFilename: 'ring-chart.png',
        actorId: 'token-1',
        actorType: 'assistant_token',
      })
      const second = await uploadPrivateDraftMedia({
        buffer: png,
        declaredMime: 'image/png',
        originalFilename: 'ring-chart-retry.png',
        actorId: 'token-1',
        actorType: 'assistant_token',
      })

      expect(first.success).toBe(true)
      expect(second.success).toBe(true)
      expect(second.media?.mediaId).toBe(first.media?.mediaId)
      expect(second.media?.storageKey).toBe(first.media?.storageKey)
      expect(second.media?.reusedExisting).toBe(true)
      expect(mockState.storageObjects.size).toBe(1)
    })
  })

  describe('3. Private Draft Media Access & Credential Leak Prevention', () => {
    it('blocks bearer tokens and expiring signed storage URLs in media and body fields', () => {
      expect(
        containsCredentialOrSignedUrlLeak('https://shewah.co/api/blog/v1/media/123?token=shw_blog_secret').leaked
      ).toBe(true)
      expect(
        containsCredentialOrSignedUrlLeak(
          'https://kthjejmuudpkcumplskm.supabase.co/storage/v1/object/sign/shewah-uploads/img.jpg?token=eyJ...'
        ).leaked
      ).toBe(true)
      expect(
        containsCredentialOrSignedUrlLeak('/api/blog/v1/media/11111111-1111-4111-8111-111111111111').leaked
      ).toBe(false)
    })

    it('rejects query-string tokens on /api/blog/v1/media/[id]', async () => {
      const { GET } = await import('@/app/api/blog/v1/media/[id]/route')
      const reqWithLeak = new NextRequest(
        'https://shewah.co/api/blog/v1/media/11111111-1111-4111-8111-111111111111?token=shw_blog_123'
      )
      const res = await GET(reqWithLeak, {
        params: { id: '11111111-1111-4111-8111-111111111111' },
      })
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toContain('Bearer tokens and signed credentials are forbidden in media URLs')
    })
  })

  describe('4. 3–5 Image Attachments & AI Illustration vs Catalogue Product Separation', () => {
    it('accepts drafts with 3, 4, or 5 valid images and persists body_structured.images for exact readback', async () => {
      for (const count of [3, 4, 5] as const) {
        const images = createSampleValidImages(count)
        const violations = validateMediaAttachmentsSafety(images)
        expect(violations.filter((v) => v.severity === 'blocker')).toHaveLength(0)

        const draftRes = await createDraftArticle({
          title: `Editorial Assay with ${count} Images`,
          slug: `editorial-assay-${count}-images`,
          category: 'education',
          bodyMarkdown: VALID_BODY_MARKDOWN,
          images,
          sourceReferences: [
            {
              title: 'GIA Diamond Cut Grading System',
              sourceName: 'GIA',
              url: 'https://www.gia.edu',
              checkedAt: '2026-10-10',
            },
          ],
          actorType: 'assistant_token',
          actorId: 'token-1',
        })

        expect(draftRes.success).toBe(true)
        const storedRevision = draftRes.data!.revision
        expect(storedRevision.body_structured?.images).toHaveLength(count)
        expect(storedRevision.body_structured?.imagesPending).toBe(false)
        expect(storedRevision.body_structured?.images[0].mediaId).toBe(images[0].mediaId)
        expect(storedRevision.body_structured?.images[0].altText).toBe(images[0].altText)
        expect(storedRevision.body_structured?.images[0].caption).toBe(images[0].caption)
        expect(storedRevision.body_structured?.images[0].position).toBe('hero_only')
        expect(storedRevision.body_structured?.images[2].sourceType).toBe('catalogue_product')
        expect(storedRevision.body_structured?.images[2].catalogueProduct?.productUrl).toBe(
          'https://shewah.co/jewellery/architectural-solitaire-ring'
        )
      }
    })

    it('marks drafts with fewer than 3 images as imagesPending=true (saveable as draft, blocked from publication)', () => {
      const twoImages = createSampleValidImages(3).slice(0, 2)
      const draftValidation = validateDraftPayload({
        title: 'Draft With Pending Third Image',
        category: 'education',
        bodyMarkdown: VALID_BODY_MARKDOWN,
        images: twoImages,
      })
      // Draft remains saveable so editorial text work is not lost
      expect(draftValidation.valid).toBe(true)
      expect(draftValidation.imagesPending).toBe(true)
      expect(draftValidation.warnings.some((w) => w.includes('3–5 images'))).toBe(true)

      // Publication is blocked until 3–5 images are attached
      const pubValidation = validateForPublication({
        title: 'Draft With Pending Third Image',
        slug: 'draft-with-pending-third-image',
        excerpt: 'A detailed study of diamond cut proportions and 18K solid gold settings.',
        bodyMarkdown: VALID_BODY_MARKDOWN,
        category: 'education',
        authorDisplayName: 'SHEWAH Editorial Atelier',
        seoTitle: 'Draft With Pending Third Image | SHEWAH',
        metaDescription:
          'A detailed study of diamond cut proportions and 18K solid gold settings for fine jewellery buyers.',
        images: twoImages,
        sourceReferences: [
          { title: 'GIA Diamond Study', sourceName: 'GIA', url: 'https://www.gia.edu', checkedAt: '2026-10-10' },
        ],
      })
      expect(pubValidation.valid).toBe(false)
      expect(pubValidation.blockers.some((b) => b.includes('3 to 5 images'))).toBe(true)
    })

    it('rejects more than 5 images or multiple hero images', () => {
      const fiveImages = createSampleValidImages(5)
      const sixImages = [
        ...fiveImages,
        {
          ...fiveImages[1],
          mediaId: '66666666-6666-4666-8666-666666666666',
          order: 6,
        },
      ]
      const sixViolations = validateMediaAttachmentsSafety(sixImages)
      expect(sixViolations.some((v) => v.severity === 'blocker' && v.message.includes('at most 5 images'))).toBe(true)

      const twoHeroes = createSampleValidImages(3).map((img, i) => ({
        ...img,
        isHero: i < 2,
      }))
      const twoHeroViolations = validateMediaAttachmentsSafety(twoHeroes)
      expect(
        twoHeroViolations.some(
          (v) => v.severity === 'blocker' && v.message.includes('Only one image attachment may be designated as the hero')
        )
      ).toBe(true)
    })

    it('strictly enforces separation between AI illustrations and verified Shewah catalogue products', () => {
      // Case A: AI illustration missing mandatory disclaimer
      const aiWithoutDisclaimer = createSampleValidImages(3)
      aiWithoutDisclaimer[0] = {
        ...aiWithoutDisclaimer[0],
        caption: 'Diagram of diamond facets without AI disclaimer.',
      }
      const resA = validateMediaAttachmentsSafety(aiWithoutDisclaimer)
      expect(resA.some((v) => v.severity === 'blocker' && v.message.includes(AI_ILLUSTRATION_DISCLAIMER))).toBe(true)

      // Case B: AI illustration falsely linked to a catalogue product
      const aiWithProductLink = createSampleValidImages(3)
      aiWithProductLink[0] = {
        ...aiWithProductLink[0],
        catalogueProduct: {
          productCode: 'SHW-FAKE',
          productName: 'Fake Catalogue Link on AI Image',
          productSlug: 'fake-ring',
          productUrl: 'https://shewah.co/jewellery/fake-ring',
          productImageUrl: '/api/blog/v1/media/11111111-1111-4111-8111-111111111111',
        },
      }
      const resB = validateMediaAttachmentsSafety(aiWithProductLink)
      expect(resB.some((v) => v.severity === 'blocker' && v.rule === 'ai_catalogue_separation')).toBe(true)

      // Case C: Catalogue product missing verified /jewellery/<slug> URL
      const catalogueWithBadUrl = createSampleValidImages(3)
      catalogueWithBadUrl[2] = {
        ...catalogueWithBadUrl[2],
        catalogueProduct: {
          productCode: 'SHW-RNG-001',
          productName: 'The Solitaire Ring',
          productSlug: 'solitaire-ring',
          productUrl: 'https://external-site.example/ring',
          productImageUrl: '/api/blog/v1/media/33333333-3333-4333-8333-333333333333',
        },
      }
      const resC = validateMediaAttachmentsSafety(catalogueWithBadUrl)
      expect(resC.some((v) => v.severity === 'blocker' && v.rule === 'catalogue_product_url')).toBe(true)
    })
  })

  describe('5. Safe Orphan Draft Media Cleanup', () => {
    it('never deletes media attached to any draft/revision or newer than the grace window, and cleans up old unattached uploads', async () => {
      const attachedId = '11111111-1111-4111-8111-111111111111'
      const recentUnattachedId = '77777777-7777-4777-8777-777777777777'
      const oldOrphanId = '88888888-8888-4888-8888-888888888888'

      const attachedKey = `blog-draft-media/2026/10/${attachedId}.jpg`
      const recentKey = `blog-draft-media/2026/10/${recentUnattachedId}.jpg`
      const oldOrphanKey = `blog-draft-media/2026/10/${oldOrphanId}.jpg`

      mockState.storageObjects.set(attachedKey, {
        buffer: Buffer.from('attached'),
        mimeType: 'image/jpeg',
      })
      mockState.storageObjects.set(recentKey, {
        buffer: Buffer.from('recent'),
        mimeType: 'image/jpeg',
      })
      mockState.storageObjects.set(oldOrphanKey, {
        buffer: Buffer.from('old-orphan'),
        mimeType: 'image/jpeg',
      })

      // Create a draft referencing attachedId
      await createDraftArticle({
        title: 'Draft Protecting Attached Media',
        slug: 'draft-protecting-attached-media',
        category: 'education',
        bodyMarkdown: VALID_BODY_MARKDOWN,
        images: createSampleValidImages(3),
        actorType: 'assistant_token',
        actorId: 'token-1',
      })

      const nowMs = Date.now()
      const twoHoursAgoIso = new Date(nowMs - 2 * 60 * 60 * 1000).toISOString()
      const fortyEightHoursAgoIso = new Date(nowMs - 48 * 60 * 60 * 1000).toISOString()

      mockState.auditLogs.push(
        {
          id: 'audit-attached',
          operation: 'upload_media',
          outcome: 'success',
          created_at: fortyEightHoursAgoIso,
          diff_summary: {
            mediaId: attachedId,
            storageKey: attachedKey,
          },
        },
        {
          id: 'audit-recent',
          operation: 'upload_media',
          outcome: 'success',
          created_at: twoHoursAgoIso,
          diff_summary: {
            mediaId: recentUnattachedId,
            storageKey: recentKey,
          },
        },
        {
          id: 'audit-old-orphan',
          operation: 'upload_media',
          outcome: 'success',
          created_at: fortyEightHoursAgoIso,
          diff_summary: {
            mediaId: oldOrphanId,
            storageKey: oldOrphanKey,
          },
        }
      )

      const cleanupRes = await cleanupOrphanDraftMedia({
        minAgeHours: 24,
        dryRun: false,
      })

      // Old orphan was deleted
      expect(cleanupRes.deletedKeys).toEqual([oldOrphanKey])
      expect(mockState.storageObjects.has(oldOrphanKey)).toBe(false)

      // Attached media and recent (<24h) unattached media were both protected
      expect(cleanupRes.protectedCount).toBe(2)
      expect(mockState.storageObjects.has(attachedKey)).toBe(true)
      expect(mockState.storageObjects.has(recentKey)).toBe(true)
    })
  })
})
