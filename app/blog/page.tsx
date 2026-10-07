import React from 'react'
import { Metadata } from 'next'
import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import StoreHeader from '@/components/d2c/StoreHeader'
import StoreFooter from '@/components/d2c/StoreFooter'
import { ArrowRight, BookOpen, Clock, Calendar, Sparkles } from 'lucide-react'
import { format } from 'date-fns'

export const revalidate = 60 // Revalidate every minute

export const metadata: Metadata = {
  title: 'The Journal | High Jewellery Essays & Gemological Perspectives',
  description:
    'Explorations into architectural diamond design, laboratory-grown solitaires, solid 18K gold metallurgy, and private atelier craftsmanship from Surat.',
  alternates: {
    canonical: 'https://shewah.co/blog',
  },
  openGraph: {
    title: 'The Journal | SHEWAH',
    description:
      'Curated essays on high jewellery craftsmanship, diamond silhouettes, and bespoke atelier techniques.',
    url: 'https://shewah.co/blog',
    siteName: 'SHEWAH',
    type: 'website',
  },
}

const CATEGORY_TABS = [
  { key: 'all', label: 'All Perspectives' },
  { key: 'education', label: 'Gemology & Education' },
  { key: 'craftsmanship', label: 'Atelier Craftsmanship' },
  { key: 'style-guides', label: 'Style & Silhouettes' },
  { key: 'materials', label: 'Gold & Metallurgy' },
  { key: 'diamonds', label: 'Diamond Guides' },
]

interface BlogIndexProps {
  searchParams?: {
    page?: string
    category?: string
  }
}

