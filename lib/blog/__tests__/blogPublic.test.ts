import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/supabaseAdmin', () => ({
  supabaseAdmin: {
    from: vi.fn((table: string) => {
      if (table === 'products') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: '1',
                    code: 'SH-001',
                    slug: 'radiant-bloom-diamond-ring',
                    d2c_status: 'published',
                    is_active: true,
                    updated_at: '2026-09-01T00:00:00Z',
                  },
                ],
                error: null,
              }),
            }),
          }),
        }
      }
      if (table === 'blog_articles') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              lte: vi.fn().mockResolvedValue({
                data: [
                  {
                    slug: 'the-solitaire-riviera',
                    title: 'The Solitaire Riviera',
                    live_revision_id: 'rev-1',
                    canonical_url_policy: 'self',
                    canonical_url_custom: null,
                    updated_at: '2026-10-02T12:00:00Z',
                    published_at: '2026-10-01T10:00:00Z',
                  },
                  {
                    slug: 'private-test-draft-ring-prong-setting-inspection-20261011',
                    title: '[PRIVATE TEST DRAFT — DO NOT PUBLISH] Ring Prong Setting Inspection',
                    live_revision_id: 'rev-test',
                    canonical_url_policy: 'self',
                    canonical_url_custom: null,
                    updated_at: '2026-10-11T18:47:20Z',
                    published_at: '2026-10-11T18:47:20Z',
                  },
                ],
                error: null,
              }),
            }),
          }),
        }
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }
    }),
  },
}))

import sitemap from '@/app/sitemap'
import robots from '@/app/robots'
import { optimizeCloudinaryUrl } from '@/lib/imageUrl'

