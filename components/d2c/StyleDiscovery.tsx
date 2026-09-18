'use client'

import React from 'react'
import Link from 'next/link'
import { ArrowRight, Sparkles } from 'lucide-react'
import { trackEvent } from '@/lib/analytics'

export default function StyleDiscovery() {
  const styles = [
    {
      key: 'solitaire',
      title: 'Classic Solitaires',
      subtitle: 'Pure focal diamond brilliance',
      href: '/jewellery?style=solitaire',
      image: 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=800&q=80',
    },
    {
      key: 'statement',
      title: 'Statement Creations',
      subtitle: 'Architectural high jewellery',
      href: '/jewellery?style=statement',
      image: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=800&q=80',
    },
    {
      key: 'minimal',
      title: 'Minimalist Icons',
      subtitle: 'Clean everyday geometric gold',
      href: '/jewellery?style=minimal',
      image: 'https://images.unsplash.com/photo-1630019852942-f89202989a59?auto=format&fit=crop&w=800&q=80',
    },
    {
      key: 'heritage',
      title: 'Curated Suites',
      subtitle: 'Harmonious artisanal sets',
      href: '/jewellery?style=heritage',
      image: 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=800&q=80',
    },
  ]

  return (
    <section className="py-20 sm:py-28 bg-[#F6F4F2] border-b border-[#E3DBD4]">
      <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-16">
          <div className="space-y-3">
            <span className="text-[11px] uppercase tracking-[0.25em] text-[#CB9274] font-medium block">
              Aesthetic Pathways
            </span>
            <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl text-[#051F34] font-normal tracking-tight">
              Shop by Design Expression
            </h2>
            <p className="text-sm text-[#69727D] font-light max-w-xl">
              From pure minimalist geometry to majestic coordinated suites, find the creation that resonates with your personal elegance.
            </p>
          </div>

          <Link
            href="/jewellery"
            className="text-xs uppercase tracking-[0.2em] font-medium text-[#051F34] hover:text-[#CB9274] transition-colors flex items-center gap-2"
          >
            <span>All Aesthetics</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
          {styles.map((st) => (
            <Link
              key={st.key}
              href={st.href}
              onClick={() => trackEvent('style_click', { style: st.key, title: st.title })}
              className="group relative h-84 sm:h-96 rounded-none overflow-hidden border border-[#E3DBD4] flex flex-col justify-end p-6 transition-all hover:border-[#051F34]"
            >
              <div
                className="absolute inset-0 bg-cover bg-center transition-transform duration-700 ease-out group-hover:scale-105"
                style={{ backgroundImage: `url('${st.image}')` }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#051F34]/85 via-[#051F34]/20 to-transparent" />

              <div className="relative z-10 text-white space-y-1.5">
                <h3 className="font-serif text-xl sm:text-2xl font-normal tracking-wide text-white">
                  {st.title}
                </h3>
                <p className="text-xs text-white/80 font-light">
                  {st.subtitle}
                </p>
                <div className="pt-2 flex items-center gap-1.5 text-[10px] text-[#CB9274] font-semibold uppercase tracking-[0.2em] group-hover:translate-x-1 transition-transform">
                  <span>Discover Style</span>
                  <ArrowRight className="w-3 h-3" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
