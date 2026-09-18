'use client'

import React from 'react'
import Link from 'next/link'
import { Calendar, MessageCircle, Shield, Clock, Video, CheckCircle2 } from 'lucide-react'

export default function ConsultationCTA() {
  const perks = [
    {
      icon: Video,
      title: 'Private Video or Studio Session',
      desc: '30-minute bespoke consultation tailored to your aesthetic, timeline, and preferences.',
    },
    {
      icon: Shield,
      title: 'Certified Diamond Curation',
      desc: 'Compare certified natural or lab-grown diamonds selected for ideal light performance.',
    },
    {
      icon: Clock,
      title: 'Photorealistic 3D CAD Preview',
      desc: 'Receive exact 360° architectural renders and metal weight estimates prior to crafting.',
    },
  ]

  return (
    <section className="py-20 lg:py-28 bg-[#051F34] text-white relative overflow-hidden">
      <div className="max-w-[1440px] mx-auto px-6 lg:px-12 relative z-10">
        <div className="max-w-3xl mx-auto text-center mb-16 space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 border border-white/20 text-[#CB9274] text-[10px] uppercase tracking-[0.25em]">
            <Calendar className="w-3 h-3" />
            <span>Private Atelier Appointment</span>
          </div>

          <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-normal tracking-tight">
            Speak Privately With a Fine Jewellery Specialist
          </h2>

          <p className="text-stone-300 text-sm sm:text-base font-light leading-relaxed max-w-2xl mx-auto">
            Whether commissioning a bespoke engagement ring, acquiring a milestone jewellery suite, or designing a custom heirloom, our private client specialists provide dedicated guidance.
          </p>
        </div>

        {/* 3 Pillars */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 mb-14 max-w-5xl mx-auto">
          {perks.map((p) => {
            const Icon = p.icon
            return (
              <div
                key={p.title}
                className="bg-white/5 border border-white/10 rounded-none p-6 sm:p-8 text-center hover:border-[#CB9274] transition-colors"
              >
                <div className="w-12 h-12 rounded-none border border-[#CB9274] bg-white/5 flex items-center justify-center mx-auto mb-4 text-[#CB9274]">
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="font-serif text-lg text-white font-normal mb-2">
                  {p.title}
                </h3>
                <p className="text-xs text-stone-300 font-light leading-relaxed">
                  {p.desc}
                </p>
              </div>
            )
          })}
        </div>

        {/* Dual Booking CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 max-w-md mx-auto">
          <Link
            href="/consultation"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 bg-[#CB9274] text-white hover:bg-white hover:text-[#051F34] px-8 py-4 rounded-none text-xs uppercase tracking-[0.2em] font-semibold transition-all duration-300 text-center"
          >
            <Calendar className="w-4 h-4" />
            <span>Schedule Consultation</span>
          </Link>

          <a
            href="https://wa.me/919909908866?text=Hello%20SHEWAH%20Atelier%2C%20I%20would%20like%20to%20inquire%20about%20a%20private%20commission."
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 bg-transparent border border-white/30 hover:border-white text-white hover:bg-white hover:text-[#051F34] px-8 py-4 rounded-none text-xs uppercase tracking-[0.2em] font-semibold transition-all duration-300 text-center"
          >
            <MessageCircle className="w-4 h-4 text-[#CB9274]" />
            <span>WhatsApp Concierge</span>
          </a>
        </div>

        {/* Trust Badges */}
        <div className="mt-12 text-center flex flex-wrap items-center justify-center gap-6 text-[11px] text-stone-300">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#CB9274]" /> Complimentary Consultation
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#CB9274]" /> Direct Atelier Access
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#CB9274]" /> Confidential Sourcing
          </span>
        </div>
      </div>
    </section>
  )
}
