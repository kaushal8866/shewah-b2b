'use client'

import React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, Sparkles, Diamond, ShieldCheck, Hammer, Award } from 'lucide-react'
import { DEFAULT_NON_EMPTY_CATEGORIES, type D2CCategoryItem } from '@/lib/categories'

interface MegaMenuProps {
  categories?: D2CCategoryItem[]
  onClose: () => void
}

export default function MegaMenu({ categories = DEFAULT_NON_EMPTY_CATEGORIES, onClose }: MegaMenuProps) {
  const styles = [
    { label: 'Solitaire & Engagement', href: '/jewellery?style=solitaire', desc: 'Antwerp brilliant cut focal stones' },
    { label: 'Statement Creations', href: '/jewellery?style=statement', desc: 'Rare architectural high jewellery' },
    { label: 'Minimalist Modern', href: '/jewellery?style=minimal', desc: 'Clean geometric everyday luxury' },
    { label: 'Heritage Suites', href: '/jewellery?style=heritage', desc: 'Matched parures and cascades' },
  ]

  const diamondEducation = [
    { label: 'Natural Mined Diamonds', href: '/diamonds', badge: 'GIA Graded' },
    { label: 'Certified Lab-Grown', href: '/diamonds', badge: 'IGI Laser Inscribed' },
    { label: 'The 4Cs Optical Standards', href: '/diamonds' },
    { label: 'Diamond Shapes Guide', href: '/jewellery' },
  ]

  const atelierServices = [
    { label: 'Book Private Consultation', href: '/consultation', highlight: true },
    { label: 'Bespoke Atelier Commissions', href: '/bespoke' },
    { label: 'Surat Artisans & Casting', href: '/craftsmanship' },
    { label: 'Complimentary Ring Sizer', href: '/ring-size-guide' },
    { label: 'Lifetime Care & Warranty', href: '/warranty' },
  ]

  return (
    <div
      className="absolute top-full left-0 w-full bg-[#FBF7F0] border-b border-[#E8DFC9] shadow-2xl transition-all duration-300 z-50 overflow-hidden"
      onMouseLeave={onClose}
    >
      <div className="max-w-7xl mx-auto px-6 py-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
          {/* Col 1: Shop by Category */}
          <div className="space-y-4 border-r border-[#E8DFC9]/60 pr-6">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-[0.3em] text-[#A88A4F] font-semibold">
                Categories
              </span>
              <Link
                href="/jewellery"
                onClick={onClose}
                className="text-[10px] uppercase tracking-wider text-[#5C5347] hover:text-[#2A241B]"
              >
                All Pieces →
              </Link>
            </div>
            <ul className="space-y-3 text-xs">
              {categories.map((cat) => (
                <li key={cat.key}>
                  <Link
                    href={cat.href}
                    onClick={onClose}
                    className="group flex items-center justify-between py-1 text-[#2A241B] hover:text-[#A88A4F] transition-colors"
                  >
                    <span className="font-medium">{cat.label}</span>
                    <span className="text-[10px] font-mono text-[#8C8275] group-hover:text-[#A88A4F]">
                      {cat.count} {cat.count === 1 ? 'piece' : 'pieces'}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Col 2: Shop by Design / Style */}
          <div className="space-y-4 border-r border-[#E8DFC9]/60 pr-6">
            <span className="text-[10px] uppercase tracking-[0.3em] text-[#A88A4F] font-semibold block">
              Design Aesthetics
            </span>
            <ul className="space-y-3.5 text-xs">
              {styles.map((s) => (
                <li key={s.label}>
                  <Link
                    href={s.href}
                    onClick={onClose}
                    className="block group"
                  >
                    <div className="font-medium text-[#2A241B] group-hover:text-[#A88A4F] transition-colors">
                      {s.label}
                    </div>
                    <div className="text-[10px] text-[#8C8275] font-light mt-0.5">
                      {s.desc}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Col 3: Diamonds & Provenance */}
          <div className="space-y-4 border-r border-[#E8DFC9]/60 pr-6">
            <span className="text-[10px] uppercase tracking-[0.3em] text-[#A88A4F] font-semibold block">
              Diamonds & Stones
            </span>
            <ul className="space-y-3 text-xs">
              {diamondEducation.map((item) => (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    onClick={onClose}
                    className="flex items-center justify-between text-[#2A241B] hover:text-[#A88A4F] transition-colors py-0.5"
                  >
                    <span>{item.label}</span>
                    {item.badge && (
                      <span className="text-[9px] px-1.5 py-0.5 bg-[#E8DFC9]/50 rounded text-[#2A241B] font-mono">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Col 4: Atelier & Client Services */}
          <div className="space-y-4 border-r border-[#E8DFC9]/60 pr-6">
            <span className="text-[10px] uppercase tracking-[0.3em] text-[#A88A4F] font-semibold block">
              Private Atelier
            </span>
            <ul className="space-y-2.5 text-xs">
              {atelierServices.map((svc) => (
                <li key={svc.label}>
                  <Link
                    href={svc.href}
                    onClick={onClose}
                    className={`block py-1 transition-colors ${
                      svc.highlight
                        ? 'font-semibold text-[#A88A4F] hover:text-[#2A241B]'
                        : 'text-[#2A241B] hover:text-[#A88A4F]'
                    }`}
                  >
                    {svc.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Col 5: Editorial Spotlight Card */}
          <div className="bg-white p-5 rounded-xl border border-[#E8DFC9] flex flex-col justify-between shadow-sm">
            <div className="space-y-2">
              <span className="text-[9px] uppercase tracking-widest px-2 py-0.5 bg-[#FBF7F0] text-[#A88A4F] font-semibold rounded inline-block">
                Master Suite
              </span>
              <h4 className="font-serif text-base text-[#2A241B] font-medium leading-snug">
                The Royal Heritage Suite
              </h4>
              <p className="text-[11px] text-[#5C5347] font-light leading-relaxed">
                Individually handcrafted in solid 18K gold and handset with certified Antwerp diamonds.
              </p>
            </div>
            <div className="pt-4 mt-auto border-t border-[#E8DFC9]">
              <Link
                href="/jewellery"
                onClick={onClose}
                className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-semibold text-[#2A241B] hover:text-[#A88A4F] transition-colors"
              >
                <span>View Creations</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
