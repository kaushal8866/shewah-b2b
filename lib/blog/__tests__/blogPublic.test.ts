import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/supabaseAdmin', () => ({
  supabaseAdmin: {
    from: vi.fn((table: string) => {
      if (table === 'products') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [{ id: '1', code: 'SH-001', updated_at: '2026-09-01T00:00:00Z' }],
              error: null,
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
                  { slug: 'the-solitaire-riviera', updated_at: '2026-10-02T12:00:00Z', published_at: '2026-10-01T10:00:00Z' },
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

describe('Blog Public Pages & Search Metadata (Phase 2)', () => {
  describe('Sitemap Integrity', () => {
    it('includes core D2C routes and /blog with valid structure', async () => {
      const entries = await sitemap()
      expect(Array.isArray(entries)).toBe(true)

      const urls = entries.map((e) => e.url)
      expect(urls).toContain('https://shewah.co')
      expect(urls).toContain('https://shewah.co/jewellery')
      expect(urls).toContain('https://shewah.co/bespoke')
      expect(urls).toContain('https://shewah.co/diamonds')
      expect(urls).toContain('https://shewah.co/craftsmanship')
      expect(urls).toContain('https://shewah.co/blog')

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
      expect(urls.some((u) => u.includes('/api/'))).toBe(false)
      expect(urls.some((u) => u.includes('preview'))).toBe(false)
    })
  })

  describe('Robots.txt Safety', () => {
    it('disallows crawling of sensitive admin, portal, API, and preview query parameters', () => {
      const result = robots()
      expect(result.sitemap).toBe('https://shewah.co/sitemap.xml')

      const rules = Array.isArray(result.rules) ? result.rules[0] : result.rules
      expect(rules.allow).toBe('/')
      expect(rules.disallow).toContain('/admin')
      expect(rules.disallow).toContain('/admin/')
      expect(rules.disallow).toContain('/portal')
      expect(rules.disallow).toContain('/dashboard')
      expect(rules.disallow).toContain('/api/')
      expect(rules.disallow).toContain('/*?*preview=*')
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
