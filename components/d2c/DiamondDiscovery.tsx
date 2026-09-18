'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { Diamond, Check, Award, ArrowRight, Sparkles } from 'lucide-react'
import { trackEvent } from '@/lib/analytics'

export default function DiamondDiscovery() {
  const [selectedType, setSelectedType] = useState<'all' | 'lgd' | 'natural'>('all')

  const diamondShapes = [
    { key: 'round', label: 'Round Brilliant', subtitle: 'Timeless 57-facet fire', icon: '💎' },
    { key: 'heart', label: 'Heart Cut', subtitle: 'Romantic botanical curves', icon: '🤍' },
    { key: 'emerald', label: 'Emerald Cut', subtitle: 'Hall-of-mirrors step cut', icon: '💠' },
    { key: 'oval', label: 'Oval Cut', subtitle: 'Elongated graceful radiance', icon: '✨' },
    { key: 'cushion', label: 'Cushion Cut', subtitle: 'Pillow-soft vintage brilliance', icon: '🔹' },
  ]

  return (
    <section className="py-20 sm:py-24 bg-white border-b border-[#E8DFC9]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto space-y-3 mb-16">
          <span className="text-[10px] uppercase tracking-[0.35em] text-[#A88A4F] font-semibold block">
            Stone Provenance & Education
          </span>
          <h2 className="font-serif text-3xl sm:text-4xl text-[#2A241B] font-light">
            Certified Diamonds, Ethically Sourced
          </h2>
          <p className="text-xs sm:text-sm text-[#5C5347] font-light leading-relaxed">
            Every Shewah diamond is hand-selected in Antwerp and Surat for superior light refraction, laser-inscribed, and independently certified by IGI or GIA.
          </p>
        </div>

        {/* 1. Natural vs Lab-Grown Education Comparison */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
          {/* Lab-Grown Card */}
          <div className="p-8 rounded-2xl bg-[#FBF7F0] border border-[#E8DFC9] space-y-4 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider text-[#A88A4F] font-semibold">
                Modern Innovation
              </span>
              <span className="text-[9px] px-2 py-0.5 bg-[#E8DFC9]/70 text-[#2A241B] font-mono font-medium rounded">
                IGI Certified
              </span>
            </div>
            <h3 className="font-serif text-2xl text-[#2A241B] font-medium">
              Certified Lab-Grown Diamonds
            </h3>
            <p className="text-xs text-[#5C5347] leading-relaxed font-light">
              Optically, chemically, and physically 100% identical to geological diamonds. Grown from carbon seeds under clean solar-powered CVD plasma chambers mimicking mantle pressure.
            </p>
            <ul className="text-xs text-[#5C5347] space-y-2 pt-2 border-t border-[#E8DFC9]">
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-[#5C7F5F]" /> D–F Colorless & VVS Clarity Standard
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-[#5C7F5F]" /> Laser Inscribed with IGI Certificate Number
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-[#5C7F5F]" /> Up to 70% Greater Carat Size for Investment
              </li>
            </ul>
            <div className="pt-2">
              <Link
                href="/jewellery?diamondType=lgd"
                className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wider font-semibold text-[#2A241B] hover:text-[#A88A4F] transition-colors"
              >
                <span>Browse Lab-Grown Creations</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* Natural Mined Card */}
          <div className="p-8 rounded-2xl bg-[#FBF7F0] border border-[#E8DFC9] space-y-4 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider text-[#A88A4F] font-semibold">
                Geological Heritage
              </span>
              <span className="text-[9px] px-2 py-0.5 bg-[#E8DFC9]/70 text-[#2A241B] font-mono font-medium rounded">
                GIA Graded
              </span>
            </div>
            <h3 className="font-serif text-2xl text-[#2A241B] font-medium">
              Natural Mined Diamonds
            </h3>
            <p className="text-xs text-[#5C5347] leading-relaxed font-light">
              Crystallized billions of years ago beneath the continental crust. Sourced strictly through verified non-conflict Kimberley Process channels and hand-cut by hereditary Antwerp artisans.
            </p>
            <ul className="text-xs text-[#5C5347] space-y-2 pt-2 border-t border-[#E8DFC9]">
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-[#5C7F5F]" /> 100% Conflict-Free & Kimberley Certified
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-[#5C7F5F]" /> Official GIA Dossier with Unique Micro-Inscription
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-[#5C7F5F]" /> Ancient Natural Geological Rarity
              </li>
            </ul>
            <div className="pt-2">
              <Link
                href="/jewellery?diamondType=natural"
                className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wider font-semibold text-[#2A241B] hover:text-[#A88A4F] transition-colors"
              >
                <span>Browse Natural Diamond Pieces</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>

        {/* 2. Shop by Diamond Shape Modules */}
        <div className="border-t border-[#E8DFC9] pt-12 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <span className="text-[10px] uppercase tracking-[0.35em] text-[#A88A4F] font-semibold block">
                Geometry of Light
              </span>
              <h3 className="font-serif text-2xl sm:text-3xl text-[#2A241B] font-light">
                Shop by Diamond Silhouette
              </h3>
            </div>
            <Link
              href="/diamonds"
              className="text-xs uppercase tracking-wider font-semibold text-[#2A241B] hover:text-[#A88A4F] transition-colors flex items-center gap-1.5"
            >
              <span>Learn About Cut & Shapes</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {diamondShapes.map((shape) => (
              <Link
                key={shape.key}
                href={`/jewellery?shape=${shape.key}`}
                onClick={() => trackEvent('shape_click', { shape: shape.key, label: shape.label })}
                className="p-5 bg-[#FBF7F0] border border-[#E8DFC9] rounded-2xl hover:border-[#2A241B] hover:bg-white transition-all text-center space-y-2 group shadow-sm hover:shadow-md"
              >
                <div className="text-2xl group-hover:scale-110 transition-transform duration-300">
                  {shape.icon}
                </div>
                <div className="font-serif text-base text-[#2A241B] font-medium group-hover:text-[#A88A4F] transition-colors">
                  {shape.label}
                </div>
                <p className="text-[10px] text-[#8C8275] font-light">
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
