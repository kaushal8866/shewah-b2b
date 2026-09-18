'use client'

import React from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { type D2CCategoryItem, DEFAULT_NON_EMPTY_CATEGORIES } from '@/lib/categories'
import { trackEvent } from '@/lib/analytics'

interface CategoryDiscoveryProps {
  categories?: D2CCategoryItem[]
}

export default function CategoryDiscovery({
  categories = DEFAULT_NON_EMPTY_CATEGORIES,
}: CategoryDiscoveryProps) {
  if (!categories || categories.length === 0) return null

  const gridColsClass =
    categories.length === 3
      ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
      : categories.length === 2
        ? 'grid-cols-1 sm:grid-cols-2'
        : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'

  return (
    <section className="py-20 sm:py-28 bg-[#F6F4F2] border-b border-[#E3DBD4]">
      <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
        {/* Section Header */}
        <div className="text-center max-w-xl mx-auto space-y-3 mb-16">
          <span className="text-[11px] uppercase tracking-[0.25em] text-[#CB9274] font-medium block">
            Curated Categories
          </span>
          <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl text-[#051F34] font-normal tracking-tight">
            Crafted for Generations
          </h2>
          <p className="text-sm text-[#69727D] font-light leading-relaxed">
            Discover iconic high jewellery designs forged from solid 18K gold and certified diamonds.
          </p>
        </div>

        {/* Categories Grid */}
        <div className={`grid ${gridColsClass} gap-6 sm:gap-8`}>
          {categories.map((col) => (
            <Link
              key={col.key}
              href={col.href}
              onClick={() => trackEvent('category_click', { category: col.key, label: col.label })}
              className="group relative h-96 sm:h-[440px] rounded-none overflow-hidden flex flex-col justify-end p-6 sm:p-8 border border-[#E3DBD4] transition-all hover:border-[#051F34]"
            >
              {col.image && (
                <div
                  className="absolute inset-0 bg-cover bg-center transition-transform duration-700 ease-out group-hover:scale-105"
                  style={{ backgroundImage: `url('${col.image}')` }}
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-[#051F34]/85 via-[#051F34]/30 to-transparent" />

              <div className="relative z-10 text-white space-y-2">
                <span className="text-[10px] uppercase tracking-[0.2em] text-[#CB9274] font-medium">
                  {col.count} {col.count === 1 ? 'Design' : 'Designs'}
                </span>
                <h3 className="font-serif text-2xl sm:text-3xl font-normal tracking-wide text-white">
                  {col.label}
                </h3>
                {col.subtitle && (
                  <p className="text-xs text-white/80 font-light line-clamp-2 leading-relaxed">
                    {col.subtitle}
                  </p>
                )}
                <div className="pt-2 flex items-center gap-2 text-[11px] text-[#CB9274] font-semibold tracking-[0.2em] uppercase group-hover:translate-x-1 transition-transform">
                  <span>Explore Collection</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
