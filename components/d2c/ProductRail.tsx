'use client'

import React, { useRef } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react'
import ProductCard, { type ProductCardProps } from './ProductCard'

interface ProductRailProps {
  title: string
  subtitle?: string
  eyebrow?: string
  products: ProductCardProps[]
  viewAllHref?: string
  viewAllLabel?: string
}

export default function ProductRail({
  title,
  subtitle,
  eyebrow = 'Curated Selection',
  products,
  viewAllHref = '/jewellery',
  viewAllLabel = 'View All Pieces',
}: ProductRailProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  if (!products || products.length === 0) {
    return null
  }

  const handleScroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return
    const cardWidth = 320
    const scrollAmount = direction === 'left' ? -cardWidth * 2 : cardWidth * 2
    scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' })
  }

  return (
    <section className="py-16 sm:py-20 border-b border-[#E8DFC9] bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header with Navigation Controls */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div className="space-y-2">
            <span className="text-[10px] uppercase tracking-[0.3em] text-[#A88A4F] font-semibold block">
              {eyebrow}
            </span>
            <h2 className="font-serif text-2xl sm:text-4xl text-[#2A241B] font-light">
              {title}
            </h2>
            {subtitle && (
              <p className="text-xs sm:text-sm text-[#5C5347] font-light max-w-xl">
                {subtitle}
              </p>
            )}
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {viewAllHref && (
              <Link
                href={viewAllHref}
                className="text-xs uppercase tracking-wider font-semibold text-[#2A241B] hover:text-[#A88A4F] transition-colors flex items-center gap-1.5 mr-2"
              >
                <span>{viewAllLabel}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            )}

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => handleScroll('left')}
                className="p-2 rounded-full border border-[#E8DFC9] text-[#2A241B] hover:bg-[#FBF7F0] hover:border-[#2A241B] transition-colors active:scale-95"
                aria-label="Scroll left"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleScroll('right')}
                className="p-2 rounded-full border border-[#E8DFC9] text-[#2A241B] hover:bg-[#FBF7F0] hover:border-[#2A241B] transition-colors active:scale-95"
                aria-label="Scroll right"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable Products Container */}
        <div
          ref={scrollRef}
          className="flex gap-6 overflow-x-auto pb-4 pt-1 scroll-smooth scrollbar-none snap-x snap-mandatory"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {products.map((p) => (
            <div
              key={p.id}
              className="min-w-[260px] sm:min-w-[300px] max-w-[320px] flex-shrink-0 snap-start"
            >
              <ProductCard {...p} />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
