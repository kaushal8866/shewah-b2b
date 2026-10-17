'use client'

import React from 'react'
import Link from 'next/link'
import { Diamond } from 'lucide-react'
import type { MarketConfig } from '@/lib/markets'

interface AnnouncementBarProps {
  market?: MarketConfig
  onSelectMarket?: (code: any) => void
  onOpenMarketModal?: () => void
}

export default function AnnouncementBar({
  market,
}: AnnouncementBarProps) {
  const isIndia = market?.code === 'IN'

  const message = isIndia
    ? 'Complimentary Insured Delivery Across India • Handcrafted to Order in Solid Gold & Precious Metals'
    : 'Complimentary Insured Delivery Worldwide • Handcrafted to Order in Solid Gold & Precious Metals'

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

        {/* Right: Quick Links */}
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
        </div>
      </div>
    </div>
  )
}
