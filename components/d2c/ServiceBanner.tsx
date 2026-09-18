'use client'

import React from 'react'
import Link from 'next/link'
import { Sparkles, MessageCircle, Phone, ArrowRight } from 'lucide-react'
import { trackEvent } from '@/lib/analytics'

export default function ServiceBanner() {
  return (
    <section className="py-16 bg-[#F4ECDD] border-b border-[#E8DFC9] relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-[#E8DFC9] p-8 sm:p-12 shadow-sm flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="space-y-3 max-w-2xl text-center md:text-left">
            <span className="text-[10px] uppercase tracking-[0.35em] text-[#A88A4F] font-semibold block">
              Private Client Care
            </span>
            <h3 className="font-serif text-2xl sm:text-3xl text-[#2A241B] font-light">
              Collaborate 1-on-1 with an Atelier Gemologist
            </h3>
            <p className="text-xs sm:text-sm text-[#5C5347] font-light leading-relaxed">
              Whether selecting an Antwerp certified diamond, customizing ring dimensions, or arranging international armored courier dispatch, our private client specialists are at your disposal.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4 shrink-0 w-full sm:w-auto">
            <Link
              href="/consultation"
              onClick={() => trackEvent('consultation_click', { source: 'service_banner' })}
              className="w-full sm:w-auto px-7 py-3.5 bg-[#2A241B] text-white text-xs uppercase tracking-widest font-semibold rounded-full hover:bg-[#A88A4F] transition-colors text-center flex items-center justify-center gap-2"
            >
              <span>Schedule Consultation</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <a
              href="https://wa.me/919662266360"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto px-6 py-3.5 border border-[#E8DFC9] bg-white text-[#2A241B] text-xs uppercase tracking-widest font-medium rounded-full hover:bg-[#FBF7F0] transition-colors text-center flex items-center justify-center gap-2"
            >
              <MessageCircle className="w-4 h-4 text-[#5C7F5F]" />
              <span>WhatsApp Concierge</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
