'use client'

import React from 'react'
import Link from 'next/link'
import { Diamond, Hammer, Users, ShieldCheck, HeartHandshake, ArrowRight } from 'lucide-react'

export default function WhyShewah() {
  const pillars = [
    {
      icon: Hammer,
      title: 'Cast Individually to Order',
      desc: 'We never mass-manufacture. Every ring and pendant is cast in individual flasks using solid 18K gold and 950 platinum alloys only after your commission is confirmed.',
    },
    {
      icon: Diamond,
      title: 'Antwerp & Surat Provenance',
      desc: 'Direct access to the world’s foremost diamond cutting centres ensures exceptional cut grades, fire, and optical scintillation without multi-tiered distributor markups.',
    },
    {
      icon: Users,
      title: 'Hereditary Master Karigars',
      desc: 'Our stones are set by master goldsmiths under stereomicroscopes, gently rolling micro-prongs over girdles with surgical accuracy for a lifetime of security.',
    },
    {
      icon: HeartHandshake,
      title: 'Private Concierge Guidance',
      desc: 'Collaborate directly with our gemologists via private video consultations, WhatsApp concierge, or email to personalize measurements and stone parameters.',
    },
    {
      icon: ShieldCheck,
      title: 'Armored & Insured Transit',
      desc: 'Delivered in discreet, tamper-evident armored packaging. Every shipment is 100% insured door-to-door with OTP verification upon delivery.',
    },
  ]

  return (
    <section className="py-20 sm:py-24 bg-white border-b border-[#E8DFC9]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto space-y-3 mb-16">
          <span className="text-[10px] uppercase tracking-[0.35em] text-[#A88A4F] font-semibold block">
            The Shewah Standard
          </span>
          <h2 className="font-serif text-3xl sm:text-4xl text-[#2A241B] font-light">
            Why Discerning Clients Choose Shewah
          </h2>
          <p className="text-xs sm:text-sm text-[#5C5347] font-light leading-relaxed">
            The intimacy of a private jewellery atelier combined with the optical precision of global diamond cutting centres.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {pillars.map((p, idx) => {
            const Icon = p.icon
            return (
              <div
                key={p.title}
                className="p-8 rounded-2xl bg-[#FBF7F0] border border-[#E8DFC9] space-y-4 hover:border-[#A88A4F] transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-white border border-[#E8DFC9] text-[#A88A4F] flex items-center justify-center shadow-sm">
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="font-serif text-xl text-[#2A241B] font-medium">
                  {p.title}
                </h3>
                <p className="text-xs text-[#5C5347] font-light leading-relaxed">
                  {p.desc}
                </p>
              </div>
            )
          })}

          {/* 6th Card: Direct Link to Craftsmanship / About */}
          <div className="p-8 rounded-2xl bg-[#2A241B] text-[#FBF7F0] space-y-5 flex flex-col justify-between shadow-xl">
            <div className="space-y-3">
              <span className="text-[9px] uppercase tracking-widest text-[#C9A86A] font-semibold block">
                Atelier Heritage
              </span>
              <h3 className="font-serif text-2xl font-light text-white leading-snug">
                Transparent from Molten Gold to Finished Masterpiece
              </h3>
              <p className="text-xs text-stone-300 font-light leading-relaxed">
                Learn how our Surat workshops and Antwerp gemologists bring mathematical clarity to timeless jewellery.
              </p>
            </div>

            <Link
              href="/craftsmanship"
              className="inline-flex items-center gap-2 text-xs uppercase tracking-widest font-semibold text-[#C9A86A] hover:text-white transition-colors pt-2"
            >
              <span>Explore Our Craftsmanship</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
