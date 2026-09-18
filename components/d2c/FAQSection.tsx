'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { ChevronDown, HelpCircle, ArrowRight } from 'lucide-react'

interface FAQItem {
  question: string
  answer: string
}

const FAQS: FAQItem[] = [
  {
    question: 'Are SHEWAH diamonds certified by recognized gemological institutes?',
    answer:
      'Yes. Every focal diamond and high jewellery creation is accompanied by an independent grading dossier from premier institutions—principally IGI (International Gemological Institute) or GIA (Gemological Institute of America). The report includes an individual certificate number micro-inscribed directly onto the diamond’s girdle with a cold laser, verifiable in any worldwide database.',
  },
  {
    question: 'What is the difference between Natural and Lab-Grown diamonds at SHEWAH?',
    answer:
      'Chemically, physically, and optically, our lab-grown and natural diamonds are 100% identical pure crystallized carbon. Both possess identical hardness (10 on the Mohs scale), refractive index (2.42), and scintillation. The sole distinction lies in their provenance: natural diamonds crystallized beneath the Earth’s mantle over billions of years, while lab diamonds are cultivated in specialized plasma chambers. We curate both to the highest optical standards (DEF colour, VVS/VS clarity) and declare provenance transparently.',
  },
  {
    question: 'How does made-to-order casting work and what is the lead time?',
    answer:
      'To prevent the degradation of stored inventory and offer complete personalization, every SHEWAH piece is cast individually upon order confirmation. Our master karigars in Surat lost-wax cast the piece in 18K solid gold, hand-set each calibrated stone under stereomicroscopes, and submit it for official assay hallmarking. This meticulous process typically requires 10 to 15 business days prior to insured dispatch.',
  },
  {
    question: 'How is high jewellery shipped securely across international borders?',
    answer:
      'We partner with premier global security couriers including Malca-Amit, Brinks, and FedEx Express Secured. Every shipment is 100% insured by SHEWAH from the moment it leaves our atelier until you inspect and physically sign for it. Deliveries are packaged in tamper-evident, unmarked discreet outer cartons containing our signature presentation boxes and documentation inside.',
  },
  {
    question: 'Can I commission a bespoke design or modify an existing piece?',
    answer:
      'Absolutely. Our bespoke atelier specializes in custom commissions—from altering stone dimensions or metal colour (18K Yellow, Rose, or White Gold) to translating sketches into photorealistic 3D CAD models. You can schedule a private virtual session or submit your concept directly to our design team at /consultation.',
  },
  {
    question: 'What is your return, resizing, and inspection policy?',
    answer:
      'We offer a 14-day inspection window on standard catalogue creations. If you wish to exchange or return an unworn piece with intact security tags and gemological certificates, we coordinate insured return courier. Bespoke and custom-engraved creations are backed by our Lifetime Craftsmanship Warranty, free initial ring resizing within 60 days, and our lifetime upgrade / buyback policy.',
  },
  {
    question: 'How do you guarantee the purity and hallmarking of your gold?',
    answer:
      'SHEWAH exclusively casts in Solid 18K (750) Gold—we never manufacture with gold plating, vermeil, or brass. In India, each creation is authenticated with Bureau of Indian Standards (BIS) Hallmarking featuring a unique 6-digit HUID (Hallmark Unique Identification). For international orders, pieces carry official 750 assay stamps and complete metal weight declarations on the commercial invoice and valuation appraisal.',
  },
]

export default function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  const toggle = (index: number) => {
    setOpenIndex((prev) => (prev === index ? null : index))
  }

  // Generate structured FAQPage JSON-LD for SEO rich snippets
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQS.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  }

  return (
    <section className="py-20 lg:py-28 bg-[#F5EFEB] border-t border-[#E8DFC9]">
      {/* Inject FAQPage Schema */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <div className="flex items-center justify-center gap-2 mb-3">
            <HelpCircle className="w-4 h-4 text-[#A88A4F]" />
            <span className="text-[11px] uppercase tracking-[0.3em] text-[#A88A4F] font-semibold">
              Frequently Addressed
            </span>
          </div>
          <h2 className="font-serif text-3xl sm:text-4xl text-[#2A241B] tracking-tight mb-4">
            Questions Discerning Collectors Ask
          </h2>
          <p className="text-[#5C5347] text-sm sm:text-base font-light leading-relaxed">
            Total transparency on certification, casting timelines, insured logistics, and client protections.
          </p>
        </div>

        {/* FAQ Accordion List */}
        <div className="space-y-4">
          {FAQS.map((faq, index) => {
            const isOpen = openIndex === index
            return (
              <div
                key={faq.question}
                className="bg-white border border-[#E8DFC9] rounded-xl overflow-hidden transition-all duration-200"
              >
                <button
                  onClick={() => toggle(index)}
                  className="w-full text-left px-6 py-5 flex items-center justify-between gap-4 hover:bg-[#FBF7F0]/60 transition-colors"
                  aria-expanded={isOpen}
                >
                  <span className="font-serif text-base sm:text-lg text-[#2A241B] font-medium pr-2">
                    {faq.question}
                  </span>
                  <div
                    className={`w-7 h-7 rounded-full border border-[#E8DFC9] flex items-center justify-center shrink-0 text-[#2A241B] transition-transform duration-200 ${
                      isOpen ? 'rotate-180 bg-[#2A241B] text-white' : 'bg-transparent'
                    }`}
                  >
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </button>

                {isOpen && (
                  <div className="px-6 pb-6 pt-1 text-sm text-[#5C5347] font-light leading-relaxed border-t border-[#E8DFC9]/40 animate-in fade-in duration-200">
                    <p>{faq.answer}</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Still Have Questions? */}
        <div className="mt-12 text-center bg-white/70 border border-[#E8DFC9] rounded-xl p-8 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="text-left">
            <h3 className="font-serif text-lg text-[#2A241B] font-medium">
              Have an individual inquiry or custom request?
            </h3>
            <p className="text-xs text-[#5C5347] font-light mt-1">
              Our gemologists and concierge specialists are on hand to assist.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Link
              href="/consultation"
              className="inline-flex items-center gap-1.5 bg-[#2A241B] text-[#FBF7F0] hover:bg-[#3D3528] px-5 py-2.5 rounded-full text-xs uppercase tracking-wider font-medium transition-colors"
            >
              <span>Book Consultation</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center gap-1.5 border border-[#E8DFC9] hover:border-[#2A241B] text-[#2A241B] px-5 py-2.5 rounded-full text-xs uppercase tracking-wider font-medium transition-colors"
            >
              <span>Contact Us</span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
