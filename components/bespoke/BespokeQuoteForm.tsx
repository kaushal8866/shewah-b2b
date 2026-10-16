'use client'

import React, { useState, type FormEvent } from 'react'
import { CheckCircle2, MessageCircle, Sparkles } from 'lucide-react'
import { trackWhatsAppClick } from './FloatingWhatsApp'

const WHATSAPP_DIRECT_URL = 'https://wa.me/919662266360?text=Hi%2C%20I%20want%20a%20custom%20jewellery%20quote'

const CREATION_TYPES = [
  'Solitaire Ring',
  'Engagement Ring',
  'Wedding Band',
  'Halo Diamond Ring',
  'Other Custom Ring',
]

const BUDGET_RANGES = [
  { label: 'Flexible / Undecided', value: '' },
  { label: 'Up to ₹1,00,000', value: '50000 - 100000' },
  { label: '₹1,00,000 – ₹2,50,000', value: '100000 - 250000' },
  { label: '₹2,50,000 – ₹5,00,000', value: '250000 - 500000' },
  { label: '₹5,00,000+', value: '500000+' },
]

export default function BespokeQuoteForm() {
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('+91 ')
  const [city, setCity] = useState('')
  const [creationType, setCreationType] = useState('Solitaire Ring')
  const [budget, setBudget] = useState('')
  const [notes, setNotes] = useState('')
  const [honeypot, setHoneypot] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (submitting) return
    setError(null)

    // Honeypot check
    if (honeypot.trim()) {
      setSubmitted(true)
      return
    }

    if (!fullName.trim()) {
      setError('Please enter your full name.')
      return
    }

    const digitsOnly = phone.replace(/\D/g, '')
    if (digitsOnly.length < 10 || digitsOnly.length > 15) {
      setError('Please enter a valid 10-digit mobile or WhatsApp number.')
      return
    }

    setSubmitting(true)

    try {
      const payload = {
        first_name: fullName.trim(),
        whatsapp: phone.trim(),
        city: city.trim() || 'India',
        occasion: creationType,
        jewellery_type: 'ring',
        budget: budget || null,
        description: notes.trim() ? `Design request: ${notes.trim()}` : undefined,
        currency: 'INR',
        landing_path: '/bespoke',
        preferred_contact: 'whatsapp',
      }

      const res = await fetch('/api/public/consultation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok || data?.ok === false) {
        setError(data?.error || 'Unable to submit your request. Please try again.')
        setSubmitting(false)
        return
      }

      // Fire conversion events exactly once upon confirmed successful submission
      try {
        if (typeof window !== 'undefined') {
          if ((window as any).dataLayer) {
            ;(window as any).dataLayer.push({
              event: 'form_submit',
              event_category: 'lead',
              event_label: 'bespoke_landing_quote',
            })
          }
          if ((window as any).gtag) {
            ;(window as any).gtag('event', 'conversion', {
              send_to: 'AW-18068366696/1IaCCIqgn9UcEOjK1adD',
              value: 1.0,
              currency: 'INR',
            })
          }
          if ((window as any).pintrk) {
            ;(window as any).pintrk('track', 'lead', {
              event_id: `lead_${Date.now()}`,
              lead_type: 'Custom Ring',
            })
          }
        }
      } catch {
        // Pixel errors must not prevent UI thank you state
      }

      setSubmitted(true)
    } catch {
      setError('A connection issue occurred. Please check your network or message us directly on WhatsApp.')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div id="quote-form" className="bg-white border-2 border-[#C6A15B] p-8 sm:p-12 shadow-none rounded-none text-center max-w-lg mx-auto scroll-mt-24">
        <div className="w-14 h-14 bg-[#C6A15B]/15 rounded-none flex items-center justify-center mx-auto mb-4 border border-[#C6A15B]/40">
          <CheckCircle2 className="w-8 h-8 text-[#C6A15B]" />
        </div>
        <h3 className="font-playfair text-2xl sm:text-3xl text-[#0E2233] font-normal">
          Thank You for Your Design Brief
        </h3>
        <p className="mt-3 font-jakarta text-xs sm:text-sm text-[#5A6570] leading-relaxed font-light">
          Our Surat atelier team will reply within 1 hour on WhatsApp with your custom design preview and itemised quote.
        </p>

        <div className="mt-6 pt-6 border-t border-[#C6A15B]/20 space-y-3">
          <p className="font-jakarta text-xs text-[#5A6570]">Want to share reference photos immediately?</p>
          <a
            href={WHATSAPP_DIRECT_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackWhatsAppClick('thankyou_wa_cta')}
            className="inline-flex items-center justify-center gap-2 min-h-[46px] w-full bg-[#25D366] hover:bg-[#20ba59] text-white font-jakarta text-xs uppercase tracking-widest font-semibold px-6 py-3 rounded-none transition-colors duration-200 active:scale-[0.98]"
          >
            <MessageCircle className="w-4 h-4 fill-current" />
            Send Photos on WhatsApp
          </a>
        </div>
      </div>
    )
  }

  const inputStyle =
    'w-full min-h-[44px] border border-[#C6A15B]/40 bg-[#F7F3EA] px-3.5 py-2.5 font-jakarta text-xs sm:text-sm text-[#1A1A1A] rounded-none outline-none transition-colors placeholder:text-[#5A6570]/50 focus:border-[#C6A15B]'

  return (
    <div id="quote-form" className="scroll-mt-24 bg-white border-2 border-[#C6A15B] p-6 sm:p-12 shadow-none rounded-none max-w-xl mx-auto">
      <div className="text-center mb-6">
        <span className="inline-flex items-center gap-1.5 font-jakarta text-[11px] uppercase tracking-[0.25em] text-[#C6A15B] font-semibold">
          <Sparkles className="w-3.5 h-3.5 text-[#C6A15B]" />
          Direct Atelier Consultation
        </span>
        <h2 className="font-playfair text-2xl sm:text-4xl text-[#0E2233] mt-2 mb-2 font-normal">
          Send Your Design Brief
        </h2>
        <p className="font-jakarta text-xs sm:text-sm text-[#5A6570] font-light leading-relaxed">
          Tell us what you want to create. Receive an itemised quote and 3D CAD design preview.
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {/* Honeypot field */}
        <input
          type="text"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
          className="absolute left-[-9999px] h-0 w-0 opacity-0"
        />

        <div>
          <label htmlFor="fullName" className="block font-jakarta text-[10px] sm:text-[11px] uppercase tracking-[0.15em] font-semibold text-[#5A6570] mb-1.5">
            Full Name <span className="text-[#C6A15B]">*</span>
          </label>
          <input
            id="fullName"
            type="text"
            required
            autoComplete="name"
            value={fullName}
            onChange={(e) => { setFullName(e.target.value); setError(null) }}
            placeholder="e.g. Priya Sharma"
            className={inputStyle}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="phone" className="block font-jakarta text-[10px] sm:text-[11px] uppercase tracking-[0.15em] font-semibold text-[#5A6570] mb-1.5">
              WhatsApp / Mobile Number <span className="text-[#C6A15B]">*</span>
            </label>
            <input
              id="phone"
              type="tel"
              inputMode="tel"
              required
              autoComplete="tel"
              value={phone}
              onChange={(e) => { setPhone(e.target.value); setError(null) }}
              placeholder="+91 98765 43210"
              className={inputStyle}
            />
          </div>

          <div>
            <label htmlFor="city" className="block font-jakarta text-[10px] sm:text-[11px] uppercase tracking-[0.15em] font-semibold text-[#5A6570] mb-1.5">
              City
            </label>
            <input
              id="city"
              type="text"
              autoComplete="address-level2"
              value={city}
              onChange={(e) => { setCity(e.target.value); setError(null) }}
              placeholder="e.g. Surat, Mumbai, Delhi"
              className={inputStyle}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block font-jakarta text-[10px] sm:text-[11px] uppercase tracking-[0.15em] font-semibold text-[#5A6570] mb-1.5">
              What do you want to create?
            </label>
            <select
              value={creationType}
              onChange={(e) => setCreationType(e.target.value)}
              className={inputStyle}
            >
              {CREATION_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-jakarta text-[10px] sm:text-[11px] uppercase tracking-[0.15em] font-semibold text-[#5A6570] mb-1.5">
              Estimated Budget <span className="text-[#5A6570]/70 lowercase font-normal">(optional)</span>
            </label>
            <select
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              className={inputStyle}
            >
              {BUDGET_RANGES.map((b) => (
                <option key={b.label} value={b.value}>{b.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block font-jakarta text-[10px] sm:text-[11px] uppercase tracking-[0.15em] font-semibold text-[#5A6570] mb-1.5">
            Describe your idea or diamond preference <span className="text-[#5A6570]/70 lowercase font-normal">(optional)</span>
          </label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. 1.5ct oval solitaire, yellow gold band, minimalist setting..."
            className="w-full border border-[#C6A15B]/40 bg-[#F7F3EA] px-3.5 py-2.5 font-jakarta text-xs sm:text-sm text-[#1A1A1A] rounded-none outline-none transition-colors placeholder:text-[#5A6570]/50 focus:border-[#C6A15B]"
          />
        </div>

        {/* Reference Image tip box */}
        <div className="p-3.5 bg-[#F7F3EA] border border-dashed border-[#C6A15B]/60 flex items-center gap-3 rounded-none">
          <Sparkles className="w-4 h-4 text-[#C6A15B] shrink-0" />
          <p className="font-jakarta text-xs text-[#5A6570]">
            <strong className="text-[#0E2233] font-semibold">Have a reference photo or link?</strong> You can describe it here or share it directly on WhatsApp after submitting.
          </p>
        </div>

        {error && (
          <div role="alert" className="border border-red-300 bg-red-50 p-3 rounded-none text-xs text-red-700 font-jakarta">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full min-h-[48px] bg-[#C6A15B] hover:bg-[#E9C178] text-[#0E2233] font-jakarta font-semibold text-xs uppercase tracking-[0.2em] rounded-none transition-colors duration-200 shadow-none active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
        >
          {submitting ? 'Submitting Your Brief…' : 'Get My Free Quote'}
        </button>

        <p className="font-jakarta text-[11px] text-[#5A6570] text-center font-light leading-relaxed">
          🔒 Direct atelier consultation. Your details remain confidential.
        </p>
      </form>
    </div>
  )
}
