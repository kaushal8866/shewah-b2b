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

  const latestUpdated = articles && articles.length > 0 && articles[0].updated_at
    ? new Date(articles[0].updated_at).toISOString()
    : now

  const entries = (articles || []).map((art) => {
    const articleUrl = `${baseUrl}/blog/${art.slug}`
    const publishedAt = art.published_at ? new Date(art.published_at).toISOString() : now
    const updatedAt = art.updated_at ? new Date(art.updated_at).toISOString() : publishedAt

    return `
  <entry>
    <title>${escapeXml(art.title)}</title>
    <link href="${articleUrl}" rel="alternate" />
    <id>${articleUrl}</id>
    <published>${publishedAt}</published>
    <updated>${updatedAt}</updated>
    <summary type="html"><![CDATA[${art.excerpt || art.title}]]></summary>
    <author>
      <name>${escapeXml(art.author_display_name || 'SHEWAH Editorial')}</name>
    </author>
    <category term="${escapeXml(art.category)}" />
    <rights>${escapeXml(art.hero_image_rights || '© SHEWAH Atelier')}</rights>
  </entry>`
  }).join('')

  const atomXml = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>SHEWAH Journal</title>
  <subtitle>Essays on high jewellery craftsmanship, gemstone science, natural solitaires, and atelier heritage.</subtitle>
  <link href="${baseUrl}/blog/atom.xml" rel="self" />
  <link href="${baseUrl}/blog" rel="alternate" />
  <id>${baseUrl}/blog</id>
  <updated>${latestUpdated}</updated>
  <rights>© ${new Date().getFullYear()} SHEWAH Atelier. All rights reserved.</rights>
  ${entries}
</feed>`

  return new NextResponse(atomXml, {
    headers: {
      'Content-Type': 'application/atom+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}
