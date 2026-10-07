import { MetadataRoute } from 'next'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getBlogSettings } from '@/lib/blog/storage'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://shewah.co'
  const now = new Date().toISOString()
  const settings = await getBlogSettings().catch(() => ({ is_blog_enabled: true }))
  const isBlogEnabled = settings.is_blog_enabled !== false

  // 1. Core static D2C routes
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${baseUrl}`, lastModified: new Date(), changeFrequency: 'daily', priority: 1.0 },
    { url: `${baseUrl}/jewellery`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${baseUrl}/collections`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: `${baseUrl}/bespoke`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: `${baseUrl}/craftsmanship`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${baseUrl}/diamonds`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${baseUrl}/consultation`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${baseUrl}/ring-size-guide`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${baseUrl}/shipping`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/returns`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/warranty`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/care`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/contact`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${baseUrl}/privacy`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
    { url: `${baseUrl}/terms`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
    { url: `${baseUrl}/about`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    ...(isBlogEnabled ? [{ url: `${baseUrl}/blog`, lastModified: new Date(), changeFrequency: 'daily' as const, priority: 0.8 }] : []),
  ]

  // 2. Dynamic published products from catalogue
  let productEntries: MetadataRoute.Sitemap = []
  try {
    const { data: products } = await supabaseAdmin
      .from('products')
      .select('id, code, updated_at')
      .eq('is_active', true)

    if (products) {
      productEntries = products.map((p) => {
        const slug = p.code.toLowerCase().replace(/[^a-z0-9]/g, '-')
        return {
          url: `${baseUrl}/jewellery/${slug}`,
          lastModified: p.updated_at ? new Date(p.updated_at) : new Date(),
          changeFrequency: 'weekly' as const,
          priority: 0.8,
        }
      })
    }
  } catch (err) {
    console.error('[sitemap] Failed to query products:', err)
  }

  // 3. Dynamic canonical published blog articles
  let blogEntries: MetadataRoute.Sitemap = []
  if (isBlogEnabled) {
    try {
      const { data: articles } = await supabaseAdmin
        .from('blog_articles')
        .select('slug, updated_at, published_at')
        .eq('status', 'published')
        .lte('published_at', now)

      if (articles) {
        blogEntries = articles.map((a) => ({
          url: `${baseUrl}/blog/${a.slug}`,
          lastModified: a.updated_at ? new Date(a.updated_at) : new Date(a.published_at || now),
          changeFrequency: 'weekly' as const,
          priority: 0.7,
        }))
      }
    } catch (err) {
      console.error('[sitemap] Failed to query blog articles:', err)
    }
  }

  return [...staticRoutes, ...productEntries, ...blogEntries]
}
