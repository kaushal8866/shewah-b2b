'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { ChevronDown, Globe, Sparkles } from 'lucide-react'

export default function SEOContent() {
  const [expanded, setExpanded] = useState(false)

  // Organization and WebSite JSON-LD Schema
  const seoSchema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': 'https://shewah.com/#organization',
        name: 'SHEWAH High Jewellery',
        url: 'https://shewah.com',
        logo: {
          '@type': 'ImageObject',
          url: 'https://shewah.com/logo.png',
          caption: 'SHEWAH High Jewellery',
        },
        sameAs: [
          'https://instagram.com/shewahjewellery',
          'https://wa.me/919909908866',
        ],
        contactPoint: [
          {
            '@type': 'ContactPoint',
            telephone: '+91-9909908866',
            contactType: 'customer service',
            areaServed: ['IN', 'US', 'GB', 'AE', 'EU', 'SG', 'CA', 'AU'],
            availableLanguage: ['en', 'hi', 'gu'],
          },
        ],
      },
      {
        '@type': 'WebSite',
        '@id': 'https://shewah.com/#website',
        url: 'https://shewah.com',
        name: 'SHEWAH High Jewellery',
        publisher: {
          '@id': 'https://shewah.com/#organization',
        },
        potentialAction: {
          '@type': 'SearchAction',
          target: 'https://shewah.com/jewellery?q={search_term_string}',
          'query-input': 'required name=search_term_string',
        },
      },
    ],
  }

  return (
    <section className="py-16 bg-[#F6F4F2] border-t border-[#E3DBD4] text-xs text-[#69727D] leading-relaxed">
      {/* Inject Structured Organization & WebSite Schemas */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(seoSchema) }}
      />

      <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
        <div className="border-b border-[#E3DBD4] pb-6 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[#CB9274]">
            <Sparkles className="w-3.5 h-3.5" />
            <span className="uppercase tracking-[0.2em] font-medium text-[11px]">
              About SHEWAH Fine Jewellery Atelier
            </span>
          </div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1.5 text-[#051F34] hover:text-[#CB9274] text-xs font-medium uppercase tracking-wider transition-colors"
          >
            <span>{expanded ? 'Show Less' : 'Editorial Overview'}</span>
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`}
            />
          </button>
        </div>

        <div
          className={`overflow-hidden transition-all duration-300 ${
            expanded ? 'max-h-[1200px] opacity-100' : 'max-h-24 opacity-80'
          }`}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-[#69727D] font-light">
            <div>
              <h3 className="font-serif text-base text-[#051F34] font-normal mb-2">
                Fine Jewellery Crafting
              </h3>
              <p>
                SHEWAH creates timeless fine jewellery using certified diamonds and solid 18K gold. By unifying gemological grading precision with individual crafting and hand-setting, our atelier delivers exceptional creations without traditional multi-tier luxury markups.
              </p>
            </div>

            <div>
              <h3 className="font-serif text-base text-[#051F34] font-normal mb-2">
                Lab-Grown & Natural Diamond Excellence
              </h3>
              <p>
                Whether you select Earth-mined stones or lab-grown diamonds, every focal gem is accompanied by independent dossiers from IGI or GIA. Every stone meets DEF colourless and VVS/VS clarity benchmarks, set by skilled jewelers for superior fire and scintillation.
              </p>
            </div>

            <div>
              <h3 className="font-serif text-base text-[#051F34] font-normal mb-2">
                Bespoke Commissions & Insured Transit
              </h3>
              <p>
                From custom bridal solitaires to high jewellery suites, our bespoke atelier crafts each design to order. Every commission is authenticated with precious metal hallmarking and delivered directly with full transit insurance.
              </p>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-[#E3DBD4] flex flex-wrap gap-x-6 gap-y-2 text-[11px] text-[#69727D]">
            <span className="font-medium text-[#051F34] uppercase tracking-wider">Navigation:</span>
            <Link href="/jewellery" className="hover:text-[#CB9274] transition-colors">
              All Diamond Jewellery
            </Link>
            <Link href="/jewellery?category=necklaces" className="hover:text-[#CB9274] transition-colors">
              Diamond Necklaces
            </Link>
            <Link href="/jewellery?category=earrings" className="hover:text-[#CB9274] transition-colors">
              Diamond Earrings
            </Link>
            <Link href="/diamonds" className="hover:text-[#CB9274] transition-colors">
              Diamonds & 4Cs
            </Link>
            <Link href="/bespoke" className="hover:text-[#CB9274] transition-colors">
              Bespoke Commissions
            </Link>
            <Link href="/craftsmanship" className="hover:text-[#CB9274] transition-colors">
              Atelier Craftsmanship
            </Link>
            <Link href="/consultation" className="hover:text-[#CB9274] transition-colors">
              Private Consultation
            </Link>
            <Link href="/ring-size-guide" className="hover:text-[#CB9274] transition-colors">
              Ring Size Guide
            </Link>
            <Link href="/business" className="hover:text-[#CB9274] transition-colors">
              B2B Portal
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
