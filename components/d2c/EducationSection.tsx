'use client'

import React from 'react'
import Link from 'next/link'
import { Ruler, Sparkles, Award, ShieldCheck, ArrowRight } from 'lucide-react'

const GUIDES = [
  {
    id: 'ring-sizer',
    icon: Ruler,
    tag: 'Fit & Sizing',
    title: 'Complimentary Ring Sizer',
    description:
      'Request our precision ring sizer delivered directly to your home, or explore our international sizing cross-reference chart.',
    link: '/ring-size-guide',
    linkText: 'Order Free Sizer',
  },
  {
    id: '4cs',
    icon: Sparkles,
    tag: 'Diamond Knowledge',
    title: 'The 4Cs Optical Standards',
    description:
      'Discover how Cut symmetry and light dispersion dictate diamond fire far beyond carat weight alone. Learn to read grading certificates.',
    link: '/diamonds',
    linkText: 'Explore 4Cs Guide',
  },
  {
    id: 'gold-assay',
    icon: Award,
    tag: 'Precious Metals',
    title: '18K Solid Gold & Hallmarks',
    description:
      'Why we exclusively craft in Solid 18K gold. Never vermeil, never brass. Every piece features verified precious metal fineness hallmarks.',
    link: '/craftsmanship',
    linkText: 'Learn About 18K Gold',
  },
  {
    id: 'care-guide',
    icon: ShieldCheck,
    tag: 'Atelier Care',
    title: 'Jewellery Care & Services',
    description:
      'Guidance on periodic prong inspection, ultrasonic cleansing, and proper storage to protect your fine jewellery for generations.',
    link: '/warranty',
    linkText: 'Care & Warranty Guide',
  },
]

export default function EducationSection() {
  return (
    <section className="py-20 lg:py-28 bg-white border-t border-[#E3DBD4]">
      <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
        <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
          <span className="text-[11px] uppercase tracking-[0.25em] text-[#CB9274] font-medium block">
            Collector&apos;s Knowledge
          </span>
          <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl text-[#051F34] font-normal tracking-tight">
            Demystifying Fine Jewellery
          </h2>
          <p className="text-[#69727D] text-sm sm:text-base font-light leading-relaxed">
            Essential guides crafted by our specialists and goldsmiths to empower every acquisition decision.
          </p>
        </div>

        {/* 4 Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
          {GUIDES.map((g) => {
            const Icon = g.icon
            return (
              <div
                key={g.id}
                className="group bg-[#F6F4F2] border border-[#E3DBD4] rounded-none p-6 sm:p-8 flex flex-col justify-between hover:border-[#051F34] transition-all duration-300"
              >
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <span className="text-[10px] uppercase tracking-[0.2em] font-semibold text-[#CB9274]">
                      {g.tag}
                    </span>
                    <div className="w-10 h-10 rounded-none bg-white border border-[#E3DBD4] flex items-center justify-center text-[#051F34] group-hover:bg-[#051F34] group-hover:text-white transition-colors">
                      <Icon className="w-4 h-4" />
                    </div>
                  </div>

                  <h3 className="font-serif text-xl text-[#051F34] font-normal mb-3 group-hover:text-[#CB9274] transition-colors">
                    {g.title}
                  </h3>

                  <p className="text-xs sm:text-sm text-[#69727D] font-light leading-relaxed mb-6">
                    {g.description}
                  </p>
                </div>

                <Link
                  href={g.link}
                  className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#051F34] group-hover:text-[#CB9274] transition-colors pt-4 border-t border-[#E3DBD4]"
                >
                  <span>{g.linkText}</span>
                  <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                </Link>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
