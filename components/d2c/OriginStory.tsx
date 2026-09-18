'use client'

import React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, Globe, Compass, Gem } from 'lucide-react'

export default function OriginStory() {
  return (
    <section className="py-20 lg:py-28 bg-[#F6F4F2] border-t border-[#E3DBD4] overflow-hidden">
      <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          {/* Left Column: Editorial Imagery & Heritage Grid */}
          <div className="lg:col-span-6 relative">
            <div className="relative mx-auto max-w-md lg:max-w-none">
              {/* Main Image */}
              <div className="relative aspect-[4/5] rounded-none overflow-hidden border border-[#E3DBD4]">
                <Image
                  src="https://images.unsplash.com/photo-1573408301185-9146fe634ad0?q=80&w=1200&auto=format&fit=crop"
                  alt="Jeweler setting diamonds in atelier"
                  fill
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-cover transition-transform duration-700 ease-out hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#051F34]/80 via-transparent to-transparent" />
                
                <div className="absolute bottom-6 left-6 right-6 text-white">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-[#CB9274] mb-1 font-semibold">
                    The Atelier
                  </div>
                  <div className="font-serif text-lg sm:text-xl font-normal">
                    Where fine jewellery artisanship meets contemporary design precision.
                  </div>
                </div>
              </div>

              {/* Floating Accent Card */}
              <div className="absolute -bottom-6 -right-4 sm:-right-8 bg-white border border-[#E3DBD4] p-5 rounded-none shadow-lg max-w-[240px] sm:max-w-[270px]">
                <div className="flex items-center gap-2 mb-2 text-[#CB9274]">
                  <Compass className="w-4 h-4 shrink-0" />
                  <span className="text-[10px] uppercase tracking-[0.2em] font-semibold">
                    Conscious Luxury
                  </span>
                </div>
                <p className="text-xs text-[#69727D] font-light leading-snug">
                  Independent gemological standards united with solid 18K gold crafting.
                </p>
              </div>
            </div>
          </div>

          {/* Right Column: Narrative Copy */}
          <div className="lg:col-span-6 space-y-6">
            <div className="flex items-center gap-2">
              <Gem className="w-4 h-4 text-[#CB9274]" />
              <span className="text-[11px] uppercase tracking-[0.25em] text-[#CB9274] font-medium">
                Our Philosophy
              </span>
            </div>

            <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl text-[#051F34] font-normal tracking-tight leading-[1.15]">
              Fine Jewellery Crafted for Discerning Collectors Worldwide
            </h2>

            <div className="space-y-4 text-sm sm:text-base text-[#69727D] font-light leading-relaxed">
              <p>
                SHEWAH was founded to provide transparent, world-class fine jewellery. Traditionally, exquisite jewellery passed through a succession of brokers and distributors—multiplying prices at every level while obscuring provenance.
              </p>
              <p>
                By working directly with certified diamond sources and skilled goldsmiths, we eliminate traditional multi-tier retail markups and channel every resource into higher metal purity and superior optical cuts.
              </p>
              <p>
                Every piece is crafted individually in solid 18K gold to order, hand-finished by skilled jewelers, verified for precious metal fineness, and delivered directly to your door with full insurance.
              </p>
            </div>

            {/* Credential Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 pt-4 border-t border-[#E3DBD4]">
              <div>
                <div className="font-serif text-2xl sm:text-3xl text-[#051F34] font-medium">
                  18K
                </div>
                <div className="text-[11px] uppercase tracking-[0.15em] text-[#69727D] mt-1">
                  Solid Gold Standard
                </div>
              </div>
              <div>
                <div className="font-serif text-2xl sm:text-3xl text-[#051F34] font-medium">
                  0%
                </div>
                <div className="text-[11px] uppercase tracking-[0.15em] text-[#69727D] mt-1">
                  Middleman Markup
                </div>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <div className="font-serif text-2xl sm:text-3xl text-[#051F34] font-medium">
                  IGI / GIA
                </div>
                <div className="text-[11px] uppercase tracking-[0.15em] text-[#69727D] mt-1">
                  Certified Diamonds
                </div>
              </div>
            </div>

            {/* Action Links */}
            <div className="flex flex-wrap items-center gap-4 pt-4">
              <Link
                href="/about"
                className="inline-flex items-center gap-2 bg-[#051F34] text-white px-8 py-4 rounded-none text-xs uppercase tracking-[0.2em] font-semibold hover:bg-[#CB9274] transition-all duration-300"
              >
                <span>Read The Full Story</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Link
                href="/craftsmanship"
                className="inline-flex items-center gap-2 border border-[#051F34] text-[#051F34] px-8 py-4 rounded-none text-xs uppercase tracking-[0.2em] font-semibold hover:bg-[#051F34] hover:text-white transition-all duration-300"
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
