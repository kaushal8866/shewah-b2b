import { MetadataRoute } from 'next'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getBlogSettings } from '@/lib/blog/storage'
import { isInternalTestBlogArtifact } from '@/lib/blog/types'

export const dynamic = 'force-dynamic'

const STATIC_CONTENT_LAST_MODIFIED = new Date('2026-10-01T00:00:00.000Z')

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://shewah.co'
  const now = new Date().toISOString()
  const settings = await getBlogSettings().catch(() => ({ is_blog_enabled: true }))
  const isBlogEnabled = settings.is_blog_enabled !== false

  // 1. Dynamic published products from catalogue (canonical slug only)
  let productEntries: MetadataRoute.Sitemap = []
  let latestProductDate = STATIC_CONTENT_LAST_MODIFIED
  try {
    const query: any = supabaseAdmin
      .from('products')
      .select('id, code, slug, updated_at, is_active, d2c_status')
      .eq('is_active', true)

    const { data: products } =
      typeof query?.eq === 'function'
        ? await query.eq('d2c_status', 'published')
        : await query

    if (Array.isArray(products)) {
      const validProducts = products.filter(
        (p: any) =>
          p &&
          p.is_active !== false &&
          (!p.d2c_status || p.d2c_status === 'published') &&
          (p.slug || p.code)
      )

      productEntries = validProducts.map((p: any) => {
        const canonicalSlug = String(p.slug || p.code)
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')
        const modDate = p.updated_at ? new Date(p.updated_at) : STATIC_CONTENT_LAST_MODIFIED
        if (modDate > latestProductDate) {
          latestProductDate = modDate
        }
        return {
          url: `${baseUrl}/jewellery/${canonicalSlug}`,
          lastModified: modDate,
          changeFrequency: 'weekly' as const,
          priority: 0.8,
        }
      })
    }
  } catch (err) {
    console.error('[sitemap] Failed to query products:', err)
  }

  // 2. Dynamic canonical published blog articles
  let blogEntries: MetadataRoute.Sitemap = []
  let latestBlogDate = STATIC_CONTENT_LAST_MODIFIED
  if (isBlogEnabled) {
    try {
      const { data: articles } = await supabaseAdmin
        .from('blog_articles')
        .select(
          'slug, title, status, live_revision_id, updated_at, published_at, canonical_url_policy, canonical_url_custom'
        )
        .eq('status', 'published')
        .lte('published_at', now)

      if (Array.isArray(articles)) {
        const validArticles = articles.filter((a: any) => {
          if (!a || !a.slug) return false
          if (a.status && a.status !== 'published') return false
          if ('live_revision_id' in a && !a.live_revision_id) return false
          if (a.published_at && new Date(a.published_at).toISOString() > now) return false
          if (isInternalTestBlogArtifact(a)) return false
          if (
            a.canonical_url_policy === 'custom' &&
            a.canonical_url_custom &&
            a.canonical_url_custom !== `${baseUrl}/blog/${a.slug}`
          ) {
            return false
          }
          return true
        })

        blogEntries = validArticles.map((a: any) => {
          const modDate = a.updated_at
            ? new Date(a.updated_at)
            : a.published_at
              ? new Date(a.published_at)
              : STATIC_CONTENT_LAST_MODIFIED
          if (modDate > latestBlogDate) {
            latestBlogDate = modDate
          }
          return {
            url: `${baseUrl}/blog/${String(a.slug).trim().toLowerCase()}`,
            lastModified: modDate,
            changeFrequency: 'weekly' as const,
            priority: 0.7,
          }
        })
      }
    } catch (err) {
      console.error('[sitemap] Failed to query blog articles:', err)
    }
  }

  const latestSiteDate =
    latestBlogDate > latestProductDate ? latestBlogDate : latestProductDate

  // 3. Core static public indexable canonical routes (excludes /collections 404 and private/utility pages)
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${baseUrl}`, lastModified: latestSiteDate, changeFrequency: 'daily', priority: 1.0 },
    { url: `${baseUrl}/jewellery`, lastModified: latestProductDate, changeFrequency: 'daily', priority: 0.9 },
    { url: `${baseUrl}/bespoke`, lastModified: STATIC_CONTENT_LAST_MODIFIED, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${baseUrl}/craftsmanship`, lastModified: STATIC_CONTENT_LAST_MODIFIED, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${baseUrl}/diamonds`, lastModified: STATIC_CONTENT_LAST_MODIFIED, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${baseUrl}/consultation`, lastModified: STATIC_CONTENT_LAST_MODIFIED, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${baseUrl}/ring-size-guide`, lastModified: STATIC_CONTENT_LAST_MODIFIED, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${baseUrl}/shipping`, lastModified: STATIC_CONTENT_LAST_MODIFIED, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/returns`, lastModified: STATIC_CONTENT_LAST_MODIFIED, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/warranty`, lastModified: STATIC_CONTENT_LAST_MODIFIED, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/care`, lastModified: STATIC_CONTENT_LAST_MODIFIED, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/contact`, lastModified: STATIC_CONTENT_LAST_MODIFIED, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${baseUrl}/privacy`, lastModified: STATIC_CONTENT_LAST_MODIFIED, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${baseUrl}/terms`, lastModified: STATIC_CONTENT_LAST_MODIFIED, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${baseUrl}/about`, lastModified: STATIC_CONTENT_LAST_MODIFIED, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/business`, lastModified: STATIC_CONTENT_LAST_MODIFIED, changeFrequency: 'monthly', priority: 0.5 },
    ...(isBlogEnabled
      ? [{ url: `${baseUrl}/blog`, lastModified: latestBlogDate, changeFrequency: 'daily' as const, priority: 0.8 }]
      : []),
  ]

  // Deduplicate by normalized URL
  const deduped = new Map<string, MetadataRoute.Sitemap[number]>()
  for (const entry of [...staticRoutes, ...productEntries, ...blogEntries]) {
    if (!deduped.has(entry.url)) {
      deduped.set(entry.url, entry)
    }
  }

  return Array.from(deduped.values())
}

