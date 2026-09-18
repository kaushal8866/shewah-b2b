'use client'

import React from 'react'
import Link from 'next/link'
import { Sparkles, MessageCircle, Phone, ArrowRight } from 'lucide-react'
import { trackEvent } from '@/lib/analytics'

export default function ServiceBanner() {
  return (
    <section className="py-16 sm:py-20 bg-[#F6F4F2] border-b border-[#E3DBD4] relative overflow-hidden">
      <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
        <div className="bg-white rounded-none border border-[#E3DBD4] p-8 sm:p-12 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="space-y-3 max-w-2xl text-center md:text-left">
            <span className="text-[11px] uppercase tracking-[0.25em] text-[#CB9274] font-medium block">
              Private Client Care
            </span>
            <h3 className="font-serif text-2xl sm:text-3xl lg:text-4xl text-[#051F34] font-normal tracking-tight">
              Collaborate 1-on-1 with a Fine Jewellery Specialist
            </h3>
            <p className="text-sm text-[#69727D] font-light leading-relaxed">
              Whether selecting a certified diamond, personalizing ring dimensions, or arranging international insured delivery, our private client specialists are at your disposal.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4 shrink-0 w-full sm:w-auto">
            <Link
              href="/consultation"
              onClick={() => trackEvent('consultation_click', { source: 'service_banner' })}
              className="w-full sm:w-auto px-8 py-4 bg-[#051F34] text-white text-xs uppercase tracking-[0.2em] font-semibold hover:bg-[#CB9274] transition-all duration-300 text-center flex items-center justify-center gap-2"
            >
              <span>Schedule Consultation</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <a
              href="https://wa.me/919662266360"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto px-8 py-4 border border-[#051F34] bg-white text-[#051F34] text-xs uppercase tracking-[0.2em] font-semibold hover:bg-[#051F34] hover:text-white transition-all duration-300 text-center flex items-center justify-center gap-2"
            >
              <MessageCircle className="w-4 h-4 text-[#CB9274]" />
              <span>WhatsApp Concierge</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
