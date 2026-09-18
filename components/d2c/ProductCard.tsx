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
    <div className="group relative flex flex-col bg-white border border-[#E3DBD4] overflow-hidden transition-all duration-300 hover:border-[#051F34]">
      {/* Photo Viewport */}
      <Link
        href={`/jewellery/${slug}`}
        onClick={handleCardClick}
        className="relative aspect-square bg-[#F6F4F2] overflow-hidden block"
      >
        {/* Primary Photo */}
        <img
          src={displayPrimary}
          alt={name}
          className={`w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105 ${
            secondaryPhotoUrl ? 'group-hover:opacity-0 transition-opacity' : ''
          }`}
          loading="lazy"
        />

        {/* Secondary Hover Photo if present */}
        {secondaryPhotoUrl && (
          <img
            src={displaySecondary}
            alt={`${name} detail`}
            className="absolute inset-0 w-full h-full object-cover opacity-0 group-hover:opacity-100 group-hover:scale-105 transition-all duration-700 ease-out"
            loading="lazy"
          />
        )}

        {/* Top Badges */}
        <div className="absolute top-3 left-3 flex flex-col gap-1 z-10">
          {isSet ? (
            <span className="px-2.5 py-1 bg-[#051F34] text-[#CB9274] text-[9px] uppercase tracking-[0.2em] font-semibold">
              Curated Suite
            </span>
          ) : isFeatured ? (
            <span className="px-2.5 py-1 bg-[#CB9274] text-white text-[9px] uppercase tracking-[0.2em] font-semibold">
              Featured
            </span>
          ) : null}
        </div>

        {/* Wishlist Bookmark Button */}
        <button
          onClick={handleWishlistClick}
          aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
          className="absolute top-3 right-3 p-2.5 bg-white/90 backdrop-blur-sm border border-[#E3DBD4] text-[#051F34] hover:text-[#CB9274] hover:bg-white transition-all z-10 active:scale-95"
        >
          <Heart
            className={`w-3.5 h-3.5 transition-colors ${
              wishlisted ? 'fill-[#CB9274] text-[#CB9274]' : 'text-[#051F34]'
            }`}
          />
        </button>

        {/* Quick Made-to-Order Lead Overlay */}
        <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity bg-white/95 backdrop-blur-sm px-3 py-1.5 text-[9px] uppercase tracking-wider text-[#30373E] border-t border-[#E3DBD4]">
          <span>Made to order</span>
          <span className="font-mono text-[#051F34] font-medium">{craftingLeadDays}d craft</span>
        </div>
      </Link>

      {/* Card Content & Pricing */}
      <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-3 bg-white">
        <div className="space-y-1">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#CB9274] font-semibold">
            {isSet ? (setLabel || 'Curated Suite') : category}
          </div>
          <Link
            href={`/jewellery/${slug}`}
            onClick={handleCardClick}
            className="block"
          >
            <h3 className="font-serif text-[17px] leading-snug text-[#051F34] group-hover:text-[#CB9274] transition-colors line-clamp-1 font-normal">
              {name}
            </h3>
          </Link>
          {subtitle && (
            <p className="text-xs text-[#69727D] line-clamp-1 font-light">
              {subtitle}
            </p>
          )}
        </div>

        {/* Price & Action */}
        <div className="pt-3 border-t border-[#E3DBD4] flex items-center justify-between gap-2">
          <div className="space-y-0.5">
            <div className="flex items-baseline gap-2">
              <span className="font-serif text-base font-medium text-[#051F34]">
                {price.formatted}
              </span>
              {price.compareAt && price.compareAt > price.amount && (
                <span className="text-xs text-[#69727D] line-through font-mono">
                  {price.currency} {price.compareAt.toLocaleString()}
                </span>
              )}
            </div>
            {price.taxLabel && (
              <span className="text-[10px] text-[#69727D] block font-light">
                {price.taxLabel}
              </span>
            )}
          </div>

          <Link
            href={`/jewellery/${slug}`}
            onClick={handleCardClick}
            className="px-3 py-1.5 bg-transparent hover:bg-[#051F34] text-[#051F34] hover:text-white border border-[#051F34] text-[10px] uppercase tracking-[0.18em] font-semibold transition-all duration-300 flex items-center gap-1 shrink-0"
          >
            <span>Explore</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>
    </div>
  )
}
