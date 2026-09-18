'use client'

import React from 'react'
import Link from 'next/link'
import { ArrowRight, Sparkles, Diamond, ShieldCheck } from 'lucide-react'
import { trackEvent } from '@/lib/analytics'

export interface CollectionFeatureProps {
  title?: string
  subtitle?: string
  description?: string
  image?: string
  href?: string
  badge?: string
}

export default function CollectionFeature({
  title = 'The Royal Heritage Suite',
  subtitle = 'Harmonious suites crafted in solid 18K gold',
  description = 'An homage to timeless fine jewellery suites, modernised with architectural fluidity and set with certified diamonds. Available as a complete coordinated suite or commissioned individually.',
  image = 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=1600&q=85',
  href = '/jewellery',
  badge = 'Curated Collection',
}: CollectionFeatureProps) {
  return (
    <section className="py-20 sm:py-28 bg-white border-b border-[#E3DBD4] overflow-hidden">
      <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          {/* Editorial Visual (7 cols) */}
          <div className="lg:col-span-7 relative">
            <div className="relative aspect-[4/3] rounded-none overflow-hidden border border-[#E3DBD4]">
              <img
                src={image}
                alt={title}
                className="w-full h-full object-cover transition-transform duration-700 ease-out hover:scale-105"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#051F34]/30 via-transparent to-transparent" />
            </div>

            {/* Float Highlight Badge */}
            <div className="absolute -bottom-4 -right-2 sm:bottom-6 sm:-right-6 bg-white/95 backdrop-blur-md p-5 rounded-none border border-[#E3DBD4] shadow-lg max-w-xs space-y-1">
              <div className="flex items-center gap-2 text-[#CB9274]">
                <Sparkles className="w-4 h-4" />
                <span className="text-[10px] uppercase tracking-[0.2em] font-semibold">
                  Suite Privilege
                </span>
              </div>
              <p className="text-xs text-[#69727D] font-light leading-relaxed">
                Available together as a harmonious set or acquired individually.
              </p>
            </div>
          </div>

          {/* Copy & CTAs (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            <span className="text-[11px] uppercase tracking-[0.25em] text-[#CB9274] font-medium block">
              {badge}
            </span>

            <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl text-[#051F34] font-normal leading-tight">
              {title}
            </h2>

            <p className="text-xs uppercase tracking-[0.2em] text-[#69727D] font-medium">
              {subtitle}
            </p>

            <p className="text-sm text-[#30373E] leading-relaxed font-light">
              {description}
            </p>

            <div className="grid grid-cols-2 gap-4 py-4 border-y border-[#E3DBD4] text-xs">
              <div>
                <span className="text-[10px] uppercase tracking-[0.2em] text-[#69727D] block mb-1">Precious Metal</span>
                <span className="font-medium text-[#051F34]">Solid 18K Gold</span>
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-[0.2em] text-[#69727D] block mb-1">Certification</span>
                <span className="font-medium text-[#051F34]">IGI / GIA Certified</span>
              </div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
              <Link
                href={href}
                onClick={() => trackEvent('collection_click', { title, href })}
                className="px-8 py-4 bg-[#051F34] text-white text-xs uppercase tracking-[0.2em] font-semibold hover:bg-[#CB9274] transition-all duration-300 flex items-center justify-center gap-2"
              >
                <span>Explore Suite</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Link
                href="/consultation"
                onClick={() => trackEvent('consultation_click', { source: 'collection_feature' })}
                className="px-8 py-4 border border-[#051F34] text-[#051F34] text-xs uppercase tracking-[0.2em] font-semibold hover:bg-[#051F34] hover:text-white transition-all duration-300 text-center"
              >
                Private Consultation
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
