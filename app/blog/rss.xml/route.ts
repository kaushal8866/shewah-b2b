import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;'
      case '>': return '&gt;'
      case '&': return '&amp;'
      case '\'': return '&apos;'
      case '"': return '&quot;'
      default: return c
    }
  })
}

export async function GET() {
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
      author_display_name,
      hero_image_url,
      hero_image_rights,
      published_at,
      updated_at
    `)
    .eq('status', 'published')
    .lte('published_at', now)
    .order('published_at', { ascending: false })
    .limit(50)

  const items = (articles || []).map((art) => {
    const articleUrl = `${baseUrl}/blog/${art.slug}`
    const pubDate = art.published_at ? new Date(art.published_at).toUTCString() : new Date().toUTCString()
    const mediaTag = art.hero_image_url
      ? `<media:content url="${escapeXml(art.hero_image_url)}" medium="image" />`
      : ''

    return `
    <item>
      <title>${escapeXml(art.title)}</title>
      <link>${articleUrl}</link>
      <guid isPermaLink="true">${articleUrl}</guid>
      <pubDate>${pubDate}</pubDate>
      <description><![CDATA[${art.excerpt || art.title}]]></description>
      <author>atelier@shewah.co (${escapeXml(art.author_display_name || 'SHEWAH Editorial')})</author>
      <category>${escapeXml(art.category)}</category>
      ${mediaTag}
    </item>`
  }).join('')

  const rssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>SHEWAH Journal | Fine Jewellery Editorial</title>
    <link>${baseUrl}/blog</link>
    <description>Essays on high jewellery craftsmanship, gemstone science, natural solitaires, and atelier heritage.</description>
    <language>en-IN</language>
    <copyright>© ${new Date().getFullYear()} SHEWAH Atelier. All rights reserved.</copyright>
    <atom:link href="${baseUrl}/blog/rss.xml" rel="self" type="application/rss+xml" />
    ${items}
  </channel>
</rss>`

  return new NextResponse(rssXml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}
