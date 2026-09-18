'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { Star, ShieldCheck, ChevronLeft, ChevronRight, Quote, ArrowRight } from 'lucide-react'

interface Testimonial {
  id: string
  client: string
  location: string
  occasion: string
  piece: string
  quote: string
  rating: number
  date: string
  verifiedCommission: boolean
}

const TESTIMONIALS: Testimonial[] = [
  {
    id: 't1',
    client: 'Alistair & Elena M.',
    location: 'Mayfair, London',
    occasion: 'Bespoke Engagement & Wedding Band',
    piece: '3.10ct Oval Solitaire in 18K White Gold',
    quote:
      'We were initially hesitant to commission an engagement ring internationally, but SHEWAH’s private video consultation and 3D CAD renders gave us total clarity. Seeing the master goldsmith’s hand-finishing in Surat alongside Antwerp-standard diamond grading was extraordinary. Delivered in London via armored courier with full IGI documentation.',
    rating: 5,
    date: 'February 2026',
    verifiedCommission: true,
  },
  {
    id: 't2',
    client: 'Priyanka & Devendra S.',
    location: 'South Mumbai, India',
    occasion: 'Heirloom Bridal Suite',
    piece: 'The Royal Heritage Diamond Necklace & Earring Suite',
    quote:
      'The craftsmanship of the Royal Heritage Suite rivals heritage European maisons at a fraction of the traditional retail markup. The BIS hallmarking and laser-inscribed diamonds gave our family complete confidence. The weight of 18K solid gold and the flexibility of the articulation on the collar are immaculate.',
    rating: 5,
    date: 'January 2026',
    verifiedCommission: true,
  },
  {
    id: 't3',
    client: 'Marcus V. H.',
    location: 'Zurich, Switzerland',
    occasion: 'Anniversary Gift',
    piece: 'Emerald Cut Tennis Bracelet (12.4ct TW)',
    quote:
      'The optical consistency across all 42 emerald cut stones is remarkable. Each diamond is perfectly colour-matched and set with micro-precision prongs that never catch on silk cuffs. Arrived in Switzerland within 12 days of casting, beautifully boxed with valuation appraisal.',
    rating: 5,
    date: 'December 2025',
    verifiedCommission: true,
  },
  {
    id: 't4',
    client: 'Claire D. & Julian R.',
    location: 'Manhattan, New York',
    occasion: 'Custom Remounting Commission',
    piece: 'Architectural Heart-Cut Diamond Pendant',
    quote:
      'The bespoke team took my grandmother’s inspiration and translated it into a contemporary, sculptural masterpiece. Their transparency regarding gold weights, diamond clarity, and casting stages is something standard Fifth Avenue retailers simply do not offer.',
    rating: 5,
    date: 'November 2025',
    verifiedCommission: true,
  },
]

export default function Testimonials() {
  const [activeIndex, setActiveIndex] = useState(0)

  const next = () => {
    setActiveIndex((prev) => (prev + 1) % TESTIMONIALS.length)
  }

  const prev = () => {
    setActiveIndex((prev) => (prev - 1 + TESTIMONIALS.length) % TESTIMONIALS.length)
  }

  const current = TESTIMONIALS[activeIndex]

  return (
    <section className="py-20 lg:py-28 bg-[#F5EFEB] border-t border-[#E8DFC9] relative overflow-hidden">
      {/* Subtle Background Ornament */}
      <div className="absolute -right-24 -top-24 w-96 h-96 rounded-full bg-[#E8DFC9]/30 blur-3xl pointer-events-none" />
      <div className="absolute -left-24 -bottom-24 w-96 h-96 rounded-full bg-[#C9A86A]/10 blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Quote className="w-4 h-4 text-[#A88A4F]" />
            <span className="text-[11px] uppercase tracking-[0.3em] text-[#A88A4F] font-medium">
              Private Client Stories
            </span>
          </div>
          <h2 className="font-serif text-3xl sm:text-4xl text-[#2A241B] tracking-tight mb-4">
            Commissions Crafted For a Lifetime
          </h2>
          <p className="text-[#5C5347] text-sm sm:text-base font-light leading-relaxed">
            From bespoke bridal suites to milestone solitaires, discover how discerning collectors across the globe experience SHEWAH’s private atelier.
          </p>
        </div>

        {/* Featured Testimonial Spotlight */}
        <div className="max-w-4xl mx-auto bg-white/90 backdrop-blur-sm border border-[#E8DFC9] rounded-2xl p-8 sm:p-12 shadow-sm relative">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-8 pb-8 border-b border-[#E8DFC9]/70">
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                {[...Array(current.rating)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-[#A88A4F] text-[#A88A4F]" />
                ))}
              </div>
              <h3 className="font-serif text-xl sm:text-2xl text-[#2A241B] font-medium">
                {current.occasion}
              </h3>
              <p className="text-xs font-mono text-[#8C8275] mt-1">
                {current.piece}
              </p>
            </div>

            <div className="md:text-right">
              <div className="font-medium text-[#2A241B] text-sm sm:text-base">
                {current.client}
              </div>
              <div className="text-xs text-[#8C8275]">{current.location}</div>
              {current.verifiedCommission && (
                <div className="inline-flex items-center gap-1 text-[11px] font-medium text-[#4A6741] mt-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Verified Bespoke Commission</span>
                </div>
              )}
            </div>
          </div>

          {/* Quote Body */}
          <blockquote className="text-base sm:text-lg lg:text-xl font-serif text-[#2A241B] italic leading-relaxed mb-8">
            &ldquo;{current.quote}&rdquo;
          </blockquote>

          {/* Footer Controls & Navigation */}
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2">
              {TESTIMONIALS.map((t, idx) => (
                <button
                  key={t.id}
                  onClick={() => setActiveIndex(idx)}
                  className={`h-1.5 transition-all duration-300 rounded-full ${
                    idx === activeIndex
                      ? 'w-8 bg-[#A88A4F]'
                      : 'w-2 bg-[#E8DFC9] hover:bg-[#8C8275]'
                  }`}
                  aria-label={`Go to review ${idx + 1}`}
                />
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={prev}
                className="w-10 h-10 rounded-full border border-[#E8DFC9] hover:border-[#2A241B] flex items-center justify-center text-[#2A241B] transition-colors"
                aria-label="Previous testimonial"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={next}
                className="w-10 h-10 rounded-full border border-[#E8DFC9] hover:border-[#2A241B] flex items-center justify-center text-[#2A241B] transition-colors"
                aria-label="Next testimonial"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Verification Strip */}
        <div className="mt-14 max-w-3xl mx-auto flex flex-wrap items-center justify-center gap-6 sm:gap-12 text-center text-xs text-[#5C5347]">
          <div className="flex items-center gap-2">
            <span className="font-serif text-lg text-[#2A241B] font-semibold">100%</span>
            <span>Individually Hallmarked Solid Gold</span>
          </div>
          <span className="hidden sm:inline text-stone-300">•</span>
          <div className="flex items-center gap-2">
            <span className="font-serif text-lg text-[#2A241B] font-semibold">IGI & GIA</span>
            <span>Dual Gemological Verification</span>
          </div>
          <span className="hidden sm:inline text-stone-300">•</span>
          <div className="flex items-center gap-2">
            <span className="font-serif text-lg text-[#2A241B] font-semibold">100%</span>
            <span>Insured Armored Transit Worldwide</span>
          </div>
        </div>
      </div>
    </section>
  )
}
