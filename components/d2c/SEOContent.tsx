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
    <section className="py-16 bg-[#FBF7F0] border-t border-[#E8DFC9] text-xs text-[#8C8275] leading-relaxed">
      {/* Inject Structured Organization & WebSite Schemas */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(seoSchema) }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="border-b border-[#E8DFC9]/70 pb-6 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[#A88A4F]">
            <Sparkles className="w-3.5 h-3.5" />
            <span className="uppercase tracking-[0.25em] font-semibold text-[10px]">
              About SHEWAH International Atelier & High Jewellery
            </span>
          </div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-[#2A241B] hover:text-[#A88A4F] text-[11px] font-medium transition-colors"
          >
            <span>{expanded ? 'Show Less' : 'Read Editorial Overview'}</span>
            <ChevronDown
              className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`}
            />
          </button>
        </div>

        <div
          className={`overflow-hidden transition-all duration-300 ${
            expanded ? 'max-h-[1200px] opacity-100' : 'max-h-24 opacity-80'
          }`}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-[#5C5347] font-light">
            <div>
              <h3 className="font-serif text-sm text-[#2A241B] font-medium mb-2">
                Certified Antwerp & Surat Provenance
              </h3>
              <p>
                SHEWAH bridges Europe&apos;s historic diamond trading capital in Antwerp with India&apos;s centuries-old cutting and goldsmithing center in Surat. By unifying gemological grading precision with hereditary lost-wax casting in 18K solid gold, our private atelier delivers museum-grade jewellery without traditional multi-tier luxury markups.
              </p>
            </div>

            <div>
              <h3 className="font-serif text-sm text-[#2A241B] font-medium mb-2">
                Lab-Grown & Natural Diamond Excellence
              </h3>
              <p>
                Whether you select rare Earth-mined stones or environmentally conscious lab-grown diamonds, every focal gem is accompanied by independent dossiers from IGI or GIA. Every stone meets DEF colourless and VVS/VS clarity benchmarks, set by master karigars under 40x stereomicroscopes for unparalleled fire and scintillation.
              </p>
            </div>

            <div>
              <h3 className="font-serif text-sm text-[#2A241B] font-medium mb-2">
                Bespoke Commissions & Insured Transit
              </h3>
              <p>
                From custom bridal solitaires to high jewellery rivière necklaces, our bespoke atelier crafts each design to order. Every commission is authenticated with official government assay hallmarking and transported across India and internationally via dedicated armored couriers with full transit insurance.
              </p>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-[#E8DFC9]/40 flex flex-wrap gap-x-6 gap-y-2 text-[11px] text-[#8C8275]">
            <span className="font-medium text-[#2A241B]">Quick Navigation:</span>
            <Link href="/jewellery" className="hover:text-[#A88A4F] underline underline-offset-2">
              All Diamond Jewellery
            </Link>
            <Link href="/jewellery?category=necklaces" className="hover:text-[#A88A4F] underline underline-offset-2">
              Diamond Necklaces
            </Link>
            <Link href="/jewellery?category=earrings" className="hover:text-[#A88A4F] underline underline-offset-2">
              Diamond Earrings
            </Link>
            <Link href="/diamonds" className="hover:text-[#A88A4F] underline underline-offset-2">
              Diamonds & 4Cs
            </Link>
            <Link href="/bespoke" className="hover:text-[#A88A4F] underline underline-offset-2">
              Bespoke Commissions
            </Link>
            <Link href="/craftsmanship" className="hover:text-[#A88A4F] underline underline-offset-2">
              Surat Atelier
            </Link>
            <Link href="/consultation" className="hover:text-[#A88A4F] underline underline-offset-2">
              Private Consultation
            </Link>
            <Link href="/ring-size-guide" className="hover:text-[#A88A4F] underline underline-offset-2">
              Ring Size Guide
            </Link>
            <Link href="/business" className="hover:text-[#A88A4F] underline underline-offset-2">
              B2B Diamond Trade
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
