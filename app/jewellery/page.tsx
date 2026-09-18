'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import StoreLayout from '@/components/d2c/StoreLayout'
import { useCart } from '@/components/d2c/CartContext'
import { useWishlist } from '@/lib/wishlistStore'
import { Diamond, Filter, ArrowUpDown, ShieldCheck, Heart, Sparkles, X } from 'lucide-react'
import ProductCard from '@/components/d2c/ProductCard'

import { DEFAULT_NON_EMPTY_CATEGORIES, KNOWN_CATEGORIES } from '@/lib/categories'

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
  isFeatured?: boolean
  isSet?: boolean
  isSetComponent?: boolean
  setParentCode?: string | null
  setLabel?: string | null
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
  const shapeParam = searchParams.get('shape') || ''
  const diamondTypeParam = searchParams.get('diamondType') || ''
  const styleParam = searchParams.get('style') || ''
  const queryParam = searchParams.get('q') || ''

  const { market } = useCart()
  const [products, setProducts] = useState<D2CProductItem[]>([])
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState(categoryParam)
  const [categories, setCategories] = useState<Array<{ key: string; label: string; count?: number }>>([
    { key: 'all', label: 'All Creations' },
    ...DEFAULT_NON_EMPTY_CATEGORIES,
  ])
  const [sortBy, setSortBy] = useState<'featured' | 'price_asc' | 'price_desc' | 'name'>('featured')

  useEffect(() => {
    setActiveCategory(categoryParam)
  }, [categoryParam])

  useEffect(() => {
    let cancelled = false
    async function loadCatalog() {
      setLoading(true)
      try {
        const params = new URLSearchParams()
        params.set('market', market.code)
        if (activeCategory && activeCategory !== 'all') params.set('category', activeCategory)
        if (shapeParam) params.set('shape', shapeParam)
        if (diamondTypeParam) params.set('diamondType', diamondTypeParam)
        if (styleParam) params.set('style', styleParam)
        if (queryParam) params.set('q', queryParam)

        const url = `/api/d2c/products?${params.toString()}`
        const res = await fetch(url)
        if (!res.ok) throw new Error('Catalog fetch failed')
        const data = await res.json()
        if (!cancelled && Array.isArray(data.products)) {
          setProducts(data.products)
        }
        if (!cancelled && Array.isArray(data.categories) && data.categories.length > 0) {
          setCategories(data.categories)
        }
      } catch (err) {
        console.warn('[JewelleryCatalogPage] Error:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadCatalog()
    return () => { cancelled = true }
  }, [market.code, activeCategory, shapeParam, diamondTypeParam, styleParam, queryParam])

  const filteredProducts = useMemo(() => {
    let list = [...products]
    if (sortBy === 'price_asc') {
      list.sort((a, b) => a.price.amount - b.price.amount)
    } else if (sortBy === 'price_desc') {
      list.sort((a, b) => b.price.amount - a.price.amount)
    } else if (sortBy === 'name') {
      list.sort((a, b) => a.name.localeCompare(b.name))
    }
    return list
  }, [products, sortBy])

  const activeCategoryLabel = activeCategory === 'all'
    ? 'All Masterworks'
    : (categories.find(c => c.key === activeCategory)?.label || KNOWN_CATEGORIES[activeCategory]?.label || 'Fine Jewellery')

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header Title */}
        <div className="text-center max-w-2xl mx-auto space-y-3 mb-10">
          <span className="text-[10px] uppercase tracking-[0.35em] text-[#A88A4F] font-medium">
            Fine Jewellery Collection
          </span>
          <h1 className="font-serif text-3xl sm:text-5xl font-light text-[#2A241B]">
            {activeCategoryLabel}
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
          <div className="text-center py-20 bg-white rounded-2xl border border-[#E8DFC9] space-y-4 px-6">
            <Diamond className="w-10 h-10 text-[#A88A4F] mx-auto" />
            <h3 className="font-serif text-xl text-[#2A241B]">No pieces found in this category</h3>
            <p className="text-xs text-[#5C5347] max-w-sm mx-auto">
              Our atelier is actively crafting new masterworks for upcoming collections. You may explore all current creations or commission a bespoke piece tailored to your desires.
            </p>
            <div className="pt-3 flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={() => setActiveCategory('all')}
                className="px-6 py-2.5 bg-[#2A241B] text-white text-xs uppercase tracking-widest font-medium rounded-full hover:bg-[#A88A4F] transition-colors"
              >
                View All Creations
              </button>
              <Link
                href="/bespoke"
                className="px-6 py-2.5 border border-[#E8DFC9] text-[#2A241B] text-xs uppercase tracking-widest font-medium rounded-full hover:bg-[#FBF7F0] transition-colors"
              >
                Commission Bespoke
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {filteredProducts.map((p) => (
              <ProductCard
                key={p.id}
                id={p.id}
                code={p.code}
                name={p.name}
                slug={p.slug}
                subtitle={p.subtitle}
                category={p.category}
                primaryPhotoUrl={p.primaryPhotoUrl}
                secondaryPhotoUrl={p.secondaryPhotoUrl}
                craftingLeadDays={p.craftingLeadDays}
                isFeatured={p.isFeatured}
                isSet={p.isSet}
                setLabel={p.setLabel}
                price={p.price}
              />
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
