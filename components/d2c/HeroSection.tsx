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
  eyebrow = 'Maison Shewah • Fine Jewellery',
  title = 'Modern Heirlooms,\nConsciously Crafted.',
  subtitle = 'Every piece is individually handcrafted in solid 18K gold and set with certified diamonds. Crafted to order with uncompromising attention to detail.',
  imageDesktop = 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=1920&q=85',
  primaryCtaText = 'Explore The Collection',
  primaryCtaHref = '/jewellery',
  secondaryCtaText = 'Private Consultation',
  secondaryCtaHref = '/consultation',
}: HeroSectionProps) {
  const pillars = [
    { icon: Diamond, title: 'Certified Diamonds', desc: 'IGI & GIA certified stones' },
    { icon: Hammer, title: 'Solid 18K Gold', desc: 'Hallmarked precious metals' },
    { icon: ShieldCheck, title: 'Insured Delivery', desc: 'Complimentary insured shipping' },
    { icon: Award, title: 'Made To Order', desc: 'Individually crafted for you' },
  ]

  return (
    <div className="relative overflow-hidden bg-[#F6F4F2] text-[#051F34]">
      {/* 1. Cinematic Hero Viewport */}
      <section className="relative min-h-[75vh] sm:min-h-[82vh] flex items-center justify-center overflow-hidden">
        {/* Ambient atmospheric backdrop */}
        <div
          className="absolute inset-0 bg-cover bg-center opacity-30 scale-105 transition-transform duration-1000"
          style={{ backgroundImage: `url('${imageDesktop}')` }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#F6F4F2] via-[#F6F4F2]/60 to-transparent" />

        <div className="relative z-10 max-w-4xl mx-auto px-6 text-center space-y-6 pt-20 pb-16">
          <span className="text-[11px] uppercase tracking-[0.3em] text-[#CB9274] font-medium block">
            {eyebrow}
          </span>

          <h1 className="font-serif text-4xl sm:text-6xl md:text-7xl font-normal tracking-tight leading-[1.1] text-[#051F34] whitespace-pre-line">
            {title}
          </h1>

          <p className="text-sm sm:text-base text-[#69727D] max-w-xl mx-auto font-light leading-relaxed">
            {subtitle}
          </p>

          <div className="pt-6 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href={primaryCtaHref}
              onClick={() => trackEvent('hero_cta_click', { cta: 'primary', target: primaryCtaHref })}
              className="w-full sm:w-auto px-9 py-4 bg-[#051F34] text-white text-xs uppercase tracking-[0.2em] font-semibold hover:bg-[#CB9274] transition-all duration-300 shadow-sm flex items-center justify-center gap-2"
            >
              <span>{primaryCtaText}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <Link
              href={secondaryCtaHref}
              onClick={() => trackEvent('hero_cta_click', { cta: 'secondary', target: secondaryCtaHref })}
              className="w-full sm:w-auto px-9 py-4 border border-[#051F34] text-[#051F34] text-xs uppercase tracking-[0.2em] font-semibold hover:bg-[#051F34] hover:text-white transition-all duration-300"
            >
              {secondaryCtaText}
            </Link>
          </div>
        </div>
      </section>

      {/* 2. Value Proposition Ribbon */}
      <section className="bg-white text-[#051F34] border-y border-[#E3DBD4] py-8">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {pillars.map((p) => {
            const Icon = p.icon
            return (
              <div key={p.title} className="space-y-2">
                <div className="w-9 h-9 border border-[#E3DBD4] text-[#CB9274] flex items-center justify-center mx-auto">
                  <Icon className="w-4 h-4" />
                </div>
                <h4 className="font-serif text-base font-medium text-[#051F34]">{p.title}</h4>
                <p className="text-xs text-[#69727D] font-light">{p.desc}</p>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
