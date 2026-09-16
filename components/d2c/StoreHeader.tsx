'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCart } from './CartContext'
import { MARKETS, type MarketCode } from '@/lib/markets'
import {
  ShoppingBag,
  Search,
  Heart,
  Menu,
  X,
  ChevronDown,
  Globe,
  Diamond,
  ArrowRight,
} from 'lucide-react'

export default function StoreHeader() {
  const pathname = usePathname()
  const { market, setMarketCode, itemCount, openCart } = useCart()
  const [mounted, setMounted] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [marketDropdownOpen, setMarketDropdownOpen] = useState(false)
  const [shopDropdownOpen, setShopDropdownOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    setMounted(true)
  }, [])

  // Auto-close mobile drawer when user navigates
  useEffect(() => {
    setMobileNavOpen(false)
  }, [pathname])

  // Prevent background scrolling when mobile nav is open
  useEffect(() => {
    if (mobileNavOpen) {
      const originalOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = originalOverflow
      }
    }
  }, [mobileNavOpen])

  const handleMarketChange = (code: MarketCode) => {
    setMarketCode(code)
    setMarketDropdownOpen(false)
  }

  const shopCategories = [
    { label: 'All Jewellery', href: '/jewellery' },
    { label: 'Rings & Bands', href: '/jewellery?category=rings' },
    { label: 'Necklaces & Pendants', href: '/jewellery?category=necklaces' },
    { label: 'Earrings', href: '/jewellery?category=earrings' },
    { label: 'Tennis Bracelets', href: '/jewellery?category=bracelets' },
    { label: 'Men’s Heritage', href: '/jewellery?category=mens' },
  ]

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#E8DFC9] transition-all">
      {/* 1. Global Announcement & Market Bar */}
      <div className="bg-[#2A241B] text-[#FBF7F0] text-[11px] uppercase tracking-widest px-4 py-2 flex items-center justify-between">
        <div className="hidden sm:flex items-center gap-2">
          <Diamond className="w-3 h-3 text-[#C9A86A]" />
          <span>Atelier Handcrafted • Antwerp & Surat Certified Diamonds</span>
        </div>
        <div className="w-full sm:w-auto text-center sm:text-right flex items-center justify-between sm:justify-end gap-4">
          <span className="text-[#C9A86A]">Complimentary Insured International Shipping</span>

          {/* Market & Currency Selector */}
          <div className="relative inline-block text-left">
            <button
              onClick={() => setMarketDropdownOpen((prev) => !prev)}
              className="flex items-center gap-1.5 px-2 py-0.5 rounded hover:bg-white/10 transition-colors text-white font-medium"
            >
              <Globe className="w-3 h-3 text-[#C9A86A]" />
              <span>{market.currency} ({market.code})</span>
              <ChevronDown className="w-2.5 h-2.5" />
            </button>

            {marketDropdownOpen && (
              <div
                className="absolute right-0 mt-1 w-44 bg-[#2A241B] border border-[#5C5347] rounded-lg shadow-xl py-1 z-50 text-xs"
                onMouseLeave={() => setMarketDropdownOpen(false)}
              >
                {Object.values(MARKETS).map((m) => (
                  <button
                    key={m.code}
                    onClick={() => handleMarketChange(m.code)}
                    className={`w-full text-left px-3 py-1.5 hover:bg-white/10 flex items-center justify-between ${
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
        </div>
      </div>

      {/* 2. Main Brand Navigation Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        {/* Mobile menu trigger */}
        <button
          onClick={() => setMobileNavOpen(true)}
          className="lg:hidden p-2 text-[#2A241B] hover:text-[#A88A4F]"
          aria-label="Open menu"
        >
          <Menu className="w-6 h-6" />
        </button>

        {/* Primary Desktop Nav */}
        <nav className="hidden lg:flex items-center gap-8 text-xs uppercase tracking-widest font-medium text-[#2A241B]">
          {/* Shop with dropdown */}
          <div
            className="relative py-6"
            onMouseEnter={() => setShopDropdownOpen(true)}
            onMouseLeave={() => setShopDropdownOpen(false)}
          >
            <Link
              href="/jewellery"
              className={`flex items-center gap-1 hover:text-[#A88A4F] transition-colors ${
                pathname.startsWith('/jewellery') ? 'text-[#A88A4F]' : ''
              }`}
            >
              <span>Shop</span>
              <ChevronDown className="w-3 h-3" />
            </Link>

            {shopDropdownOpen && (
              <div className="absolute left-0 top-full w-56 bg-white border border-[#E8DFC9] shadow-xl rounded-b-xl py-3 px-2 z-50">
                {shopCategories.map((cat) => (
                  <Link
                    key={cat.href}
                    href={cat.href}
                    className="block px-4 py-2 text-xs text-[#5C5347] hover:text-[#2A241B] hover:bg-[#FBF7F0] rounded-md transition-colors"
                  >
                    {cat.label}
                  </Link>
                ))}
              </div>
            )}
          </div>

          <Link
            href="/bespoke"
            className={`hover:text-[#A88A4F] transition-colors ${
              pathname === '/bespoke' ? 'text-[#A88A4F]' : ''
            }`}
          >
            Bespoke Atelier
          </Link>

          <Link
            href="/craftsmanship"
            className={`hover:text-[#A88A4F] transition-colors ${
              pathname === '/craftsmanship' ? 'text-[#A88A4F]' : ''
            }`}
          >
            Craftsmanship
          </Link>

          <Link
            href="/diamonds"
            className={`hover:text-[#A88A4F] transition-colors ${
              pathname === '/diamonds' ? 'text-[#A88A4F]' : ''
            }`}
          >
            Diamonds
          </Link>

          <Link
            href="/business"
            className={`hover:text-[#A88A4F] transition-colors ${
              pathname.startsWith('/business') ? 'text-[#A88A4F]' : ''
            }`}
          >
            Trade / B2B
          </Link>
        </nav>

        {/* Brand Logo */}
        <div className="text-center">
          <Link href="/" className="inline-block group">
            <span className="font-serif text-2xl sm:text-3xl tracking-[0.25em] font-medium text-[#2A241B] block">
              SHEWAH
            </span>
            <span className="text-[9px] uppercase tracking-[0.35em] text-[#A88A4F] block mt-0.5">
              High Jewellery
            </span>
          </Link>
        </div>

        {/* Right utility icons */}
        <div className="flex items-center gap-4 sm:gap-6 text-[#2A241B]">
          <button
            onClick={() => setSearchOpen((prev) => !prev)}
            className="p-1.5 hover:text-[#A88A4F] transition-colors"
            aria-label="Search"
          >
            <Search className="w-5 h-5" />
          </button>

          <Link
            href="/wishlist"
            className="p-1.5 hover:text-[#A88A4F] transition-colors relative"
            aria-label="Wishlist"
          >
            <Heart className="w-5 h-5" />
          </Link>

          <button
            onClick={openCart}
            className="p-1.5 hover:text-[#A88A4F] transition-colors relative flex items-center gap-1.5"
            aria-label="Open Shopping Bag"
          >
            <ShoppingBag className="w-5 h-5" />
            {itemCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-[#2A241B] text-white text-[10px] font-mono font-medium flex items-center justify-center">
                {itemCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Search Input Bar (Toggled) */}
      {searchOpen && (
        <div className="border-t border-[#E8DFC9] bg-[#FBF7F0] px-4 py-3 animate-in fade-in">
          <div className="max-w-3xl mx-auto flex items-center gap-3">
            <Search className="w-5 h-5 text-[#8C8275]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && searchQuery.trim()) {
                  window.location.href = `/jewellery?q=${encodeURIComponent(searchQuery.trim())}`
                }
              }}
              placeholder="Search solitaire rings, tennis bracelets, pendants..."
              className="flex-1 bg-transparent border-none outline-none text-sm text-[#2A241B] placeholder-[#8C8275]"
              autoFocus
            />
            <button
              onClick={() => setSearchOpen(false)}
              className="text-xs uppercase tracking-wider text-[#8C8275] hover:text-[#2A241B]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Mobile Drawer Navigation (Rendered in Body Portal to escape header backdrop-filter stacking context) */}
      {mounted && mobileNavOpen && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[100] lg:hidden">
          {/* Dimmed backdrop overlay */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileNavOpen(false)}
            aria-hidden="true"
          />

          {/* Solid Drawer Panel */}
          <div
            className="fixed inset-y-0 left-0 max-w-xs w-full bg-[#FBF7F0] text-[#2A241B] shadow-2xl p-6 flex flex-col justify-between z-10 overflow-y-auto"
            style={{ backgroundColor: '#FBF7F0' }}
          >
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-6 border-b border-[#E8DFC9]">
                <span className="font-serif text-xl tracking-[0.2em] font-medium text-[#2A241B]">
                  SHEWAH
                </span>
                <button
                  onClick={() => setMobileNavOpen(false)}
                  className="p-1 text-[#2A241B] hover:text-[#A88A4F] transition-colors"
                  aria-label="Close menu"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="py-2 space-y-4 text-xs uppercase tracking-widest font-medium">
                <Link
                  href="/jewellery"
                  onClick={() => setMobileNavOpen(false)}
                  className="block py-2 text-[#2A241B] hover:text-[#A88A4F] transition-colors"
                >
                  Explore Collection
                </Link>
                <div className="pl-4 space-y-2.5 border-l border-[#E8DFC9] text-[#5C5347]">
                  {shopCategories.slice(1).map((c) => (
                    <Link
                      key={c.href}
                      href={c.href}
                      onClick={() => setMobileNavOpen(false)}
                      className="block py-1 text-[11px] hover:text-[#2A241B] transition-colors"
                    >
                      {c.label}
                    </Link>
                  ))}
                </div>

                <Link
                  href="/bespoke"
                  onClick={() => setMobileNavOpen(false)}
                  className="block py-2 text-[#2A241B] hover:text-[#A88A4F] transition-colors"
                >
                  Bespoke Atelier
                </Link>
                <Link
                  href="/craftsmanship"
                  onClick={() => setMobileNavOpen(false)}
                  className="block py-2 text-[#2A241B] hover:text-[#A88A4F] transition-colors"
                >
                  Craftsmanship
                </Link>
                <Link
                  href="/diamonds"
                  onClick={() => setMobileNavOpen(false)}
                  className="block py-2 text-[#2A241B] hover:text-[#A88A4F] transition-colors"
                >
                  Diamonds
                </Link>
                <Link
                  href="/business"
                  onClick={() => setMobileNavOpen(false)}
                  className="block py-2 text-[#2A241B] hover:text-[#A88A4F] transition-colors"
                >
                  Trade & B2B
                </Link>
              </div>
            </div>

            <div className="pt-6 border-t border-[#E8DFC9] space-y-4 shrink-0">
              <div className="text-xs text-[#5C5347]">
                <div className="font-medium text-[#2A241B] mb-1">Delivering to:</div>
                <div className="flex items-center justify-between">
                  <span>{market.name}</span>
                  <span className="font-mono">{market.currency} ({market.currencySymbol})</span>
                </div>
              </div>

              <Link
                href="/login"
                onClick={() => setMobileNavOpen(false)}
                className="block text-center py-2.5 text-xs uppercase tracking-wider border border-[#2A241B] rounded-lg text-[#2A241B] hover:bg-[#2A241B] hover:text-[#FBF7F0] transition-colors"
              >
                Trade Portal Sign In
              </Link>
            </div>
          </div>
        </div>,
        document.body
      )}
    </header>
  )
}
