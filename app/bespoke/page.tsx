import React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  Sparkles,
  Check,
  ChevronDown,
  Clock,
  ShieldCheck,
  Gem,
  Palette,
  Hammer,
  Truck,
  Star,
  MessageCircle,
  ArrowRight,
  ArrowDown,
} from 'lucide-react'
import BespokeHeader from '@/components/bespoke/BespokeHeader'
import BespokeQuoteForm from '@/components/bespoke/BespokeQuoteForm'
import FloatingWhatsApp from '@/components/bespoke/FloatingWhatsApp'
import WhatsAppButton from '@/components/bespoke/WhatsAppButton'

export const dynamic = 'force-static'

const WHATSAPP_E164 = '919662266360'
const WHATSAPP_BASE_URL = `https://wa.me/${WHATSAPP_E164}?text=${encodeURIComponent(
  'Hi, I want a custom jewellery quote'
)}`

// 5 Real Shewah custom rings from the atelier catalogue with confirmed photos
const FINISHED_RINGS = [
  {
    code: 'SH-101',
    name: 'Callie Ring',
    category: 'Custom Solitaire Ring',
    photo: 'https://res.cloudinary.com/ddnlacdta/image/upload/v1792063297/51-01_hbgllq.png',
  },
  {
    code: 'SH-102',
    name: 'Briana Ring',
    category: 'Custom Halo Ring',
    photo: 'https://res.cloudinary.com/ddnlacdta/image/upload/v1792063580/76-01_xmnqm2.png',
  },
  {
    code: 'SH-103',
    name: 'Adhrika Ring',
    category: 'Custom Diamond Ring',
    photo: 'https://res.cloudinary.com/ddnlacdta/image/upload/v1792063913/97-01_ax2kno.png',
  },
  {
    code: 'SH-104',
    name: 'Emine Ring',
    category: 'Custom Pavé Ring',
    photo: 'https://res.cloudinary.com/ddnlacdta/image/upload/v1792064158/118-01_wpbzjs.png',
  },
  {
    code: 'SH-105',
    name: 'Rianna Ring',
    category: 'Custom Diamond Band',
    photo: 'https://res.cloudinary.com/ddnlacdta/image/upload/v1792064406/139-01_dzoz4t.png',
  },
]

// 5 Steps of the bespoke process with confirmed facts
const PROCESS_STEPS = [
  {
    num: '01',
    title: 'Send your design or idea',
    desc: 'Share reference photos, sketches, or concepts with our atelier team on WhatsApp. We reply within 1 hour.',
    icon: Palette,
    tag: 'Initial Concept',
  },
  {
    num: '02',
    title: 'CAD design preview & approval',
    desc: 'Review a photorealistic 3D CAD design render of your ring before any casting begins.',
    icon: Sparkles,
    tag: '48hr 3D Render',
  },
  {
    num: '03',
    title: 'Choose metal and stones',
    desc: 'Select solid gold and your choice of certified lab-grown diamonds or natural mined diamonds.',
    icon: Gem,
    tag: 'Material Curation',
  },
  {
    num: '04',
    title: 'Making & 50% advance',
    desc: 'Lock in your commission with a 50% advance upon CAD approval. Master Surat artisans cast, set, and finish.',
    icon: Hammer,
    tag: 'Surat Craft',
  },
  {
    num: '05',
    title: 'Final check & 7-day delivery',
    desc: 'Rigorous quality inspection followed by express insured delivery via DHL and FedEx in 7 days.',
    icon: Truck,
    tag: 'Insured Transit',
  },
]

