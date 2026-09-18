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
          className="w-screen max-w-md bg-[#F6F4F2] text-[#051F34] shadow-2xl flex flex-col border-l border-[#E3DBD4]"
          style={{ backgroundColor: '#F6F4F2' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-[#E3DBD4] bg-white">
            <div className="flex items-center gap-2.5">
              <ShoppingBag className="w-5 h-5 text-[#CB9274]" />
              <h2 className="font-serif text-xl tracking-wide uppercase font-normal text-[#051F34]">
                Shopping Bag ({itemCount})
              </h2>
            </div>
            <button
              onClick={closeCart}
              className="p-1.5 text-[#69727D] hover:text-[#051F34] transition-colors"
              aria-label="Close bag"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Delivery banner */}
          <div className="bg-[#F6F4F2] px-6 py-2.5 border-b border-[#E3DBD4] text-xs text-[#69727D] flex items-center justify-between font-sans">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#CB9274]" />
              Insured courier delivery ({market.countryName})
            </span>
            <span className="font-medium text-[#051F34]">Included</span>
          </div>

          {/* Cart items list */}
          <div className="flex-1 overflow-y-auto px-6 py-4 divide-y divide-[#E3DBD4]">
            {items.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-12 text-[#69727D]">
                <div className="w-14 h-14 bg-white border border-[#E3DBD4] flex items-center justify-center mb-4 text-[#CB9274]">
                  <ShoppingBag className="w-7 h-7" />
                </div>
                <h3 className="font-serif text-xl text-[#051F34] mb-2 font-normal">Your bag is empty</h3>
                <p className="text-xs max-w-xs mb-6 text-[#69727D] leading-relaxed">
                  Discover our curated fine jewellery collections handcrafted in solid gold.
                </p>
                <Link
                  href="/jewellery"
                  onClick={closeCart}
                  className="px-6 py-3 bg-[#051F34] hover:bg-[#CB9274] text-white text-[11px] uppercase tracking-[0.2em] font-sans font-medium transition-colors"
                >
                  Explore Jewellery
                </Link>
              </div>
            ) : (
              items.map((it) => (
                <div key={it.id} className="py-4 flex gap-4">
                  {/* Thumbnail */}
                  <div className="w-20 h-20 bg-white border border-[#E3DBD4] overflow-hidden shrink-0 relative">
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
                        <h4 className="font-serif text-sm font-normal leading-snug line-clamp-2 text-[#051F34]">
                          {it.name}
                        </h4>
                        <span className="text-xs font-semibold whitespace-nowrap text-[#051F34] font-sans">
                          {it.formattedLineTotal}
                        </span>
                      </div>
                      
                      {/* Variant tags */}
                      <div className="text-[11px] text-[#69727D] mt-1 space-y-0.5 font-sans">
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
                          <div className="text-[#69727D]">Size: {it.config.ringSize}</div>
                        )}
                      </div>
                    </div>

                    {/* Quantity controls */}
                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center border border-[#E3DBD4] bg-white">
                        <button
                          onClick={() => updateQuantity(it.id, it.quantity - 1)}
                          className="p-1 text-[#69727D] hover:text-[#051F34] transition-colors"
                          aria-label="Decrease quantity"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="px-2.5 text-xs font-medium font-sans text-[#051F34]">{it.quantity}</span>
                        <button
                          onClick={() => updateQuantity(it.id, it.quantity + 1)}
                          className="p-1 text-[#69727D] hover:text-[#051F34] transition-colors"
                          aria-label="Increase quantity"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <button
                        onClick={() => removeItem(it.id)}
                        className="text-[#69727D] hover:text-red-600 transition-colors p-1"
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
            <div className="p-6 border-t border-[#E3DBD4] bg-white space-y-4">
              <div className="space-y-1 text-sm font-sans">
                <div className="flex items-center justify-between font-serif text-base text-[#051F34]">
                  <span>Subtotal</span>
                  <span className="font-sans font-semibold text-[#051F34]">{formattedSubtotal}</span>
                </div>
                <p className="text-[11px] text-[#69727D]">
                  {market.taxDisclaimer} Shipping calculated at checkout.
                </p>
              </div>

              <div className="space-y-2 pt-2">
                <Link
                  href="/checkout"
                  onClick={closeCart}
                  className="w-full flex items-center justify-center gap-2 py-3.5 px-4 bg-[#051F34] hover:bg-[#CB9274] text-white text-[11px] uppercase tracking-[0.2em] font-sans font-medium transition-colors shadow-sm"
                >
                  <span>Proceed to Checkout</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>

                <Link
                  href="/cart"
                  onClick={closeCart}
                  className="w-full flex items-center justify-center py-2.5 text-[11px] text-[#051F34] uppercase tracking-[0.18em] font-sans font-medium hover:text-[#CB9274] transition-colors text-center border border-[#E3DBD4] hover:border-[#051F34]"
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
