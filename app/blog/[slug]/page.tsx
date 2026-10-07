import React from 'react'
import { Metadata } from 'next'
import { notFound, redirect, RedirectType } from 'next/navigation'
import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import StoreHeader from '@/components/d2c/StoreHeader'
import StoreFooter from '@/components/d2c/StoreFooter'
import {
  Calendar,
  Clock,
  User,
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react'
import { format } from 'date-fns'

export const revalidate = 60

interface BlogPostProps {
  params: {
    slug: string
  }
}

/**
 * Helper to fetch public article + live revision.
 * Enforces 301 redirect if old_slug exists.
 * Returns null if article is draft, scheduled, archived, or nonexistent.
 */
async function fetchPublicArticle(slug: string) {
  const cleanSlug = slug.toLowerCase().trim()
  const now = new Date().toISOString()

  // 1. Check permanent 301 redirect map
  const { data: redirectRow } = await supabaseAdmin
    .from('blog_slug_redirects')
    .select('new_slug')
    .eq('old_slug', cleanSlug)
    .maybeSingle()

  if (redirectRow?.new_slug) {
    redirect(`/blog/${redirectRow.new_slug}`, RedirectType.replace)
  }

  // 2. Fetch published article
  const { data: article } = await supabaseAdmin
    .from('blog_articles')
    .select('*')
    .eq('slug', cleanSlug)
    .eq('status', 'published')
    .lte('published_at', now)
    .maybeSingle()

  if (!article || !article.live_revision_id) {
    return null
  }

  // 3. Fetch exact live revision snapshot
  const { data: revision } = await supabaseAdmin
    .from('blog_revisions')
    .select('*')
    .eq('id', article.live_revision_id)
    .maybeSingle()

  if (!revision) {
    return null
  }

  return { article, revision }
}

export async function generateMetadata({ params }: BlogPostProps): Promise<Metadata> {
  const data = await fetchPublicArticle(params.slug)
  if (!data) {
    return {
      title: 'Article Not Found | SHEWAH',
      description: 'The requested journal essay does not exist or has been withdrawn.',
      robots: { index: false, follow: false },
    }
  }

  const { article, revision } = data
  const canonicalUrl =
    article.canonical_url_policy === 'custom' && article.canonical_url_custom
      ? article.canonical_url_custom
      : `https://shewah.co/blog/${article.slug}`

  const title = revision.seo_title || `${revision.title} | SHEWAH Journal`
  const description =
    revision.meta_description ||
    revision.excerpt ||
    'High jewellery essay on certified diamonds and solid 18K gold craftsmanship from Maison SHEWAH.'

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title,
      description,
      url: `https://shewah.co/blog/${article.slug}`,
      siteName: 'SHEWAH',
      type: 'article',
      publishedTime: article.published_at || undefined,
      modifiedTime: article.updated_at || undefined,
      authors: [revision.author_display_name],
      images: revision.hero_image_url
        ? [
            {
              url: revision.hero_image_url,
              alt: revision.hero_image_alt || revision.title,
            },
          ]
        : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: revision.hero_image_url ? [revision.hero_image_url] : undefined,
    },
  }
}

