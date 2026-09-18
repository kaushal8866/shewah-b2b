'use client'

import React, { useState, useMemo } from 'react'
import Link from 'next/link'
import { ArrowRight, Sparkles } from 'lucide-react'
import ProductCard, { type ProductCardProps } from './ProductCard'

interface SignatureCollectionsProps {
  products: ProductCardProps[]
}

export default function SignatureCollections({ products }: SignatureCollectionsProps) {
  const [activeTab, setActiveTab] = useState<string>('all')

  const availableCategories = useMemo(() => {
    const cats = new Set<string>()
    products.forEach((p) => {
      if (p.category) cats.add(p.category)
    })
    return Array.from(cats)
  }, [products])

  const tabs = useMemo(() => {
    const list = [{ key: 'all', label: 'All Creations' }]
    if (availableCategories.includes('necklaces')) {
      list.push({ key: 'necklaces', label: 'Necklaces & Pendants' })
    }
    if (availableCategories.includes('earrings')) {
      list.push({ key: 'earrings', label: 'Diamond Earrings' })
    }
    if (availableCategories.includes('rings')) {
      list.push({ key: 'rings', label: 'Rings & Bands' })
    }
    return list
  }, [availableCategories])

  const displayedProducts = useMemo(() => {
    if (activeTab === 'all') {
      return products.slice(0, 8)
    }
    return products.filter((p) => p.category === activeTab).slice(0, 8)
  }, [products, activeTab])

  if (!products || products.length === 0) return null

  return (
    <section className="py-20 sm:py-28 bg-white border-b border-[#E3DBD4]">
      <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-14">
          <div className="space-y-3">
            <span className="text-[11px] uppercase tracking-[0.25em] text-[#CB9274] font-medium block">
              Curated Selections
            </span>
            <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl text-[#051F34] font-normal tracking-tight">
              Signature Creations
            </h2>
            <p className="text-sm text-[#69727D] font-light max-w-xl">
              Each piece is individually crafted in solid 18K gold and set with certified diamonds to order.
            </p>
          </div>

          {/* Interactive Filter Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 scrollbar-none">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-5 py-2.5 text-[11px] uppercase tracking-[0.2em] rounded-none transition-all whitespace-nowrap ${
                  activeTab === tab.key
                    ? 'bg-[#051F34] text-white border border-[#051F34] font-semibold'
                    : 'bg-transparent border border-[#E3DBD4] text-[#69727D] hover:border-[#051F34] hover:text-[#051F34]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Product Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 sm:gap-8">
          {displayedProducts.map((product) => (
            <ProductCard key={product.id} {...product} />
          ))}
        </div>

        {/* Bottom Catalog Action */}
        <div className="pt-16 text-center">
          <Link
            href="/jewellery"
            className="inline-flex items-center gap-2 px-9 py-4 bg-transparent border border-[#051F34] text-[#051F34] text-xs uppercase tracking-[0.2em] font-semibold hover:bg-[#051F34] hover:text-white transition-all duration-300"
          >
            <span>Explore Entire Collection</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </section>
  )
}
