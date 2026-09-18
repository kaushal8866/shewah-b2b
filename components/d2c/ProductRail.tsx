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
    <section className="py-20 sm:py-24 border-b border-[#E3DBD4] bg-[#FFFFFF]">
      <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
        {/* Header with Navigation Controls */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-10">
          <div className="space-y-2">
            <span className="text-[11px] uppercase tracking-[0.25em] text-[#CB9274] font-medium block">
              {eyebrow}
            </span>
            <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl text-[#051F34] font-normal tracking-tight">
              {title}
            </h2>
            {subtitle && (
              <p className="text-sm text-[#69727D] font-light max-w-xl">
                {subtitle}
              </p>
            )}
          </div>

          <div className="flex items-center gap-4 shrink-0">
            {viewAllHref && (
              <Link
                href={viewAllHref}
                className="text-xs uppercase tracking-[0.2em] font-medium text-[#051F34] hover:text-[#CB9274] transition-colors flex items-center gap-2 mr-2"
              >
                <span>{viewAllLabel}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            )}

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleScroll('left')}
                className="w-10 h-10 flex items-center justify-center border border-[#E3DBD4] text-[#051F34] hover:bg-[#051F34] hover:text-white hover:border-[#051F34] transition-colors active:scale-95"
                aria-label="Scroll left"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleScroll('right')}
                className="w-10 h-10 flex items-center justify-center border border-[#E3DBD4] text-[#051F34] hover:bg-[#051F34] hover:text-white hover:border-[#051F34] transition-colors active:scale-95"
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
              className="min-w-[280px] sm:min-w-[320px] max-w-[340px] flex-shrink-0 snap-start"
            >
              <ProductCard {...p} />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
