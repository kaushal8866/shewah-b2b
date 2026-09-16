'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import StoreLayout from '@/components/d2c/StoreLayout'
import { useWishlist } from '@/lib/wishlistStore'
import { Heart, Diamond, ArrowRight, Trash2, ShoppingBag } from 'lucide-react'

export default function WishlistPage() {
  const { items, removeFromWishlist, clearWishlist } = useWishlist()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <StoreLayout>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
          <p className="text-xs text-[#8C8275]">Loading your saved pieces&hellip;</p>
        </div>
      </StoreLayout>
    )
  }

  return (
    <StoreLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-20">
        {/* Header */}
        <div className="text-center space-y-3 pb-8 border-b border-[#E8DFC9]">
          <div className="w-14 h-14 rounded-full bg-[#F4ECDD] text-[#A88A4F] flex items-center justify-center mx-auto mb-1">
            <Heart className="w-7 h-7 fill-[#A88A4F]" />
          </div>
          <span className="text-[10px] uppercase tracking-[0.35em] text-[#A88A4F] font-semibold">
            Private Client Selection
          </span>
          <h1 className="font-serif text-3xl sm:text-5xl text-[#2A241B] font-light">
            Your Saved Pieces
          </h1>
          <p className="text-xs sm:text-sm text-[#5C5347] max-w-md mx-auto leading-relaxed">
            Curated masterworks you have marked to compare, personalize, or share with a loved one.
          </p>

          {items.length > 0 && (
            <div className="pt-2 flex items-center justify-center gap-4 text-xs">
              <span className="text-[#8C8275]">
                {items.length} {items.length === 1 ? 'creation saved' : 'creations saved'}
              </span>
              <span className="text-stone-300">•</span>
              <button
                onClick={clearWishlist}
                className="text-stone-400 hover:text-red-600 transition-colors uppercase tracking-wider text-[10px]"
              >
                Clear All
              </button>
            </div>
          )}
        </div>

        {/* Content */}
        {items.length === 0 ? (
          <div className="py-20 text-center space-y-6 max-w-md mx-auto">
            <Diamond className="w-10 h-10 text-[#A88A4F] mx-auto opacity-70" />
            <h3 className="font-serif text-xl text-[#2A241B]">Your wishlist is currently empty</h3>
            <p className="text-xs text-[#5C5347] leading-relaxed">
              Explore our fine jewellery collections and click the heart icon on any piece to save it here for future consideration.
            </p>
            <div className="pt-2">
              <Link
                href="/jewellery"
                className="inline-block px-8 py-3.5 bg-[#2A241B] text-white text-xs uppercase tracking-widest font-semibold rounded-full hover:bg-[#A88A4F] transition-all shadow-md"
              >
                Explore Fine Jewellery →
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 pt-10">
            {items.map((item) => (
              <div
                key={item.id}
                className="group flex flex-col bg-white rounded-2xl border border-[#E8DFC9] overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300"
              >
                {/* Photo */}
                <div className="relative aspect-square bg-[#FBF7F0] overflow-hidden">
                  <Link href={`/jewellery/${item.slug}`} className="block w-full h-full">
                    {item.photoUrl ? (
                      <img
                        src={item.photoUrl}
                        alt={item.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center font-serif text-stone-300 text-sm">
                        SHEWAH ATELIER
                      </div>
                    )}
                  </Link>

                  {/* Remove button */}
                  <button
                    type="button"
                    onClick={() => removeFromWishlist(item.id)}
                    className="absolute top-3 right-3 p-2 rounded-full bg-white/90 text-[#5C5347] hover:bg-red-50 hover:text-red-600 transition-all shadow-sm"
                    aria-label="Remove from saved pieces"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Details */}
                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-[#A88A4F] font-semibold">
                      {item.category || 'Fine Jewellery'}
                    </span>
                    <h3 className="font-serif text-base font-medium text-[#2A241B] leading-snug line-clamp-1 mt-0.5">
                      <Link href={`/jewellery/${item.slug}`} className="hover:text-[#A88A4F] transition-colors">
                        {item.name}
                      </Link>
                    </h3>
                    {item.subtitle && (
                      <p className="text-xs text-[#5C5347] line-clamp-1 font-light mt-0.5">
                        {item.subtitle}
                      </p>
                    )}
                    <p className="font-serif text-base text-[#2A241B] font-semibold mt-2">
                      {item.priceFormatted}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-[#E8DFC9] flex items-center justify-between gap-2">
                    <Link
                      href={`/jewellery/${item.slug}`}
                      className="flex-1 py-2.5 px-4 bg-[#2A241B] text-white text-[11px] uppercase tracking-wider text-center font-semibold rounded-xl hover:bg-[#A88A4F] transition-colors shadow-sm"
                    >
                      View Piece →
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </StoreLayout>
  )
}
