'use client'

import React from 'react'
import Link from 'next/link'
import StoreLayout from '@/components/d2c/StoreLayout'
import { Heart, Diamond, ArrowRight } from 'lucide-react'

export default function WishlistPage() {
  return (
    <StoreLayout>
      <div className="max-w-4xl mx-auto px-6 py-20 text-center space-y-6">
        <div className="w-16 h-16 rounded-full bg-[#F4ECDD] text-[#A88A4F] flex items-center justify-center mx-auto">
          <Heart className="w-8 h-8" />
        </div>
        <h1 className="font-serif text-3xl sm:text-4xl text-[#2A241B]">
          Your Saved Pieces
        </h1>
        <p className="text-xs text-[#5C5347] max-w-sm mx-auto">
          Save your favorite masterworks to compare designs or share with a loved one.
        </p>
        <div className="pt-4">
          <Link
            href="/jewellery"
            className="inline-block px-8 py-3 bg-[#2A241B] text-white text-xs uppercase tracking-widest font-semibold rounded-full hover:bg-stone-800 transition-colors"
          >
            Explore Fine Jewellery
          </Link>
        </div>
      </div>
    </StoreLayout>
  )
}
