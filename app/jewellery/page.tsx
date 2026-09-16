'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import StoreLayout from '@/components/d2c/StoreLayout'
import { useCart } from '@/components/d2c/CartContext'
import { useWishlist } from '@/lib/wishlistStore'
import { Diamond, Filter, ArrowUpDown, ShieldCheck, Heart } from 'lucide-react'

interface D2CProductItem {
  id: string
  code: string
  name: string
  slug: string
  subtitle: string
  category: string
  primaryPhotoUrl: string | null
  secondaryPhotoUrl: string | null
  craftingLeadDays: number
  price: {
    amount: number
    compareAt: number | null
    currency: string
    formatted: string
    taxLabel: string
    isAvailable: boolean
  }
}

function JewelleryCatalogContent() {
  const searchParams = useSearchParams()
  const categoryParam = searchParams.get('category') || 'all'
  const queryParam = searchParams.get('q') || ''

  const { market } = useCart()
  const { isInWishlist, toggleWishlist } = useWishlist()
  const [products, setProducts] = useState<D2CProductItem[]>([])
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState(categoryParam)
  const [sortBy, setSortBy] = useState<'featured' | 'price_asc' | 'price_desc' | 'name'>('featured')

  useEffect(() => {
    setActiveCategory(categoryParam)
  }, [categoryParam])

  useEffect(() => {
    let cancelled = false
    async function loadCatalog() {
      setLoading(true)
      try {
        const url = `/api/d2c/products?market=${market.code}&category=${encodeURIComponent(activeCategory)}`
        const res = await fetch(url)
        if (!res.ok) throw new Error('Catalog fetch failed')
        const data = await res.json()
        if (!cancelled && Array.isArray(data.products)) {
          setProducts(data.products)
        }
      } catch (err) {
        console.warn('[JewelleryCatalogPage] Error:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadCatalog()
    return () => { cancelled = true }
  }, [market.code, activeCategory])

  const categories = [
    { key: 'all', label: 'All Creations' },
    { key: 'rings', label: 'Rings & Bands' },
    { key: 'necklaces', label: 'Necklaces & Pendants' },
    { key: 'earrings', label: 'Earrings' },
    { key: 'bracelets', label: 'Tennis Bracelets' },
    { key: 'mens', label: 'Men’s Heritage' },
  ]

  const filteredProducts = useMemo(() => {
    let list = [...products]
    if (queryParam) {
      const q = queryParam.toLowerCase()
      list = list.filter(p => p.name.toLowerCase().includes(q) || p.subtitle.toLowerCase().includes(q) || p.category?.toLowerCase().includes(q))
    }
    if (sortBy === 'price_asc') {
      list.sort((a, b) => a.price.amount - b.price.amount)
    } else if (sortBy === 'price_desc') {
      list.sort((a, b) => b.price.amount - a.price.amount)
    } else if (sortBy === 'name') {
      list.sort((a, b) => a.name.localeCompare(b.name))
    }
    return list
  }, [products, queryParam, sortBy])

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header Title */}
        <div className="text-center max-w-2xl mx-auto space-y-3 mb-10">
          <span className="text-[10px] uppercase tracking-[0.35em] text-[#A88A4F] font-medium">
            Fine Jewellery Collection
          </span>
          <h1 className="font-serif text-3xl sm:text-5xl font-light text-[#2A241B]">
            {activeCategory === 'all' ? 'All Masterworks' : categories.find(c => c.key === activeCategory)?.label}
          </h1>
          <p className="text-xs sm:text-sm text-[#5C5347] font-light leading-relaxed">
            Handcrafted in solid gold alloys and handset with certified diamonds.
            Crafted individually to order.
          </p>
        </div>

        {/* Category Pill Tabs */}
        <div className="flex items-center justify-center gap-2 overflow-x-auto pb-6 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat.key}
              onClick={() => setActiveCategory(cat.key)}
              className={`px-4 py-2 text-xs uppercase tracking-widest rounded-full transition-all whitespace-nowrap ${
                activeCategory === cat.key
                  ? 'bg-[#2A241B] text-white font-medium shadow-sm'
                  : 'bg-white border border-[#E8DFC9] text-[#5C5347] hover:border-[#2A241B] hover:text-[#2A241B]'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Filter and Sort Bar */}
        <div className="flex items-center justify-between py-4 border-y border-[#E8DFC9] text-xs text-[#5C5347] mb-8">
          <div>
            <span>{loading ? 'Curating creations...' : `Showing ${filteredProducts.length} pieces`}</span>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <ArrowUpDown className="w-3.5 h-3.5" />
              <span>Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-transparent border-none text-xs text-[#2A241B] font-medium outline-none cursor-pointer"
              >
                <option value="featured">Featured</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
                <option value="name">Name</option>
              </select>
            </div>
          </div>
        </div>

        {/* Product Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 py-12">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="animate-pulse space-y-3">
                <div className="bg-stone-200 aspect-square rounded-2xl" />
                <div className="h-4 bg-stone-200 rounded w-3/4" />
                <div className="h-3 bg-stone-200 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-[#E8DFC9] space-y-4">
            <Diamond className="w-10 h-10 text-[#A88A4F] mx-auto" />
            <h3 className="font-serif text-xl text-[#2A241B]">No pieces found in this category</h3>
            <p className="text-xs text-[#5C5347] max-w-sm mx-auto">
              Our atelier introduces new collections periodically. You may also commission a bespoke creation tailored to your desires.
            </p>
            <div className="pt-2">
              <Link
                href="/bespoke"
                className="inline-block px-6 py-2.5 bg-[#2A241B] text-white text-xs uppercase tracking-widest font-medium rounded-full"
              >
                Commission Bespoke
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {filteredProducts.map((p) => (
              <Link
                key={p.id}
                href={`/jewellery/${p.slug}`}
                className="group flex flex-col bg-white rounded-2xl border border-[#E8DFC9] overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300"
              >
                {/* Photo container */}
                <div className="relative aspect-square bg-[#FBF7F0] overflow-hidden">
                  {p.primaryPhotoUrl ? (
                    <img
                      src={p.primaryPhotoUrl}
                      alt={p.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center font-serif text-stone-300 text-sm">
                      SHEWAH ATELIER
                    </div>
                  )}

                  {/* Made to order badge */}
                  <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm px-2.5 py-1 rounded-full text-[10px] uppercase tracking-wider text-[#2A241B] font-medium border border-[#E8DFC9]">
                    Made to Order
                  </div>

                  {/* Wishlist toggle button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      toggleWishlist({
                        id: p.id,
                        slug: p.slug,
                        name: p.name,
                        category: p.category,
                        priceFormatted: p.price.formatted,
                        photoUrl: p.primaryPhotoUrl,
                        subtitle: p.subtitle,
                      })
                    }}
                    className={`absolute top-3 right-3 p-2 rounded-full backdrop-blur-sm transition-all shadow-sm ${
                      isInWishlist(p.id)
                        ? 'bg-[#2A241B] text-[#D4AF37]'
                        : 'bg-white/80 text-[#5C5347] hover:bg-white hover:text-[#2A241B]'
                    }`}
                    aria-label={isInWishlist(p.id) ? 'Remove from Wishlist' : 'Save to Wishlist'}
                  >
                    <Heart className={`w-3.5 h-3.5 ${isInWishlist(p.id) ? 'fill-[#D4AF37]' : ''}`} />
                  </button>
                </div>

                {/* Details */}
                <div className="p-5 flex-1 flex flex-col justify-between space-y-3">
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-[#A88A4F] font-medium">
                      {p.category || 'Fine Jewellery'}
                    </span>
                    <h3 className="font-serif text-base font-medium text-[#2A241B] group-hover:text-[#A88A4F] transition-colors leading-snug line-clamp-1">
                      {p.name}
                    </h3>
                    <p className="text-xs text-[#5C5347] line-clamp-1 font-light mt-0.5">
                      {p.subtitle}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-[#E8DFC9] flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold text-[#2A241B]">
                        {p.price.formatted}
                      </div>
                      <div className="text-[10px] text-[#8C8275]">
                        {p.price.taxLabel}
                      </div>
                    </div>

                    <span className="text-[11px] uppercase tracking-wider text-[#A88A4F] font-semibold group-hover:translate-x-1 transition-transform">
                      View Piece →
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
  )
}

export default function JewelleryCatalogPage() {
  return (
    <StoreLayout>
      <React.Suspense
        fallback={
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 flex items-center justify-center">
            <Diamond className="w-8 h-8 text-[#A88A4F] animate-pulse" />
          </div>
        }
      >
        <JewelleryCatalogContent />
      </React.Suspense>
    </StoreLayout>
  )
}
