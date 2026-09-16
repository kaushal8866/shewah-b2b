'use client'

import React, { useState, useMemo } from 'react'
import Link from 'next/link'
import StoreLayout from '@/components/d2c/StoreLayout'
import { RING_SIZE_DATA, COUNTRY_OPTIONS, type RingSizeEntry } from '@/lib/ringSizeData'
import {
  Diamond,
  ShieldCheck,
  Ruler,
  Printer,
  Package,
  Sparkles,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Check,
  Send,
  Search,
  ExternalLink,
  Phone,
  HeartHandshake,
} from 'lucide-react'

export default function RingSizeGuidePage() {
  // --- State: Interactive Converter ---
  const [converterMode, setConverterMode] = useState<'diameter' | 'country'>('country')
  const [selectedCountry, setSelectedCountry] = useState<'us' | 'uk' | 'eu' | 'asia'>('us')
  const [selectedEntry, setSelectedEntry] = useState<RingSizeEntry>(
    RING_SIZE_DATA.find((r) => r.us === '6') || RING_SIZE_DATA[12]
  )

  // --- State: Master Matrix Search ---
  const [tableSearch, setTableSearch] = useState('')

  // --- State: Sizer Kit Form ---
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    street: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'United States',
    ringStyle: 'Engagement Ring',
    targetDate: '',
  })
  const [formSubmitting, setFormSubmitting] = useState(false)
  const [formSuccessRef, setFormSuccessRef] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  // --- State: FAQ Accordions ---
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0)

  // Filtered Matrix Rows
  const filteredMatrix = useMemo(() => {
    const q = tableSearch.trim().toLowerCase()
    if (!q) return RING_SIZE_DATA
    return RING_SIZE_DATA.filter(
      (r) =>
        r.us.toLowerCase().includes(q) ||
        r.uk.toLowerCase().includes(q) ||
        r.eu.toLowerCase().includes(q) ||
        r.asia.toLowerCase().includes(q) ||
        r.diameterMm.toString().includes(q) ||
        r.circumferenceMm.toString().includes(q)
    )
  }, [tableSearch])

  // Handle sizer kit submission
  const handleSizerSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormSubmitting(true)
    setFormError(null)

    try {
      const res = await fetch('/api/public/ring-sizer-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Failed to submit request.')
      }
      setFormSuccessRef(data.reference || 'SHW-CONFIRMED')
    } catch (err: any) {
      setFormError(err.message || 'Something went wrong. Please reach out to concierge@shewah.com')
    } finally {
      setFormSubmitting(false)
    }
  }

  // FAQs
  const faqs = [
    {
      q: '1. Can I trust the accuracy of the ring sizes listed on SHEWAH?',
      a: 'Yes, absolutely. Our ring sizing matrix is calibrated to international ISO and American standard jewellery mandrels. Every SHEWAH piece is individually hand-cast and finished by our master artisans to tolerances within 0.1 mm. If you have an existing well-fitting ring, measuring its inner diameter with digital callipers or against our circle silhouettes gives 100% precision.',
    },
    {
      q: '2. How do I accurately measure my ring size at home?',
      a: 'The most reliable home method is using a strip of non-stretchy paper or fine ribbon. Wrap it comfortably around the base of the specific finger you intend to wear the ring on, mark the exact overlap point with a sharp pen, and measure the flat length in millimetres against a ruler. To account for comfort, ensure the loop can slide smoothly over your knuckle.',
    },
    {
      q: '3. Is it possible to place a bespoke order using my local country size?',
      a: 'Yes. While our website displays US numerical sizing by default, our atelier accepts orders in UK alphabetical (F–Z+5), European millimetre circumference (44–76), or Asian sizes (4–31). You can select your US equivalent from our chart or leave your exact local size in the order instructions at checkout.',
    },
    {
      q: '4. What are the terms of the SHEWAH ring resizing policy?',
      a: 'We understand that getting the perfect fit can be nuanced. SHEWAH provides one complimentary ring resizing within the first 30 days of receiving your creation for all standard solitaire rings and diamond bands (up to one full size up or down). Fully eternity diamond bands with stones around 100% of the circumference cannot be resized, so we strongly encourage requesting our complimentary physical sizer belt first.',
    },
    {
      q: '5. How can I get personal assistance from the Bespoke Atelier?',
      a: 'Our master gemologists and customer care concierge are available via email at concierge@shewah.com, direct WhatsApp, or private virtual video appointment. We can inspect reference photos of your hands, verify measurements from an existing ring, or guide you step-by-step through the sizing process.',
    },
  ]

  return (
    <StoreLayout>
      <div className="bg-[#FBF7F0] text-[#2A241B]">
        {/* ================= HERO HEADER ================= */}
        <section className="border-b border-[#E8DFC9] bg-white/50 pt-14 pb-16 px-4 sm:px-6 lg:px-8 text-center relative overflow-hidden">
          <div className="max-w-3xl mx-auto space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#F4ECDD] border border-[#E8DFC9] rounded-full text-[10px] uppercase tracking-[0.25em] text-[#A88A4F] font-medium">
              <Diamond className="w-3 h-3 text-[#A88A4F]" />
              <span>Atelier Sizing & Concierge</span>
            </div>

            <h1 className="font-serif text-3xl sm:text-5xl lg:text-6xl font-normal text-[#2A241B] tracking-tight leading-tight">
              Find Your Ring Size at Home
            </h1>

            <p className="text-xs sm:text-sm text-[#5C5347] font-light leading-relaxed max-w-2xl mx-auto">
              Every SHEWAH creation is individually cast and handcrafted in solid gold to your exact
              measurements. Use our master interactive converter, DIY ribbon guide, printable 1:1 scale
              chart, or request a complimentary physical multi-sizer kit delivered directly to your home.
            </p>

            {/* Quick Navigation Anchors */}
            <div className="pt-4 flex flex-wrap items-center justify-center gap-2 text-xs">
              <a
                href="#converter"
                className="px-4 py-2 bg-[#2A241B] text-white rounded-full hover:bg-stone-800 transition-colors uppercase tracking-wider font-medium text-[11px]"
              >
                Size Converter
              </a>
              <a
                href="#diy-method"
                className="px-4 py-2 bg-white border border-[#E8DFC9] text-[#5C5347] rounded-full hover:border-[#2A241B] hover:text-[#2A241B] transition-colors uppercase tracking-wider font-medium text-[11px]"
              >
                DIY Measurement
              </a>
              <a
                href="#request-sizer"
                className="px-4 py-2 bg-[#F4ECDD] border border-[#C9A86A] text-[#2A241B] rounded-full hover:bg-[#E8DFC9] transition-colors uppercase tracking-wider font-medium text-[11px]"
              >
                Free Sizer Kit
              </a>
              <a
                href="#size-matrix"
                className="px-4 py-2 bg-white border border-[#E8DFC9] text-[#5C5347] rounded-full hover:border-[#2A241B] hover:text-[#2A241B] transition-colors uppercase tracking-wider font-medium text-[11px]"
              >
                Full Matrix Table
              </a>
            </div>
          </div>
        </section>

        {/* ================= 4-STEP DIY PAPER STRIP METHOD ================= */}
        <section id="diy-method" className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-12 space-y-2">
            <span className="text-[10px] uppercase tracking-[0.3em] text-[#A88A4F] font-semibold">
              Step-by-Step Method
            </span>
            <h2 className="font-serif text-2xl sm:text-4xl text-[#2A241B] font-normal">
              How to Measure Your Finger with a Strip of Paper
            </h2>
            <p className="text-xs text-[#5C5347] leading-relaxed">
              Jewellery crafting is a fine art. For an accurate measure at home, use a non-stretchy strip
              of paper, ribbon, or string.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Step 1 */}
            <div className="bg-white border border-[#E8DFC9] rounded-2xl p-6 flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow">
              <div className="space-y-4">
                <div className="w-10 h-10 rounded-full bg-[#F4ECDD] text-[#A88A4F] font-serif font-semibold flex items-center justify-center text-sm border border-[#E8DFC9]">
                  01
                </div>
                <h3 className="font-serif text-lg text-[#2A241B] font-medium">
                  Cut a Thin Strip of Paper
                </h3>
                <p className="text-xs text-[#5C5347] leading-relaxed">
                  Cut a strip of paper approximately 1 cm (0.4 inches) wide and 10 cm long. Avoid elastic
                  threads or flexible tape that can stretch and distort your measurement.
                </p>
              </div>
              <div className="pt-6 border-t border-[#E8DFC9] text-[11px] text-[#A88A4F] font-medium">
                Tip: Standard printer paper is ideal.
              </div>
            </div>

            {/* Step 2 */}
            <div className="bg-white border border-[#E8DFC9] rounded-2xl p-6 flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow">
              <div className="space-y-4">
                <div className="w-10 h-10 rounded-full bg-[#F4ECDD] text-[#A88A4F] font-serif font-semibold flex items-center justify-center text-sm border border-[#E8DFC9]">
                  02
                </div>
                <h3 className="font-serif text-lg text-[#2A241B] font-medium">
                  Wrap Snugly Around Finger
                </h3>
                <p className="text-xs text-[#5C5347] leading-relaxed">
                  Wrap the paper around the base of the finger you plan to wear your ring on. Ensure the fit
                  is comfortable and slides smoothly over your knuckle without catching.
                </p>
              </div>
              <div className="pt-6 border-t border-[#E8DFC9] text-[11px] text-[#A88A4F] font-medium">
                Tip: Measure at room temperature in the late afternoon.
              </div>
            </div>

            {/* Step 3 */}
            <div className="bg-white border border-[#E8DFC9] rounded-2xl p-6 flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow">
              <div className="space-y-4">
                <div className="w-10 h-10 rounded-full bg-[#F4ECDD] text-[#A88A4F] font-serif font-semibold flex items-center justify-center text-sm border border-[#E8DFC9]">
                  03
                </div>
                <h3 className="font-serif text-lg text-[#2A241B] font-medium">
                  Mark the Overlap Point
                </h3>
                <p className="text-xs text-[#5C5347] leading-relaxed">
                  Using a fine-tip pen or sharp pencil, draw a precise line across the paper where it completes
                  the circle and overlaps itself.
                </p>
              </div>
              <div className="pt-6 border-t border-[#E8DFC9] text-[11px] text-[#A88A4F] font-medium">
                Tip: Keep the strip flush against the skin when marking.
              </div>
            </div>

            {/* Step 4 */}
            <div className="bg-white border border-[#E8DFC9] rounded-2xl p-6 flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow">
              <div className="space-y-4">
                <div className="w-10 h-10 rounded-full bg-[#F4ECDD] text-[#A88A4F] font-serif font-semibold flex items-center justify-center text-sm border border-[#E8DFC9]">
                  04
                </div>
                <h3 className="font-serif text-lg text-[#2A241B] font-medium">
                  Measure with a Metric Ruler
                </h3>
                <p className="text-xs text-[#5C5347] leading-relaxed">
                  Lay the paper flat against a standard ruler. Measure the distance from the start of the paper
                  to your mark in millimetres (mm). This number is your finger circumference.
                </p>
              </div>
              <div className="pt-6 border-t border-[#E8DFC9] text-[11px] text-[#A88A4F] font-medium">
                Tip: Match this millimetre value in our converter below.
              </div>
            </div>
          </div>
        </section>

        {/* ================= INTERACTIVE GLOBAL SIZE CONVERTER ================= */}
        <section id="converter" className="py-16 bg-white border-y border-[#E8DFC9]">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-10 space-y-2">
              <span className="text-[10px] uppercase tracking-[0.3em] text-[#A88A4F] font-semibold">
                Universal Calculator
              </span>
              <h2 className="font-serif text-2xl sm:text-4xl text-[#2A241B] font-normal">
                Find Out Ring Size Equivalents Globally
              </h2>
              <p className="text-xs text-[#5C5347] leading-relaxed">
                Already know your size in your home country, or just measured your finger circumference?
                Select your preferred input method to calculate your exact international conversion.
              </p>
            </div>

            {/* Mode Switcher Tabs */}
            <div className="flex justify-center mb-8">
              <div className="inline-flex bg-[#F4ECDD] p-1 rounded-xl border border-[#E8DFC9]">
                <button
                  onClick={() => setConverterMode('country')}
                  className={`px-5 py-2 rounded-lg text-xs uppercase tracking-wider font-medium transition-all ${
                    converterMode === 'country'
                      ? 'bg-[#2A241B] text-white shadow-sm'
                      : 'text-[#5C5347] hover:text-[#2A241B]'
                  }`}
                >
                  By Known Country Size
                </button>
                <button
                  onClick={() => setConverterMode('diameter')}
                  className={`px-5 py-2 rounded-lg text-xs uppercase tracking-wider font-medium transition-all ${
                    converterMode === 'diameter'
                      ? 'bg-[#2A241B] text-white shadow-sm'
                      : 'text-[#5C5347] hover:text-[#2A241B]'
                  }`}
                >
                  By Inside Diameter / Millimetres
                </button>
              </div>
            </div>

            {/* Controls Box */}
            <div className="bg-[#FBF7F0] border border-[#E8DFC9] rounded-2xl p-6 sm:p-8 shadow-sm">
              {converterMode === 'country' ? (
                <div className="space-y-6">
                  {/* Select Country */}
                  <div>
                    <label className="block text-xs uppercase tracking-widest text-[#2A241B] font-medium mb-3">
                      Select Your Country / Regional Sizing Standard:
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {COUNTRY_OPTIONS.map((c) => (
                        <button
                          key={c.code}
                          onClick={() => setSelectedCountry(c.standard as any)}
                          className={`p-3 rounded-xl border text-left transition-all flex items-center gap-2.5 ${
                            selectedCountry === c.standard
                              ? 'bg-[#2A241B] text-white border-[#2A241B] shadow-sm'
                              : 'bg-white border-[#E8DFC9] text-[#2A241B] hover:border-[#A88A4F]'
                          }`}
                        >
                          <span className="text-xl">{c.flag}</span>
                          <div className="text-xs">
                            <div className="font-semibold">{c.code}</div>
                            <div className="text-[10px] opacity-80 leading-tight line-clamp-1">{c.label}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Select Size Dropdown */}
                  <div>
                    <label className="block text-xs uppercase tracking-widest text-[#2A241B] font-medium mb-2">
                      Select Known Ring Size:
                    </label>
                    <select
                      value={selectedEntry.us}
                      onChange={(e) => {
                        const found = RING_SIZE_DATA.find((r) => r.us === e.target.value)
                        if (found) setSelectedEntry(found)
                      }}
                      className="w-full bg-white border border-[#E8DFC9] rounded-xl px-4 py-3 text-sm text-[#2A241B] focus:outline-none focus:border-[#2A241B] shadow-sm font-medium"
                    >
                      {RING_SIZE_DATA.map((r) => {
                        let label = ''
                        if (selectedCountry === 'us') label = `US / CA ${r.us}`
                        else if (selectedCountry === 'uk') label = `UK / AU ${r.uk} (US ${r.us})`
                        else if (selectedCountry === 'eu') label = `EU ${r.eu} (US ${r.us})`
                        else label = `Asia / IN / JP ${r.asia} (US ${r.us})`

                        return (
                          <option key={r.us} value={r.us}>
                            {label} — {r.diameterMm} mm inside diameter ({r.circumferenceMm} mm circumference)
                          </option>
                        )
                      })}
                    </select>
                  </div>
                </div>
              ) : (
                /* Diameter / Circumference Mode */
                <div className="space-y-6">
                  <div>
                    <label className="block text-xs uppercase tracking-widest text-[#2A241B] font-medium mb-2">
                      Select Inside Diameter (mm) or Finger Circumference (mm):
                    </label>
                    <select
                      value={selectedEntry.us}
                      onChange={(e) => {
                        const found = RING_SIZE_DATA.find((r) => r.us === e.target.value)
                        if (found) setSelectedEntry(found)
                      }}
                      className="w-full bg-white border border-[#E8DFC9] rounded-xl px-4 py-3 text-sm text-[#2A241B] focus:outline-none focus:border-[#2A241B] shadow-sm font-medium"
                    >
                      {RING_SIZE_DATA.map((r) => (
                        <option key={r.us} value={r.us}>
                          {r.diameterMm} mm Inside Diameter | {r.circumferenceMm} mm Circumference (US {r.us})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Range Slider for rapid visual preview */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-[#8C8275]">
                      <span>14.05 mm (Size 3)</span>
                      <span className="font-mono font-medium text-[#2A241B]">
                        Active: {selectedEntry.diameterMm} mm
                      </span>
                      <span>24.23 mm (Size 15)</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={RING_SIZE_DATA.length - 1}
                      value={RING_SIZE_DATA.findIndex((r) => r.us === selectedEntry.us)}
                      onChange={(e) => {
                        const idx = parseInt(e.target.value, 10)
                        if (RING_SIZE_DATA[idx]) setSelectedEntry(RING_SIZE_DATA[idx])
                      }}
                      className="w-full accent-[#2A241B] cursor-pointer"
                    />
                  </div>
                </div>
              )}

              {/* Real-Time Conversion Result Card */}
              <div className="mt-8 pt-8 border-t border-[#E8DFC9]">
                <div className="bg-white border border-[#E8DFC9] rounded-2xl p-6 shadow-sm">
                  <div className="text-center pb-6 border-b border-[#E8DFC9]">
                    <span className="text-[10px] uppercase tracking-[0.3em] text-[#A88A4F] font-semibold">
                      Your Global Measurement
                    </span>
                    <div className="font-serif text-3xl sm:text-4xl text-[#2A241B] font-medium mt-1">
                      US {selectedEntry.us}
                    </div>
                    <p className="text-xs text-[#8C8275] mt-1">
                      Equivalent to {selectedEntry.circumferenceMm} mm circumference around your finger.
                    </p>
                  </div>

                  {/* 4 Standard Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-6 text-center border-b border-[#E8DFC9]">
                    <div className="p-3 bg-[#FBF7F0] rounded-xl border border-[#E8DFC9]">
                      <div className="text-[10px] uppercase tracking-wider text-[#8C8275]">US & Canada</div>
                      <div className="font-serif text-xl font-medium text-[#2A241B] mt-0.5">
                        {selectedEntry.us}
                      </div>
                    </div>
                    <div className="p-3 bg-[#FBF7F0] rounded-xl border border-[#E8DFC9]">
                      <div className="text-[10px] uppercase tracking-wider text-[#8C8275]">UK & Australia</div>
                      <div className="font-serif text-xl font-medium text-[#2A241B] mt-0.5">
                        {selectedEntry.uk}
                      </div>
                    </div>
                    <div className="p-3 bg-[#FBF7F0] rounded-xl border border-[#E8DFC9]">
                      <div className="text-[10px] uppercase tracking-wider text-[#8C8275]">Europe (EU)</div>
                      <div className="font-serif text-xl font-medium text-[#2A241B] mt-0.5">
                        {selectedEntry.eu}
                      </div>
                    </div>
                    <div className="p-3 bg-[#FBF7F0] rounded-xl border border-[#E8DFC9]">
                      <div className="text-[10px] uppercase tracking-wider text-[#8C8275]">India & Japan</div>
                      <div className="font-serif text-xl font-medium text-[#2A241B] mt-0.5">
                        {selectedEntry.asia}
                      </div>
                    </div>
                  </div>

                  {/* Metric Dimensions */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 text-xs text-[#5C5347]">
                    <div className="flex items-center gap-4">
                      <span>
                        Inside Diameter: <strong className="text-[#2A241B] font-mono">{selectedEntry.diameterMm} mm</strong>
                      </span>
                      <span>•</span>
                      <span>
                        Circumference: <strong className="text-[#2A241B] font-mono">{selectedEntry.circumferenceMm} mm</strong>
                      </span>
                    </div>

                    <Link
                      href="/jewellery?category=rings"
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#2A241B] text-white rounded-xl text-xs uppercase tracking-widest font-medium hover:bg-stone-800 transition-colors shadow-sm"
                    >
                      <span>Explore Rings & Bands</span>
                      <ArrowRight className="w-3.5 h-3.5 text-[#C9A86A]" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ================= COMPLIMENTARY SIZER REQUEST FORM ================= */}
        <section id="request-sizer" className="py-16 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
          <div className="bg-[#2A241B] text-[#FBF7F0] rounded-3xl p-8 sm:p-12 shadow-xl relative overflow-hidden">
            {/* Background luxury ornament */}
            <div className="absolute top-0 right-0 transform translate-x-1/4 -translate-y-1/4 opacity-10 pointer-events-none">
              <Diamond className="w-96 h-96 text-[#C9A86A]" />
            </div>

            <div className="relative z-10">
              <div className="text-center max-w-xl mx-auto space-y-3 mb-8">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 rounded-full text-[10px] uppercase tracking-[0.25em] text-[#C9A86A]">
                  <Package className="w-3.5 h-3.5" />
                  <span>Complimentary Atelier Service</span>
                </div>
                <h2 className="font-serif text-2xl sm:text-4xl text-white font-normal">
                  Request a Free Physical Ring Sizer Kit
                </h2>
                <p className="text-xs text-stone-300 leading-relaxed">
                  Before your ring is cast in solid gold, we want you to have 100% peace of mind. Fill
                  in your details and our concierge will express-dispatch a complimentary reusable multi-sizer
                  belt directly to your address worldwide.
                </p>
              </div>

              {formSuccessRef ? (
                <div className="bg-white/10 border border-[#C9A86A]/40 rounded-2xl p-8 text-center space-y-4 max-w-md mx-auto">
                  <div className="w-12 h-12 rounded-full bg-[#C9A86A] text-[#2A241B] flex items-center justify-center mx-auto">
                    <Check className="w-6 h-6 stroke-[3]" />
                  </div>
                  <h3 className="font-serif text-2xl text-white font-medium">
                    Sizer Kit Request Confirmed
                  </h3>
                  <p className="text-xs text-stone-300 leading-relaxed">
                    Thank you! Your complimentary sizing belt has been scheduled for priority dispatch.
                  </p>
                  <div className="p-3 bg-black/40 rounded-lg text-xs font-mono text-[#C9A86A]">
                    Reference: {formSuccessRef}
                  </div>
                  <button
                    onClick={() => {
                      setFormSuccessRef(null)
                      setFormData({
                        fullName: '',
                        email: '',
                        phone: '',
                        street: '',
                        city: '',
                        state: '',
                        postalCode: '',
                        country: 'United States',
                        ringStyle: 'Engagement Ring',
                        targetDate: '',
                      })
                    }}
                    className="text-xs text-stone-300 underline hover:text-white"
                  >
                    Request another sizer
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSizerSubmit} className="space-y-4 max-w-2xl mx-auto">
                  {formError && (
                    <div className="p-3 bg-red-950/60 border border-red-500/50 rounded-xl text-xs text-red-200">
                      {formError}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] uppercase tracking-wider text-stone-300 mb-1">
                        Full Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.fullName}
                        onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                        placeholder="e.g. Katherine Vance"
                        className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-2.5 text-xs text-white placeholder-stone-400 focus:outline-none focus:border-[#C9A86A]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] uppercase tracking-wider text-stone-300 mb-1">
                        Email Address *
                      </label>
                      <input
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="katherine@example.com"
                        className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-2.5 text-xs text-white placeholder-stone-400 focus:outline-none focus:border-[#C9A86A]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] uppercase tracking-wider text-stone-300 mb-1">
                        Mobile / WhatsApp (with Country Code)
                      </label>
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        placeholder="+1 (555) 019-2834"
                        className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-2.5 text-xs text-white placeholder-stone-400 focus:outline-none focus:border-[#C9A86A]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] uppercase tracking-wider text-stone-300 mb-1">
                        Ring Creation of Interest
                      </label>
                      <select
                        value={formData.ringStyle}
                        onChange={(e) => setFormData({ ...formData, ringStyle: e.target.value })}
                        className="w-full bg-[#3D3528] border border-white/20 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#C9A86A]"
                      >
                        <option value="Solitaire Engagement Ring">Solitaire Engagement Ring</option>
                        <option value="Classic Wedding Band">Classic Wedding Band</option>
                        <option value="Eternity Diamond Band">Eternity Diamond Band</option>
                        <option value="Bespoke Custom Atelier Ring">Bespoke Custom Atelier Ring</option>
                        <option value="Men's Heritage Ring">Men's Heritage Ring</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] uppercase tracking-wider text-stone-300 mb-1">
                      Street Shipping Address *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.street}
                      onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                      placeholder="Street address, apartment or suite number"
                      className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-2.5 text-xs text-white placeholder-stone-400 focus:outline-none focus:border-[#C9A86A]"
                    />
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[11px] uppercase tracking-wider text-stone-300 mb-1">
                        City *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.city}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                        placeholder="New York"
                        className="w-full bg-white/5 border border-white/20 rounded-xl px-3 py-2 text-xs text-white placeholder-stone-400 focus:outline-none focus:border-[#C9A86A]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] uppercase tracking-wider text-stone-300 mb-1">
                        State / Region
                      </label>
                      <input
                        type="text"
                        value={formData.state}
                        onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                        placeholder="NY"
                        className="w-full bg-white/5 border border-white/20 rounded-xl px-3 py-2 text-xs text-white placeholder-stone-400 focus:outline-none focus:border-[#C9A86A]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] uppercase tracking-wider text-stone-300 mb-1">
                        Postal Code *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.postalCode}
                        onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                        placeholder="10001"
                        className="w-full bg-white/5 border border-white/20 rounded-xl px-3 py-2 text-xs text-white placeholder-stone-400 focus:outline-none focus:border-[#C9A86A]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] uppercase tracking-wider text-stone-300 mb-1">
                        Country *
                      </label>
                      <select
                        value={formData.country}
                        onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                        className="w-full bg-[#3D3528] border border-white/20 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#C9A86A]"
                      >
                        <option value="United States">United States</option>
                        <option value="United Kingdom">United Kingdom</option>
                        <option value="Australia">Australia</option>
                        <option value="Canada">Canada</option>
                        <option value="Germany">Germany</option>
                        <option value="France">France</option>
                        <option value="Ireland">Ireland</option>
                        <option value="New Zealand">New Zealand</option>
                        <option value="India">India</option>
                        <option value="United Arab Emirates">UAE</option>
                        <option value="Singapore">Singapore</option>
                        <option value="Other">Other Country</option>
                      </select>
                    </div>
                  </div>

                  <div className="pt-4 text-center">
                    <button
                      type="submit"
                      disabled={formSubmitting}
                      className="w-full sm:w-auto px-8 py-3.5 bg-[#C9A86A] text-[#2A241B] rounded-xl text-xs uppercase tracking-widest font-semibold hover:bg-[#E8DFC9] transition-all shadow-lg active:scale-95 disabled:opacity-50"
                    >
                      {formSubmitting ? 'Submitting Request...' : 'Dispatch My Complimentary Sizer'}
                    </button>
                    <p className="text-[11px] text-stone-400 mt-2">
                      100% Free • No obligation • Complimentary insured shipping
                    </p>
                  </div>
                </form>
              )}
            </div>
          </div>
        </section>

        {/* ================= PRINTABLE 1:1 TRUE-SCALE GUIDE ================= */}
        <section id="printable-guide" className="py-16 bg-white border-y border-[#E8DFC9]">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-10 space-y-2">
              <span className="text-[10px] uppercase tracking-[0.3em] text-[#A88A4F] font-semibold">
                Print & True-Scale Calibration
              </span>
              <h2 className="font-serif text-2xl sm:text-4xl text-[#2A241B] font-normal">
                Printable 1:1 Scale Guide & Circle Silhouettes
              </h2>
              <p className="text-xs text-[#5C5347] leading-relaxed">
                If you have an existing ring that fits your chosen finger, print this page or compare the
                inner diameter directly against our calibrated circles.
              </p>
            </div>

            <div className="bg-[#FBF7F0] border border-[#E8DFC9] rounded-2xl p-6 sm:p-8 space-y-8">
              {/* Calibration Card Box */}
              <div className="flex flex-col md:flex-row items-center justify-between gap-6 p-6 bg-white border border-[#E8DFC9] rounded-xl">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#2A241B] uppercase tracking-wider">
                    <Ruler className="w-4 h-4 text-[#A88A4F]" />
                    <span>Credit Card Scale Verification</span>
                  </div>
                  <p className="text-xs text-[#5C5347] max-w-md leading-relaxed">
                    Place any standard credit or debit card over this box. If it aligns with the border
                    exactly (85.6 mm × 53.98 mm), your screen/print scale is 100% accurate.
                  </p>
                </div>

                {/* Exact Credit Card Size in CSS mm */}
                <div
                  className="border-2 border-dashed border-[#A88A4F] bg-[#FBF7F0] rounded-lg flex items-center justify-center text-[10px] uppercase tracking-widest text-[#8C8275] shrink-0"
                  style={{ width: '85.6mm', height: '53.98mm' }}
                >
                  <span>Credit Card Silhouette (85.6mm × 54mm)</span>
                </div>
              </div>

              {/* Sample Ring Circles Grid */}
              <div className="space-y-4">
                <div className="text-xs font-semibold text-[#2A241B] uppercase tracking-wider">
                  Popular Ring Diameters (Place your ring over circle to match inner edge):
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4 text-center">
                  {[
                    { size: 'US 4', mm: 14.88 },
                    { size: 'US 5', mm: 15.70 },
                    { size: 'US 6', mm: 16.51 },
                    { size: 'US 7', mm: 17.32 },
                    { size: 'US 8', mm: 18.14 },
                    { size: 'US 9', mm: 18.95 },
                    { size: 'US 10', mm: 19.76 },
                    { size: 'US 11', mm: 20.57 },
                    { size: 'US 12', mm: 21.39 },
                    { size: 'US 13', mm: 22.20 },
                    { size: 'US 14', mm: 23.01 },
                    { size: 'US 15', mm: 24.23 },
                  ].map((circle) => (
                    <div
                      key={circle.size}
                      className="bg-white border border-[#E8DFC9] rounded-xl p-4 flex flex-col items-center justify-between"
                    >
                      <div
                        className="rounded-full border-2 border-[#2A241B] flex items-center justify-center my-2"
                        style={{ width: `${circle.mm}mm`, height: `${circle.mm}mm` }}
                      />
                      <div className="text-xs font-semibold text-[#2A241B]">{circle.size}</div>
                      <div className="text-[10px] font-mono text-[#8C8275]">{circle.mm} mm</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-[#E8DFC9]">
                <span className="text-xs text-[#8C8275]">
                  Ensure your printer scaling is set to <strong>100% or "Actual Size"</strong> (not "Fit to Page").
                </span>

                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-white border border-[#2A241B] rounded-xl text-xs uppercase tracking-widest font-medium text-[#2A241B] hover:bg-[#2A241B] hover:text-white transition-colors"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Sizing Guide</span>
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ================= SECRET SIZING & PROPOSAL TIPS ================= */}
        <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-12 space-y-2">
            <span className="text-[10px] uppercase tracking-[0.3em] text-[#A88A4F] font-semibold">
              The Art of the Surprise
            </span>
            <h2 className="font-serif text-2xl sm:text-4xl text-[#2A241B] font-normal">
              How to Measure Their Ring Size Secretly
            </h2>
            <p className="text-xs text-[#5C5347] leading-relaxed">
              Planning a surprise proposal? Discover the clever methods our bespoke atelier clients use to
              find the right ring size without spoiling the moment.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white border border-[#E8DFC9] rounded-2xl p-6 space-y-3">
              <div className="text-xs uppercase tracking-wider font-semibold text-[#A88A4F]">
                Method 1: The Ring Borrow
              </div>
              <h3 className="font-serif text-lg text-[#2A241B] font-medium">Borrow an Existing Ring</h3>
              <p className="text-xs text-[#5C5347] leading-relaxed">
                Discreetly borrow a ring they wear on their left ring finger (or middle finger, which is
                typically half a size larger). Trace the inside circle on a piece of paper or press it into a
                bar of soap to capture the exact diameter.
              </p>
            </div>

            <div className="bg-white border border-[#E8DFC9] rounded-2xl p-6 space-y-3">
              <div className="text-xs uppercase tracking-wider font-semibold text-[#A88A4F]">
                Method 2: The Trusted Confidante
              </div>
              <h3 className="font-serif text-lg text-[#2A241B] font-medium">Ask Friends or Family</h3>
              <p className="text-xs text-[#5C5347] leading-relaxed">
                Her best friend, sister, or mother often knows her ring size—or can casually bring up jewellery
                in conversation or take her shopping to try on rings "for fun."
              </p>
            </div>

            <div className="bg-white border border-[#E8DFC9] rounded-2xl p-6 space-y-3">
              <div className="text-xs uppercase tracking-wider font-semibold text-[#A88A4F]">
                Method 3: The Safe Average
              </div>
              <h3 className="font-serif text-lg text-[#2A241B] font-medium">Use the Average Size</h3>
              <p className="text-xs text-[#5C5347] leading-relaxed">
                The most common women's ring size worldwide is <strong>US 6 to 6.5 (UK L to M)</strong>.
                Because SHEWAH offers a complimentary 30-day resizing policy on all solitaire designs, you can
                propose with full confidence and resize afterwards.
              </p>
            </div>
          </div>
        </section>

        {/* ================= MASTER INTERNATIONAL SIZING MATRIX ================= */}
        <section id="size-matrix" className="py-16 bg-white border-y border-[#E8DFC9]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
              <div className="space-y-2">
                <span className="text-[10px] uppercase tracking-[0.3em] text-[#A88A4F] font-semibold">
                  Comprehensive Data
                </span>
                <h2 className="font-serif text-2xl sm:text-4xl text-[#2A241B] font-normal">
                  Master Ring Size Conversion Chart
                </h2>
                <p className="text-xs text-[#5C5347]">
                  Equivalents across US/Canada, UK/Australia, Europe, Asia, and metric dimensions.
                </p>
              </div>

              {/* Quick Filter Search */}
              <div className="w-full md:w-72">
                <div className="relative">
                  <Search className="w-4 h-4 text-[#8C8275] absolute left-3 top-1/2 transform -translate-y-1/2" />
                  <input
                    type="text"
                    value={tableSearch}
                    onChange={(e) => setTableSearch(e.target.value)}
                    placeholder="Search size (e.g. 6, L 1/2, 16.51)..."
                    className="w-full bg-[#FBF7F0] border border-[#E8DFC9] rounded-xl pl-9 pr-4 py-2 text-xs text-[#2A241B] focus:outline-none focus:border-[#2A241B]"
                  />
                </div>
              </div>
            </div>

            {/* Responsive Table */}
            <div className="border border-[#E8DFC9] rounded-2xl overflow-hidden shadow-sm bg-white">
              <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="sticky top-0 bg-[#2A241B] text-[#FBF7F0] text-[11px] uppercase tracking-wider font-medium z-10">
                    <tr>
                      <th className="py-3 px-4">US & Canada</th>
                      <th className="py-3 px-4">UK & Australia</th>
                      <th className="py-3 px-4">Europe (EU)</th>
                      <th className="py-3 px-4">India & Japan</th>
                      <th className="py-3 px-4 font-mono">Inside Diameter (mm)</th>
                      <th className="py-3 px-4 font-mono">Circumference (mm)</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E8DFC9]">
                    {filteredMatrix.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-stone-400">
                          No matching sizes found for "{tableSearch}".
                        </td>
                      </tr>
                    ) : (
                      filteredMatrix.map((row) => {
                        const isSelected = selectedEntry.us === row.us
                        return (
                          <tr
                            key={row.us}
                            onClick={() => setSelectedEntry(row)}
                            className={`cursor-pointer transition-colors ${
                              isSelected
                                ? 'bg-[#F4ECDD] font-semibold text-[#2A241B]'
                                : 'hover:bg-[#FAF6ED] text-[#5C5347]'
                            }`}
                          >
                            <td className="py-3 px-4 font-serif text-sm text-[#2A241B]">
                              US {row.us}
                            </td>
                            <td className="py-3 px-4">{row.uk}</td>
                            <td className="py-3 px-4">{row.eu}</td>
                            <td className="py-3 px-4">{row.asia}</td>
                            <td className="py-3 px-4 font-mono">{row.diameterMm} mm</td>
                            <td className="py-3 px-4 font-mono">{row.circumferenceMm} mm</td>
                            <td className="py-3 px-4 text-right">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setSelectedEntry(row)
                                  const el = document.getElementById('converter')
                                  if (el) el.scrollIntoView({ behavior: 'smooth' })
                                }}
                                className="text-[11px] text-[#A88A4F] hover:underline"
                              >
                                View in Converter
                              </button>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        {/* ================= FREQUENTLY ASKED QUESTIONS ================= */}
        <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
          <div className="text-center max-w-xl mx-auto mb-10 space-y-2">
            <span className="text-[10px] uppercase tracking-[0.3em] text-[#A88A4F] font-semibold">
              Questions & Policies
            </span>
            <h2 className="font-serif text-2xl sm:text-4xl text-[#2A241B] font-normal">
              Frequently Asked Questions
            </h2>
            <p className="text-xs text-[#5C5347]">
              Everything you need to know about precision ring sizing, delivery, and our 30-day resizing guarantee.
            </p>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, idx) => {
              const isOpen = openFaqIndex === idx
              return (
                <div
                  key={faq.q}
                  className="bg-white border border-[#E8DFC9] rounded-2xl overflow-hidden transition-all shadow-sm"
                >
                  <button
                    onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                    className="w-full text-left px-6 py-4 flex items-center justify-between gap-4"
                  >
                    <span className="font-serif text-sm sm:text-base font-medium text-[#2A241B]">
                      {faq.q}
                    </span>
                    {isOpen ? (
                      <ChevronUp className="w-4 h-4 text-[#A88A4F] shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-[#8C8275] shrink-0" />
                    )}
                  </button>

                  {isOpen && (
                    <div className="px-6 pb-5 pt-1 text-xs sm:text-sm text-[#5C5347] font-light leading-relaxed border-t border-[#F4ECDD]">
                      {faq.a}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>

        {/* ================= CONCIERGE FOOTER BANNER ================= */}
        <section className="bg-[#F4ECDD] border-t border-[#E8DFC9] py-14 px-4 sm:px-6 lg:px-8 text-center">
          <div className="max-w-2xl mx-auto space-y-4">
            <div className="w-10 h-10 rounded-full bg-[#2A241B] text-[#C9A86A] flex items-center justify-center mx-auto">
              <Sparkles className="w-5 h-5" />
            </div>
            <h3 className="font-serif text-2xl sm:text-3xl text-[#2A241B] font-medium">
              Still Need Sizing Assistance?
            </h3>
            <p className="text-xs sm:text-sm text-[#5C5347] leading-relaxed">
              Our atelier master craftsmen and gemologists are at your service. Contact our concierge
              via WhatsApp, email, or schedule a 1-on-1 virtual design appointment.
            </p>
            <div className="pt-2 flex flex-wrap items-center justify-center gap-3 text-xs font-medium">
              <a
                href="mailto:concierge@shewah.com"
                className="px-5 py-2.5 bg-[#2A241B] text-white rounded-xl uppercase tracking-wider hover:bg-stone-800 transition-colors"
              >
                Email Concierge
              </a>
              <Link
                href="/bespoke"
                className="px-5 py-2.5 bg-white border border-[#2A241B] text-[#2A241B] rounded-xl uppercase tracking-wider hover:bg-[#2A241B] hover:text-white transition-colors"
              >
                Book Bespoke Consultation
              </Link>
            </div>
          </div>
        </section>
      </div>
    </StoreLayout>
  )
}
