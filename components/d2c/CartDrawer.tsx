'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import Image from 'next/image'
import { useCart } from './CartContext'
import { X, Trash2, Plus, Minus, ShoppingBag, ShieldCheck, ArrowRight } from 'lucide-react'

export default function CartDrawer() {
  const {
    items,
    isCartOpen,
    closeCart,
    updateQuantity,
    removeItem,
    formattedSubtotal,
    market,
    itemCount,
  } = useCart()

  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Lock body scrolling when cart drawer is open
  useEffect(() => {
    if (isCartOpen) {
      const originalOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = originalOverflow
      }
    }
  }, [isCartOpen])

  if (!isCartOpen || !mounted || typeof document === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 z-[100] overflow-hidden">
      {/* Dimmed backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={closeCart}
        aria-hidden="true"
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10 z-10">
        <div
          className="w-screen max-w-md bg-[#FBF7F0] text-[#2A241B] shadow-2xl flex flex-col border-l border-[#E8DFC9]"
          style={{ backgroundColor: '#FBF7F0' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-[#E8DFC9] bg-white">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-[#A88A4F]" />
              <h2 className="font-serif text-xl tracking-wide uppercase font-medium">
                Shopping Bag ({itemCount})
              </h2>
            </div>
            <button
              onClick={closeCart}
              className="p-1.5 text-[#5C5347] hover:text-[#2A241B] rounded-full hover:bg-stone-100 transition-colors"
              aria-label="Close bag"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Delivery banner */}
          <div className="bg-[#F4ECDD] px-6 py-2.5 border-b border-[#E8DFC9] text-xs text-[#5C5347] flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#A88A4F]" />
              Insured priority courier delivery ({market.countryName})
            </span>
            <span className="font-medium text-[#2A241B]">Included</span>
          </div>

          {/* Cart items list */}
          <div className="flex-1 overflow-y-auto px-6 py-4 divide-y divide-[#E8DFC9]">
            {items.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-12 text-[#8C8275]">
                <div className="w-16 h-16 rounded-full bg-[#F4ECDD] flex items-center justify-center mb-4 text-[#A88A4F]">
                  <ShoppingBag className="w-8 h-8" />
                </div>
                <h3 className="font-serif text-lg text-[#2A241B] mb-1">Your bag is empty</h3>
                <p className="text-xs max-w-xs mb-6">
                  Discover our curated high jewellery collections handcrafted in solid gold.
                </p>
                <Link
                  href="/jewellery"
                  onClick={closeCart}
                  className="px-6 py-2.5 bg-[#2A241B] text-white text-xs uppercase tracking-widest font-medium rounded-full hover:bg-stone-800 transition-colors"
                >
                  Explore Jewellery
                </Link>
              </div>
            ) : (
              items.map((it) => (
                <div key={it.id} className="py-4 flex gap-4">
                  {/* Thumbnail */}
                  <div className="w-20 h-20 bg-white rounded-lg border border-[#E8DFC9] overflow-hidden shrink-0 relative">
                    {it.photoUrl ? (
                      <img
                        src={it.photoUrl}
                        alt={it.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-stone-300 font-serif text-xs">
                        SHEWAH
                      </div>
                    )}
                  </div>

                  {/* Details */}
                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-serif text-sm font-medium leading-snug line-clamp-2">
                          {it.name}
                        </h4>
                        <span className="text-xs font-semibold whitespace-nowrap">
                          {it.formattedLineTotal}
                        </span>
                      </div>
                      
                      {/* Variant tags */}
                      <div className="text-[11px] text-[#5C5347] mt-1 space-y-0.5">
                        {it.config?.metalTone && (
                          <span className="capitalize">{it.config.metalTone} Gold • </span>
                        )}
                        {it.config?.karat && <span>{it.config.karat}K • </span>}
                        {it.config?.diamondType && (
                          <span className="capitalize">
                            {it.config.diamondType === 'natural' ? 'Natural Diamond' : 'Lab-Grown Diamond'}
                          </span>
                        )}
                        {it.config?.ringSize && (
                          <div className="text-stone-500">Size: {it.config.ringSize}</div>
                        )}
                      </div>
                    </div>

                    {/* Quantity controls */}
                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center border border-[#E8DFC9] rounded-md bg-white">
                        <button
                          onClick={() => updateQuantity(it.id, it.quantity - 1)}
                          className="p-1 hover:text-[#A88A4F] text-[#5C5347]"
                          aria-label="Decrease quantity"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="px-2 text-xs font-medium font-mono">{it.quantity}</span>
                        <button
                          onClick={() => updateQuantity(it.id, it.quantity + 1)}
                          className="p-1 hover:text-[#A88A4F] text-[#5C5347]"
                          aria-label="Increase quantity"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <button
                        onClick={() => removeItem(it.id)}
                        className="text-stone-400 hover:text-red-600 transition-colors p-1"
                        aria-label="Remove item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer actions */}
          {items.length > 0 && (
            <div className="p-6 border-t border-[#E8DFC9] bg-white space-y-4">
              <div className="space-y-1 text-sm">
                <div className="flex items-center justify-between font-serif text-base">
                  <span>Subtotal</span>
                  <span className="font-semibold">{formattedSubtotal}</span>
                </div>
                <p className="text-[11px] text-[#8C8275]">
                  {market.taxDisclaimer} Shipping calculated at checkout.
                </p>
              </div>

              <div className="space-y-2 pt-2">
                <Link
                  href="/checkout"
                  onClick={closeCart}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-[#2A241B] text-white text-xs uppercase tracking-widest font-medium rounded-lg hover:bg-stone-800 transition-all shadow-md active:scale-[0.99]"
                >
                  <span>Proceed to Checkout</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>

                <Link
                  href="/cart"
                  onClick={closeCart}
                  className="w-full flex items-center justify-center py-2.5 text-xs text-[#5C5347] uppercase tracking-wider font-medium hover:text-[#2A241B] transition-colors text-center"
                >
                  View Full Bag
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
