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
  subtitle = 'Centuries of goldsmithing mastery reborn in Surat',
  description = 'An homage to traditional diamond cascading suites, modernised with architectural fluidity and handset with optical-precision Antwerp diamonds. Available as a unified heirloom parure or commissioned individually.',
  image = 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=1600&q=85',
  href = '/jewellery',
  badge = 'Featured Atelier Collection',
}: CollectionFeatureProps) {
  return (
    <section className="py-20 sm:py-24 bg-white border-b border-[#E8DFC9] overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          {/* Editorial Visual (7 cols) */}
          <div className="lg:col-span-7 relative">
            <div className="relative aspect-[4/3] rounded-2xl overflow-hidden shadow-2xl border border-[#E8DFC9]">
              <img
                src={image}
                alt={title}
                className="w-full h-full object-cover"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-stone-950/40 via-transparent to-transparent" />
            </div>

            {/* Float Highlight Badge */}
            <div className="absolute -bottom-5 -right-2 sm:bottom-6 sm:-right-6 bg-white/95 backdrop-blur-md p-4 sm:p-5 rounded-2xl border border-[#E8DFC9] shadow-xl max-w-xs space-y-1">
              <div className="flex items-center gap-2 text-[#A88A4F]">
                <Sparkles className="w-4 h-4" />
                <span className="text-[10px] uppercase tracking-widest font-semibold">
                  Suite Privilege
                </span>
              </div>
              <p className="text-[11px] text-[#5C5347] font-light leading-relaxed">
                Available together as a harmonious set or acquired individually.
              </p>
            </div>
          </div>

          {/* Copy & CTAs (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            <span className="text-[10px] uppercase tracking-[0.35em] text-[#A88A4F] font-semibold block">
              {badge}
            </span>

            <h2 className="font-serif text-3xl sm:text-5xl text-[#2A241B] font-light leading-tight">
              {title}
            </h2>

            <p className="text-xs uppercase tracking-wider text-[#8C8275] font-medium">
              {subtitle}
            </p>

            <p className="text-sm text-[#5C5347] leading-relaxed font-light">
              {description}
            </p>

            <div className="grid grid-cols-2 gap-4 py-3 border-y border-[#E8DFC9] text-xs">
              <div>
                <span className="text-[10px] uppercase tracking-widest text-[#8C8275] block">Precious Metal</span>
                <span className="font-medium text-[#2A241B]">Solid 18K Gold & Platinum</span>
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-widest text-[#8C8275] block">Certification</span>
                <span className="font-medium text-[#2A241B]">IGI / GIA Certified</span>
              </div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <Link
                href={href}
                onClick={() => trackEvent('collection_click', { title, href })}
                className="px-7 py-3 bg-[#2A241B] text-white text-xs uppercase tracking-widest font-semibold rounded-full hover:bg-[#A88A4F] transition-colors flex items-center justify-center gap-2"
              >
                <span>Explore Suite</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Link
                href="/consultation"
                onClick={() => trackEvent('consultation_click', { source: 'collection_feature' })}
                className="px-7 py-3 border border-[#E8DFC9] text-[#2A241B] text-xs uppercase tracking-widest font-medium rounded-full hover:bg-[#FBF7F0] transition-colors text-center"
              >
                Bespoke Inquiries
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
