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
      desc: 'Share a sketch, an heirloom inspiration, or desired diamond shape and precious metal alloy.',
    },
    {
      num: '02',
      title: '3D CAD Rendering',
      desc: 'Review custom photorealistic CAD renders from multiple camera perspectives with refined adjustments.',
    },
    {
      num: '03',
      title: 'Atelier Goldsmithing',
      desc: 'Individually crafted in solid 18K gold and handset by meticulous jewelers.',
    },
    {
      num: '04',
      title: 'Insured Delivery',
      desc: 'Certified by IGI or GIA where applicable, and delivered with full door-to-door insurance.',
    },
  ]

  return (
    <section className="py-20 sm:py-28 bg-[#051F34] text-white relative overflow-hidden">
      {/* Subtle ambient luxury backdrop */}
      <div
        className="absolute inset-0 bg-cover bg-center opacity-10"
        style={{
          backgroundImage: `url('https://images.unsplash.com/photo-1573408301185-9146fe634ad0?auto=format&fit=crop&w=1920&q=80')`,
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-[#051F34] via-transparent to-[#051F34]" />

      <div className="relative z-10 max-w-[1440px] mx-auto px-6 lg:px-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          {/* Left: Headline & Consultation Pitch (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            <span className="text-[11px] uppercase tracking-[0.25em] text-[#CB9274] font-medium block">
              Private Commission
            </span>

            <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-normal text-white leading-tight">
              Bespoke Jewellery, <br />
              Sculpted Around You.
            </h2>

            <p className="text-sm text-stone-300 font-light leading-relaxed">
              Your jewellery can begin with an heirloom stone, an architectural sketch, or simply a cherished memory. Collaborate 1-on-1 with our design team to create a one-of-a-kind treasure.
            </p>

            <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
              <Link
                href="/consultation"
                onClick={() => trackEvent('consultation_click', { source: 'bespoke_section' })}
                className="px-8 py-4 bg-[#CB9274] text-white text-xs uppercase tracking-[0.2em] font-semibold hover:bg-white hover:text-[#051F34] transition-all duration-300 text-center flex items-center justify-center gap-2"
              >
                <span>Book a Consultation</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Link
                href="/bespoke"
                className="px-8 py-4 border border-white/40 text-white text-xs uppercase tracking-[0.2em] font-semibold hover:bg-white hover:text-[#051F34] transition-all duration-300 text-center"
              >
                Explore Bespoke
              </Link>
            </div>
          </div>

          {/* Right: 4-Step Made-to-Order Process (7 cols) */}
          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            {steps.map((s) => (
              <div
                key={s.num}
                className="p-6 sm:p-8 bg-white/5 border border-white/10 space-y-3 backdrop-blur-sm hover:border-[#CB9274] transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-semibold text-[#CB9274]">{s.num}</span>
                  <Sparkles className="w-4 h-4 text-[#CB9274]" />
                </div>
                <h4 className="font-serif text-xl text-white font-normal">{s.title}</h4>
                <p className="text-xs text-stone-300 font-light leading-relaxed">
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