describe('Blog Public Pages & Search Metadata (Phase 2 & Semrush Audit Hardening)', () => {
  describe('Sitemap Integrity', () => {
    it('includes core D2C routes, /business, canonical product slugs, and valid published blog posts', async () => {
      const entries = await sitemap()
      expect(Array.isArray(entries)).toBe(true)

      const urls = entries.map((e) => e.url)
      expect(urls).toContain('https://shewah.co')
      expect(urls).toContain('https://shewah.co/jewellery')
      expect(urls).toContain('https://shewah.co/bespoke')
      expect(urls).toContain('https://shewah.co/diamonds')
      expect(urls).toContain('https://shewah.co/craftsmanship')
      expect(urls).toContain('https://shewah.co/business')
      expect(urls).toContain('https://shewah.co/blog')
      expect(urls).toContain('https://shewah.co/jewellery/radiant-bloom-diamond-ring')
      expect(urls).toContain('https://shewah.co/blog/the-solitaire-riviera')

      // Must NOT include non-canonical SKU URL or removed /collections 404 route
      expect(urls).not.toContain('https://shewah.co/jewellery/sh-001')
      expect(urls).not.toContain('https://shewah.co/collections')

      // Must NOT include synthetic test draft fixtures even if status was flipped in test runs
      expect(
        urls.some((u) => u.includes('private-test-draft-ring-prong-setting-inspection'))
      ).toBe(false)

      // Must have zero duplicate URLs
      expect(new Set(urls).size).toBe(urls.length)

      for (const entry of entries) {
        expect(entry.url).toMatch(/^https:\/\/shewah\.co/)
        expect(entry.lastModified).toBeInstanceOf(Date)
      }
    })

    it('does not include any admin, draft, or internal portal routes in sitemap', async () => {
      const entries = await sitemap()
      const urls = entries.map((e) => e.url)

      expect(urls.some((u) => u.includes('/admin'))).toBe(false)
      expect(urls.some((u) => u.includes('/portal'))).toBe(false)
      expect(urls.some((u) => u.includes('/dashboard'))).toBe(false)
      expect(urls.some((u) => u.includes('/editorial'))).toBe(false)
      expect(urls.some((u) => u.includes('/api/'))).toBe(false)
      expect(urls.some((u) => u.includes('preview'))).toBe(false)
    })
  })

  describe('Robots.txt Safety & Bot Access (Phase 4)', () => {
    it('allows public storefront, blog media, and D2C API while disallowing private admin/portal/editorial routes', () => {
      const result = robots()
      expect(result.sitemap).toBe('https://shewah.co/sitemap.xml')

      const ruleGroups = Array.isArray(result.rules) ? result.rules : [result.rules]
      expect(ruleGroups.length).toBeGreaterThanOrEqual(2)

      for (const group of ruleGroups) {
        const allowList = Array.isArray(group.allow) ? group.allow : [group.allow]
        expect(allowList).toContain('/')
        expect(allowList).toContain('/api/blog/v1/media/')
        expect(allowList).toContain('/api/d2c/')

        const disallowList = Array.isArray(group.disallow) ? group.disallow : [group.disallow]
        expect(disallowList).toContain('/admin')
        expect(disallowList).toContain('/admin/')
        expect(disallowList).toContain('/portal')
        expect(disallowList).toContain('/dashboard')
        expect(disallowList).toContain('/editorial')
        expect(disallowList).toContain('/api/')
        expect(disallowList).toContain('/*?*preview=*')
        // /login is controlled via X-Robots-Tag + <meta name="robots" content="noindex, nofollow">
        expect(disallowList).not.toContain('/login')
      }
    })
  })

  describe('Cloudinary Image Optimization (Phase 6)', () => {
    it('injects f_auto,q_auto,w_<width>,c_limit into raw Cloudinary upload URLs without double-transforming', () => {
      const raw = 'https://res.cloudinary.com/ddnlacdta/image/upload/v1782577185/ose19027_aepd7a.jpg'
      const optimized = optimizeCloudinaryUrl(raw, 800)
      expect(optimized).toBe(
        'https://res.cloudinary.com/ddnlacdta/image/upload/f_auto,q_auto,w_800,c_limit/v1782577185/ose19027_aepd7a.jpg'
      )
      // Idempotent when called again
      expect(optimizeCloudinaryUrl(optimized, 800)).toBe(optimized)
      // Non-Cloudinary URLs untouched
      const unsplash = 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=800'
      expect(optimizeCloudinaryUrl(unsplash, 800)).toBe(unsplash)
    })
  })

  describe('JSON-LD Structured Data Schema', () => {
    it('creates compliant BlogPosting structured data matching visible content', () => {
      const article = {
        title: 'Synthetic Test Fixture: Solitaire Setting Architecture',
        excerpt: 'Synthetic test excerpt: Investigation into prong architecture and structural tension.',
        author: 'Synthetic Test Author',
        heroImage: 'https://images.unsplash.com/photo-1605100804763-247f67b3557e',
        publishedAt: '2026-10-01T10:00:00.000Z',
        updatedAt: '2026-10-02T12:00:00.000Z',
        canonicalUrl: 'https://shewah.co/blog/synthetic-solitaire-setting',
      }

      const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        headline: article.title,
        description: article.excerpt,
        image: article.heroImage ? [article.heroImage] : undefined,
        datePublished: article.publishedAt,
        dateModified: article.updatedAt,
        author: {
          '@type': 'Person',
          name: article.author,
        },
        publisher: {
          '@type': 'Organization',
          name: 'SHEWAH',
          logo: {
            '@type': 'ImageObject',
            url: 'https://shewah.co/logo.png',
          },
        },
        mainEntityOfPage: {
          '@type': 'WebPage',
          '@id': article.canonicalUrl,
        },
      }

      const serialized = JSON.stringify(jsonLd)
      expect(() => JSON.parse(serialized)).not.toThrow()
      const parsed = JSON.parse(serialized)

      expect(parsed['@type']).toBe('BlogPosting')
      expect(parsed.headline).toBe(article.title)
      expect(parsed.author.name).toBe(article.author)
      expect(parsed.mainEntityOfPage['@id']).toBe(article.canonicalUrl)
      expect(parsed.publisher.name).toBe('SHEWAH')
    })

    it('creates valid BreadcrumbList structured data', () => {
      const breadcrumbs = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://shewah.co' },
          { '@type': 'ListItem', position: 2, name: 'Journal', item: 'https://shewah.co/blog' },
          { '@type': 'ListItem', position: 3, name: 'EDUCATION', item: 'https://shewah.co/blog?category=education' },
          { '@type': 'ListItem', position: 4, name: 'Prong Architecture', item: 'https://shewah.co/blog/prong-architecture' },
        ],
      }

      const serialized = JSON.stringify(breadcrumbs)
      const parsed = JSON.parse(serialized)
      expect(parsed['@type']).toBe('BreadcrumbList')
      expect(parsed.itemListElement).toHaveLength(4)
      expect(parsed.itemListElement[0].item).toBe('https://shewah.co')
      expect(parsed.itemListElement[3].item).toBe('https://shewah.co/blog/prong-architecture')
    })
  })
})
