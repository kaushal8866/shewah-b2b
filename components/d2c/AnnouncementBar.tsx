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
    ? 'Complimentary Insured Delivery Across India • Handcrafted to Order in Solid 18K Gold'
    : 'Complimentary Insured Delivery Worldwide • Handcrafted to Order in Solid 18K Gold'

  const handleSelect = (code: MarketCode) => {
    setDropdownOpen(false)
    if (onSelectMarket) onSelectMarket(code)
  }

  return (
    <div className="bg-[#051F34] text-[#F6F4F2] text-[10px] sm:text-[11px] uppercase tracking-[0.14em] px-4 py-2 border-b border-[#E3DBD4]/20 transition-colors relative z-50">
      <div className="max-w-[1440px] mx-auto flex items-center justify-between gap-4">
        {/* Left: Atelier Tag */}
        <div className="hidden lg:flex items-center gap-2 text-[#CB9274]">
          <Diamond className="w-2.5 h-2.5 shrink-0 stroke-[1.5]" />
          <span className="font-medium tracking-[0.2em] text-[10px]">Atelier SHEWAH</span>
        </div>

        {/* Center: Dynamic Market Announcement */}
        <div className="flex-1 text-center font-normal tracking-[0.12em] text-[#F6F4F2]/90">
          <span>{message}</span>
        </div>

        {/* Right: Quick Links & Market Indicator */}
        <div className="hidden sm:flex items-center gap-4 shrink-0 text-[#E3DBD4]/80">
          <Link
            href="/consultation"
            className="hover:text-white transition-colors text-[10px] tracking-[0.12em]"
          >
            Private Consultation
          </Link>
          <span className="text-white/20 select-none">|</span>
          <Link
            href="/ring-size-guide"
            className="hover:text-white transition-colors text-[10px] tracking-[0.12em]"
          >
            Ring Sizer
          </Link>

          {(onSelectMarket || onOpenMarketModal) && (
            <>
              <span className="text-white/20 select-none">|</span>
              <div className="relative inline-block text-left">
                <button
                  onClick={() => {
                    if (onOpenMarketModal) {
                      onOpenMarketModal()
                    } else {
                      setDropdownOpen((prev) => !prev)
                    }
                  }}
                  className="flex items-center gap-1.5 text-white hover:text-[#CB9274] transition-colors font-medium text-[10px] tracking-[0.1em]"
                  aria-label="Change market and currency"
                >
                  <Globe className="w-3 h-3 text-[#CB9274] stroke-[1.5]" />
                  <span>
                    {market.currency} ({market.code})
                  </span>
                  <ChevronDown className="w-2.5 h-2.5 opacity-70" />
                </button>

                {dropdownOpen && onSelectMarket && (
                  <div
                    className="absolute right-0 mt-2 w-48 bg-[#051F34] border border-[#E3DBD4]/30 shadow-2xl py-1 z-50 text-xs"
                    onMouseLeave={() => setDropdownOpen(false)}
                  >
                    {Object.values(MARKETS).map((m) => (
                      <button
                        key={m.code}
                        onClick={() => handleSelect(m.code)}
                        className={`w-full text-left px-3.5 py-2 hover:bg-white/10 flex items-center justify-between transition-colors ${
                          market.code === m.code ? 'text-[#CB9274] font-semibold' : 'text-stone-300'
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
