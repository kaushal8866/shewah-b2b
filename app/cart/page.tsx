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
        <div className="flex items-center justify-between pb-6 border-b border-[#E8DFC9] mb-8">
          <div>
            <h1 className="font-serif text-3xl sm:text-4xl text-[#2A241B] font-light">
              Shopping Bag
            </h1>
            <p className="text-xs text-[#5C5347] mt-1">
              Review your handcrafted selections ({itemCount} {itemCount === 1 ? 'item' : 'items'})
            </p>
          </div>

          <Link
            href="/jewellery"
            className="hidden sm:inline-flex items-center gap-1.5 text-xs uppercase tracking-wider text-[#A88A4F] hover:text-[#2A241B] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Continue Shopping</span>
          </Link>
        </div>

        {items.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-[#E8DFC9] space-y-4">
            <div className="w-16 h-16 rounded-full bg-[#F4ECDD] text-[#A88A4F] flex items-center justify-center mx-auto">
              <ShoppingBag className="w-8 h-8" />
            </div>
            <h2 className="font-serif text-2xl text-[#2A241B]">Your Shopping Bag is Empty</h2>
            <p className="text-xs text-[#5C5347] max-w-sm mx-auto">
              Explore our fine jewellery collections and bespoke masterworks.
            </p>
            <div className="pt-2">
              <Link
                href="/jewellery"
                className="inline-block px-8 py-3 bg-[#2A241B] text-white text-xs uppercase tracking-widest font-semibold rounded-full"
              >
                Discover Jewellery
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
            {/* Items Column (8 cols) */}
            <div className="lg:col-span-8 space-y-4">
              <div className="bg-white rounded-2xl border border-[#E8DFC9] divide-y divide-[#E8DFC9] overflow-hidden">
                {items.map((it) => (
                  <div key={it.id} className="p-6 flex flex-col sm:flex-row gap-6">
                    {/* Image */}
                    <div className="w-24 h-24 sm:w-28 sm:h-28 bg-[#FBF7F0] rounded-xl border border-[#E8DFC9] overflow-hidden shrink-0 relative">
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
                            <span className="text-[10px] uppercase tracking-wider text-[#A88A4F] font-semibold">
                              {it.category || 'Fine Jewellery'}
                            </span>
                            <h3 className="font-serif text-base sm:text-lg font-medium text-[#2A241B]">
                              {it.name}
                            </h3>
                          </div>
                          <span className="text-sm sm:text-base font-semibold text-[#2A241B]">
                            {it.formattedLineTotal}
                          </span>
                        </div>

                        {/* Specs */}
                        <div className="text-xs text-[#5C5347] mt-1 space-y-0.5">
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
                        <div className="flex items-center border border-[#E8DFC9] rounded-lg bg-white">
                          <button
                            onClick={() => updateQuantity(it.id, it.quantity - 1)}
                            className="p-1.5 text-[#5C5347] hover:text-[#2A241B]"
                            aria-label="Decrease quantity"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="px-3 text-xs font-mono font-medium">{it.quantity}</span>
                          <button
                            onClick={() => updateQuantity(it.id, it.quantity + 1)}
                            className="p-1.5 text-[#5C5347] hover:text-[#2A241B]"
                            aria-label="Increase quantity"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <button
                          onClick={() => removeItem(it.id)}
                          className="inline-flex items-center gap-1.5 text-xs text-stone-400 hover:text-red-600 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Remove</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between text-xs text-[#8C8275] pt-2">
                <button onClick={clearCart} className="hover:text-red-600 underline">
                  Empty Bag
                </button>
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-[#A88A4F]" />
                  Secure, encrypted transaction
                </span>
              </div>
            </div>

            {/* Summary Column (4 cols) */}
            <div className="lg:col-span-4">
              <div className="bg-white rounded-2xl border border-[#E8DFC9] p-6 space-y-6 shadow-sm sticky top-28">
                <h3 className="font-serif text-lg font-medium text-[#2A241B] pb-4 border-b border-[#E8DFC9]">
                  Order Summary
                </h3>

                <div className="space-y-3 text-xs">
                  <div className="flex items-center justify-between text-[#5C5347]">
                    <span>Subtotal</span>
                    <span className="font-medium text-[#2A241B]">{formattedSubtotal}</span>
                  </div>

                  <div className="flex items-center justify-between text-[#5C5347]">
                    <span>Shipping ({market.countryName})</span>
                    <span className="font-medium text-[#5C7F5F]">Complimentary Express</span>
                  </div>

                  <div className="pt-3 border-t border-[#E8DFC9]">
                    <div className="flex items-center justify-between font-serif text-base text-[#2A241B]">
                      <span>Estimated Total</span>
                      <span className="font-semibold">{formattedSubtotal}</span>
                    </div>
                    <p className="text-[11px] text-[#8C8275] mt-1">
                      {market.taxDisclaimer}
                    </p>
                  </div>
                </div>

                <div className="pt-2">
                  <Link
                    href="/checkout"
                    className="w-full py-3.5 px-6 bg-[#2A241B] text-white text-xs uppercase tracking-widest font-medium rounded-xl hover:bg-stone-800 transition-all shadow-md flex items-center justify-center gap-2"
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
