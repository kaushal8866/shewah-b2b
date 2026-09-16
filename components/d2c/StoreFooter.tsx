'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { Diamond, ShieldCheck, Mail, ArrowRight, Check } from 'lucide-react'

export default function StoreFooter() {
  const [email, setEmail] = useState('')
  const [subscribed, setSubscribed] = useState(false)

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault()
    if (email.trim()) {
      setSubscribed(true)
    }
  }

  return (
    <footer className="bg-[#2A241B] text-[#FBF7F0] border-t border-[#3D3528] pt-16 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 pb-16 border-b border-white/10">
          {/* Col 1: Brand & Atelier */}
          <div className="lg:col-span-2 space-y-4">
            <Link href="/" className="inline-block">
              <span className="font-serif text-2xl tracking-[0.25em] font-medium text-white block">
                SHEWAH
              </span>
              <span className="text-[10px] uppercase tracking-[0.35em] text-[#C9A86A] block mt-0.5">
                Atelier & High Jewellery
              </span>
            </Link>
            <p className="text-xs text-[#8C8275] max-w-sm leading-relaxed">
              Crafted in solid gold and set with certified diamonds in Antwerp and Surat.
              Every creation is individually made to order, combining centuries of artisanal heritage with modern design.
            </p>
            <div className="pt-2 flex items-center gap-3 text-xs text-[#C9A86A]">
              <ShieldCheck className="w-4 h-4" />
              <span>Certified Authenticity • Made to Order</span>
            </div>
          </div>

          {/* Col 2: High Jewellery */}
          <div className="space-y-3">
            <h4 className="font-serif text-sm uppercase tracking-widest text-[#C9A86A]">
              Collections
            </h4>
            <ul className="space-y-2 text-xs text-[#8C8275]">
              <li>
                <Link href="/jewellery?category=rings" className="hover:text-white transition-colors">
                  Solitaire Rings & Bands
                </Link>
              </li>
              <li>
                <Link href="/jewellery?category=necklaces" className="hover:text-white transition-colors">
                  Necklaces & Pendants
                </Link>
              </li>
              <li>
                <Link href="/jewellery?category=earrings" className="hover:text-white transition-colors">
                  Diamond Earrings
                </Link>
              </li>
              <li>
                <Link href="/jewellery?category=bracelets" className="hover:text-white transition-colors">
                  Tennis Bracelets
                </Link>
              </li>
              <li>
                <Link href="/bespoke" className="hover:text-white transition-colors">
                  Bespoke Commissions
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 3: Client Care & Policies */}
          <div className="space-y-3">
            <h4 className="font-serif text-sm uppercase tracking-widest text-[#C9A86A]">
              Client Care
            </h4>
            <ul className="space-y-2 text-xs text-[#8C8275]">
              <li>
                <Link href="/shipping" className="hover:text-white transition-colors">
                  Shipping & Delivery Policy
                </Link>
              </li>
              <li>
                <Link href="/returns" className="hover:text-white transition-colors">
                  Returns & Resizing
                </Link>
              </li>
              <li>
                <Link href="/warranty" className="hover:text-white transition-colors">
                  Warranty & Servicing
                </Link>
              </li>
              <li>
                <Link href="/care" className="hover:text-white transition-colors">
                  Jewellery Care Guide
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-white transition-colors">
                  Concierge & Appointments
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 4: Business & Trade */}
          <div className="space-y-3">
            <h4 className="font-serif text-sm uppercase tracking-widest text-[#C9A86A]">
              Trade & Wholesale
            </h4>
            <ul className="space-y-2 text-xs text-[#8C8275]">
              <li>
                <Link href="/business" className="hover:text-white transition-colors">
                  Shewah for Retailers
                </Link>
              </li>
              <li>
                <Link href="/business/enquiry" className="hover:text-white transition-colors">
                  B2B Trade Enquiry
                </Link>
              </li>
              <li>
                <Link href="/login" className="hover:text-white transition-colors">
                  Partner Portal Login
                </Link>
              </li>
              <li>
                <Link href="/diamonds" className="hover:text-white transition-colors">
                  Diamond Procurement
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Newsletter & Copyright Bottom Row */}
        <div className="pt-10 flex flex-col md:flex-row items-center justify-between gap-6 text-xs text-[#8C8275]">
          <div>
            <p>© {new Date().getFullYear()} SHEWAH Atelier. All rights reserved.</p>
            <p className="text-[11px] mt-1 text-stone-500">
              International high jewellery crafted especially for you.
            </p>
          </div>

          <div className="flex items-center gap-6 text-[11px]">
            <Link href="/shipping" className="hover:text-white transition-colors">
              Terms & Conditions
            </Link>
            <Link href="/returns" className="hover:text-white transition-colors">
              Privacy Policy
            </Link>
            <Link href="/business" className="hover:text-white transition-colors">
              Trade Terms
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
