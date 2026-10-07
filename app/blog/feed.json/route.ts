import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getBlogSettings } from '@/lib/blog/storage'

export const dynamic = 'force-dynamic'

export async function GET() {
  const settings = await getBlogSettings()
  if (settings.is_blog_enabled === false) {
    return new NextResponse(null, { status: 404 })
  }

  const now = new Date().toISOString()
  const baseUrl = 'https://shewah.co'

  const { data: articles } = await supabaseAdmin
    .from('blog_articles')
    .select(`
      id,
      slug,
      title,
      excerpt,
      category,
      tags,
      author_display_name,
      hero_image_url,
      published_at,
      updated_at
    `)
    .eq('status', 'published')
    .lte('published_at', now)
    .order('published_at', { ascending: false })
    .limit(50)

  const items = (articles || []).map((art) => ({
    id: `${baseUrl}/blog/${art.slug}`,
    url: `${baseUrl}/blog/${art.slug}`,
    title: art.title,
    summary: art.excerpt || undefined,
    image: art.hero_image_url || undefined,
    date_published: art.published_at ? new Date(art.published_at).toISOString() : now,
    date_modified: art.updated_at ? new Date(art.updated_at).toISOString() : undefined,
    tags: art.tags && art.tags.length > 0 ? art.tags : [art.category],
    authors: [
      {
        name: art.author_display_name || 'SHEWAH Editorial Atelier',
      },
    ],
  }))

  const jsonFeed = {
    version: 'https://jsonfeed.org/version/1.1',
    title: 'SHEWAH Journal',
    home_page_url: `${baseUrl}/blog`,
    feed_url: `${baseUrl}/blog/feed.json`,
    description: 'Essays on high jewellery craftsmanship, gemstone science, natural solitaires, and atelier heritage.',
    language: 'en-IN',
    favicon: `${baseUrl}/favicon.ico`,
    items,
  }

  return NextResponse.json(jsonFeed, {
    headers: {
      'Content-Type': 'application/feed+json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}
