'use client'

import React from 'react'
import Link from 'next/link'
import { MessageCircle } from 'lucide-react'

const WHATSAPP_URL = 'https://wa.me/919662266360?text=Hi%2C%20I%20want%20a%20custom%20jewellery%20quote'

export default function BespokeHeader() {
  return (
    <header className="sticky top-0 z-50 bg-[#0E2233] border-b border-[#C6A15B]/30 text-[#F7F3EA] transition-all">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-8 lg:px-12 h-20 flex items-center justify-between gap-4">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-3 shrink-0">
          <div className="flex flex-col">
            <span className="font-playfair text-xl sm:text-2xl tracking-[0.2em] font-medium text-[#F7F3EA] uppercase">
              SHEWAH
            </span>
            <span className="font-jakarta text-[9px] tracking-[0.25em] text-[#C6A15B] uppercase font-semibold -mt-0.5">
              Atelier • Surat
            </span>
          </div>
        </Link>

        {/* Short Navigation */}
        <nav aria-label="Bespoke Navigation" className="hidden lg:flex items-center space-x-8">
          <a
            href="#how-it-works"
            className="font-jakarta text-xs uppercase tracking-[0.15em] text-[#F7F3EA]/80 hover:text-[#C6A15B] transition-colors py-2"
          >
            How It Works
          </a>
          <a
            href="#custom-rings"
            className="font-jakarta text-xs uppercase tracking-[0.15em] text-[#F7F3EA]/80 hover:text-[#C6A15B] transition-colors py-2"
          >
            Portfolio
          </a>
          <a
            href="#reviews"
            className="font-jakarta text-xs uppercase tracking-[0.15em] text-[#F7F3EA]/80 hover:text-[#C6A15B] transition-colors py-2"
          >
            Client Stories
          </a>
          <a
            href="#faq"
            className="font-jakarta text-xs uppercase tracking-[0.15em] text-[#F7F3EA]/80 hover:text-[#C6A15B] transition-colors py-2"
          >
            FAQs
          </a>
        </nav>

        {/* Header Actions */}
        <div className="flex items-center gap-4 lg:gap-6 shrink-0">
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden md:inline-flex items-center gap-1.5 font-jakarta text-xs tracking-wider text-[#F7F3EA]/90 hover:text-[#C6A15B] transition-colors"
          >
            <MessageCircle className="w-4 h-4 text-[#C6A15B] fill-current" />
            <span>WhatsApp (+91 96622 66360)</span>
          </a>
          <a
            href="#quote-form"
            className="inline-flex items-center justify-center bg-[#C6A15B] text-[#0E2233] hover:bg-[#E9C178] font-jakarta text-xs uppercase tracking-[0.15em] font-semibold px-5 py-2.5 rounded-none transition-colors duration-200"
          >
            Request Quote
          </a>
        </div>
      </div>
    </header>
  )
}

