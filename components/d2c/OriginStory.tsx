'use client'

import React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, Globe, Compass, Gem } from 'lucide-react'

export default function OriginStory() {
  return (
    <section className="py-20 lg:py-28 bg-[#FBF7F0] border-t border-[#E8DFC9] overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          {/* Left Column: Editorial Imagery & Heritage Grid */}
          <div className="lg:col-span-6 relative">
            <div className="relative mx-auto max-w-md lg:max-w-none">
              {/* Main Image */}
              <div className="relative aspect-[4/5] rounded-2xl overflow-hidden shadow-2xl border border-[#E8DFC9]">
                <Image
                  src="https://images.unsplash.com/photo-1573408301185-9146fe634ad0?q=80&w=1200&auto=format&fit=crop"
                  alt="SHEWAH Master Karigar diamond setting in atelier"
                  fill
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#2A241B]/80 via-transparent to-transparent" />
                
                <div className="absolute bottom-6 left-6 right-6 text-white">
                  <div className="text-[10px] uppercase tracking-[0.25em] text-[#C9A86A] mb-1">
                    The Surat Atelier
                  </div>
                  <div className="font-serif text-lg sm:text-xl font-light">
                    Where hereditary artisanship meets precision stereomicroscopy.
                  </div>
                </div>
              </div>

              {/* Floating Antwerp Accent Card */}
              <div className="absolute -bottom-6 -right-4 sm:-right-8 bg-white border border-[#E8DFC9] p-5 rounded-xl shadow-xl max-w-[240px] sm:max-w-[270px]">
                <div className="flex items-center gap-2 mb-2 text-[#A88A4F]">
                  <Compass className="w-4 h-4 shrink-0" />
                  <span className="text-[10px] uppercase tracking-[0.2em] font-semibold">
                    Dual Heritage
                  </span>
                </div>
                <p className="text-xs text-[#5C5347] font-light leading-snug">
                  Antwerp gemological optical standards united with Surat lost-wax gold casting.
                </p>
              </div>
            </div>
          </div>

          {/* Right Column: Narrative Copy */}
          <div className="lg:col-span-6 space-y-6">
            <div className="flex items-center gap-2">
              <Gem className="w-4 h-4 text-[#A88A4F]" />
              <span className="text-[11px] uppercase tracking-[0.3em] text-[#A88A4F] font-medium">
                Our Provenance
              </span>
            </div>

            <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl text-[#2A241B] tracking-tight leading-[1.15]">
              From Antwerp & Surat to Discerning Collectors Worldwide
            </h2>

            <div className="space-y-4 text-sm sm:text-base text-[#5C5347] font-light leading-relaxed">
              <p>
                SHEWAH was founded to challenge the traditional luxury diamond paradigm. For generations, exquisite high jewellery passed through a labyrinth of brokers, wholesale syndicates, and opulent storefronts—multiplying the price tag at every tier while diluting connection to the artisans.
              </p>
              <p>
                By anchoring our diamond grading rigor in the historic diamond capital of Antwerp and our manufacturing atelier in the heart of Surat’s master karigar district, we eliminate intermediate markups entirely.
              </p>
              <p>
                Every piece is cast individually in solid 18K gold only when requested, hand-set under stereomicroscopes, independently hallmarked with government assay certificates, and delivered directly to your doorstep in armored transit.
              </p>
            </div>

            {/* Credential Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 pt-4 border-t border-[#E8DFC9]">
              <div>
                <div className="font-serif text-2xl sm:text-3xl text-[#2A241B] font-medium">
                  18K
                </div>
                <div className="text-[11px] uppercase tracking-wider text-[#8C8275] mt-1">
                  Solid 750 Gold Only
                </div>
              </div>
              <div>
                <div className="font-serif text-2xl sm:text-3xl text-[#2A241B] font-medium">
                  0%
                </div>
                <div className="text-[11px] uppercase tracking-wider text-[#8C8275] mt-1">
                  Dead Stock Markups
                </div>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <div className="font-serif text-2xl sm:text-3xl text-[#2A241B] font-medium">
                  IGI & GIA
                </div>
                <div className="text-[11px] uppercase tracking-wider text-[#8C8275] mt-1">
                  Dual Certification
                </div>
              </div>
            </div>

            {/* Action Links */}
            <div className="flex flex-wrap items-center gap-4 pt-4">
              <Link
                href="/about"
                className="inline-flex items-center gap-2 bg-[#2A241B] text-[#FBF7F0] px-6 py-3.5 rounded-full text-xs uppercase tracking-widest font-medium hover:bg-[#3D3528] transition-colors"
              >
                <span>Read The Full Story</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Link
                href="/craftsmanship"
                className="inline-flex items-center gap-2 border border-[#E8DFC9] text-[#2A241B] px-6 py-3.5 rounded-full text-xs uppercase tracking-widest font-medium hover:border-[#2A241B] hover:bg-white transition-colors"
              >
                <span>Explore The Atelier</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