export default async function BlogPostPage({ params }: BlogPostProps) {
  const data = await fetchPublicArticle(params.slug)
  if (!data) {
    notFound()
  }

  const { article, revision } = data
  const now = new Date().toISOString()

  // Query related published articles in the same category
  const { data: relatedArticles } = await supabaseAdmin
    .from('blog_articles')
    .select('id, slug, title, hero_image_url, hero_image_alt, reading_time_minutes, published_at')
    .eq('category', article.category)
    .eq('status', 'published')
    .lte('published_at', now)
    .neq('id', article.id)
    .order('published_at', { ascending: false })
    .limit(3)

  const canonicalUrl =
    article.canonical_url_policy === 'custom' && article.canonical_url_custom
      ? article.canonical_url_custom
      : `https://shewah.co/blog/${article.slug}`

  // Safe JSON-LD Structured Data
  const jsonLdArticle = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: revision.title,
    description: revision.meta_description || revision.excerpt || '',
    image: revision.hero_image_url ? [revision.hero_image_url] : undefined,
    datePublished: article.published_at,
    dateModified: article.updated_at,
    author: {
      '@type': 'Person',
      name: revision.author_display_name,
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
      '@id': canonicalUrl,
    },
  }

  const jsonLdBreadcrumbs = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: 'https://shewah.co',
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Journal',
        item: 'https://shewah.co/blog',
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: revision.category.replace('-', ' ').toUpperCase(),
        item: `https://shewah.co/blog?category=${encodeURIComponent(revision.category)}`,
      },
      {
        '@type': 'ListItem',
        position: 4,
        name: revision.title,
        item: canonicalUrl,
      },
    ],
  }

  return (
    <div className="min-h-screen bg-[#F6F4F2] text-[#051F34] flex flex-col font-sans selection:bg-[#CB9274]/20">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdArticle) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdBreadcrumbs) }}
      />
      <StoreHeader />

      <main className="flex-1 py-10 sm:py-16">
        <article className="max-w-[1440px] mx-auto px-4 sm:px-8 lg:px-12">
          {/* Breadcrumb Navigation */}
          <nav aria-label="Breadcrumb" className="pb-8">
            <ol className="flex items-center flex-wrap gap-2 text-[11px] uppercase tracking-[0.2em] text-[#69727D]">
              <li>
                <Link href="/" className="hover:text-[#051F34] transition-colors">
                  HOME
                </Link>
              </li>
              <span className="text-[#E3DBD4]">/</span>
              <li>
                <Link href="/blog" className="hover:text-[#051F34] transition-colors">
                  JOURNAL
                </Link>
              </li>
              <span className="text-[#E3DBD4]">/</span>
              <li>
                <Link
                  href={`/blog?category=${article.category}`}
                  className="hover:text-[#051F34] transition-colors"
                >
                  {article.category.replace('-', ' ').toUpperCase()}
                </Link>
              </li>
              <span className="text-[#E3DBD4]">/</span>
              <li className="text-[#051F34] font-medium truncate max-w-xs sm:max-w-md">
                {revision.title}
              </li>
            </ol>
          </nav>

          {/* Article Header & Typography Hero */}
          <header className="max-w-4xl mx-auto space-y-6 text-center pb-12">
            <div className="inline-block bg-[#051F34] text-white px-3 py-1 text-[10px] uppercase tracking-[0.25em] font-medium">
              {article.category.replace('-', ' ')}
            </div>

            <h1 className="font-serif text-3xl sm:text-5xl lg:text-6xl text-[#051F34] font-normal leading-[1.15] tracking-tight">
              {revision.title}
            </h1>

            {revision.excerpt && (
              <p className="font-serif text-lg sm:text-xl text-[#69727D] font-light leading-relaxed max-w-2xl mx-auto italic">
                &ldquo;{revision.excerpt}&rdquo;
              </p>
            )}

            {/* Bylines and Metadata */}
            <div className="flex flex-wrap items-center justify-center gap-6 pt-4 text-xs font-mono text-[#69727D] border-t border-[#E3DBD4] max-w-lg mx-auto">
              <span className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-[#CB9274]" />
                <span>{revision.author_display_name}</span>
              </span>
              {article.published_at && (
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-[#CB9274]" />
                  <time dateTime={article.published_at}>
                    {format(new Date(article.published_at), 'MMMM dd, yyyy')}
                  </time>
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#CB9274]" />
                <span>{revision.reading_time_minutes} min read</span>
              </span>
            </div>
          </header>

          {/* Hero Media Canvas */}
          {revision.hero_image_url && (
            <figure className="max-w-5xl mx-auto mb-16 bg-white border border-[#E3DBD4] p-3 sm:p-4">
              <div className="relative aspect-[16/9] overflow-hidden bg-[#F6F4F2]">
                <img
                  src={revision.hero_image_url}
                  alt={revision.hero_image_alt || revision.title}
                  className="w-full h-full object-cover"
                />
              </div>
              {(revision.hero_image_caption || revision.hero_image_rights) && (
                <figcaption className="pt-3 px-1 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1 text-[11px] text-[#69727D] font-light">
                  <span>{revision.hero_image_caption}</span>
                  {revision.hero_image_rights && (
                    <span className="text-[10px] uppercase tracking-wider font-mono text-stone-400">
                      Provenance: {revision.hero_image_rights}
                    </span>
                  )}
                </figcaption>
              )}
            </figure>
          )}

          {/* Article Body Content */}
          <div className="max-w-3xl mx-auto bg-white border border-[#E3DBD4] p-8 sm:p-14 lg:p-16 space-y-8 shadow-sm">
            <div className="prose prose-stone max-w-none text-[#051F34] font-sans leading-relaxed text-base sm:text-lg">
              {/* Render article markdown safely formatted */}
              {((revision.body_markdown || '').split('\n\n')).map((block: string, idx: number) => {
                const trimmed = block.trim()
                if (!trimmed) return null

                // Headings
                if (trimmed.startsWith('### ')) {
                  return (
                    <h3 key={idx} className="font-serif text-xl sm:text-2xl text-[#051F34] font-normal pt-6 pb-2">
                      {trimmed.replace('### ', '')}
                    </h3>
                  )
                }
                if (trimmed.startsWith('## ')) {
                  return (
                    <h2 key={idx} className="font-serif text-2xl sm:text-3xl text-[#051F34] font-normal pt-8 pb-3 border-b border-[#E3DBD4]/60">
                      {trimmed.replace('## ', '')}
                    </h2>
                  )
                }
                if (trimmed.startsWith('# ')) {
                  return (
                    <h2 key={idx} className="font-serif text-2xl sm:text-3xl text-[#051F34] font-normal pt-8 pb-3">
                      {trimmed.replace('# ', '')}
                    </h2>
                  )
                }

                // Blockquotes
                if (trimmed.startsWith('> ')) {
                  return (
                    <blockquote key={idx} className="pl-6 border-l-2 border-[#CB9274] my-6 font-serif italic text-lg sm:text-xl text-[#051F34]/90">
                      {trimmed.replace('> ', '')}
                    </blockquote>
                  )
                }

                // Bullet lists
                if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                  const items = trimmed.split('\n').filter(Boolean)
                  return (
                    <ul key={idx} className="space-y-2 my-4 pl-5 list-disc text-stone-700">
                      {items.map((it: string, i: number) => (
                        <li key={i}>{it.replace(/^[-*]\s+/, '')}</li>
                      ))}
                    </ul>
                  )
                }

                // Standard paragraph
                return (
                  <p key={idx} className="text-[#051F34]/90 font-light leading-relaxed mb-4">
                    {trimmed}
                  </p>
                )
              })}
            </div>

            {/* Atelier Trust Note */}
            <div className="mt-12 pt-8 border-t border-[#E3DBD4] bg-[#F6F4F2] p-6 sm:p-8 flex items-start gap-4">
              <ShieldCheck className="w-6 h-6 text-[#CB9274] shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="font-serif text-base text-[#051F34] font-medium">
                  The Maison Shewah Atelier Standard
                </h4>
                <p className="text-xs text-[#69727D] font-light leading-relaxed">
                  Every creation referenced across our journal essays is made individually to order
                  using solid 18K gold and independently certified diamonds (IGI & GIA). We uphold complete
                  material transparency and zero synthetic plating.
                </p>
                <div className="pt-2 flex items-center gap-4 text-xs">
                  <Link href="/jewellery" className="text-[#CB9274] hover:underline font-medium">
                    Explore Made-to-Order Pieces &rarr;
                  </Link>
                  <Link href="/bespoke" className="text-[#051F34] hover:underline font-medium">
                    Commission Custom Bespoke &rarr;
                  </Link>
                </div>
              </div>
            </div>

            {/* Primary Source Citations */}
            {revision.source_references && revision.source_references.length > 0 && (
              <section className="pt-10 border-t border-[#E3DBD4] space-y-4 font-sans" aria-label="Research Sources">
                <h3 className="font-sans text-[11px] uppercase tracking-[0.2em] font-semibold text-[#CB9274]">
                  Research & Gemological References
                </h3>
                <ol className="space-y-2.5 text-xs text-[#69727D]">
                  {revision.source_references.map((src: any, index: number) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="font-mono text-[#CB9274] font-medium">[{index + 1}]</span>
                      <div className="flex-1">
                        <span className="text-[#051F34] font-medium">{src.title}</span> —{' '}
                        <span>{src.sourceName}</span>
                        {src.checkedAt && (
                          <span className="font-mono text-[10px] text-stone-400"> (Verified: {src.checkedAt})</span>
                        )}
                        {src.url && (
                          <a
                            href={src.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 ml-2 text-[#CB9274] hover:underline"
                          >
                            <span>Verify Source</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            )}
          </div>

          {/* Related Articles (Rendered ONLY when real published articles exist!) */}
          {relatedArticles && relatedArticles.length > 0 && (
            <section className="max-w-5xl mx-auto pt-20 border-t border-[#E3DBD4] mt-20 space-y-8">
              <div className="text-center space-y-2">
                <span className="text-[11px] uppercase tracking-[0.25em] text-[#CB9274] font-medium block">
                  Further Reading
                </span>
                <h3 className="font-serif text-3xl text-[#051F34] font-normal">
                  Related Atelier Perspectives
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
                {relatedArticles.map((rel: any) => (
                  <Link
                    key={rel.id}
                    href={`/blog/${rel.slug}`}
                    className="group bg-white border border-[#E3DBD4] p-4 flex flex-col justify-between hover:border-[#051F34] transition-all"
                  >
                    <div className="space-y-3">
                      <div className="aspect-[16/10] bg-[#F6F4F2] overflow-hidden">
                        {rel.hero_image_url ? (
                          <img
                            src={rel.hero_image_url}
                            alt={rel.hero_image_alt || rel.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-stone-300">
                            <Clock className="w-6 h-6 stroke-[1]" />
                          </div>
                        )}
                      </div>
                      <h4 className="font-serif text-base text-[#051F34] group-hover:text-[#CB9274] transition-colors leading-snug">
                        {rel.title}
                      </h4>
                    </div>
                    <div className="pt-4 flex items-center justify-between text-[11px] text-[#CB9274] font-mono">
                      <span>{rel.reading_time_minutes} min read</span>
                      <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Back to Journal Link */}
          <div className="max-w-3xl mx-auto pt-16 flex items-center justify-between border-t border-[#E3DBD4] mt-16">
            <Link
              href="/blog"
              className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] font-medium text-[#051F34] hover:text-[#CB9274] transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to The Journal</span>
            </Link>
            <Link
              href="/bespoke"
              className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] font-medium text-[#CB9274] hover:text-[#051F34] transition-colors"
            >
              <span>Explore Atelier Bespoke</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </article>
      </main>

      <StoreFooter />
    </div>
  )
}