export default async function BlogIndexPage({ searchParams }: BlogIndexProps) {
  const page = Math.max(1, parseInt(searchParams?.page || '1', 10))
  const selectedCategory = searchParams?.category || 'all'
  const pageSize = 9
  const offset = (page - 1) * pageSize
  const now = new Date().toISOString()

  // Base query: strictly published articles with arrival time <= now
  let countQuery = supabaseAdmin
    .from('blog_articles')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'published')
    .lte('published_at', now)

  let dataQuery = supabaseAdmin
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
      hero_image_alt,
      reading_time_minutes,
      published_at
    `)
    .eq('status', 'published')
    .lte('published_at', now)
    .order('published_at', { ascending: false })
    .range(offset, offset + pageSize - 1)

  if (selectedCategory && selectedCategory !== 'all') {
    countQuery = countQuery.eq('category', selectedCategory)
    dataQuery = dataQuery.eq('category', selectedCategory)
  }

  const [{ count }, { data: articles, error }] = await Promise.all([countQuery, dataQuery])
  const totalArticles = count ?? 0
  const totalPages = Math.ceil(totalArticles / pageSize)

  const breadcrumbJsonLd = {
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
        name: 'The Journal',
        item: 'https://shewah.co/blog',
      },
    ],
  }

  return (
    <div className="min-h-screen bg-[#F6F4F2] text-[#051F34] flex flex-col font-sans selection:bg-[#CB9274]/20">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <StoreHeader />

      <main className="flex-1">
        {/* Editorial Masthead */}
        <section className="border-b border-[#E3DBD4] bg-white/50 py-16 sm:py-24">
          <div className="max-w-[1440px] mx-auto px-4 sm:px-8 lg:px-12 text-center space-y-4 max-w-3xl">
            <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.25em] font-semibold text-[#CB9274]">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Maison Shewah • Private Editorial</span>
            </div>
            <h1 className="font-serif text-3xl sm:text-5xl lg:text-6xl text-[#051F34] font-normal tracking-tight">
              The Journal
            </h1>
            <p className="text-sm sm:text-base text-[#69727D] font-light leading-relaxed max-w-2xl mx-auto">
              Curated perspectives on fine jewellery metallurgy, laboratory-grown solitaires,
              and centuries-refined diamond setting from our Surat atelier.
            </p>
          </div>
        </section>

        {/* Category Navigation Bar */}
        <section className="border-b border-[#E3DBD4] bg-[#F6F4F2] sticky top-18 sm:top-20 z-20 backdrop-blur-md">
          <div className="max-w-[1440px] mx-auto px-4 sm:px-8 lg:px-12">
            <div className="flex items-center gap-2 sm:gap-4 overflow-x-auto py-4 scrollbar-none text-xs uppercase tracking-[0.16em] font-medium">
              {CATEGORY_TABS.map((tab) => {
                const isActive = (selectedCategory === tab.key) || (!selectedCategory && tab.key === 'all')
                const href = tab.key === 'all' ? '/blog' : `/blog?category=${tab.key}`
                return (
                  <Link
                    key={tab.key}
                    href={href}
                    className={`px-4 py-2 whitespace-nowrap transition-all border ${
                      isActive
                        ? 'bg-[#051F34] text-white border-[#051F34]'
                        : 'bg-white/60 text-[#69727D] border-[#E3DBD4] hover:border-[#051F34] hover:text-[#051F34]'
                    }`}
                  >
                    {tab.label}
                  </Link>
                )
              })}
            </div>
          </div>
        </section>

        {/* Article Grid or Clean Empty State */}
        <section className="py-16 sm:py-20">
          <div className="max-w-[1440px] mx-auto px-4 sm:px-8 lg:px-12">
            {(!articles || articles.length === 0) ? (
              <div className="max-w-xl mx-auto text-center py-20 px-6 bg-white border border-[#E3DBD4] space-y-4">
                <div className="w-12 h-12 mx-auto rounded-none bg-[#F6F4F2] border border-[#E3DBD4] flex items-center justify-center text-[#CB9274]">
                  <BookOpen className="w-5 h-5 stroke-[1.5]" />
                </div>
                <h2 className="font-serif text-2xl text-[#051F34] font-normal">
                  Forthcoming Editorial Releases
                </h2>
                <p className="text-xs sm:text-sm text-[#69727D] font-light leading-relaxed">
                  Our atelier essays on diamond grading standards, gold metallurgy, and bespoke commissioning
                  are currently being prepared by our gemological staff. Please check back shortly or explore our bespoke atelier.
                </p>
                <div className="pt-4 flex flex-wrap items-center justify-center gap-3">
                  <Link
                    href="/jewellery"
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#051F34] text-white text-[11px] uppercase tracking-[0.18em] font-medium hover:bg-[#CB9274] transition-colors"
                  >
                    <span>Explore Jewellery</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                  <Link
                    href="/bespoke"
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-white border border-[#E3DBD4] text-[#051F34] text-[11px] uppercase tracking-[0.18em] font-medium hover:border-[#051F34] transition-colors"
                  >
                    <span>Bespoke Commissions</span>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-12">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 sm:gap-10">
                  {articles.map((item) => (
                    <article
                      key={item.id}
                      className="group bg-white border border-[#E3DBD4] flex flex-col justify-between overflow-hidden hover:border-[#051F34] transition-all"
                    >
                      <div>
                        {/* Image Canvas */}
                        <Link href={`/blog/${item.slug}`} className="block relative aspect-[16/10] overflow-hidden bg-[#F6F4F2] border-b border-[#E3DBD4]">
                          {item.hero_image_url ? (
                            <img
                              src={item.hero_image_url}
                              alt={item.hero_image_alt || item.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-stone-300">
                              <BookOpen className="w-8 h-8 stroke-[1]" />
                            </div>
                          )}
                          <div className="absolute top-3 left-3 bg-[#051F34] text-white px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] font-medium">
                            {item.category.replace('-', ' ')}
                          </div>
                        </Link>

                        {/* Article Metadata & Content */}
                        <div className="p-6 sm:p-8 space-y-3">
                          <div className="flex items-center gap-4 text-[11px] text-[#69727D] font-mono">
                            {item.published_at && (
                              <span className="flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5" />
                                <span>{format(new Date(item.published_at), 'MMM dd, yyyy')}</span>
                              </span>
                            )}
                            <span className="flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5" />
                              <span>{item.reading_time_minutes} min read</span>
                            </span>
                          </div>

                          <h2 className="font-serif text-xl sm:text-2xl text-[#051F34] font-normal leading-snug group-hover:text-[#CB9274] transition-colors">
                            <Link href={`/blog/${item.slug}`}>
                              {item.title}
                            </Link>
                          </h2>

                          {item.excerpt && (
                            <p className="text-xs text-[#69727D] font-light leading-relaxed line-clamp-3">
                              {item.excerpt}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Footer Link */}
                      <div className="px-6 pb-6 sm:px-8 sm:pb-8 pt-2 border-t border-[#E3DBD4]/40 flex items-center justify-between">
                        <span className="text-[10px] uppercase tracking-[0.16em] text-[#69727D]">
                          By {item.author_display_name}
                        </span>
                        <Link
                          href={`/blog/${item.slug}`}
                          className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em] font-semibold text-[#CB9274] group-hover:translate-x-1 transition-transform"
                        >
                          <span>Read Essay</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </article>
                  ))}
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <nav className="flex items-center justify-center gap-3 pt-8 border-t border-[#E3DBD4]" aria-label="Pagination">
                    {page > 1 && (
                      <Link
                        href={`/blog?page=${page - 1}${selectedCategory !== 'all' ? `&category=${selectedCategory}` : ''}`}
                        className="px-4 py-2 border border-[#E3DBD4] bg-white text-xs uppercase tracking-[0.16em] hover:border-[#051F34]"
                      >
                        Previous
                      </Link>
                    )}
                    <span className="text-xs uppercase tracking-[0.16em] text-[#69727D] px-2">
                      Page {page} of {totalPages}
                    </span>
                    {page < totalPages && (
                      <Link
                        href={`/blog?page=${page + 1}${selectedCategory !== 'all' ? `&category=${selectedCategory}` : ''}`}
                        className="px-4 py-2 border border-[#E3DBD4] bg-white text-xs uppercase tracking-[0.16em] hover:border-[#051F34]"
                      >
                        Next
                      </Link>
                    )}
                  </nav>
                )}
              </div>
            )}
          </div>
        </section>
      </main>

      <StoreFooter />
    </div>
  )
}
