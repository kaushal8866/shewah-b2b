'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { Diamond, Globe, ChevronDown } from 'lucide-react'
import { MARKETS, type MarketConfig, type MarketCode } from '@/lib/markets'

interface AnnouncementBarProps {
  market: MarketConfig
  onSelectMarket?: (code: MarketCode) => void
  onOpenMarketModal?: () => void
}

export default function AnnouncementBar({
  market,
  onSelectMarket,
  onOpenMarketModal,
}: AnnouncementBarProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const isIndia = market.code === 'IN'

  const message = isIndia
    ? 'Complimentary Insured Delivery Across India • Certified BIS Hallmarking'
    : 'Complimentary Insured Armored Express Worldwide • Antwerp & Surat Certified'

  const handleSelect = (code: MarketCode) => {
    setDropdownOpen(false)
    if (onSelectMarket) onSelectMarket(code)
  }

  return (
    <div className="bg-[#2A241B] text-[#FBF7F0] text-[10px] sm:text-[11px] uppercase tracking-widest px-4 py-2 border-b border-[#3D3528]/80 transition-colors relative z-50">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Left: Credential / Heritage Tag */}
        <div className="hidden lg:flex items-center gap-2 text-[#C9A86A]">
          <Diamond className="w-3 h-3 shrink-0" />
          <span className="font-light tracking-[0.25em]">Atelier Shewah • High Jewellery</span>
        </div>

        {/* Center: Dynamic Market Announcement */}
        <div className="flex-1 text-center font-light tracking-wider text-[#FBF7F0]/90">
          <span>{message}</span>
        </div>

        {/* Right: Quick Links & Market Indicator */}
        <div className="hidden sm:flex items-center gap-4 shrink-0 text-[#E8DFC9]">
          <Link
            href="/consultation"
            className="hover:text-white transition-colors text-[10px] tracking-wider"
          >
            Private Consultation
          </Link>
          <span className="text-stone-600 select-none">|</span>
          <Link
            href="/ring-size-guide"
            className="hover:text-white transition-colors text-[10px] tracking-wider"
          >
            Ring Sizer
          </Link>

          {(onSelectMarket || onOpenMarketModal) && (
            <>
              <span className="text-stone-600 select-none">|</span>
              <div className="relative inline-block text-left">
                <button
                  onClick={() => {
                    if (onOpenMarketModal) {
                      onOpenMarketModal()
                    } else {
                      setDropdownOpen((prev) => !prev)
                    }
                  }}
                  className="flex items-center gap-1.5 text-white hover:text-[#C9A86A] transition-colors font-medium text-[10px]"
                  aria-label="Change market and currency"
                >
                  <Globe className="w-3 h-3 text-[#C9A86A]" />
                  <span>
                    {market.currency} ({market.code})
                  </span>
                  <ChevronDown className="w-2.5 h-2.5 opacity-70" />
                </button>

                {dropdownOpen && onSelectMarket && (
                  <div
                    className="absolute right-0 mt-2 w-48 bg-[#2A241B] border border-[#5C5347] rounded-lg shadow-2xl py-1 z-50 text-xs"
                    onMouseLeave={() => setDropdownOpen(false)}
                  >
                    {Object.values(MARKETS).map((m) => (
                      <button
                        key={m.code}
                        onClick={() => handleSelect(m.code)}
                        className={`w-full text-left px-3.5 py-2 hover:bg-white/10 flex items-center justify-between transition-colors ${
                          market.code === m.code ? 'text-[#C9A86A] font-bold' : 'text-stone-300'
                        }`}
                      >
                        <span>{m.name}</span>
                        <span className="font-mono text-[10px] text-stone-400">
                          {m.currencySymbol} {m.currency}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
