'use client'

import React from 'react'
import Link from 'next/link'
import { Calendar, MessageCircle, Shield, Clock, Video, CheckCircle2 } from 'lucide-react'

export default function ConsultationCTA() {
  const perks = [
    {
      icon: Video,
      title: 'Private Video or Studio Session',
      desc: '30-minute bespoke consultation tailored to your aesthetic, timeline, and budget.',
    },
    {
      icon: Shield,
      title: 'Certified Diamond Curation',
      desc: 'Compare hand-selected Antwerp rough or lab-grown stones under 10x magnification.',
    },
    {
      icon: Clock,
      title: 'Photorealistic 3D CAD Preview',
      desc: 'Receive exact 360° architectural renders and metal weight estimates prior to casting.',
    },
  ]

  return (
    <section className="py-20 lg:py-28 bg-[#2A241B] text-[#FBF7F0] relative overflow-hidden">
      {/* Decorative Gold Glows */}
      <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-[#C9A86A]/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full bg-[#A88A4F]/10 blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="max-w-3xl mx-auto text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#3D3528] border border-[#5C5347] text-[#C9A86A] text-[10px] uppercase tracking-[0.25em] mb-4">
            <Calendar className="w-3 h-3" />
            <span>Private Atelier Appointment</span>
          </div>

          <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl tracking-tight mb-6">
            Speak Privately With a High Jewellery Specialist
          </h2>

          <p className="text-stone-300 text-sm sm:text-base font-light leading-relaxed max-w-2xl mx-auto">
            Whether commissioning a bespoke engagement ring, acquiring a milestone bridal suite, or remounting a family heirloom, our private client directors provide dedicated guidance.
          </p>
        </div>

        {/* 3 Pillars */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 mb-14 max-w-5xl mx-auto">
          {perks.map((p) => {
            const Icon = p.icon
            return (
              <div
                key={p.title}
                className="bg-[#352E23]/80 border border-[#5C5347]/60 rounded-xl p-6 sm:p-8 text-center hover:border-[#C9A86A]/50 transition-colors"
              >
                <div className="w-12 h-12 rounded-full bg-[#2A241B] border border-[#5C5347] flex items-center justify-center mx-auto mb-4 text-[#C9A86A]">
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="font-serif text-lg text-white mb-2">
                  {p.title}
                </h3>
                <p className="text-xs text-stone-400 font-light leading-relaxed">
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
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 bg-[#C9A86A] text-[#2A241B] hover:bg-[#D9BA7D] px-8 py-4 rounded-full text-xs uppercase tracking-widest font-semibold transition-all shadow-lg hover:shadow-xl text-center"
          >
            <Calendar className="w-4 h-4" />
            <span>Schedule Virtual Session</span>
          </Link>

          <a
            href="https://wa.me/919909908866?text=Hello%20SHEWAH%20Atelier%2C%20I%20would%20like%20to%20inquire%20about%20a%20private%20commission."
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 bg-transparent border border-[#5C5347] hover:border-white text-stone-200 hover:text-white px-7 py-4 rounded-full text-xs uppercase tracking-widest font-medium transition-colors text-center"
          >
            <MessageCircle className="w-4 h-4 text-emerald-400" />
            <span>WhatsApp Concierge</span>
          </a>
        </div>

        {/* Trust Badges */}
        <div className="mt-12 text-center flex flex-wrap items-center justify-center gap-6 text-[11px] text-stone-400">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#C9A86A]" /> No Obligation Consultation
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#C9A86A]" /> Direct Karigar Access
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#C9A86A]" /> Confidential Sourcing
          </span>
        </div>
      </div>
    </section>
  )
}
