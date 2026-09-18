'use client'

import React from 'react'
import Link from 'next/link'
import StoreLayout from '@/components/d2c/StoreLayout'
import { useCart } from '@/components/d2c/CartContext'
import { ShoppingBag, Trash2, Plus, Minus, ShieldCheck, ArrowRight, ArrowLeft } from 'lucide-react'

export default function CartPage() {
  const { items, updateQuantity, removeItem, clearCart, formattedSubtotal, market, itemCount } = useCart()

  return (
    <StoreLayout>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-center justify-between pb-6 border-b border-[#E3DBD4] mb-8">
          <div>
            <h1 className="font-serif text-3xl sm:text-4xl text-[#051F34] font-normal">
              Shopping Bag
            </h1>
            <p className="text-xs text-[#69727D] mt-1 font-sans">
              Review your handcrafted selections ({itemCount} {itemCount === 1 ? 'item' : 'items'})
            </p>
          </div>

          <Link
            href="/jewellery"
            className="hidden sm:inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.2em] font-sans text-[#CB9274] hover:text-[#051F34] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Continue Shopping</span>
          </Link>
        </div>

        {items.length === 0 ? (
          <div className="text-center py-20 bg-white border border-[#E3DBD4] space-y-4">
            <div className="w-16 h-16 bg-[#F6F4F2] border border-[#E3DBD4] text-[#CB9274] flex items-center justify-center mx-auto">
              <ShoppingBag className="w-8 h-8" />
            </div>
            <h2 className="font-serif text-2xl text-[#051F34] font-normal">Your Shopping Bag is Empty</h2>
            <p className="text-xs text-[#69727D] max-w-sm mx-auto font-sans leading-relaxed">
              Explore our fine jewellery collections and bespoke masterworks.
            </p>
            <div className="pt-2">
              <Link
                href="/jewellery"
                className="inline-block px-8 py-3.5 bg-[#051F34] hover:bg-[#CB9274] text-white text-[11px] uppercase tracking-[0.2em] font-sans font-medium transition-colors"
              >
                Discover Jewellery
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
            {/* Items Column (8 cols) */}
            <div className="lg:col-span-8 space-y-4">
              <div className="bg-white border border-[#E3DBD4] divide-y divide-[#E3DBD4] overflow-hidden">
                {items.map((it) => (
                  <div key={it.id} className="p-6 flex flex-col sm:flex-row gap-6">
                    {/* Image */}
                    <div className="w-24 h-24 sm:w-28 sm:h-28 bg-[#F6F4F2] border border-[#E3DBD4] overflow-hidden shrink-0 relative">
                      {it.photoUrl ? (
                        <img src={it.photoUrl} alt={it.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center font-serif text-stone-300 text-xs">
                          SHEWAH
                        </div>
                      )}
                    </div>

                    {/* Meta */}
                    <div className="flex-1 flex flex-col justify-between space-y-3">
                      <div>
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <span className="text-[10px] uppercase tracking-[0.2em] font-sans text-[#CB9274] font-medium">
                              {it.category || 'Fine Jewellery'}
                            </span>
                            <h3 className="font-serif text-base sm:text-lg font-normal text-[#051F34]">
                              {it.name}
                            </h3>
                          </div>
                          <span className="text-sm sm:text-base font-semibold text-[#051F34] font-sans">
                            {it.formattedLineTotal}
                          </span>
                        </div>

                        {/* Specs */}
                        <div className="text-xs text-[#69727D] mt-1 space-y-0.5 font-sans">
                          {it.config?.metalTone && (
                            <span className="capitalize">{it.config.metalTone} Gold • </span>
                          )}
                          {it.config?.diamondType && (
                            <span className="capitalize">
                              {it.config.diamondType === 'natural' ? 'Natural Diamond' : 'Lab-Grown Diamond'} • 
                            </span>
                          )}
                          {it.config?.ringSize && (
                            <span> Size: {it.config.ringSize}</span>
                          )}
                        </div>
                      </div>

                      {/* Controls */}
                      <div className="flex items-center justify-between pt-2">
                        <div className="flex items-center border border-[#E3DBD4] bg-white">
                          <button
                            onClick={() => updateQuantity(it.id, it.quantity - 1)}
                            className="p-1.5 text-[#69727D] hover:text-[#051F34] transition-colors"
                            aria-label="Decrease quantity"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="px-3 text-xs font-sans font-medium text-[#051F34]">{it.quantity}</span>
                          <button
                            onClick={() => updateQuantity(it.id, it.quantity + 1)}
                            className="p-1.5 text-[#69727D] hover:text-[#051F34] transition-colors"
                            aria-label="Increase quantity"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <button
                          onClick={() => removeItem(it.id)}
                          className="inline-flex items-center gap-1.5 text-xs text-[#69727D] hover:text-red-600 transition-colors font-sans"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Remove</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between text-xs text-[#69727D] pt-2 font-sans">
                <button onClick={clearCart} className="hover:text-red-600 underline">
                  Empty Bag
                </button>
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-[#CB9274]" />
                  Secure, encrypted transaction
                </span>
              </div>
            </div>

            {/* Summary Column (4 cols) */}
            <div className="lg:col-span-4">
              <div className="bg-white border border-[#E3DBD4] p-6 sm:p-8 space-y-6 shadow-sm sticky top-28">
                <h3 className="font-serif text-lg font-normal text-[#051F34] pb-4 border-b border-[#E3DBD4]">
                  Order Summary
                </h3>

                <div className="space-y-3 text-xs font-sans">
                  <div className="flex items-center justify-between text-[#69727D]">
                    <span>Subtotal</span>
                    <span className="font-medium text-[#051F34]">{formattedSubtotal}</span>
                  </div>

                  <div className="flex items-center justify-between text-[#69727D]">
                    <span>Shipping ({market.countryName})</span>
                    <span className="font-medium text-[#5C7F5F]">Complimentary Express</span>
                  </div>

                  <div className="pt-3 border-t border-[#E3DBD4]">
                    <div className="flex items-center justify-between font-serif text-base text-[#051F34]">
                      <span>Estimated Total</span>
                      <span className="font-sans font-semibold text-[#051F34]">{formattedSubtotal}</span>
                    </div>
                    <p className="text-[11px] text-[#69727D] mt-1">
                      {market.taxDisclaimer}
                    </p>
                  </div>
                </div>

                <div className="pt-2">
                  <Link
                    href="/checkout"
                    className="w-full py-4 px-6 bg-[#051F34] hover:bg-[#CB9274] text-white text-[11px] uppercase tracking-[0.2em] font-sans font-medium transition-colors shadow-sm flex items-center justify-center gap-2"
                  >
                    <span>Proceed to Checkout</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </StoreLayout>
  )
}
