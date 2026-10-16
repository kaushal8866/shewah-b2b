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
  },
  {
    num: '02',
    title: 'CAD design preview & approval',
    desc: 'Review a photorealistic 3D CAD design render of your ring before any casting begins.',
    icon: Sparkles,
  },
  {
    num: '03',
    title: 'Choose metal and stones',
    desc: 'Select solid gold and your choice of certified lab-grown diamonds or natural mined diamonds.',
    icon: Gem,
  },
  {
    num: '04',
    title: 'Making & 50% advance',
    desc: 'Lock in your commission with a 50% advance upon CAD approval. Master Surat artisans cast, set, and finish.',
    icon: Hammer,
  },
  {
    num: '05',
    title: 'Final check & 7-day delivery',
    desc: 'Rigorous quality inspection followed by express insured delivery via DHL and FedEx in 7 days.',
    icon: Truck,
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
    <div className="min-h-screen bg-[#FBF7F0] text-[#051F34] font-sans antialiased selection:bg-[#D4AF37]/30 selection:text-[#051F34]">
      {/* ── 1. Focused Landing Header ── */}
      <BespokeHeader />

      <main>
        {/* ── 2. Hero Section (Above the fold on 360px & 390px mobile screens) ── */}
        <section className="relative bg-[#051F34] text-white overflow-hidden pt-6 pb-8 sm:pt-12 sm:pb-16 border-b border-[#E8DFC9]/20">
          {/* Subtle gold ambient glow */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-24 right-1/4 h-80 w-80 rounded-full bg-[#D4AF37]/15 blur-3xl"
          />

          <div className="max-w-5xl mx-auto px-4 sm:px-6 relative z-10">
            {/* Atelier Eyebrow */}
            <div className="inline-flex items-center gap-2 rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-3 py-1 text-[10px] sm:text-xs font-mono uppercase tracking-[0.25em] text-[#D4AF37]">
              <span>✦ Surat Atelier</span>
              <span className="text-white/40">·</span>
              <span>Direct Craftsmanship</span>
            </div>

            {/* Headline */}
            <h1 className="mt-3 font-serif text-2xl sm:text-4xl lg:text-5xl font-normal leading-[1.15] tracking-tight text-white max-w-2xl">
              Custom diamond rings, made for you in Surat
            </h1>

            {/* One line under headline */}
            <p className="mt-2.5 text-xs sm:text-sm text-stone-300 leading-relaxed max-w-xl font-light">
              Work directly with master artisans in our Surat atelier. Handcrafted to order with your choice of certified lab-grown or natural mined diamonds in solid gold.
            </p>

            {/* Two Action Buttons (Both visible above fold on 390px screen) */}
            <div className="mt-4 sm:mt-6 flex flex-col xs:flex-row gap-2.5 sm:gap-4 max-w-md">
              <a
                href="#quote-form"
                className="inline-flex items-center justify-center min-h-[46px] px-6 py-2.5 text-xs uppercase tracking-widest font-semibold text-[#051F34] bg-[#D4AF37] hover:bg-[#c49f2e] rounded-lg transition-all shadow-md active:scale-[0.98] text-center"
              >
                Get a Free Quote
              </a>
              <WhatsAppButton
                href={WHATSAPP_BASE_URL}
                label="Quote on WhatsApp"
                trackingLabel="hero_whatsapp_quote"
                variant="outline"
                className="min-h-[46px] px-5 py-2.5"
              />
            </div>

            {/* Reply Time Promise (Confirmed: within 1 hour) */}
            <div className="mt-2.5 flex items-center gap-1.5 text-xs text-[#D4AF37] font-light">
              <Clock className="w-3.5 h-3.5 shrink-0" />
              <span>We reply within 1 hour</span>
            </div>

            {/* Confirmed Trust Ticks */}
            <div className="mt-4 pt-4 border-t border-white/10 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] sm:text-xs text-stone-300 font-light">
              <span className="inline-flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-[#D4AF37] shrink-0" />
                Direct from Surat atelier
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-[#D4AF37] shrink-0" />
                Lab-grown & natural diamonds
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-[#D4AF37] shrink-0" />
                50% advance payment
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-[#D4AF37] shrink-0" />
                7-day insured delivery (DHL / FedEx)
              </span>
            </div>
          </div>
        </section>

        {/* ── 3. INR Price Strip ── */}
        <section className="bg-[#FAF7F2] border-b border-[#E8DFC9] py-3.5 px-4 text-center">
          <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-center gap-2 text-xs sm:text-sm text-[#051F34]">
            <Sparkles className="w-4 h-4 text-[#A88A4F] shrink-0" />
            <span className="font-semibold text-base sm:text-lg text-[#051F34]">
              Custom rings from ₹8,500
            </span>
            <span className="text-[#A88A4F] font-bold hidden sm:inline">·</span>
            <span className="text-[#5C5347] font-light">
              Transparent atelier pricing with zero hidden distributor markups
            </span>
          </div>
        </section>

        {/* ── 4. How It Works (5 Steps) ── */}
        <section id="how-it-works" className="scroll-mt-20 py-12 sm:py-16 px-4 sm:px-6 max-w-5xl mx-auto">
          <div className="text-center mb-10 sm:mb-12">
            <span className="text-[10px] uppercase tracking-[0.25em] text-[#A88A4F] font-semibold">
              The Atelier Process
            </span>
            <h2 className="font-serif text-2xl sm:text-3xl lg:text-4xl text-[#051F34] mt-1 font-normal">
              How It Works
            </h2>
            <p className="text-xs sm:text-sm text-[#5C5347] mt-1.5 max-w-lg mx-auto font-light leading-relaxed">
              From your initial idea to a master-crafted custom ring in 5 transparent steps.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
            {PROCESS_STEPS.map((step) => {
              const IconComponent = step.icon
              return (
                <div
                  key={step.num}
                  className="bg-white border border-[#E8DFC9] rounded-2xl p-5 shadow-sm flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-mono text-xs font-semibold text-[#A88A4F]">
                        {step.num}
                      </span>
                      <IconComponent className="w-4 h-4 text-[#A88A4F]" />
                    </div>
                    <h3 className="font-serif text-base text-[#051F34] font-medium leading-snug">
                      {step.title}
                    </h3>
                    <p className="mt-2 text-xs text-[#5C5347] leading-relaxed font-light">
                      {step.desc}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* ── 5. Finished Custom Rings (Real Shewah Pieces from Catalog) ── */}
        <section id="custom-rings" className="scroll-mt-20 bg-white border-y border-[#E8DFC9] py-12 sm:py-16 px-4 sm:px-6">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-10">
              <span className="text-[10px] uppercase tracking-[0.25em] text-[#A88A4F] font-semibold">
                Surat Atelier Portfolio
              </span>
              <h2 className="font-serif text-2xl sm:text-3xl lg:text-4xl text-[#051F34] mt-1 font-normal">
                Finished Custom Rings
              </h2>
              <p className="text-xs sm:text-sm text-[#5C5347] mt-1.5 max-w-lg mx-auto font-light leading-relaxed">
                Handcrafted directly in our atelier. Every piece is made to order to your exact stone and design preferences.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {FINISHED_RINGS.map((ring) => {
                const ringWaUrl = `https://wa.me/${WHATSAPP_E164}?text=${encodeURIComponent(
                  `Hi, I want a custom jewellery quote for ${ring.name}`
                )}`
                return (
                  <div
                    key={ring.code}
                    className="bg-[#FBF7F0] border border-[#E8DFC9] rounded-2xl overflow-hidden shadow-sm flex flex-col transition-all hover:shadow-md"
                  >
                    <div className="relative aspect-square w-full bg-stone-100">
                      <Image
                        src={ring.photo}
                        alt={`${ring.name} - Handcrafted custom diamond ring by Shewah in Surat`}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        className="object-contain p-4 transition-transform duration-300 hover:scale-105"
                        loading="lazy"
                      />
                    </div>
                    <div className="p-5 flex-1 flex flex-col justify-between">
                      <div>
                        <span className="text-[10px] uppercase tracking-wider text-[#A88A4F] font-semibold">
                          {ring.category}
                        </span>
                        <h3 className="font-serif text-lg text-[#051F34] font-medium mt-0.5">
                          {ring.name}
                        </h3>
                        <p className="text-[11px] text-[#8C8275] mt-1 font-light">
                          Crafted in Surat atelier · Made to order
                        </p>
                      </div>

                      <div className="mt-4 pt-3 border-t border-[#E8DFC9]/70">
                        <WhatsAppButton
                          href={ringWaUrl}
                          label="Ask for this design"
                          trackingLabel={`ring_wa_${ring.code}`}
                          variant="card"
                          className="min-h-[44px]"
                        >
                          Ask for this design
                        </WhatsAppButton>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* ── 6. Client Reviews & Trust Section ── */}
        <section className="py-12 sm:py-16 px-4 sm:px-6 max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-1.5 text-amber-500 mb-2">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
              ))}
              <span className="text-xs font-semibold text-[#051F34] ml-1">5.0 / 5.0</span>
            </div>
            <h2 className="font-serif text-2xl sm:text-3xl lg:text-4xl text-[#051F34] font-normal">
              Client Experiences
            </h2>
            <p className="text-xs sm:text-sm text-[#5C5347] mt-1 max-w-md mx-auto font-light">
              Verified custom ring commissions crafted in our Surat atelier.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {REVIEWS.map((rev, i) => (
              <div
                key={i}
                className="bg-white border border-[#E8DFC9] rounded-2xl p-6 shadow-sm flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-1 text-amber-400">
                      {[...Array(5)].map((_, idx) => (
                        <Star key={idx} className="w-3.5 h-3.5 fill-current" />
                      ))}
                    </div>
                    <span className="text-[10px] uppercase tracking-wider text-[#A88A4F] font-mono font-semibold">
                      Verified Client
                    </span>
                  </div>
                  <h3 className="font-serif text-base text-[#051F34] font-medium leading-snug">
                    "{rev.headline}"
                  </h3>
                  <p className="mt-2 text-xs text-[#5C5347] leading-relaxed font-light">
                    {rev.review}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-[#E8DFC9]/60 flex items-center justify-between text-xs text-[#8C8275]">
                  <span className="font-semibold text-[#051F34]">{rev.author} · {rev.location}</span>
                  <span className="text-[11px] text-[#A88A4F]">{rev.product}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── 7. Short Quote Form ── */}
        <section className="py-12 sm:py-16 px-4 sm:px-6 bg-[#FAF7F2] border-t border-[#E8DFC9]">
          <BespokeQuoteForm />
        </section>

        {/* ── 8. FAQ Section (Grounded strictly in Confirmed Facts) ── */}
        <section id="faq" className="scroll-mt-20 bg-white border-t border-[#E8DFC9] py-12 sm:py-16 px-4 sm:px-6">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-8">
              <span className="text-[10px] uppercase tracking-[0.25em] text-[#A88A4F] font-semibold">
                Clear Answers
              </span>
              <h2 className="font-serif text-2xl sm:text-3xl text-[#051F34] mt-1 font-normal">
                Frequently Asked Questions
              </h2>
            </div>

            <div className="divide-y divide-[#E8DFC9] border-y border-[#E8DFC9]">
              {FAQS.map((faq, idx) => (
                <details key={idx} className="group py-4">
                  <summary className="flex items-center justify-between cursor-pointer list-none font-serif text-base sm:text-lg text-[#051F34] font-medium pr-2 outline-none">
                    <span>{faq.q}</span>
                    <ChevronDown className="w-4 h-4 text-[#A88A4F] transition-transform duration-200 group-open:rotate-180 shrink-0 ml-3" />
                  </summary>
                  <p className="mt-2.5 text-xs sm:text-sm text-[#5C5347] leading-relaxed font-light">
                    {faq.a}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ── 9. Final Call to Action ── */}
        <section className="bg-[#051F34] text-white py-12 sm:py-16 px-4 sm:px-6 border-t border-[#D4AF37]/20 text-center">
          <div className="max-w-2xl mx-auto space-y-4">
            <h2 className="font-serif text-2xl sm:text-3xl lg:text-4xl text-white font-normal">
              Start your custom piece
            </h2>
            <p className="text-xs sm:text-sm text-stone-300 font-light leading-relaxed">
              Work directly with our Surat atelier. Request an itemised quote online or message our master craftsmen directly on WhatsApp. We reply within 1 hour.
            </p>
            <div className="pt-2 flex flex-col xs:flex-row items-center justify-center gap-3">
              <a
                href="#quote-form"
                className="w-full xs:w-auto inline-flex items-center justify-center min-h-[46px] px-7 py-2.5 text-xs uppercase tracking-widest font-semibold text-[#051F34] bg-[#D4AF37] hover:bg-[#c49f2e] rounded-lg transition-all shadow-md active:scale-[0.98]"
              >
                Get a Free Quote
              </a>
              <WhatsAppButton
                href={WHATSAPP_BASE_URL}
                label="Quote on WhatsApp"
                trackingLabel="final_cta_whatsapp"
                variant="outline"
                className="w-full xs:w-auto min-h-[46px] px-6 py-2.5"
              />
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer with verified site contact details ── */}
      <footer className="bg-[#031524] text-stone-400 py-10 px-4 sm:px-6 border-t border-white/10 text-xs">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="space-y-1">
            <p className="font-serif text-lg tracking-[0.2em] text-white font-normal">
              SHEWAH
            </p>
            <p className="text-[11px] text-stone-400">
              Atelier Shewah · Surat Diamond Bourse / Katargam, Surat, Gujarat 395004, India
            </p>
            <p className="text-[11px] text-stone-400">
              Client Care: <a href="mailto:concierge@shewah.co" className="underline hover:text-white">concierge@shewah.co</a> · <a href={`https://wa.me/${WHATSAPP_E164}`} className="underline hover:text-white">+91 96622 66360</a>
            </p>
          </div>

          <div className="text-[11px] text-stone-500 sm:text-right">
            <p>© {new Date().getFullYear()} SHEWAH High Jewellery. All rights reserved.</p>
            <p className="mt-0.5">Handcrafted in Surat, India.</p>
          </div>
        </div>
      </footer>

      {/* ── Floating WhatsApp Action ── */}
      <FloatingWhatsApp />
    </div>
  )
}
