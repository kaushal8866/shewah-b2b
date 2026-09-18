'use client'

import React from 'react'
import Link from 'next/link'
import { Heart, Sparkles, ArrowRight, ShieldCheck } from 'lucide-react'
import { useWishlist } from '@/lib/wishlistStore'
import { trackEvent } from '@/lib/analytics'

export interface ProductCardProps {
  id: string
  code: string
  name: string
  slug: string
  subtitle?: string
  category: string
  primaryPhotoUrl: string | null
  secondaryPhotoUrl?: string | null
  craftingLeadDays?: number
  isFeatured?: boolean
  isSet?: boolean
  setLabel?: string | null
  price: {
    amount: number
    compareAt: number | null
    currency: string
    formatted: string
    taxLabel?: string
    isAvailable?: boolean
  }
}

export default function ProductCard({
  id,
  code,
  name,
  slug,
  subtitle,
  category,
  primaryPhotoUrl,
  secondaryPhotoUrl,
  craftingLeadDays = 14,
  isFeatured,
  isSet,
  setLabel,
  price,
}: ProductCardProps) {
  const { isInWishlist, toggleWishlist } = useWishlist()
  const wishlisted = isInWishlist(id)

  const handleWishlistClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    toggleWishlist({
      id,
      slug,
      name,
      category,
      priceFormatted: price.formatted,
      photoUrl: primaryPhotoUrl,
      subtitle,
    })
    trackEvent('wishlist_add', {
      productId: id,
      productName: name,
      price: price.amount,
      currency: price.currency,
    })
  }

  const handleCardClick = () => {
    trackEvent('product_click', {
      productId: id,
      productName: name,
      price: price.amount,
      currency: price.currency,
      category,
    })
  }

  const fallbackPhoto = 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=800&q=80'
  const displayPrimary = primaryPhotoUrl || fallbackPhoto
  const displaySecondary = secondaryPhotoUrl || displayPrimary

  return (
    <div className="group relative flex flex-col bg-white rounded-2xl border border-[#E8DFC9] overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300">
      {/* Photo Viewport */}
      <Link
        href={`/jewellery/${slug}`}
        onClick={handleCardClick}
        className="relative aspect-square bg-[#FBF7F0] overflow-hidden block"
      >
        {/* Primary Photo */}
        <img
          src={displayPrimary}
          alt={name}
          className={`w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 ${
            secondaryPhotoUrl ? 'group-hover:opacity-0 transition-opacity' : ''
          }`}
          loading="lazy"
        />

        {/* Secondary Hover Photo if present */}
        {secondaryPhotoUrl && (
          <img
            src={displaySecondary}
            alt={`${name} detail`}
            className="absolute inset-0 w-full h-full object-cover opacity-0 group-hover:opacity-100 group-hover:scale-105 transition-all duration-700"
            loading="lazy"
          />
        )}

        {/* Top Badges */}
        <div className="absolute top-3 left-3 flex flex-col gap-1.5 z-10">
          {isSet ? (
            <span className="px-2.5 py-1 bg-[#2A241B] text-[#C9A86A] text-[9px] uppercase tracking-widest font-semibold rounded-full shadow-md">
              Curated Suite
            </span>
          ) : isFeatured ? (
            <span className="px-2.5 py-1 bg-[#A88A4F] text-white text-[9px] uppercase tracking-widest font-medium rounded-full shadow-md">
              Featured
            </span>
          ) : null}
        </div>

        {/* Wishlist Bookmark Button */}
        <button
          onClick={handleWishlistClick}
          aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
          className="absolute top-3 right-3 p-2 rounded-full bg-white/90 backdrop-blur-sm border border-[#E8DFC9] text-[#2A241B] hover:text-[#A88A4F] hover:bg-white shadow-sm transition-all z-10 active:scale-95"
        >
          <Heart
            className={`w-4 h-4 transition-colors ${
              wishlisted ? 'fill-[#A88A4F] text-[#A88A4F]' : 'text-[#2A241B]'
            }`}
          />
        </button>

        {/* Quick Made-to-Order Lead Overlay */}
        <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity bg-white/95 backdrop-blur-md px-2.5 py-1 rounded-lg text-[9px] text-[#5C5347] border border-[#E8DFC9]/60">
          <span>Made to order in solid gold</span>
          <span className="font-mono text-[#A88A4F]">{craftingLeadDays}d craft</span>
        </div>
      </Link>

      {/* Card Content & Pricing */}
      <div className="p-4 flex-1 flex flex-col justify-between space-y-3 bg-white">
        <div className="space-y-1">
          <div className="text-[10px] uppercase tracking-widest text-[#A88A4F] font-medium">
            {isSet ? (setLabel || 'Curated Suite') : category}
          </div>
          <Link
            href={`/jewellery/${slug}`}
            onClick={handleCardClick}
            className="block"
          >
            <h3 className="font-serif text-base text-[#2A241B] group-hover:text-[#A88A4F] transition-colors line-clamp-1 font-medium">
              {name}
            </h3>
          </Link>
          {subtitle && (
            <p className="text-xs text-[#5C5347] line-clamp-1 font-light">
              {subtitle}
            </p>
          )}
        </div>

        {/* Price & Action */}
        <div className="pt-2 border-t border-[#E8DFC9] flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="flex items-baseline gap-2">
              <span className="font-serif text-base font-semibold text-[#2A241B]">
                {price.formatted}
              </span>
              {price.compareAt && price.compareAt > price.amount && (
                <span className="text-xs text-[#8C8275] line-through font-mono">
                  {price.currency} {price.compareAt.toLocaleString()}
                </span>
              )}
            </div>
            {price.taxLabel && (
              <span className="text-[10px] text-[#8C8275] block font-light">
                {price.taxLabel}
              </span>
            )}
          </div>

          <Link
            href={`/jewellery/${slug}`}
            onClick={handleCardClick}
            className="px-3 py-1.5 bg-[#FBF7F0] hover:bg-[#2A241B] text-[#2A241B] hover:text-white border border-[#E8DFC9] rounded-full text-[10px] uppercase tracking-wider font-semibold transition-all flex items-center gap-1"
          >
            <span>Configure</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>
    </div>
  )
}
