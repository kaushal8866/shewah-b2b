import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getKolkataTimeDetails,
  isWithinPublishWindow,
  runScheduledBlogPublisher,
} from '../scheduler'
import * as storage from '../storage'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

vi.mock('@/lib/supabaseAdmin', () => ({
  supabaseAdmin: {
    from: vi.fn(),
  },
}))

describe('Scheduling, Reliability & Pause Controls (Phase 5)', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  describe('Timezone & Window Correctness (Asia/Kolkata)', () => {
    it('correctly maps UTC times to Asia/Kolkata (IST = UTC+05:30)', () => {
      // 03:30 UTC is 09:00 IST
      const utcTime = new Date('2026-10-07T03:30:00Z')
      const details = getKolkataTimeDetails(utcTime)
      expect(details.timeStr).toBe('09:00')
      expect(details.dateStr).toBe('2026-10-07')
      // Start of day in IST (00:00:00 IST) is previous day 18:30:00 UTC
      expect(details.startOfDayUTC).toBe('2026-10-06T18:30:00.000Z')
    })

    it('enforces publishing window bounds', () => {
      expect(isWithinPublishWindow('09:00', '09:00', '20:00')).toBe(true)
      expect(isWithinPublishWindow('14:30', '09:00', '20:00')).toBe(true)
      expect(isWithinPublishWindow('20:00', '09:00', '20:00')).toBe(true)
      // Outside window
      expect(isWithinPublishWindow('08:59', '09:00', '20:00')).toBe(false)
      expect(isWithinPublishWindow('20:01', '09:00', '20:00')).toBe(false)
      expect(isWithinPublishWindow('02:00', '09:00', '20:00')).toBe(false)
    })
  })

  describe('Publishing Switch OFF & Global Pause Controls', () => {
    it('halts scheduled publication when global pause switch is active', async () => {
      vi.spyOn(storage, 'getBlogSettings').mockResolvedValue({
        id: 'default',
        is_blog_enabled: true,
        publication_mode: 'auto_publish',
        is_automation_paused: true, // PAUSED
        max_daily_new_posts: 1,
        allowed_categories: ['craftsmanship'],
        publish_window_start_time: '00:00',
        publish_window_end_time: '23:59',
        timezone: 'Asia/Kolkata',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })

      const res = await runScheduledBlogPublisher()
      expect(res.processed).toBe(0)
      expect(res.success).toBe(false)
      expect(res.reason).toBe('automation_paused')
    })

    it('halts scheduled publication when publishing switch is OFF (draft_only mode)', async () => {
      vi.spyOn(storage, 'getBlogSettings').mockResolvedValue({
        id: 'default',
        is_blog_enabled: true,
        publication_mode: 'draft_only', // OFF
        is_automation_paused: false,
        max_daily_new_posts: 1,
        allowed_categories: ['craftsmanship'],
        publish_window_start_time: '00:00',
        publish_window_end_time: '23:59',
        timezone: 'Asia/Kolkata',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })

      const res = await runScheduledBlogPublisher()
      expect(res.processed).toBe(0)
      expect(res.success).toBe(false)
      expect(res.reason).toBe('draft_only_mode')
    })
  })

  describe('Outage Catchup Guard & Daily Quotas', () => {
    it('prevents publishing if daily limit has already been met today in Asia/Kolkata', async () => {
      vi.spyOn(storage, 'getBlogSettings').mockResolvedValue({
        id: 'default',
        is_blog_enabled: true,
        publication_mode: 'auto_publish',
        is_automation_paused: false,
        max_daily_new_posts: 1,
        allowed_categories: ['craftsmanship'],
        publish_window_start_time: '00:00',
        publish_window_end_time: '23:59',
        timezone: 'Asia/Kolkata',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })

      // Mock database returning 1 post already published today
      vi.mocked(supabaseAdmin.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gte: vi.fn().mockResolvedValue({ count: 1, error: null }),
          }),
        }),
      } as any)

      const res = await runScheduledBlogPublisher()
      expect(res.processed).toBe(0)
      expect(res.reason).toBe('daily_cap_reached')
    })

    it('rejects publication on broken draft and transitions it to in_review', async () => {
      vi.spyOn(storage, 'getBlogSettings').mockResolvedValue({
        id: 'default',
        is_blog_enabled: true,
        publication_mode: 'auto_publish',
        is_automation_paused: false,
        max_daily_new_posts: 5,
        allowed_categories: ['craftsmanship'],
        publish_window_start_time: '00:00',
        publish_window_end_time: '23:59',
        timezone: 'Asia/Kolkata',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })

      const brokenArticle = {
        id: 'art-broken-1',
        slug: 'broken-article',
        status: 'scheduled',
        lock_version: 2,
        scheduled_at: '2026-10-07T00:00:00Z',
        blog_revisions: [
          {
            title: 'Too short',
            body_markdown: 'Broken content with no citations or hero image.',
            category: 'craftsmanship',
            author_display_name: '',
          },
        ],
      }

      const updateMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: {}, error: null }),
        }),
      })

      vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
        if (table === 'blog_articles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                gte: vi.fn().mockResolvedValue({ count: 0, error: null }),
                lte: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue({ data: [brokenArticle], error: null }),
                  }),
                }),
              }),
            }),
            update: updateMock,
          } as any
        }
        if (table === 'blog_audit_logs') {
          return { insert: vi.fn().mockResolvedValue({ error: null }) } as any
        }
        return {} as any
      })

      const res = await runScheduledBlogPublisher({ forceNow: true })
      expect(res.processed).toBe(1)
      expect(res.success).toBe(false)
      expect(res.reason).toBe('validation_failed')
      expect(res.blockers && res.blockers.length > 0).toBe(true)
      // Verify demotion to in_review was called
      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'in_review' })
      )
    })

    it('successfully releases a validated scheduled article atomically', async () => {
      vi.spyOn(storage, 'getBlogSettings').mockResolvedValue({
        id: 'default',
        is_blog_enabled: true,
        publication_mode: 'auto_publish',
        is_automation_paused: false,
        max_daily_new_posts: 5,
        allowed_categories: ['craftsmanship'],
        publish_window_start_time: '00:00',
        publish_window_end_time: '23:59',
        timezone: 'Asia/Kolkata',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })

      const validArticle = {
        id: 'art-valid-1',
        slug: 'master-gem-setting',
        status: 'scheduled',
        lock_version: 3,
        scheduled_at: '2026-10-07T00:00:00Z',
        blog_revisions: [
          {
            id: 'rev-valid-1',
            title: 'Synthetic Test Fixture: Master Gem Setting Techniques',
            excerpt: 'Synthetic test excerpt: An exploration of jewellery settings and gold foil packing techniques.',
            body_markdown: `Synthetic test body: Detailed essay on jewellery settings spanning craftsmanship techniques. Every bezel is hand burnished with agate tools to secure stones without prongs, producing a seamless gold tapestry. The karigars fold micro-thin 24k gold leaf around the gem until it bonds through pure molecular contact, a process preserved through generations of royal atelier traditions.`,
            category: 'craftsmanship',
            author_display_name: 'Synthetic Test Author',
            hero_image_url: 'https://res.cloudinary.com/synthetic-test/image/upload/fixture.webp',
            hero_image_alt: 'Synthetic test diagram of gemstone setting under microscope',
            hero_image_rights: 'Synthetic Test Attribution — Automated Test Harness',
            seo_title: 'Synthetic Test Fixture: Master Gem Setting | SHEWAH Journal',
            meta_description: 'Synthetic test description for scheduler automated test.',
            source_references: [
              {
                title: 'Synthetic Reference on Traditional Setting Methods',
                sourceName: 'Synthetic Historical Craft Registry',
                url: 'https://example.com/synthetic-craft-registry',
                checkedAt: '2026-08-01T00:00:00Z',
              },
            ],
          },
        ],
      }

      const updateMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { ...validArticle, status: 'published', lock_version: 4 },
                  error: null,
                }),
              }),
            }),
          }),
        }),
      })

      vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
        if (table === 'blog_articles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                gte: vi.fn().mockResolvedValue({ count: 0, error: null }),
                lte: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue({ data: [validArticle], error: null }),
                  }),
                }),
              }),
            }),
            update: updateMock,
          } as any
        }
        if (table === 'blog_audit_logs') {
          return { insert: vi.fn().mockResolvedValue({ error: null }) } as any
        }
        return {} as any
      })

      const res = await runScheduledBlogPublisher({ forceNow: true })
      expect(res.processed).toBe(1)
      expect(res.success).toBe(true)
      expect(res.slug).toBe('master-gem-setting')
      // Verified update with published status
      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'published', live_revision_id: 'rev-valid-1' })
      )
    })
  })

  describe('Syndication Feeds Compliance', () => {
    const publishedArticle = {
      id: 'art-1',
      slug: 'heritage-solitaire',
      title: 'Synthetic Test Fixture: The Heritage Solitaire',
      excerpt: 'Synthetic test excerpt for syndication feed verification.',
      category: 'craftsmanship',
      author_display_name: 'Synthetic Test Author',
      hero_image_url: 'https://res.cloudinary.com/synthetic-test/image/upload/fixture.webp',
      hero_image_rights: 'Synthetic Test Attribution — Automated Test Harness',
      published_at: '2026-10-01T12:00:00Z',
      updated_at: '2026-10-02T12:00:00Z',
      tags: ['craftsmanship', 'diamonds'],
    }

    it('generates valid RSS 2.0 XML with RFC-822 timestamps and canonical links', async () => {
      const { GET: getRss } = await import('@/app/blog/rss.xml/route')
      vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
        if (table === 'blog_settings') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: 'default', is_blog_enabled: true },
                  error: null,
                }),
              }),
            }),
          } as any
        }
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              lte: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({ data: [publishedArticle], error: null }),
                }),
              }),
            }),
          }),
        } as any
      })

      const response = await getRss()
      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toContain('application/rss+xml')
      const xml = await response.text()
      expect(xml).toContain('<rss version="2.0"')
      expect(xml).toContain('<title>SHEWAH Journal | Fine Jewellery Editorial</title>')
      expect(xml).toContain('https://shewah.co/blog/heritage-solitaire')
      expect(xml).toContain('<guid isPermaLink="true">https://shewah.co/blog/heritage-solitaire</guid>')
    })

    it('generates valid Atom 1.0 XML with RFC-3339 timestamps', async () => {
      const { GET: getAtom } = await import('@/app/blog/atom.xml/route')
      vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
        if (table === 'blog_settings') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: 'default', is_blog_enabled: true },
                  error: null,
                }),
              }),
            }),
          } as any
        }
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              lte: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({ data: [publishedArticle], error: null }),
                }),
              }),
            }),
          }),
        } as any
      })

      const response = await getAtom()
      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toContain('application/atom+xml')
      const xml = await response.text()
      expect(xml).toContain('<feed xmlns="http://www.w3.org/2005/Atom">')
      expect(xml).toContain('<entry>')
      expect(xml).toContain('<published>2026-10-01T12:00:00.000Z</published>')
    })

    it('generates valid JSON Feed 1.1 structure', async () => {
      const { GET: getJsonFeed } = await import('@/app/blog/feed.json/route')
      vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
        if (table === 'blog_settings') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: 'default', is_blog_enabled: true },
                  error: null,
                }),
              }),
            }),
          } as any
        }
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              lte: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({ data: [publishedArticle], error: null }),
                }),
              }),
            }),
          }),
        } as any
      })

      const response = await getJsonFeed()
      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toContain('application/feed+json')
      const data = await response.json()
      expect(data.version).toBe('https://jsonfeed.org/version/1.1')
      expect(data.title).toBe('SHEWAH Journal')
      expect(data.items).toHaveLength(1)
      expect(data.items[0].url).toBe('https://shewah.co/blog/heritage-solitaire')
    })
  })
})
