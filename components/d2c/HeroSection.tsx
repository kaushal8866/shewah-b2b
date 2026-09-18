'use client'

import React from 'react'
import Link from 'next/link'
import { Diamond, Hammer, ShieldCheck, Award, ArrowRight } from 'lucide-react'
import { trackEvent } from '@/lib/analytics'

export interface HeroSectionProps {
  eyebrow?: string
  title?: string
  subtitle?: string
  imageDesktop?: string
  primaryCtaText?: string
  primaryCtaHref?: string
  secondaryCtaText?: string
  secondaryCtaHref?: string
}

export default function HeroSection({
  eyebrow = 'Atelier Shewah • Est. Antwerp & Surat',
  title = 'Modern Heirlooms,\nConsciously Crafted.',
  subtitle = 'Every piece is individually handcrafted in solid 18K gold and set with certified diamonds. Crafted especially for you with transparent provenance.',
  imageDesktop = 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=1920&q=85',
  primaryCtaText = 'Explore The Collection',
  primaryCtaHref = '/jewellery',
  secondaryCtaText = 'Book Private Consultation',
  secondaryCtaHref = '/consultation',
}: HeroSectionProps) {
  const pillars = [
    { icon: Diamond, title: 'Antwerp Certified', desc: 'IGI & GIA graded diamonds' },
    { icon: Hammer, title: 'Cast to Order', desc: 'Solid 18K gold & platinum' },
    { icon: ShieldCheck, title: 'Insured Courier', desc: 'Discreet armored delivery' },
    { icon: Award, title: 'Lifetime Care', desc: 'Complimentary inspection' },
  ]

  return (
    <div className="relative overflow-hidden bg-stone-950 text-white">
      {/* 1. Cinematic Hero Viewport */}
      <section className="relative min-h-[80vh] sm:min-h-[85vh] flex items-center justify-center overflow-hidden">
        {/* Ambient atmospheric backdrop */}
        <div
          className="absolute inset-0 bg-cover bg-center opacity-45 scale-105 transition-transform duration-1000"
          style={{ backgroundImage: `url('${imageDesktop}')` }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-stone-950 via-stone-950/40 to-transparent" />

        <div className="relative z-10 max-w-4xl mx-auto px-6 text-center space-y-6 pt-16 pb-12">
          <span className="text-[10px] sm:text-xs uppercase tracking-[0.4em] text-[#C9A86A] font-medium block">
            {eyebrow}
          </span>

          <h1 className="font-serif text-4xl sm:text-6xl md:text-7xl font-light tracking-tight leading-[1.1] text-[#FBF7F0] whitespace-pre-line">
            {title}
          </h1>

          <p className="text-xs sm:text-base text-stone-300 max-w-xl mx-auto font-light leading-relaxed">
            {subtitle}
          </p>

          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href={primaryCtaHref}
              onClick={() => trackEvent('hero_cta_click', { cta: 'primary', target: primaryCtaHref })}
              className="w-full sm:w-auto px-8 py-3.5 bg-[#C9A86A] text-[#2A241B] text-xs uppercase tracking-widest font-semibold rounded-full hover:bg-[#E8D6AC] transition-all shadow-lg hover:shadow-[#C9A86A]/20 flex items-center justify-center gap-2"
            >
              <span>{primaryCtaText}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <Link
              href={secondaryCtaHref}
              onClick={() => trackEvent('hero_cta_click', { cta: 'secondary', target: secondaryCtaHref })}
              className="w-full sm:w-auto px-8 py-3.5 border border-[#E8DFC9]/40 text-white text-xs uppercase tracking-widest font-medium rounded-full hover:bg-white/10 transition-colors"
            >
              {secondaryCtaText}
            </Link>
          </div>
        </div>
      </section>

      {/* 2. Value Proposition Ribbon */}
      <section className="bg-[#F4ECDD] text-[#2A241B] border-y border-[#E8DFC9] py-8">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {pillars.map((p) => {
            const Icon = p.icon
            return (
              <div key={p.title} className="space-y-1.5">
                <div className="w-8 h-8 rounded-full bg-[#E8DFC9] text-[#A88A4F] flex items-center justify-center mx-auto mb-2">
                  <Icon className="w-4 h-4" />
                </div>
                <h4 className="font-serif text-sm font-medium text-[#2A241B]">{p.title}</h4>
                <p className="text-[11px] text-[#5C5347]">{p.desc}</p>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
