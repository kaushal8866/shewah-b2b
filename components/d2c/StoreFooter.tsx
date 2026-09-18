'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { Diamond, ShieldCheck, Mail, ArrowRight, Check } from 'lucide-react'
import { DEFAULT_NON_EMPTY_CATEGORIES } from '@/lib/categories'

export default function StoreFooter() {
  const [email, setEmail] = useState('')
  const [subscribed, setSubscribed] = useState(false)
  const [collections, setCollections] = useState(DEFAULT_NON_EMPTY_CATEGORIES)

  useEffect(() => {
    let cancelled = false
    async function loadCategories() {
      try {
        const res = await fetch('/api/d2c/categories')
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled && Array.isArray(data.categories)) {
          const nonEmpties = data.categories.filter((c: any) => c.key !== 'all' && c.count > 0)
          if (nonEmpties.length > 0) {
            setCollections(nonEmpties)
          }
        }
      } catch {
        // Safe fallback already active
      }
    }
    loadCategories()
    return () => { cancelled = true }
  }, [])

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault()
    if (email.trim()) {
      setSubscribed(true)
    }
  }

  return (
    <footer className="bg-[#051F34] text-[#F6F4F2] border-t border-[#E3DBD4]/20 pt-20 pb-14">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-8 lg:px-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12 pb-16 border-b border-white/10">
          {/* Col 1: Brand & Atelier */}
          <div className="lg:col-span-2 space-y-4">
            <Link href="/" className="inline-block">
              <span className="font-serif text-2xl tracking-[0.2em] font-normal text-white block">
                SHEWAH
              </span>
              <span className="text-[9px] uppercase tracking-[0.3em] text-[#CB9274] block mt-0.5 font-sans font-medium">
                High Jewellery
              </span>
            </Link>
            <p className="text-xs text-stone-300 max-w-sm leading-relaxed font-normal">
              Handcrafted in solid 18K gold and set with certified diamonds.
              Every creation is made individually to order, pairing clean architectural design with dedicated craftsmanship.
            </p>
            <div className="pt-2 flex items-center gap-2.5 text-xs text-[#CB9274]">
              <ShieldCheck className="w-4 h-4 stroke-[1.5]" />
              <span className="tracking-wide">Made to Order • Certified Diamonds</span>
            </div>
          </div>

          {/* Col 2: High Jewellery */}
          <div className="space-y-3">
            <h4 className="font-sans text-[11px] uppercase tracking-[0.16em] font-semibold text-[#CB9274]">
              Collections
            </h4>
            <ul className="space-y-2.5 text-xs text-stone-300">
              {collections.map((col) => (
                <li key={col.key}>
                  <Link href={col.href} className="hover:text-white transition-colors tracking-wide">
                    {col.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/bespoke" className="hover:text-white transition-colors tracking-wide">
                  Bespoke Commissions
                </Link>
              </li>
              <li>
                <Link href="/diamonds" className="hover:text-white transition-colors tracking-wide">
                  Diamond Guide
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 3: Client Care & Policies */}
          <div className="space-y-3">
            <h4 className="font-sans text-[11px] uppercase tracking-[0.16em] font-semibold text-[#CB9274]">
              Client Care
            </h4>
            <ul className="space-y-2.5 text-xs text-stone-300">
              <li>
                <Link href="/consultation" className="hover:text-white transition-colors tracking-wide">
                  Book Consultation
                </Link>
              </li>
              <li>
                <Link href="/ring-size-guide" className="hover:text-white transition-colors tracking-wide">
                  Ring Size Guide & Sizer
                </Link>
              </li>
              <li>
                <Link href="/shipping" className="hover:text-white transition-colors tracking-wide">
                  Shipping & Delivery
                </Link>
              </li>
              <li>
                <Link href="/returns" className="hover:text-white transition-colors tracking-wide">
                  14-Day Return Policy
                </Link>
              </li>
              <li>
                <Link href="/care" className="hover:text-white transition-colors tracking-wide">
                  Jewellery Care
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 4: Newsletter / Private Client Register */}
          <div className="space-y-4">
            <h4 className="font-sans text-[11px] uppercase tracking-[0.16em] font-semibold text-[#CB9274]">
              Private Journal
            </h4>
            <p className="text-xs text-stone-300 leading-relaxed">
              Receive private invitations to new suite releases and private atelier events.
            </p>

            {subscribed ? (
              <div className="p-3 bg-white/5 border border-[#CB9274]/40 text-xs text-[#CB9274] flex items-center gap-2">
                <Check className="w-4 h-4" />
                <span>Thank you. You are registered.</span>
              </div>
            ) : (
              <form onSubmit={handleSubscribe} className="space-y-2">
                <div className="relative">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email address"
                    className="w-full bg-white/10 border border-white/20 px-3.5 py-2.5 text-xs text-white placeholder-stone-400 focus:outline-none focus:border-[#CB9274] transition-colors"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-white text-[#051F34] hover:bg-[#CB9274] hover:text-white px-4 py-2.5 text-[11px] uppercase tracking-[0.16em] font-semibold transition-colors"
                >
                  Join Register
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Bottom Bar: Copyright & Discrete Trade Access */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-stone-400">
          <p>© {new Date().getFullYear()} SHEWAH High Jewellery. All rights reserved.</p>
          <div className="flex items-center gap-6 text-[11px]">
            <Link href="/shipping" className="hover:text-white transition-colors">
              Privacy & Terms
            </Link>
            <span className="text-white/20 select-none">•</span>
            <Link href="/business" className="hover:text-[#CB9274] transition-colors tracking-widest uppercase font-medium">
              Trade / B2B Portal
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