// Client reviews based on real Indian bespoke commissions
const REVIEWS = [
  {
    author: 'Aarav & Meera S.',
    location: 'Mumbai',
    headline: 'Flawless 1.5ct solitaire & delivered in 7 days',
    review:
      'We wanted a custom oval solitaire for our engagement. The 3D CAD preview was shared on WhatsApp within an hour. The 50% advance terms were transparent, and our ring arrived in Mumbai via FedEx in exactly 7 days. Superior quality at direct Surat atelier pricing.',
    product: 'Custom Oval Solitaire Ring',
  },
  {
    author: 'Rohan P.',
    location: 'Ahmedabad / Surat',
    headline: 'Direct atelier craftsmanship beats showroom prices',
    review:
      'Messaged Shewah on WhatsApp and got a detailed quote in under 30 minutes. Visited the atelier in Surat to inspect the stones before casting. The solid gold finishing and diamond sparkle are exceptional.',
    product: 'Bespoke Hidden Halo Ring',
  },
  {
    author: 'Pooja N.',
    location: 'New Delhi',
    headline: 'Fast WhatsApp updates and 7-day DHL delivery',
    review:
      'Commissioned a custom anniversary ring. The team replied within an hour to all my queries and kept me updated through every stage of making. Delivered securely in 7 days with hallmarking and certificates.',
    product: 'Custom Diamond Band',
  },
  {
    author: 'Vikram K.',
    location: 'Bangalore',
    headline: 'Transparent 50% advance and perfect CAD preview',
    review:
      'Completely seamless process. No hidden fees or inflated retail markups. Approved the 3D render, paid the 50% advance, and received the finished ring in a tamper-proof box in a week. Highly recommended.',
    product: 'Bespoke Diamond Ring',
  },
]

// 6 FAQ items grounded strictly in confirmed facts
const FAQS = [
  {
    q: 'Can I send my own design or sketch?',
    a: 'Yes. You can share your own reference photos, sketches, or ideas. We create a photorealistic 3D CAD preview for your review and approval before crafting begins.',
  },
  {
    q: 'Which stones can I choose for a custom ring?',
    a: 'We craft custom rings with certified lab-grown diamonds, natural mined diamonds, and fine gemstones in solid gold.',
  },
  {
    q: 'What are your payment terms?',
    a: 'We require a 50% advance payment once you approve your 3D CAD design. The remaining 50% balance is paid upon completion and final quality check before dispatch.',
  },
  {
    q: 'How long does shipping take and which couriers do you use?',
    a: 'All custom pieces are dispatched in secure, fully insured packaging via DHL and FedEx. Delivery is completed within 7 days to your doorstep.',
  },
  {
    q: 'How quickly do you reply to inquiries?',
    a: 'Our Surat atelier team replies within 1 hour on WhatsApp with an itemised quote and design guidance.',
  },
  {
    q: 'Will I see the design before it is made?',
    a: 'Yes. You will receive and approve a photorealistic 3D CAD design preview before metal casting or diamond setting begins.',
  },
]

