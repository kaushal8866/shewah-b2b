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
    location: 'London, United Kingdom',
    occasion: 'Bespoke Engagement & Wedding Band',
    piece: '3.10ct Oval Solitaire in 18K White Gold',
    quote:
      'We were initially hesitant to commission fine jewellery internationally, but SHEWAH’s private video consultation and 3D CAD renders gave us total clarity. Seeing the meticulous goldsmithing alongside certified diamond grading was extraordinary. Delivered in London with full IGI documentation.',
    rating: 5,
    date: 'February 2026',
    verifiedCommission: true,
  },
  {
    id: 't2',
    client: 'Priyanka & Devendra S.',
    location: 'Mumbai, India',
    occasion: 'Heirloom Bridal Suite',
    piece: 'The Royal Heritage Diamond Necklace & Earring Suite',
    quote:
      'The craftsmanship of the Royal Heritage Suite rivals heritage luxury houses. The solid 18K hallmarking and certified diamonds gave our family complete confidence. The weight of solid gold and the flexibility of the articulation on the collar are immaculate.',
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
      'The optical consistency across all 42 emerald cut stones is remarkable. Each diamond is perfectly colour-matched and set with precision prongs that feel smooth and secure. Arrived in Switzerland beautifully packaged with valuation appraisal.',
    rating: 5,
    date: 'December 2025',
    verifiedCommission: true,
  },
  {
    id: 't4',
    client: 'Claire D. & Julian R.',
    location: 'New York, United States',
    occasion: 'Custom Remounting Commission',
    piece: 'Architectural Heart-Cut Diamond Pendant',
    quote:
      'The bespoke team took our design ideas and translated them into a contemporary, sculptural masterpiece. Their transparency regarding gold weights, diamond clarity, and crafting stages is truly exceptional.',
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
    <section className="py-20 lg:py-28 bg-[#F6F4F2] border-t border-[#E3DBD4] relative overflow-hidden">
      <div className="max-w-[1440px] mx-auto px-6 lg:px-12 relative z-10">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
          <div className="flex items-center justify-center gap-2">
            <Quote className="w-4 h-4 text-[#CB9274]" />
            <span className="text-[11px] uppercase tracking-[0.25em] text-[#CB9274] font-medium">
              Private Client Stories
            </span>
          </div>
          <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl text-[#051F34] font-normal tracking-tight">
            Commissions Crafted For a Lifetime
          </h2>
          <p className="text-[#69727D] text-sm sm:text-base font-light leading-relaxed">
            From bespoke suites to milestone solitaires, discover how discerning collectors across the globe experience SHEWAH’s fine jewellery atelier.
          </p>
        </div>

        {/* Featured Testimonial Spotlight */}
        <div className="max-w-4xl mx-auto bg-white border border-[#E3DBD4] rounded-none p-8 sm:p-12 relative">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-8 pb-8 border-b border-[#E3DBD4]">
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                {[...Array(current.rating)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-[#CB9274] text-[#CB9274]" />
                ))}
              </div>
              <h3 className="font-serif text-xl sm:text-2xl text-[#051F34] font-normal">
                {current.occasion}
              </h3>
              <p className="text-xs font-mono text-[#69727D] mt-1">
                {current.piece}
              </p>
            </div>

            <div className="md:text-right">
              <div className="font-medium text-[#051F34] text-sm sm:text-base">
                {current.client}
              </div>
              <div className="text-xs text-[#69727D]">{current.location}</div>
              {current.verifiedCommission && (
                <div className="inline-flex items-center gap-1 text-[11px] font-medium text-[#051F34] mt-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#CB9274]" />
                  <span>Verified Commission</span>
                </div>
              )}
            </div>
          </div>

          {/* Quote Body */}
          <blockquote className="text-base sm:text-lg lg:text-xl font-serif text-[#051F34] italic leading-relaxed mb-8 font-normal">
            &ldquo;{current.quote}&rdquo;
          </blockquote>

          {/* Footer Controls & Navigation */}
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2">
              {TESTIMONIALS.map((t, idx) => (
                <button
                  key={t.id}
                  onClick={() => setActiveIndex(idx)}
                  className={`h-1 transition-all duration-300 rounded-none ${
                    idx === activeIndex
                      ? 'w-8 bg-[#051F34]'
                      : 'w-3 bg-[#E3DBD4] hover:bg-[#69727D]'
                  }`}
                  aria-label={`Go to review ${idx + 1}`}
                />
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={prev}
                className="w-10 h-10 border border-[#E3DBD4] hover:border-[#051F34] hover:bg-[#051F34] hover:text-white flex items-center justify-center text-[#051F34] transition-colors rounded-none"
                aria-label="Previous testimonial"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={next}
                className="w-10 h-10 border border-[#E3DBD4] hover:border-[#051F34] hover:bg-[#051F34] hover:text-white flex items-center justify-center text-[#051F34] transition-colors rounded-none"
                aria-label="Next testimonial"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Verification Strip */}
        <div className="mt-14 max-w-3xl mx-auto flex flex-wrap items-center justify-center gap-6 sm:gap-12 text-center text-xs text-[#69727D]">
          <div className="flex items-center gap-2">
            <span className="font-serif text-lg text-[#051F34] font-medium">100%</span>
            <span>Hallmarked Solid 18K Gold</span>
          </div>
          <span className="hidden sm:inline text-[#E3DBD4]">•</span>
          <div className="flex items-center gap-2">
            <span className="font-serif text-lg text-[#051F34] font-medium">IGI & GIA</span>
            <span>Certified Diamond Grading</span>
          </div>
          <span className="hidden sm:inline text-[#E3DBD4]">•</span>
          <div className="flex items-center gap-2">
            <span className="font-serif text-lg text-[#051F34] font-medium">100%</span>
            <span>Insured Delivery Worldwide</span>
          </div>
        </div>
      </div>
    </section>
  )
}
