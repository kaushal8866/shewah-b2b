'use client'

import React from 'react'
import Link from 'next/link'
import { Diamond, Hammer, Users, ShieldCheck, HeartHandshake, ArrowRight } from 'lucide-react'

export default function WhyShewah() {
  const pillars = [
    {
      icon: Hammer,
      title: 'Crafted to Order',
      desc: 'We eschew mass manufacturing. Every piece is individually crafted in solid 18K gold only after your commission is confirmed, ensuring bespoke perfection.',
    },
    {
      icon: Diamond,
      title: 'Certified Diamonds',
      desc: 'Expertly grown diamonds cut and polished to demanding proportions, providing fire, scintillation, and peerless brilliance with independent grading certificates.',
    },
    {
      icon: Users,
      title: 'Artisanal Setting',
      desc: 'Our gemstones are secured by skilled goldsmiths using precision hand-finishing techniques, ensuring enduring balance, comfort, and gemstone protection.',
    },
    {
      icon: HeartHandshake,
      title: 'Private Concierge Guidance',
      desc: 'Collaborate directly with our jewellery advisors via video appointments, WhatsApp, or email to personalize ring sizing, metal choices, and custom engravings.',
    },
    {
      icon: ShieldCheck,
      title: 'Complimentary Insured Delivery',
      desc: 'Delivered in discreet, tamper-evident presentation boxes. Every shipment is fully insured door-to-door with secure tracking and signature verification.',
    },
  ]

  return (
    <section className="py-20 sm:py-28 bg-white border-b border-[#E3DBD4]">
      <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
        <div className="text-center max-w-2xl mx-auto space-y-3 mb-16">
          <span className="text-[11px] uppercase tracking-[0.25em] text-[#CB9274] font-medium block">
            The Shewah Standard
          </span>
          <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl text-[#051F34] font-normal tracking-tight">
            Why Discerning Clients Choose Shewah
          </h2>
          <p className="text-sm text-[#69727D] font-light leading-relaxed">
            The intimacy of an individual jewellery atelier paired with certified diamond excellence and transparent standards.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {pillars.map((p) => {
            const Icon = p.icon
            return (
              <div
                key={p.title}
                className="p-8 rounded-none bg-[#F6F4F2] border border-[#E3DBD4] space-y-4 hover:border-[#051F34] transition-colors"
              >
                <div className="w-10 h-10 border border-[#E3DBD4] text-[#CB9274] flex items-center justify-center bg-white">
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="font-serif text-xl sm:text-2xl text-[#051F34] font-normal">
                  {p.title}
                </h3>
                <p className="text-xs sm:text-sm text-[#69727D] font-light leading-relaxed">
                  {p.desc}
                </p>
              </div>
            )
          })}

          {/* 6th Card: Direct Link to Craftsmanship / About */}
          <div className="p-8 rounded-none bg-[#051F34] text-white space-y-6 flex flex-col justify-between border border-[#051F34]">
            <div className="space-y-3">
              <span className="text-[10px] uppercase tracking-[0.2em] text-[#CB9274] font-semibold block">
                Atelier Heritage
              </span>
              <h3 className="font-serif text-2xl sm:text-3xl font-normal text-white leading-snug">
                Transparent from Gold Alloy to Finished Masterpiece
              </h3>
              <p className="text-xs sm:text-sm text-white/80 font-light leading-relaxed">
                Discover how our atelier pairs traditional goldsmithing technique with contemporary design excellence and verified gemology.
              </p>
            </div>

            <Link
              href="/craftsmanship"
              className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] font-semibold text-[#CB9274] hover:text-white transition-colors pt-4"
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
