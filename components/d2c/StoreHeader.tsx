'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useCart } from './CartContext'
import { useWishlist } from '@/lib/wishlistStore'
import { MARKETS, type MarketCode } from '@/lib/markets'
import { DEFAULT_NON_EMPTY_CATEGORIES, type D2CCategoryItem } from '@/lib/categories'
import AnnouncementBar from './AnnouncementBar'
import MegaMenu from './MegaMenu'
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
  Ruler,
} from 'lucide-react'

export default function StoreHeader() {
  const pathname = usePathname()
  const router = useRouter()
  const { market, setMarketCode, itemCount, openCart } = useCart()
  const { wishlistCount } = useWishlist()
  const [mounted, setMounted] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [marketDropdownOpen, setMarketDropdownOpen] = useState(false)
  const [shopDropdownOpen, setShopDropdownOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searchLoading, setSearchLoading] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Auto-close search & mobile drawer when user navigates
  useEffect(() => {
    setMobileNavOpen(false)
    setSearchOpen(false)
  }, [pathname])

  // Real-time typeahead search debouncer
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setSearchResults([])
      setSearchLoading(false)
      return
    }

    let cancelled = false
    setSearchLoading(true)
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/d2c/products?market=${market.code}&q=${encodeURIComponent(searchQuery.trim())}&limit=4`
        )
        if (!res.ok) throw new Error('Search failed')
        const data = await res.json()
        if (!cancelled) {
          setSearchResults(data.products || [])
          setSearchLoading(false)
        }
      } catch {
        if (!cancelled) setSearchLoading(false)
      }
    }, 200)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [searchQuery, market.code])

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

  const [d2cCategories, setD2cCategories] = useState<D2CCategoryItem[]>(DEFAULT_NON_EMPTY_CATEGORIES)
  const [shopCategories, setShopCategories] = useState([
    { label: 'All Jewellery', href: '/jewellery' },
    ...DEFAULT_NON_EMPTY_CATEGORIES.map((c) => ({ label: c.label, href: c.href })),
    { label: 'Ring Size Guide & Sizer', href: '/ring-size-guide' },
  ])

  useEffect(() => {
    let cancelled = false
    async function loadCategories() {
      try {
        const res = await fetch('/api/d2c/categories')
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled && Array.isArray(data.categories)) {
          const activeOnly = data.categories.filter((c: any) => c.key !== 'all' && c.count > 0)
          if (activeOnly.length > 0) {
            setD2cCategories(activeOnly)
            setShopCategories([
              { label: 'All Jewellery', href: '/jewellery' },
              ...activeOnly.map((c: any) => ({ label: c.label, href: c.href })),
              { label: 'Ring Size Guide & Sizer', href: '/ring-size-guide' },
            ])
          }
        }
      } catch (err) {
        // Fallback already provides safe non-empty defaults
      }
    }
    loadCategories()
    return () => { cancelled = true }
  }, [])

  return (
    <header className="sticky top-0 z-40 bg-[#F6F4F2]/95 backdrop-blur-md border-b border-[#E3DBD4] transition-all relative">
      {/* 1. Global Market-Aware Announcement Bar */}
      <AnnouncementBar market={market} onSelectMarket={handleMarketChange} />

      {/* 2. Main Brand Navigation Bar */}
      <div className="relative max-w-[1440px] mx-auto px-4 sm:px-8 lg:px-12 h-18 sm:h-20 flex items-center justify-between">
        {/* Left Side: Mobile Menu Trigger + Primary Left Nav */}
        <div className="flex items-center gap-6">
          <button
            onClick={() => setMobileNavOpen(true)}
            className="lg:hidden p-1.5 sm:p-2 text-[#051F34] hover:text-[#CB9274]"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5 sm:w-6 sm:h-6 stroke-[1.25]" />
          </button>

          {/* Left Desktop Nav */}
          <nav className="hidden lg:flex items-center gap-8 text-[12px] uppercase tracking-[0.14em] font-medium text-[#051F34]">
            {/* Shop with MegaMenu Trigger */}
            <div
              className="relative py-6"
              onMouseEnter={() => setShopDropdownOpen(true)}
              onMouseLeave={() => setShopDropdownOpen(false)}
            >
              <Link
                href="/jewellery"
                className={`flex items-center gap-1.5 hover:text-[#CB9274] transition-colors ${
                  pathname.startsWith('/jewellery') ? 'text-[#CB9274]' : ''
                }`}
              >
                <span>Shop</span>
                <ChevronDown className={`w-3 h-3 transition-transform ${shopDropdownOpen ? 'rotate-180' : ''}`} />
              </Link>
            </div>

            <Link
              href="/bespoke"
              className={`hover:text-[#CB9274] transition-colors ${
                pathname === '/bespoke' ? 'text-[#CB9274]' : ''
              }`}
            >
              Bespoke
            </Link>

            <Link
              href="/craftsmanship"
              className={`hover:text-[#CB9274] transition-colors ${
                pathname === '/craftsmanship' ? 'text-[#CB9274]' : ''
              }`}
            >
              Atelier
            </Link>
          </nav>
        </div>

        {/* Center: Brand Logo (Guaranteed Absolute Center on all viewports) */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-auto z-10">
          <Link href="/" className="inline-block group">
            <span className="font-serif text-xl sm:text-2xl lg:text-3xl tracking-[0.2em] font-normal text-[#051F34] block whitespace-nowrap">
              SHEWAH
            </span>
            <span className="text-[8px] sm:text-[9.5px] uppercase tracking-[0.3em] text-[#CB9274] block mt-0.5 whitespace-nowrap font-sans font-medium">
              High Jewellery
            </span>
          </Link>
        </div>

        {/* Right Side: Desktop Nav Links + Utility Icons */}
        <div className="flex items-center gap-8 text-[#051F34]">
          <nav className="hidden lg:flex items-center gap-8 text-[12px] uppercase tracking-[0.14em] font-medium text-[#051F34]">
            <Link
              href="/diamonds"
              className={`hover:text-[#CB9274] transition-colors ${
                pathname === '/diamonds' ? 'text-[#CB9274]' : ''
              }`}
            >
              Diamonds
            </Link>

            <Link
              href="/business"
              className={`hover:text-[#CB9274] transition-colors ${
                pathname.startsWith('/business') ? 'text-[#CB9274]' : ''
              }`}
            >
              Trade
            </Link>
          </nav>

          {/* Utility Icons */}
          <div className="flex items-center gap-3 sm:gap-5">
            <button
              onClick={() => setSearchOpen((prev) => !prev)}
              className="p-1.5 hover:text-[#CB9274] transition-colors"
              aria-label="Search"
            >
              <Search className="w-4 h-4 sm:w-[18px] sm:h-[18px] stroke-[1.25]" />
            </button>

            <Link
              href="/wishlist"
              className="p-1.5 hover:text-[#CB9274] transition-colors relative flex items-center"
              aria-label="Wishlist"
            >
              <Heart className="w-4 h-4 sm:w-[18px] sm:h-[18px] stroke-[1.25]" />
              {mounted && wishlistCount > 0 && (
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full bg-[#CB9274] text-white text-[8px] sm:text-[9px] font-mono font-medium flex items-center justify-center shadow-sm">
                  {wishlistCount}
                </span>
              )}
            </Link>

            <button
              onClick={openCart}
              className="p-1.5 hover:text-[#CB9274] transition-colors relative flex items-center gap-1.5"
              aria-label="Open Shopping Bag"
            >
              <ShoppingBag className="w-4 h-4 sm:w-[18px] sm:h-[18px] stroke-[1.25]" />
              {itemCount > 0 && (
                <span className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full bg-[#051F34] text-white text-[8px] sm:text-[10px] font-mono font-medium flex items-center justify-center">
                  {itemCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 3. MegaMenu Dropdown (Full Width) */}
      {shopDropdownOpen && (
        <div
          onMouseEnter={() => setShopDropdownOpen(true)}
          onMouseLeave={() => setShopDropdownOpen(false)}
        >
          <MegaMenu
            categories={d2cCategories}
            onClose={() => setShopDropdownOpen(false)}
          />
        </div>
      )}

      {/* Search Input Drawer (Toggled) */}
      {searchOpen && (
        <div className="border-t border-[#E3DBD4] bg-[#F6F4F2] px-4 py-4 animate-in fade-in shadow-xl">
          <div className="max-w-3xl mx-auto space-y-4">
            <div className="flex items-center gap-3 bg-white px-4 py-2.5 border border-[#E3DBD4] shadow-sm">
              <Search className="w-5 h-5 text-[#69727D]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchQuery.trim()) {
                    router.push(`/jewellery?q=${encodeURIComponent(searchQuery.trim())}`)
                    setSearchOpen(false)
                  }
                  if (e.key === 'Escape') {
                    setSearchOpen(false)
                  }
                }}
                placeholder="Search solitaire rings, tennis bracelets, pendants..."
                className="flex-1 bg-transparent border-none outline-none text-sm text-[#051F34] placeholder-[#69727D] font-sans"
                autoFocus
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-[#69727D] hover:text-[#051F34] p-1"
                  aria-label="Clear search"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => setSearchOpen(false)}
                className="text-[11px] uppercase tracking-[0.18em] text-[#69727D] hover:text-[#051F34] pl-2 border-l border-[#E3DBD4] font-sans"
              >
                Close
              </button>
            </div>

            {/* Suggestions & Live Results Panel */}
            {searchQuery.trim().length >= 2 ? (
              <div className="bg-white border border-[#E3DBD4] p-4 shadow-sm">
                {searchLoading ? (
                  <div className="py-6 text-center text-xs text-[#69727D] font-sans tracking-wider flex items-center justify-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#CB9274] animate-ping" />
                    Searching fine jewellery...
                  </div>
                ) : searchResults.length > 0 ? (
                  <div className="space-y-3 font-sans">
                    <div className="text-[10px] uppercase tracking-[0.2em] font-medium text-[#69727D]">
                      Matching Pieces ({searchResults.length})
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {searchResults.map((item) => (
                        <Link
                          key={item.id}
                          href={`/jewellery/${item.slug}`}
                          onClick={() => setSearchOpen(false)}
                          className="flex items-center gap-3 p-2 hover:bg-[#F6F4F2] border border-transparent hover:border-[#E3DBD4] transition-all group"
                        >
                          <div className="w-12 h-12 overflow-hidden bg-[#F6F4F2] shrink-0 border border-[#E3DBD4]">
                            {item.primaryPhotoUrl ? (
                              <img
                                src={item.primaryPhotoUrl}
                                alt={item.name}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-[#69727D]">
                                <Diamond className="w-5 h-5" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-normal text-[#051F34] truncate group-hover:text-[#CB9274] transition-colors font-serif">
                              {item.name}
                            </p>
                            <p className="text-[11px] font-medium text-[#CB9274] font-sans">
                              {item.price?.formatted}
                            </p>
                          </div>
                        </Link>
                      ))}
                    </div>
                    <div className="pt-2 border-t border-[#E3DBD4] flex justify-end">
                      <button
                        onClick={() => {
                          router.push(`/jewellery?q=${encodeURIComponent(searchQuery.trim())}`)
                          setSearchOpen(false)
                        }}
                        className="text-[11px] font-medium text-[#051F34] hover:text-[#CB9274] inline-flex items-center gap-1 uppercase tracking-[0.18em] font-sans"
                      >
                        <span>View all matching results</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="py-6 text-center space-y-2 font-sans">
                    <p className="text-xs text-[#69727D]">
                      No creations found matching &quot;{searchQuery}&quot;.
                    </p>
                    <div className="flex items-center justify-center gap-4 text-xs font-medium pt-1">
                      <Link
                        href="/jewellery"
                        onClick={() => setSearchOpen(false)}
                        className="text-[#CB9274] hover:underline"
                      >
                        Browse all pieces
                      </Link>
                      <span className="text-stone-300">•</span>
                      <Link
                        href="/bespoke"
                        onClick={() => setSearchOpen(false)}
                        className="text-[#CB9274] hover:underline"
                      >
                        Custom Bespoke
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2 pt-1 font-sans">
                <span className="text-[11px] uppercase tracking-[0.18em] font-medium text-[#69727D] mr-2">
                  Popular:
                </span>
                {[
                  { label: 'Solitaire Rings', href: '/jewellery?category=rings' },
                  { label: 'Necklaces & Pendants', href: '/jewellery?category=necklaces' },
                  { label: 'Diamond Earrings', href: '/jewellery?category=earrings' },
                  { label: 'Ring Size Guide', href: '/ring-size-guide' },
                  { label: 'Bespoke Atelier', href: '/bespoke' },
                ].map((tag) => (
                  <Link
                    key={tag.label}
                    href={tag.href}
                    onClick={() => setSearchOpen(false)}
                    className="text-xs px-3 py-1 bg-white border border-[#E3DBD4] text-[#69727D] hover:text-[#051F34] hover:border-[#051F34] transition-colors"
                  >
                    {tag.label}
                  </Link>
                ))}
              </div>
            )}
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
            className="fixed inset-y-0 left-0 max-w-xs w-full bg-[#F6F4F2] text-[#051F34] shadow-2xl p-6 flex flex-col justify-between z-10 overflow-y-auto border-r border-[#E3DBD4]"
            style={{ backgroundColor: '#F6F4F2' }}
          >
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-6 border-b border-[#E3DBD4]">
                <span className="font-serif text-2xl tracking-[0.2em] font-normal text-[#051F34]">
                  SHEWAH
                </span>
                <button
                  onClick={() => setMobileNavOpen(false)}
                  className="p-1 text-[#69727D] hover:text-[#051F34] transition-colors"
                  aria-label="Close menu"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="py-2 space-y-4 text-xs uppercase tracking-[0.2em] font-sans font-medium">
                <Link
                  href="/jewellery"
                  onClick={() => setMobileNavOpen(false)}
                  className="block py-2 text-[#051F34] hover:text-[#CB9274] transition-colors"
                >
                  Explore Collection
                </Link>
                <div className="pl-4 space-y-2.5 border-l border-[#E3DBD4] text-[#69727D]">
                  {shopCategories.slice(1).map((c) => (
                    <Link
                      key={c.href}
                      href={c.href}
                      onClick={() => setMobileNavOpen(false)}
                      className="block py-1 text-[11px] hover:text-[#051F34] transition-colors"
                    >
                      {c.label}
                    </Link>
                  ))}
                </div>

                <Link
                  href="/bespoke"
                  onClick={() => setMobileNavOpen(false)}
                  className="block py-2 text-[#051F34] hover:text-[#CB9274] transition-colors"
                >
                  Bespoke Atelier
                </Link>
                <Link
                  href="/craftsmanship"
                  onClick={() => setMobileNavOpen(false)}
                  className="block py-2 text-[#051F34] hover:text-[#CB9274] transition-colors"
                >
                  Craftsmanship
                </Link>
                <Link
                  href="/diamonds"
                  onClick={() => setMobileNavOpen(false)}
                  className="block py-2 text-[#051F34] hover:text-[#CB9274] transition-colors"
                >
                  Diamonds
                </Link>
                <Link
                  href="/ring-size-guide"
                  onClick={() => setMobileNavOpen(false)}
                  className="block py-2 text-[#051F34] hover:text-[#CB9274] transition-colors"
                >
                  Ring Sizer & Guide
                </Link>
                <Link
                  href="/business"
                  onClick={() => setMobileNavOpen(false)}
                  className="block py-2 text-[#051F34] hover:text-[#CB9274] transition-colors"
                >
                  Trade & B2B
                </Link>
              </div>
            </div>

            <div className="pt-6 border-t border-[#E3DBD4] space-y-4 shrink-0 font-sans">
              <div className="text-xs text-[#69727D]">
                <div className="font-medium text-[#051F34] mb-1">Delivering to:</div>
                <div className="flex items-center justify-between">
                  <span>{market.name}</span>
                  <span className="font-mono">{market.currency} ({market.currencySymbol})</span>
                </div>
              </div>

              <Link
                href="/login"
                onClick={() => setMobileNavOpen(false)}
                className="block text-center py-3 text-[11px] uppercase tracking-[0.2em] font-sans border border-[#051F34] text-[#051F34] hover:bg-[#051F34] hover:text-white transition-colors"
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