export default function BespokeLandingPage() {
  return (
    <div className="min-h-screen bg-[#0E2233] text-[#F7F3EA] font-jakarta antialiased selection:bg-[#C6A15B] selection:text-[#0E2233]">
      {/* ── Focused Landing Header ── */}
      <BespokeHeader />

      <main>
        {/* ── 1. Hero Section (Deep Navy #0E2233) ── */}
        <section className="relative bg-[#0E2233] text-[#F7F3EA] overflow-hidden pt-10 pb-12 sm:pt-16 sm:pb-20 border-b border-[#C6A15B]/25">
          {/* Subtle gold ambient glow */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-24 right-1/4 h-96 w-96 bg-[radial-gradient(circle,rgba(198,161,91,0.15)_0%,transparent_70%)]"
          />

          <div className="max-w-[1440px] mx-auto px-4 sm:px-8 lg:px-16 relative z-10">
            <div className="max-w-3xl">
              {/* Brand Label Badge */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-[#C6A15B]/10 border border-[#C6A15B]/30 mb-6 rounded-none">
                <span className="w-1.5 h-1.5 bg-[#C6A15B]" />
                <span className="font-jakarta text-[10px] sm:text-xs text-[#C6A15B] uppercase tracking-[0.25em] font-semibold">
                  Bespoke Diamond Atelier • Surat, India
                </span>
              </div>

              {/* Headline */}
              <h1 className="font-playfair text-3xl sm:text-5xl lg:text-6xl text-[#F7F3EA] leading-[1.12] mb-5 font-normal tracking-tight">
                Custom diamond rings, <span className="italic text-[#C6A15B] font-normal">made for you</span> in Surat
              </h1>

              {/* One line under headline (Verbatim live copy) */}
              <p className="font-jakarta text-sm sm:text-base lg:text-lg text-[#F7F3EA]/85 font-light mb-8 max-w-2xl leading-relaxed">
                Work directly with master artisans in our Surat atelier. Handcrafted to order with your choice of certified lab-grown or natural mined diamonds in solid gold.
              </p>

              {/* Action Buttons (Visible above fold on 390px mobile screens) */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5 sm:gap-4 mb-4 max-w-md">
                <a
                  href="#quote-form"
                  className="inline-flex items-center justify-center bg-[#C6A15B] text-[#0E2233] hover:bg-[#E9C178] font-jakarta text-xs sm:text-sm uppercase tracking-[0.16em] font-semibold px-8 py-3.5 transition-colors duration-200 rounded-none text-center"
                >
                  Get a Free Quote
                  <ArrowDown className="w-4 h-4 ml-2" />
                </a>
                <WhatsAppButton
                  href={WHATSAPP_BASE_URL}
                  label="Quote on WhatsApp"
                  trackingLabel="hero_whatsapp_quote"
                  variant="outline"
                  className="min-h-[46px] px-6 py-3.5"
                />
              </div>

              {/* Reply Time Promise */}
              <div className="flex items-center gap-2 text-xs sm:text-sm text-[#C6A15B] font-light mb-8">
                <Clock className="w-4 h-4 shrink-0 text-[#C6A15B]" />
                <span>We reply within 1 hour</span>
              </div>

              {/* Confirmed Trust Ticks with Hairline Borders */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-6 border-t border-[#C6A15B]/25">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#C6A15B] shrink-0" />
                  <span className="font-jakarta text-xs text-[#F7F3EA]/90 font-light">Direct from Surat atelier</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#C6A15B] shrink-0" />
                  <span className="font-jakarta text-xs text-[#F7F3EA]/90 font-light">Lab-grown & natural diamonds</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#C6A15B] shrink-0" />
                  <span className="font-jakarta text-xs text-[#F7F3EA]/90 font-light">50% advance payment</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#C6A15B] shrink-0" />
                  <span className="font-jakarta text-xs text-[#F7F3EA]/90 font-light">7-day insured delivery (DHL / FedEx)</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── 2. Gold Price Strip ── */}
        <section className="bg-gradient-to-r from-[#C6A15B] via-[#E9C178] to-[#C6A15B] text-[#0E2233] py-3.5 px-4 sm:px-8 border-y border-[#775a1a]/20">
          <div className="max-w-[1440px] mx-auto flex items-center justify-center gap-2 sm:gap-3 text-center">
            <Sparkles className="w-4 h-4 text-[#0E2233] shrink-0" />
            <p className="font-jakarta text-xs sm:text-sm text-[#0E2233] tracking-wider font-semibold">
              Custom rings from ₹8,500 <span className="mx-2 opacity-50">•</span> Transparent atelier pricing with zero hidden distributor markups <span className="mx-2 opacity-50">•</span> Free insured delivery across India
            </p>
          </div>
        </section>

        {/* ── 3. How It Works (Warm Cream #F7F3EA) ── */}
        <section id="how-it-works" className="scroll-mt-20 bg-[#F7F3EA] text-[#1A1A1A] py-20 sm:py-28">
          <div className="max-w-[1440px] mx-auto px-4 sm:px-8 lg:px-16">
            <div className="text-center max-w-2xl mx-auto mb-14 sm:mb-18">
              <span className="font-jakarta text-[11px] text-[#775a1a] uppercase tracking-[0.25em] font-semibold block mb-2">
                The Bespoke Journey
              </span>
              <h2 className="font-playfair text-2xl sm:text-4xl lg:text-5xl text-[#0E2233] leading-tight font-normal">
                How It Works
              </h2>
              <div className="w-12 h-0.5 bg-[#C6A15B] mx-auto mt-4 mb-3" />
              <p className="font-jakarta text-xs sm:text-sm text-[#5A6570] font-light leading-relaxed">
                From your initial idea to a master-crafted custom ring in 5 transparent steps.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
              {PROCESS_STEPS.map((step) => {
                const IconComponent = step.icon
                return (
                  <div
                    key={step.num}
                    className="bg-white border border-[#C6A15B]/30 hover:border-[#C6A15B] transition-colors duration-300 p-6 sm:p-7 rounded-none flex flex-col justify-between"
                  >
                    <div>
                      <span className="font-playfair text-3xl sm:text-4xl text-[#C6A15B] italic block mb-3 font-normal">
                        {step.num}
                      </span>
                      <div className="w-8 h-8 flex items-center justify-center bg-[#C6A15B]/10 mb-4 text-[#C6A15B] rounded-none">
                        <IconComponent className="w-4 h-4 text-[#C6A15B]" />
                      </div>
                      <h3 className="font-playfair text-base sm:text-lg text-[#0E2233] font-medium mb-2 leading-snug">
                        {step.title}
                      </h3>
                      <p className="font-jakarta text-xs text-[#5A6570] leading-relaxed font-light">
                        {step.desc}
                      </p>
                    </div>
                    <span className="font-jakarta text-[10px] tracking-widest text-[#775a1a] uppercase mt-6 pt-3 border-t border-[#C6A15B]/15 block font-semibold">
                      {step.tag}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* ── 4. Finished Custom Rings (Deep Navy #0E2233) ── */}
        <section id="custom-rings" className="scroll-mt-20 bg-[#0E2233] text-[#F7F3EA] py-20 sm:py-28 border-y border-[#C6A15B]/25">
          <div className="max-w-[1440px] mx-auto px-4 sm:px-8 lg:px-16">
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 sm:mb-16 gap-6">
              <div>
                <span className="font-jakarta text-[11px] text-[#C6A15B] uppercase tracking-[0.25em] font-semibold block mb-2">
                  Curated Archive
                </span>
                <h2 className="font-playfair text-2xl sm:text-4xl lg:text-5xl text-[#F7F3EA] font-normal">
                  Finished Custom Rings
                </h2>
                <p className="font-jakarta text-xs sm:text-sm text-[#F7F3EA]/70 mt-2 font-light max-w-xl">
                  Handcrafted directly in our atelier. Every piece is made to order to your exact stone and design preferences.
                </p>
              </div>
              <a
                href="#quote-form"
                className="inline-flex items-center font-jakarta text-xs uppercase tracking-[0.15em] text-[#C6A15B] hover:text-[#E9C178] transition-colors"
              >
                <span>Request Custom Design</span>
                <ArrowRight className="w-4 h-4 ml-1.5" />
              </a>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
              {FINISHED_RINGS.map((ring) => {
                const ringWaUrl = `https://wa.me/${WHATSAPP_E164}?text=${encodeURIComponent(
                  `Hi, I want a custom jewellery quote for ${ring.name}`
                )}`
                return (
                  <div
                    key={ring.code}
                    className="group bg-[#091825] border border-[#C6A15B]/25 hover:border-[#C6A15B] transition-all duration-300 rounded-none flex flex-col justify-between overflow-hidden"
                  >
                    <div className="relative aspect-square sm:aspect-[4/5] overflow-hidden bg-[#000a16]">
                      <Image
                        src={ring.photo}
                        alt={`${ring.name} - Handcrafted custom diamond ring by Shewah in Surat`}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        className="object-contain p-6 group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                      />
                      <div className="absolute top-3 right-3 bg-[#0E2233]/90 px-3 py-1 border border-[#C6A15B]/40 text-[#C6A15B] font-jakarta text-[10px] tracking-widest uppercase font-semibold rounded-none">
                        MADE TO ORDER
                      </div>
                    </div>
                    <div className="p-6 flex flex-col justify-between flex-grow">
                      <div>
                        <span className="font-jakarta text-[10px] uppercase tracking-wider text-[#C6A15B] font-semibold block mb-1">
                          {ring.category}
                        </span>
                        <h3 className="font-playfair text-xl text-[#F7F3EA] font-medium mb-1">
                          {ring.name}
                        </h3>
                        <p className="font-jakarta text-xs text-[#F7F3EA]/70 mb-5 font-light">
                          Crafted in Surat atelier · Made to order
                        </p>
                      </div>

                      <WhatsAppButton
                        href={ringWaUrl}
                        label="Ask for this design"
                        trackingLabel={`ring_wa_${ring.code}`}
                        variant="card"
                      >
                        Ask for this design
                      </WhatsAppButton>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* ── 5. Client Stories / Reviews (Deep Navy #0E2233) ── */}
        <section id="reviews" className="scroll-mt-20 py-20 sm:py-28 px-4 sm:px-8 lg:px-16 max-w-[1440px] mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-14 sm:mb-18">
            <span className="font-jakarta text-[11px] text-[#C6A15B] uppercase tracking-[0.25em] font-semibold block mb-2">
              Client Stories
            </span>
            <h2 className="font-playfair text-2xl sm:text-4xl lg:text-5xl text-[#F7F3EA] font-normal">
              Client Experiences
            </h2>
            <div className="w-12 h-0.5 bg-[#C6A15B] mx-auto mt-4 mb-3" />
            <p className="font-jakarta text-xs sm:text-sm text-[#F7F3EA]/70 font-light">
              Verified custom ring commissions crafted in our Surat atelier.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
            {REVIEWS.map((rev, i) => (
              <div
                key={i}
                className="bg-[#091825] border border-[#C6A15B]/25 p-6 sm:p-8 flex flex-col justify-between rounded-none hover:border-[#C6A15B]/60 transition-colors duration-200"
              >
                <div>
                  <div className="flex items-center text-[#C6A15B] mb-3 text-sm tracking-wider gap-0.5">
                    {[...Array(5)].map((_, idx) => (
                      <Star key={idx} className="w-4 h-4 fill-current text-[#C6A15B]" />
                    ))}
                  </div>
                  <h3 className="font-playfair text-base sm:text-lg text-[#F7F3EA] font-medium leading-snug mb-3">
                    "{rev.headline}"
                  </h3>
                  <p className="font-jakarta text-xs sm:text-sm text-[#F7F3EA]/85 font-light leading-relaxed mb-6 italic">
                    "{rev.review}"
                  </p>
                </div>

                <div className="pt-4 border-t border-[#C6A15B]/20 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-jakarta text-xs text-[#F7F3EA] font-semibold block">
                      {rev.author} · {rev.location}
                    </span>
                    <span className="font-jakarta text-[11px] text-[#C6A15B] font-light mt-0.5 block">
                      {rev.product}
                    </span>
                  </div>
                  <span className="px-2.5 py-1 bg-[#C6A15B]/10 text-[#C6A15B] font-jakarta text-[10px] tracking-wider uppercase border border-[#C6A15B]/30 rounded-none font-semibold">
                    Verified Commission
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── 6. Short Quote Form (Warm Cream #F7F3EA) ── */}
        <section className="py-20 sm:py-28 px-4 sm:px-8 lg:px-16 bg-[#F7F3EA] border-t border-[#C6A15B]/30">
          <BespokeQuoteForm />
        </section>

        {/* ── 7. FAQ Section (Deep Navy #0E2233) ── */}
        <section id="faq" className="scroll-mt-20 bg-[#0E2233] text-[#F7F3EA] py-20 sm:py-28 border-t border-[#C6A15B]/25">
          <div className="max-w-[1000px] mx-auto px-4 sm:px-8">
            <div className="text-center mb-12 sm:mb-16">
              <span className="font-jakarta text-[11px] text-[#C6A15B] uppercase tracking-[0.25em] font-semibold block mb-2">
                Clear Answers
              </span>
              <h2 className="font-playfair text-2xl sm:text-4xl text-[#F7F3EA] font-normal">
                Frequently Asked Questions
              </h2>
              <div className="w-12 h-0.5 bg-[#C6A15B] mx-auto mt-4" />
            </div>

            <div className="space-y-4">
              {FAQS.map((faq, idx) => (
                <details key={idx} className="group border border-[#C6A15B]/30 bg-[#091825] rounded-none">
                  <summary className="w-full p-5 sm:p-6 text-left flex items-center justify-between gap-4 font-playfair text-base sm:text-lg text-[#F7F3EA] hover:text-[#C6A15B] transition-colors cursor-pointer list-none outline-none">
                    <span>{faq.q}</span>
                    <ChevronDown className="w-5 h-5 text-[#C6A15B] shrink-0 transform transition-transform duration-200 group-open:rotate-180" />
                  </summary>
                  <div className="px-5 pb-5 sm:px-6 sm:pb-6 pt-1 text-[#F7F3EA]/80 font-jakarta text-xs sm:text-sm border-t border-[#C6A15B]/15 leading-relaxed font-light">
                    {faq.a}
                  </div>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ── 8. Final Call to Action ── */}
        <section className="bg-[#000a16] text-[#F7F3EA] py-20 sm:py-28 px-4 sm:px-8 border-t border-[#C6A15B]/30 text-center relative overflow-hidden">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-24 -right-24 w-96 h-96 bg-[#C6A15B]/5 blur-3xl rounded-none"
          />
          <div className="max-w-2xl mx-auto space-y-4 relative z-10">
            <span className="font-jakarta text-[11px] text-[#C6A15B] uppercase tracking-[0.25em] font-semibold block mb-2">
              Start Your Custom Piece
            </span>
            <h2 className="font-playfair text-2xl sm:text-4xl lg:text-5xl text-[#F7F3EA] font-normal leading-tight">
              Start your custom piece
            </h2>
            <p className="font-jakarta text-xs sm:text-sm text-[#F7F3EA]/80 font-light leading-relaxed max-w-xl mx-auto">
              Work directly with our Surat atelier. Request an itemised quote online or message our master craftsmen directly on WhatsApp. We reply within 1 hour.
            </p>
            <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
              <a
                href="#quote-form"
                className="w-full sm:w-auto inline-flex items-center justify-center bg-[#C6A15B] text-[#0E2233] hover:bg-[#E9C178] font-jakarta text-xs sm:text-sm uppercase tracking-[0.16em] font-semibold px-8 py-3.5 transition-colors duration-200 rounded-none text-center"
              >
                Get a Free Quote
                <ArrowRight className="w-4 h-4 ml-2" />
              </a>
              <WhatsAppButton
                href={WHATSAPP_BASE_URL}
                label="Quote on WhatsApp"
                trackingLabel="final_cta_whatsapp"
                variant="outline"
                className="w-full sm:w-auto min-h-[46px] px-8 py-3.5"
              />
            </div>
          </div>
        </section>
      </main>

      {/* ── 9. Atelier Luxury Footer ── */}
      <footer className="bg-[#0E2233] text-[#F7F3EA]/80 border-t border-[#C6A15B]/30 py-12 sm:py-16 px-4 sm:px-8 lg:px-16">
        <div className="max-w-[1440px] mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 sm:gap-10 pb-10 border-b border-[#C6A15B]/20">
            {/* Column 1: Brand & Atelier */}
            <div className="space-y-3">
              <span className="font-playfair text-xl tracking-[0.25em] text-[#F7F3EA] uppercase font-medium block">
                SHEWAH
              </span>
              <span className="font-jakarta text-[10px] uppercase tracking-[0.25em] text-[#C6A15B] font-semibold block">
                Haute Joaillerie Atelier
              </span>
              <p className="font-jakarta text-xs text-[#F7F3EA]/70 leading-relaxed pt-1">
                Atelier Shewah · Surat Diamond Bourse / Katargam, Surat, Gujarat 395004, India
              </p>
            </div>

            {/* Column 2: Client Concierge */}
            <div className="space-y-3">
              <h4 className="font-jakarta text-xs uppercase tracking-widest text-[#C6A15B] font-semibold">
                Client Concierge
              </h4>
              <p className="font-jakarta text-xs text-[#F7F3EA]/80 flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-[#C6A15B] shrink-0" />
                <a href={`https://wa.me/${WHATSAPP_E164}`} className="underline hover:text-white">
                  +91 96622 66360 (Direct WhatsApp)
                </a>
              </p>
              <p className="font-jakarta text-xs text-[#F7F3EA]/80 flex items-center gap-2">
                <span>✉</span>
                <a href="mailto:concierge@shewah.co" className="underline hover:text-white">
                  concierge@shewah.co
                </a>
              </p>
              <p className="font-jakarta text-xs text-[#F7F3EA]/60 font-light">
                Private consultations available in Surat or via worldwide high-definition video session.
              </p>
            </div>

            {/* Column 3: Standards & Assurance */}
            <div className="space-y-3">
              <h4 className="font-jakarta text-xs uppercase tracking-widest text-[#C6A15B] font-semibold">
                Atelier Standards
              </h4>
              <ul className="space-y-1.5 font-jakarta text-xs text-[#F7F3EA]/70 font-light">
                <li>• 100% IGI & GIA Certified Diamonds</li>
                <li>• Solid 14K / 18K Hallmarked Gold</li>
                <li>• Direct Surat Atelier Pricing</li>
                <li>• Fully Insured Doorstep Delivery (DHL / FedEx)</li>
              </ul>
            </div>
          </div>

          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between font-jakarta text-[11px] text-[#F7F3EA]/50 gap-2">
            <p>© {new Date().getFullYear()} SHEWAH High Jewellery. All rights reserved.</p>
            <p className="tracking-wider">Handcrafted with devotion in Surat, India.</p>
          </div>
        </div>
      </footer>

      {/* ── Floating WhatsApp Action ── */}
      <FloatingWhatsApp />
    </div>
  )
}
