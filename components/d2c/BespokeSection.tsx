'use client'

import React from 'react'
import Link from 'next/link'
import { Sparkles, ArrowRight, ShieldCheck, CheckCircle2 } from 'lucide-react'
import { trackEvent } from '@/lib/analytics'

export default function BespokeSection() {
  const steps = [
    {
      num: '01',
      title: 'Submit Your Vision',
      desc: 'Share a sketch, an heirloom inspiration, or simply a desired carat size and metal alloy.',
    },
    {
      num: '02',
      title: '3D CAD Rendering',
      desc: 'Review custom photorealistic CAD renders from multiple camera perspectives with unlimited refinements.',
    },
    {
      num: '03',
      title: 'Atelier Goldsmithing',
      desc: 'Individually cast in solid 18K gold and set under microscope magnification by master artisans.',
    },
    {
      num: '04',
      title: 'Armored Delivery',
      desc: 'Independently assay-hallmarked, certified by IGI or GIA, and delivered insured to your door.',
    },
  ]

  return (
    <section className="py-20 sm:py-24 bg-[#2A241B] text-[#FBF7F0] relative overflow-hidden">
      {/* Subtle ambient luxury backdrop */}
      <div
        className="absolute inset-0 bg-cover bg-center opacity-10"
        style={{
          backgroundImage: `url('https://images.unsplash.com/photo-1573408301185-9146fe634ad0?auto=format&fit=crop&w=1920&q=80')`,
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-[#2A241B] via-transparent to-[#2A241B]" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          {/* Left: Headline & Consultation Pitch (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            <span className="text-[10px] uppercase tracking-[0.35em] text-[#C9A86A] font-semibold block">
              Private Commission
            </span>

            <h2 className="font-serif text-3xl sm:text-5xl font-light text-white leading-tight">
              Bespoke Jewellery, <br />
              Sculpted Around You.
            </h2>

            <p className="text-xs sm:text-sm text-stone-300 font-light leading-relaxed">
              Your jewellery can begin with an heirloom stone, an architectural sketch, or simply a cherished memory. Collaborate 1-on-1 with our master CAD sculptors and gemologists to create a one-of-a-kind treasure.
            </p>

            <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
              <Link
                href="/consultation"
                onClick={() => trackEvent('consultation_click', { source: 'bespoke_section' })}
                className="px-8 py-3.5 bg-[#C9A86A] text-[#2A241B] text-xs uppercase tracking-widest font-semibold rounded-full hover:bg-[#E8D6AC] transition-all shadow-xl text-center flex items-center justify-center gap-2"
              >
                <span>Book a Consultation</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Link
                href="/bespoke"
                className="px-8 py-3.5 border border-[#E8DFC9]/40 text-white text-xs uppercase tracking-widest font-medium rounded-full hover:bg-white/10 transition-colors text-center"
              >
                Explore Bespoke Process
              </Link>
            </div>
          </div>

          {/* Right: 4-Step Made-to-Order Process (7 cols) */}
          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            {steps.map((s) => (
              <div
                key={s.num}
                className="p-6 rounded-2xl bg-stone-900/80 border border-[#E8DFC9]/20 space-y-2.5 backdrop-blur-sm hover:border-[#C9A86A]/50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-[#C9A86A]">{s.num}</span>
                  <Sparkles className="w-3.5 h-3.5 text-[#C9A86A]/60" />
                </div>
                <h4 className="font-serif text-lg text-white font-medium">{s.title}</h4>
                <p className="text-[11px] text-stone-400 font-light leading-relaxed">
                  {s.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
