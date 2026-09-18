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
    <section className="py-20 bg-[#FBF7F0] border-b border-[#E8DFC9]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-xl mx-auto space-y-3 mb-14">
          <span className="text-[10px] uppercase tracking-[0.35em] text-[#A88A4F] font-semibold block">
            Curated Categories
          </span>
          <h2 className="font-serif text-3xl sm:text-4xl text-[#2A241B] font-light">
            Crafted for Generations
          </h2>
          <p className="text-xs sm:text-sm text-[#5C5347] font-light leading-relaxed">
            Discover iconic high jewellery designs forged from the purest solid gold alloys and certified diamonds.
          </p>
        </div>

        {/* Categories Grid */}
        <div className={`grid ${gridColsClass} gap-6 sm:gap-8`}>
          {categories.map((col) => (
            <Link
              key={col.key}
              href={col.href}
              onClick={() => trackEvent('category_click', { category: col.key, label: col.label })}
              className="group relative h-96 sm:h-[420px] rounded-2xl overflow-hidden shadow-sm flex flex-col justify-end p-6 sm:p-8 border border-[#E8DFC9] transition-all hover:shadow-2xl"
            >
              {col.image && (
                <div
                  className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
                  style={{ backgroundImage: `url('${col.image}')` }}
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-stone-950/85 via-stone-950/30 to-transparent" />

              <div className="relative z-10 text-white space-y-1.5">
                <span className="text-[9px] uppercase tracking-widest text-[#C9A86A] font-mono">
                  {col.count} {col.count === 1 ? 'Masterwork' : 'Masterworks'}
                </span>
                <h3 className="font-serif text-2xl font-light tracking-wide text-white">
                  {col.label}
                </h3>
                {col.subtitle && (
                  <p className="text-xs text-stone-300 font-light line-clamp-2 leading-relaxed">
                    {col.subtitle}
                  </p>
                )}
                <div className="pt-3 flex items-center gap-1.5 text-xs text-[#C9A86A] font-medium tracking-wider uppercase group-hover:translate-x-1 transition-transform">
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
