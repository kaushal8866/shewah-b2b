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
    const list = [{ key: 'all', label: 'All Masterworks' }]
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
    <section className="py-20 sm:py-24 bg-white border-b border-[#E8DFC9]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div className="space-y-2">
            <span className="text-[10px] uppercase tracking-[0.35em] text-[#A88A4F] font-semibold block">
              Curated Atelier Merchandising
            </span>
            <h2 className="font-serif text-3xl sm:text-4xl text-[#2A241B] font-light">
              Signature Creations
            </h2>
            <p className="text-xs sm:text-sm text-[#5C5347] font-light max-w-xl">
              Each piece is individual in creation, certified by international gemological authorities, and cast in solid gold alloys.
            </p>
          </div>

          {/* Interactive Filter Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 scrollbar-none">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2 text-xs uppercase tracking-widest rounded-full transition-all whitespace-nowrap ${
                  activeTab === tab.key
                    ? 'bg-[#2A241B] text-white font-medium shadow-sm'
                    : 'bg-[#FBF7F0] border border-[#E8DFC9] text-[#5C5347] hover:border-[#2A241B] hover:text-[#2A241B]'
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
        <div className="pt-14 text-center">
          <Link
            href="/jewellery"
            className="inline-flex items-center gap-2 px-8 py-3.5 bg-[#FBF7F0] border border-[#E8DFC9] text-[#2A241B] text-xs uppercase tracking-widest font-semibold rounded-full hover:bg-[#2A241B] hover:text-white transition-all shadow-sm"
          >
            <span>Explore Entire Jewellery Vault</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  )
}
