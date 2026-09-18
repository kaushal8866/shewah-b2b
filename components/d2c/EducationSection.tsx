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
      'Request our precision physical ring sizer delivered directly to your home, or explore our international sizing cross-reference chart.',
    link: '/ring-size-guide',
    linkText: 'Order Free Sizer',
  },
  {
    id: '4cs',
    icon: Sparkles,
    tag: 'Diamond Knowledge',
    title: 'The 4Cs Optical Standards',
    description:
      'Discover how Cut symmetry and light dispersion dictate diamond fire far beyond carat weight alone. Learn to read IGI and GIA dossiers.',
    link: '/diamonds',
    linkText: 'Explore 4Cs Guide',
  },
  {
    id: 'gold-assay',
    icon: Award,
    tag: 'Noble Metals',
    title: '18K Solid Gold & Hallmarks',
    description:
      'Why we exclusively craft in Solid 18K (750) gold. Never vermeil, never brass. Every creation features laser-etched BIS or international assay hallmarks.',
    link: '/craftsmanship',
    linkText: 'Learn About 18K Gold',
  },
  {
    id: 'lifetime-care',
    icon: ShieldCheck,
    tag: 'Atelier Commitment',
    title: 'Lifetime Care & Warranty',
    description:
      'Every creation includes complimentary annual prong inspection, ultrasonic cleansing, and rhodium polish to protect your heirloom.',
    link: '/warranty',
    linkText: 'View Lifetime Warranty',
  },
]

export default function EducationSection() {
  return (
    <section className="py-20 lg:py-28 bg-[#FBF7F0] border-t border-[#E8DFC9]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="text-[11px] uppercase tracking-[0.3em] text-[#A88A4F] font-semibold block mb-3">
            Collector&apos;s Knowledge
          </span>
          <h2 className="font-serif text-3xl sm:text-4xl text-[#2A241B] tracking-tight mb-4">
            Demystifying Fine Jewellery
          </h2>
          <p className="text-[#5C5347] text-sm sm:text-base font-light leading-relaxed">
            Essential guides crafted by our gemologists and master karigars to empower every acquisition decision.
          </p>
        </div>

        {/* 4 Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {GUIDES.map((g) => {
            const Icon = g.icon
            return (
              <div
                key={g.id}
                className="group bg-white border border-[#E8DFC9] rounded-2xl p-6 sm:p-8 flex flex-col justify-between hover:border-[#A88A4F] hover:shadow-lg transition-all duration-300"
              >
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <span className="text-[10px] uppercase tracking-[0.2em] font-semibold text-[#A88A4F]">
                      {g.tag}
                    </span>
                    <div className="w-10 h-10 rounded-full bg-[#FBF7F0] border border-[#E8DFC9] flex items-center justify-center text-[#2A241B] group-hover:bg-[#2A241B] group-hover:text-white transition-colors">
                      <Icon className="w-4 h-4" />
                    </div>
                  </div>

                  <h3 className="font-serif text-xl text-[#2A241B] font-medium mb-3 group-hover:text-[#A88A4F] transition-colors">
                    {g.title}
                  </h3>

                  <p className="text-xs sm:text-sm text-[#5C5347] font-light leading-relaxed mb-6">
                    {g.description}
                  </p>
                </div>

                <Link
                  href={g.link}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-[#2A241B] group-hover:text-[#A88A4F] transition-colors pt-4 border-t border-[#E8DFC9]/60"
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
