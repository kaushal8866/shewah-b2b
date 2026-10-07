'use client'

import React, { useState } from 'react'
import StoreLayout from '@/components/d2c/StoreLayout'
import { Mail, MessageCircle, Clock, MapPin, Check, ArrowRight, ShieldCheck } from 'lucide-react'

export default function ContactPage() {
  const [formSubmitted, setFormSubmitted] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    inquiryType: 'bespoke',
    message: '',
  })
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    // Simulate luxury concierge dispatch
    setTimeout(() => {
      setSubmitting(false)
      setFormSubmitted(true)
    }, 600)
  }

  return (
    <StoreLayout>
      <div className="max-w-5xl mx-auto px-4 sm:px-8 py-16 lg:py-24 space-y-16">
        {/* Header */}
        <div className="text-center space-y-3 pb-8 border-b border-[#E3DBD4]">
          <span className="text-[11px] uppercase tracking-[0.25em] text-[#CB9274] font-medium font-sans">
            Private Client Care & Atelier
          </span>
          <h1 className="font-serif text-3xl sm:text-5xl font-normal text-[#051F34]">
            Atelier Concierge
          </h1>
          <p className="text-xs sm:text-sm text-[#69727D] max-w-lg mx-auto font-light leading-relaxed font-sans">
            Our diamond specialists, master goldsmiths, and private client liaisons are at your service for personal appointments, bespoke commissions, and fine jewellery guidance.
          </p>
        </div>

        {/* 4 Contact Pillars Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 text-center font-sans">
          {/* Channel 1: WhatsApp */}
          <div className="bg-white p-6 rounded-none border border-[#E3DBD4] flex flex-col justify-between space-y-3">
            <div className="space-y-2">
              <MessageCircle className="w-6 h-6 text-[#CB9274] mx-auto stroke-[1.5]" />
              <h2 className="font-serif text-base text-[#051F34] font-normal">WhatsApp Concierge</h2>
              <p className="text-xs text-[#69727D] font-light">Direct real-time dialogue with our client specialists.</p>
            </div>
            <div className="pt-2">
              <a
                href="https://wa.me/919662266360"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-[11px] uppercase tracking-[0.16em] font-semibold text-[#051F34] hover:text-[#CB9274] underline transition-colors"
              >
                +91 96622 66360 →
              </a>
            </div>
          </div>

          {/* Channel 2: Email */}
          <div className="bg-white p-6 rounded-none border border-[#E3DBD4] flex flex-col justify-between space-y-3">
            <div className="space-y-2">
              <Mail className="w-6 h-6 text-[#CB9274] mx-auto stroke-[1.5]" />
              <h2 className="font-serif text-base text-[#051F34] font-normal">Email Enquiries</h2>
              <p className="text-xs text-[#69727D] font-light">For bespoke commission briefs, valuations, and orders.</p>
            </div>
            <div className="pt-2">
              <a
                href="mailto:concierge@shewah.co"
                className="inline-block text-[11px] uppercase tracking-[0.16em] font-semibold text-[#051F34] hover:text-[#CB9274] underline transition-colors"
              >
                concierge@shewah.co →
              </a>
            </div>
          </div>

          {/* Channel 3: Atelier Address */}
          <div className="bg-white p-6 rounded-none border border-[#E3DBD4] flex flex-col justify-between space-y-3">
            <div className="space-y-2">
              <MapPin className="w-6 h-6 text-[#CB9274] mx-auto stroke-[1.5]" />
              <h2 className="font-serif text-base text-[#051F34] font-normal">Atelier & Studio</h2>
              <p className="text-xs text-[#69727D] font-light">
                Surat Diamond Bourse / Katargam,<br />
                Surat, Gujarat 395004, India
              </p>
            </div>
            <div className="pt-2">
              <span className="text-[11px] uppercase tracking-[0.16em] text-[#69727D]">
                By Private Appointment
              </span>
            </div>
          </div>

          {/* Channel 4: Hours */}
          <div className="bg-white p-6 rounded-none border border-[#E3DBD4] flex flex-col justify-between space-y-3">
            <div className="space-y-2">
              <Clock className="w-6 h-6 text-[#CB9274] mx-auto stroke-[1.5]" />
              <h2 className="font-serif text-base text-[#051F34] font-normal">Operating Hours</h2>
              <p className="text-xs text-[#69727D] font-light">
                Monday – Saturday<br />
                9:00 AM – 8:00 PM IST (GMT+5:30)
              </p>
            </div>
            <div className="pt-2">
              <span className="text-[11px] uppercase tracking-[0.16em] text-[#CB9274] font-semibold">
                Available Now
              </span>
            </div>
          </div>
        </div>

        {/* Concierge Message Form */}
        <div className="bg-white p-8 sm:p-12 border border-[#E3DBD4] rounded-none max-w-3xl mx-auto font-sans">
          <div className="space-y-2 pb-6 border-b border-[#E3DBD4] text-center">
            <span className="text-[11px] uppercase tracking-[0.2em] text-[#CB9274] font-medium">Direct Inquiries</span>
            <h2 className="font-serif text-2xl sm:text-3xl text-[#051F34] font-normal">Send a Private Message</h2>
            <p className="text-xs text-[#69727D] font-light">We respond to all private communications within 24 hours.</p>
          </div>

          {formSubmitted ? (
            <div className="py-12 text-center space-y-4 animate-in fade-in">
              <div className="w-12 h-12 bg-[#F6F4F2] border border-[#CB9274] text-[#CB9274] flex items-center justify-center mx-auto rounded-none">
                <Check className="w-6 h-6" />
              </div>
              <h3 className="font-serif text-xl text-[#051F34]">Thank you for reaching out</h3>
              <p className="text-xs text-[#69727D] max-w-md mx-auto font-light leading-relaxed">
                Your inquiry has been received by our Atelier Concierge team. A dedicated gemologist or client specialist will contact you shortly.
              </p>
              <div className="pt-4">
                <button
                  onClick={() => setFormSubmitted(false)}
                  className="text-xs uppercase tracking-[0.2em] text-[#051F34] underline hover:text-[#CB9274]"
                >
                  Send Another Inquiry
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="pt-8 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-[11px] uppercase tracking-[0.16em] font-medium text-[#051F34] mb-2">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Lady / Sir Your Name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-[#F6F4F2] border border-[#E3DBD4] px-4 py-3 text-xs text-[#051F34] placeholder-[#69727D]/60 rounded-none focus:outline-none focus:border-[#051F34]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] uppercase tracking-[0.16em] font-medium text-[#051F34] mb-2">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="client@domain.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full bg-[#F6F4F2] border border-[#E3DBD4] px-4 py-3 text-xs text-[#051F34] placeholder-[#69727D]/60 rounded-none focus:outline-none focus:border-[#051F34]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-[11px] uppercase tracking-[0.16em] font-medium text-[#051F34] mb-2">
                    Telephone / WhatsApp
                  </label>
                  <input
                    type="tel"
                    placeholder="+1 (555) 000-0000"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full bg-[#F6F4F2] border border-[#E3DBD4] px-4 py-3 text-xs text-[#051F34] placeholder-[#69727D]/60 rounded-none focus:outline-none focus:border-[#051F34]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] uppercase tracking-[0.16em] font-medium text-[#051F34] mb-2">
                    Inquiry Nature *
                  </label>
                  <select
                    value={formData.inquiryType}
                    onChange={(e) => setFormData({ ...formData, inquiryType: e.target.value })}
                    className="w-full bg-[#F6F4F2] border border-[#E3DBD4] px-4 py-3 text-xs text-[#051F34] rounded-none focus:outline-none focus:border-[#051F34]"
                  >
                    <option value="bespoke">Bespoke Custom Commission</option>
                    <option value="sizing">Ring Sizing & Metal Selection</option>
                    <option value="order_status">Existing Order Inquiry</option>
                    <option value="appointment">Private Appointment at Atelier</option>
                    <option value="general">General Client Care</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-[0.16em] font-medium text-[#051F34] mb-2">
                  Your Message or Commission Requirements *
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="Please describe your dream piece, preferred carat weight, diamond shape, or order reference..."
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  className="w-full bg-[#F6F4F2] border border-[#E3DBD4] p-4 text-xs text-[#051F34] placeholder-[#69727D]/60 rounded-none focus:outline-none focus:border-[#051F34]"
                />
              </div>

              <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-[11px] text-[#69727D]">
                  <ShieldCheck className="w-4 h-4 text-[#CB9274]" />
                  <span>Confidential luxury client care. Zero marketing spam.</span>
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full sm:w-auto px-8 py-3.5 bg-[#051F34] text-white text-xs uppercase tracking-[0.2em] font-semibold rounded-none hover:bg-[#CB9274] transition-colors duration-300 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <span>{submitting ? 'Transmitting...' : 'Submit Inquiry'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </StoreLayout>
  )
}
