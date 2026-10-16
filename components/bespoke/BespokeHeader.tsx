'use client'

import React from 'react'
import Link from 'next/link'

export default function BespokeHeader() {
  return (
    <header className="sticky top-0 z-40 bg-[#051F34]/95 backdrop-blur-md border-b border-white/10 text-white transition-all">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Brand Logo */}
        <Link href="/" className="flex flex-col">
          <span className="font-serif text-xl sm:text-2xl tracking-[0.25em] font-normal text-white">
            SHEWAH
          </span>
          <span className="text-[8px] uppercase tracking-[0.35em] text-[#D4AF37] font-mono font-medium -mt-0.5">
            Surat Atelier
          </span>
        </Link>

        {/* Short Navigation */}
        <nav aria-label="Bespoke Navigation" className="hidden md:flex items-center gap-7 text-xs uppercase tracking-wider text-stone-300 font-medium">
          <a href="#how-it-works" className="hover:text-[#D4AF37] transition-colors">
            How It Works
          </a>
          <a href="#custom-rings" className="hover:text-[#D4AF37] transition-colors">
            Custom Rings
          </a>
          <a href="#faq" className="hover:text-[#D4AF37] transition-colors">
            FAQ
          </a>
        </nav>

        {/* Gold Action Button */}
        <div>
          <a
            href="#quote-form"
            className="inline-flex items-center justify-center min-h-[44px] px-4 sm:px-5 py-2 text-[11px] sm:text-xs uppercase tracking-widest font-semibold text-[#051F34] bg-[#D4AF37] hover:bg-[#c49f2e] rounded-lg transition-all shadow-md active:scale-95"
          >
            Get a Free Quote
          </a>
        </div>
      </div>
    </header>
  )
}
