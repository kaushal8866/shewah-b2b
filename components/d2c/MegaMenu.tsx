'use client'

import React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, Sparkles, Diamond } from 'lucide-react'
import { DEFAULT_NON_EMPTY_CATEGORIES, type D2CCategoryItem } from '@/lib/categories'

interface MegaMenuProps {
  categories?: D2CCategoryItem[]
  onClose: () => void
}

export default function MegaMenu({ categories = DEFAULT_NON_EMPTY_CATEGORIES, onClose }: MegaMenuProps) {
  const styles = [
    { label: 'Solitaire & Bands', href: '/jewellery?style=solitaire', desc: 'Focal stones in solid 18K gold' },
    { label: 'Statement Creations', href: '/jewellery?style=statement', desc: 'Sculptural fine jewellery' },
    { label: 'Minimalist Icons', href: '/jewellery?style=minimal', desc: 'Clean everyday diamond silhouettes' },
    { label: 'Signature Suites', href: '/jewellery?style=heritage', desc: 'Harmonious matching parures' },
  ]

  const diamondEducation = [
    { label: 'Natural Mined Diamonds', href: '/diamonds', badge: 'Certified' },
    { label: 'Certified Lab-Grown', href: '/diamonds', badge: 'Certified' },
    { label: 'The 4Cs Optical Standards', href: '/diamonds' },
    { label: 'Diamond Silhouette Guide', href: '/jewellery' },
  ]

  const atelierServices = [
    { label: 'Book Private Consultation', href: '/consultation', highlight: true },
    { label: 'Bespoke Commissions', href: '/bespoke' },
    { label: 'Atelier Craftsmanship', href: '/craftsmanship' },
    { label: 'Complimentary Ring Sizer', href: '/ring-size-guide' },
    { label: '14-Day Inspection & Care', href: '/returns' },
  ]

  return (
    <div
      className="absolute top-full left-0 w-full bg-[#F6F4F2] border-b border-[#E3DBD4] shadow-xl transition-all duration-300 z-50 overflow-hidden"
      onMouseLeave={onClose}
    >
      <div className="max-w-[1440px] mx-auto px-6 sm:px-12 py-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
          {/* Col 1: Shop by Category */}
          <div className="space-y-4 border-r border-[#E3DBD4]/60 pr-6">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-[0.2em] text-[#CB9274] font-semibold">
                Categories
              </span>
              <Link
                href="/jewellery"
                onClick={onClose}
                className="text-[10px] uppercase tracking-[0.14em] text-[#69727D] hover:text-[#051F34] transition-colors"
              >
                All Pieces →
              </Link>
            </div>
            <ul className="space-y-2.5 text-xs">
              {categories.map((cat) => (
                <li key={cat.key}>
                  <Link
                    href={cat.href}
                    onClick={onClose}
                    className="group flex items-center justify-between py-1 text-[#051F34] hover:text-[#CB9274] transition-colors"
                  >
                    <span className="font-medium tracking-wide">{cat.label}</span>
                    <span className="text-[10px] font-mono text-[#69727D] group-hover:text-[#CB9274]">
                      {cat.count} {cat.count === 1 ? 'piece' : 'pieces'}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Col 2: Shop by Design / Style */}
          <div className="space-y-4 border-r border-[#E3DBD4]/60 pr-6">
            <span className="text-[11px] uppercase tracking-[0.2em] text-[#CB9274] font-semibold block">
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
                    <div className="font-medium text-[#051F34] group-hover:text-[#CB9274] transition-colors tracking-wide">
                      {s.label}
                    </div>
                    <div className="text-[10px] text-[#69727D] font-normal mt-0.5">
                      {s.desc}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Col 3: Diamonds & Provenance */}
          <div className="space-y-4 border-r border-[#E3DBD4]/60 pr-6">
            <span className="text-[11px] uppercase tracking-[0.2em] text-[#CB9274] font-semibold block">
              Diamonds & Stones
            </span>
            <ul className="space-y-3 text-xs">
              {diamondEducation.map((item) => (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    onClick={onClose}
                    className="flex items-center justify-between text-[#051F34] hover:text-[#CB9274] transition-colors py-0.5 tracking-wide"
                  >
                    <span>{item.label}</span>
                    {item.badge && (
                      <span className="text-[9px] px-1.5 py-0.5 bg-white border border-[#E3DBD4] text-[#051F34] font-mono">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Col 4: Atelier & Client Services */}
          <div className="space-y-4 border-r border-[#E3DBD4]/60 pr-6">
            <span className="text-[11px] uppercase tracking-[0.2em] text-[#CB9274] font-semibold block">
              Private Atelier
            </span>
            <ul className="space-y-2.5 text-xs">
              {atelierServices.map((svc) => (
                <li key={svc.label}>
                  <Link
                    href={svc.href}
                    onClick={onClose}
                    className={`block py-1 transition-colors tracking-wide ${
                      svc.highlight
                        ? 'font-semibold text-[#CB9274] hover:text-[#051F34]'
                        : 'text-[#051F34] hover:text-[#CB9274]'
                    }`}
                  >
                    {svc.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Col 5: Editorial Spotlight Card */}
          <div className="bg-white border border-[#E3DBD4] p-5 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="relative aspect-[4/3] overflow-hidden bg-[#F6F4F2]">
                <Image
                  src="https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=600&q=80"
                  alt="The Royal Heritage Suite"
                  fill
                  sizes="240px"
                  className="object-cover"
                />
              </div>
              <div className="space-y-1">
                <span className="text-[9px] uppercase tracking-[0.2em] text-[#CB9274] font-semibold block">
                  Curated Suite
                </span>
                <h4 className="font-serif text-base text-[#051F34] font-normal leading-snug">
                  The Royal Heritage Suite
                </h4>
                <p className="text-[11px] text-[#69727D] font-normal leading-relaxed line-clamp-2">
                  Harmonious matching parure hand-set with certified diamonds in solid 18K gold.
                </p>
              </div>
            </div>

            <Link
              href="/jewellery/the-tulip-cut-diamond-necklace"
              onClick={onClose}
              className="mt-4 pt-3 border-t border-[#E3DBD4] inline-flex items-center justify-between text-xs uppercase tracking-[0.14em] font-semibold text-[#051F34] hover:text-[#CB9274] transition-colors group"
            >
              <span>Explore Piece</span>
              <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
