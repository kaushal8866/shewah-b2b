'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { Diamond, Check, Award, ArrowRight, Sparkles } from 'lucide-react'
import { trackEvent } from '@/lib/analytics'

export default function DiamondDiscovery() {
  const [selectedType, setSelectedType] = useState<'all' | 'lgd' | 'natural'>('all')

  const diamondShapes = [
    { key: 'round', label: 'Round Brilliant', subtitle: 'Timeless 57-facet fire', icon: '💎' },
    { key: 'heart', label: 'Heart Cut', subtitle: 'Romantic graceful curves', icon: '🤍' },
    { key: 'emerald', label: 'Emerald Cut', subtitle: 'Hall-of-mirrors step cut', icon: '💠' },
    { key: 'oval', label: 'Oval Cut', subtitle: 'Elongated graceful radiance', icon: '✨' },
    { key: 'cushion', label: 'Cushion Cut', subtitle: 'Soft vintage brilliance', icon: '🔹' },
  ]

  return (
    <section className="py-20 sm:py-28 bg-white border-b border-[#E3DBD4]">
      <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
        <div className="text-center max-w-2xl mx-auto space-y-3 mb-16">
          <span className="text-[11px] uppercase tracking-[0.25em] text-[#CB9274] font-medium block">
            Stone Provenance & Education
          </span>
          <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl text-[#051F34] font-normal tracking-tight">
            Certified Diamonds, Ethically Sourced
          </h2>
          <p className="text-sm text-[#69727D] font-light leading-relaxed">
            Every Shewah diamond is carefully selected for superior light performance, cut precision, and independently certified by IGI or GIA.
          </p>
        </div>

        {/* 1. Natural vs Lab-Grown Education Comparison */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
          {/* Lab-Grown Card */}
          <div className="p-8 sm:p-10 rounded-none bg-[#F6F4F2] border border-[#E3DBD4] space-y-5 relative overflow-hidden transition-colors hover:border-[#051F34]">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-[0.2em] text-[#CB9274] font-semibold">
                Modern Innovation
              </span>
              <span className="text-[9px] px-2 py-0.5 bg-[#051F34] text-white font-mono uppercase tracking-wider">
                IGI Certified
              </span>
            </div>
            <h3 className="font-serif text-2xl sm:text-3xl text-[#051F34] font-normal">
              Certified Lab-Grown Diamonds
            </h3>
            <p className="text-xs sm:text-sm text-[#69727D] leading-relaxed font-light">
              Optically, chemically, and physically identical to geological diamonds. Grown from pure carbon seeds using advanced plasma deposition replicating natural crystallisation conditions.
            </p>
            <ul className="text-xs text-[#30373E] space-y-2.5 pt-3 border-t border-[#E3DBD4]">
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-[#CB9274]" /> D–F Colorless & VVS Clarity Standard
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-[#CB9274]" /> Laser Inscribed with Certificate Number
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-[#CB9274]" /> Exceptional Carat Scale for Fine Jewellery
              </li>
            </ul>
            <div className="pt-2">
              <Link
                href="/jewellery?diamondType=lgd"
                className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] font-semibold text-[#051F34] hover:text-[#CB9274] transition-colors"
              >
                <span>Browse Lab-Grown Pieces</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* Natural Mined Card */}
          <div className="p-8 sm:p-10 rounded-none bg-[#F6F4F2] border border-[#E3DBD4] space-y-5 relative overflow-hidden transition-colors hover:border-[#051F34]">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-[0.2em] text-[#CB9274] font-semibold">
                Geological Heritage
              </span>
              <span className="text-[9px] px-2 py-0.5 bg-[#051F34] text-white font-mono uppercase tracking-wider">
                GIA Graded
              </span>
            </div>
            <h3 className="font-serif text-2xl sm:text-3xl text-[#051F34] font-normal">
              Natural Mined Diamonds
            </h3>
            <p className="text-xs sm:text-sm text-[#69727D] leading-relaxed font-light">
              Crystallized billions of years ago beneath the earth's crust. Sourced through conflict-free Kimberley Process channels and faceted to exacting geometric proportions.
            </p>
            <ul className="text-xs text-[#30373E] space-y-2.5 pt-3 border-t border-[#E3DBD4]">
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-[#CB9274]" /> 100% Conflict-Free & Kimberley Certified
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-[#CB9274]" /> Official GIA Dossier with Unique Micro-Inscription
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-[#CB9274]" /> Geological Rarity
              </li>
            </ul>
            <div className="pt-2">
              <Link
                href="/jewellery?diamondType=natural"
                className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] font-semibold text-[#051F34] hover:text-[#CB9274] transition-colors"
              >
                <span>Browse Natural Diamond Pieces</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>

        {/* 2. Shop by Diamond Shape Modules */}
        <div className="border-t border-[#E3DBD4] pt-14 space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <span className="text-[11px] uppercase tracking-[0.25em] text-[#CB9274] font-medium block">
                Geometry of Light
              </span>
              <h3 className="font-serif text-2xl sm:text-3xl lg:text-4xl text-[#051F34] font-normal tracking-tight">
                Shop by Diamond Silhouette
              </h3>
            </div>
            <Link
              href="/diamonds"
              className="text-xs uppercase tracking-[0.2em] font-medium text-[#051F34] hover:text-[#CB9274] transition-colors flex items-center gap-2"
            >
              <span>Diamond Guide</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-6">
            {diamondShapes.map((shape) => (
              <Link
                key={shape.key}
                href={`/jewellery?shape=${shape.key}`}
                onClick={() => trackEvent('shape_click', { shape: shape.key, label: shape.label })}
                className="p-6 bg-[#F6F4F2] border border-[#E3DBD4] rounded-none hover:border-[#051F34] hover:bg-white transition-all text-center space-y-2 group"
              >
                <div className="text-3xl group-hover:scale-110 transition-transform duration-300">
                  {shape.icon}
                </div>
                <div className="font-serif text-base text-[#051F34] font-normal group-hover:text-[#CB9274] transition-colors">
                  {shape.label}
                </div>
                <p className="text-[10px] text-[#69727D] font-light uppercase tracking-wider">
                  {shape.subtitle}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
