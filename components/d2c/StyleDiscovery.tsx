'use client'

import React from 'react'
import Link from 'next/link'
import { ArrowRight, Sparkles } from 'lucide-react'
import { trackEvent } from '@/lib/analytics'

export default function StyleDiscovery() {
  const styles = [
    {
      key: 'solitaire',
      title: 'Antwerp Solitaires',
      subtitle: 'Pure focal diamond brilliance',
      href: '/jewellery?style=solitaire',
      image: 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=800&q=80',
    },
    {
      key: 'statement',
      title: 'Statement Creations',
      subtitle: 'Rare architectural high jewellery',
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
      title: 'Royal Heritage Suites',
      subtitle: 'Matched artisanal cascades',
      href: '/jewellery?style=heritage',
      image: 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=800&q=80',
    },
  ]

  return (
    <section className="py-20 bg-[#FBF7F0] border-b border-[#E8DFC9]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-12">
          <div className="space-y-2">
            <span className="text-[10px] uppercase tracking-[0.35em] text-[#A88A4F] font-semibold block">
              Aesthetic Pathways
            </span>
            <h2 className="font-serif text-3xl sm:text-4xl text-[#2A241B] font-light">
              Shop by Design Expression
            </h2>
            <p className="text-xs sm:text-sm text-[#5C5347] font-light max-w-xl">
              From pure minimalist geometry to majestic heritage collar suites, find the creation that resonates with your personal elegance.
            </p>
          </div>

          <Link
            href="/jewellery"
            className="text-xs uppercase tracking-wider font-semibold text-[#2A241B] hover:text-[#A88A4F] transition-colors flex items-center gap-1.5"
          >
            <span>All Aesthetics</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {styles.map((st) => (
            <Link
              key={st.key}
              href={st.href}
              onClick={() => trackEvent('style_click', { style: st.key, title: st.title })}
              className="group relative h-80 rounded-2xl overflow-hidden border border-[#E8DFC9] flex flex-col justify-end p-6 shadow-sm hover:shadow-xl transition-all"
            >
              <div
                className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
                style={{ backgroundImage: `url('${st.image}')` }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-stone-950/85 via-stone-950/20 to-transparent" />

              <div className="relative z-10 text-white space-y-1">
                <h3 className="font-serif text-xl font-light tracking-wide text-white">
                  {st.title}
                </h3>
                <p className="text-[11px] text-stone-300 font-light">
                  {st.subtitle}
                </p>
                <div className="pt-2 flex items-center gap-1 text-[10px] text-[#C9A86A] font-semibold uppercase tracking-wider group-hover:translate-x-1 transition-transform">
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
