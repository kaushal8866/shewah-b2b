'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import StoreLayout from '@/components/d2c/StoreLayout'
import { useCart } from '@/components/d2c/CartContext'
import { MARKETS, type MarketCode } from '@/lib/markets'
import {
  ShieldCheck,
  Lock,
  ArrowRight,
  Truck,
  Diamond,
  AlertCircle,
  CheckCircle2,
  CreditCard,
  Building,
} from 'lucide-react'

export default function CheckoutPage() {
  const router = useRouter()
  const { items, market, setMarketCode, clearCart, formattedSubtotal } = useCart()

  // Form State
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [line1, setLine1] = useState('')
  const [line2, setLine2] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [country, setCountry] = useState(market.defaultCountry)
  const [notes, setNotes] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'concierge_wire'>('card')

  // Consents
  const [privacyPolicyAgreed, setPrivacyPolicyAgreed] = useState(true)
  const [marketingConsent, setMarketingConsent] = useState(false)

  // Validation & Submission
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [marketShiftNotice, setMarketShiftNotice] = useState<string | null>(null)

  // When shipping country changes, check for market locking
  const handleCountryChange = (newCountry: string) => {
    setCountry(newCountry)
    const upper = newCountry.toUpperCase()
    if (upper in MARKETS && upper !== market.code) {
      setMarketCode(upper as MarketCode)
      setMarketShiftNotice(
        `Destination updated to ${MARKETS[upper as MarketCode].name}. Currencies and local tax rules have been automatically re-locked.`
      )
      setTimeout(() => setMarketShiftNotice(null), 6000)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!email.trim() || !fullName.trim()) {
      setError('Please provide your full name and email address.')
      return
    }
    if (!line1.trim() || !city.trim() || !country.trim()) {
      setError('Please complete the shipping address fields.')
      return
    }
    if (!privacyPolicyAgreed) {
      setError('Please accept the Terms & Conditions to proceed.')
      return
    }
    if (items.length === 0) {
      setError('Your shopping bag is empty.')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/d2c/checkout/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer: {
            email: email.trim(),
            fullName: fullName.trim(),
            phone: phone.trim(),
            marketingConsent,
            privacyPolicyAgreed,
          },
          shippingAddress: {
            line1: line1.trim(),
            line2: line2.trim() || null,
            city: city.trim(),
            state: state.trim() || null,
            postalCode: postalCode.trim(),
            country: country.trim(),
          },
          items: items.map((it) => ({
            productId: it.productId,
            quantity: it.quantity,
            config: it.config,
          })),
          notes: notes.trim() || null,
          paymentMethod,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to initialize order.')
      }

      // Clear local shopping bag
      clearCart()

      // Redirect to payment provider or direct order confirmation
      if (data.redirectUrl) {
        window.location.href = data.redirectUrl
      } else if (data.orderId) {
        router.push(`/order-confirmation/${data.orderId}`)
      }
    } catch (err: any) {
      console.error('[Checkout] Submission error:', err)
      setError(err?.message || 'An error occurred during checkout.')
      setSubmitting(false)
    }
  }

  if (items.length === 0) {
    return (
      <StoreLayout>
        <div className="max-w-xl mx-auto px-6 py-24 text-center space-y-4">
          <Diamond className="w-10 h-10 text-[#CB9274] mx-auto" />
          <h2 className="font-serif text-2xl text-[#051F34] font-normal">Your Bag is Empty</h2>
          <p className="text-xs text-[#69727D] font-sans">
            Please add items to your shopping bag before proceeding to checkout.
          </p>
          <div className="pt-2">
            <Link
              href="/jewellery"
              className="inline-block px-8 py-3.5 bg-[#051F34] hover:bg-[#CB9274] text-white text-[11px] uppercase tracking-[0.2em] font-sans font-medium transition-colors"
            >
              Discover Jewellery
            </Link>
          </div>
        </div>
      </StoreLayout>
    )
  }

  return (
    <StoreLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-16">
        {/* Title */}
        <div className="pb-8 border-b border-[#E3DBD4] mb-10">
          <span className="text-[10px] uppercase tracking-[0.2em] text-[#CB9274] font-medium font-sans">
            Secure Checkout
          </span>
          <h1 className="font-serif text-3xl sm:text-4xl text-[#051F34] font-normal mt-1">
            Complete Your Commission
          </h1>
          <p className="text-xs text-[#69727D] mt-1 font-sans">
            Complimentary insured air courier delivery to {market.name}
          </p>
        </div>

        {/* Market shift notification banner */}
        {marketShiftNotice && (
          <div className="mb-6 p-4 bg-[#F6F4F2] border border-[#E3DBD4] text-xs text-[#051F34] font-sans flex items-center gap-3">
            <CheckCircle2 className="w-4 h-4 text-[#CB9274] shrink-0" />
            <span>{marketShiftNotice}</span>
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-xs text-red-700 font-sans flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{error}</span>
            </div>
            {paymentMethod === 'card' && (
              <button
                type="button"
                onClick={() => {
                  setPaymentMethod('concierge_wire')
                  setError(null)
                }}
                className="px-4 py-2 bg-[#051F34] text-white text-[11px] uppercase tracking-[0.18em] font-sans font-medium hover:bg-[#CB9274] transition-colors whitespace-nowrap shrink-0"
              >
                Reserve via Atelier Wire Instead →
              </button>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          {/* Left Column: Guest info & Address (7 cols) */}
          <div className="lg:col-span-7 space-y-8">
            {/* 1. Contact Information */}
            <div className="bg-white p-6 sm:p-8 border border-[#E3DBD4] space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#E3DBD4]">
                <h3 className="font-serif text-lg font-normal text-[#051F34]">
                  1. Contact Details
                </h3>
                <span className="text-[11px] text-[#69727D] font-sans">Guest Checkout Enabled</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-[#051F34] font-sans">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Eleanor Vance"
                    className="w-full px-3.5 py-2.5 text-xs bg-[#F6F4F2] border border-[#E3DBD4] outline-none focus:border-[#051F34] text-[#051F34] font-sans"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-[#051F34] font-sans">Email Address *</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="eleanor@example.com"
                    className="w-full px-3.5 py-2.5 text-xs bg-[#F6F4F2] border border-[#E3DBD4] outline-none focus:border-[#051F34] text-[#051F34] font-sans"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-[#051F34] font-sans">Phone / WhatsApp (for courier dispatch)</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 (555) 019-2834"
                  className="w-full px-3.5 py-2.5 text-xs bg-[#F6F4F2] border border-[#E3DBD4] outline-none focus:border-[#051F34] text-[#051F34] font-sans"
                />
              </div>
            </div>

            {/* 2. Delivery Address */}
            <div className="bg-white p-6 sm:p-8 border border-[#E3DBD4] space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#E3DBD4]">
                <h3 className="font-serif text-lg font-normal text-[#051F34]">
                  2. Shipping Address
                </h3>
                <span className="text-[11px] text-[#CB9274] flex items-center gap-1 font-medium font-sans">
                  <Lock className="w-3 h-3" /> Insured Delivery
                </span>
              </div>

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-[#051F34] font-sans">Destination Country *</label>
                  <select
                    value={country}
                    onChange={(e) => handleCountryChange(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs bg-[#F6F4F2] border border-[#E3DBD4] outline-none focus:border-[#051F34] text-[#051F34] font-sans cursor-pointer"
                  >
                    {Object.values(MARKETS).map((m) => (
                      <option key={m.code} value={m.code}>
                        {m.name} ({m.currency} {m.currencySymbol})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-[#051F34] font-sans">Street Address *</label>
                  <input
                    type="text"
                    required
                    value={line1}
                    onChange={(e) => setLine1(e.target.value)}
                    placeholder="742 Evergreen Terrace"
                    className="w-full px-3.5 py-2.5 text-xs bg-[#F6F4F2] border border-[#E3DBD4] outline-none focus:border-[#051F34] text-[#051F34] font-sans"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-[#051F34] font-sans">Apartment, Suite, Unit (optional)</label>
                  <input
                    type="text"
                    value={line2}
                    onChange={(e) => setLine2(e.target.value)}
                    placeholder="Apt 4B"
                    className="w-full px-3.5 py-2.5 text-xs bg-[#F6F4F2] border border-[#E3DBD4] outline-none focus:border-[#051F34] text-[#051F34] font-sans"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-[#051F34] font-sans">City *</label>
                    <input
                      type="text"
                      required
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="Springfield"
                      className="w-full px-3.5 py-2.5 text-xs bg-[#F6F4F2] border border-[#E3DBD4] outline-none focus:border-[#051F34] text-[#051F34] font-sans"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-[#051F34] font-sans">State / Region</label>
                    <input
                      type="text"
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      placeholder="Oregon"
                      className="w-full px-3.5 py-2.5 text-xs bg-[#F6F4F2] border border-[#E3DBD4] outline-none focus:border-[#051F34] text-[#051F34] font-sans"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-[#051F34] font-sans">Postal Code *</label>
                    <input
                      type="text"
                      required
                      value={postalCode}
                      onChange={(e) => setPostalCode(e.target.value)}
                      placeholder="97477"
                      className="w-full px-3.5 py-2.5 text-xs bg-[#F6F4F2] border border-[#E3DBD4] outline-none focus:border-[#051F34] text-[#051F34] font-sans"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-[#051F34] font-sans">Order Notes / Custom Requests</label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Include gift packaging, discrete delivery, or specific engraving notes..."
                    className="w-full px-3.5 py-2.5 text-xs bg-[#F6F4F2] border border-[#E3DBD4] outline-none focus:border-[#051F34] text-[#051F34] font-sans"
                  />
                </div>
              </div>
            </div>

            {/* 3. Payment Method Selection */}
            <div className="bg-white p-6 sm:p-8 border border-[#E3DBD4] space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#E3DBD4]">
                <h3 className="font-serif text-lg font-normal text-[#051F34]">
                  3. Payment Method
                </h3>
                <span className="text-[11px] text-[#CB9274] flex items-center gap-1 font-medium font-sans">
                  <ShieldCheck className="w-3.5 h-3.5" /> Encrypted Checkout
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Option 1: Card */}
                <div
                  onClick={() => setPaymentMethod('card')}
                  className={`p-4 border cursor-pointer transition-all ${
                    paymentMethod === 'card'
                      ? 'border-[#051F34] bg-[#F6F4F2]'
                      : 'border-[#E3DBD4] hover:border-[#051F34] bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        id="pay-card"
                        name="paymentMethod"
                        checked={paymentMethod === 'card'}
                        onChange={() => setPaymentMethod('card')}
                        className="accent-[#051F34]"
                      />
                      <label htmlFor="pay-card" className="text-xs font-medium text-[#051F34] cursor-pointer font-sans">
                        Credit / Debit Card
                      </label>
                    </div>
                    <CreditCard className="w-4 h-4 text-[#CB9274]" />
                  </div>
                  <p className="text-[11px] text-[#69727D] pl-5 leading-relaxed font-sans">
                    Instant authorization via 256-bit encrypted checkout (Visa, Mastercard, Amex, Apple Pay).
                  </p>
                </div>

                {/* Option 2: Concierge Wire */}
                <div
                  onClick={() => setPaymentMethod('concierge_wire')}
                  className={`p-4 border cursor-pointer transition-all ${
                    paymentMethod === 'concierge_wire'
                      ? 'border-[#051F34] bg-[#F6F4F2]'
                      : 'border-[#E3DBD4] hover:border-[#051F34] bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        id="pay-wire"
                        name="paymentMethod"
                        checked={paymentMethod === 'concierge_wire'}
                        onChange={() => setPaymentMethod('concierge_wire')}
                        className="accent-[#051F34]"
                      />
                      <label htmlFor="pay-wire" className="text-xs font-medium text-[#051F34] cursor-pointer font-sans">
                        Atelier Bank Wire & Concierge
                      </label>
                    </div>
                    <Building className="w-4 h-4 text-[#CB9274]" />
                  </div>
                  <p className="text-[11px] text-[#69727D] pl-5 leading-relaxed font-sans">
                    Direct wire (NEFT/RTGS/Swift). Zero card limits. Immediate piece reservation.
                  </p>
                </div>
              </div>
            </div>

            {/* 4. Consent & Privacy Checkboxes */}
            <div className="bg-white p-6 border border-[#E3DBD4] space-y-3">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  required
                  checked={privacyPolicyAgreed}
                  onChange={(e) => setPrivacyPolicyAgreed(e.target.checked)}
                  className="mt-0.5 border-[#E3DBD4] text-[#051F34] focus:ring-[#051F34]"
                />
                <span className="text-xs text-[#69727D] font-sans leading-tight">
                  I agree to the <Link href="/shipping" className="underline text-[#051F34]">Terms of Service</Link> and acknowledge the <Link href="/returns" className="underline text-[#051F34]">Privacy Policy</Link>. *
                </span>
              </label>

              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={marketingConsent}
                  onChange={(e) => setMarketingConsent(e.target.checked)}
                  className="mt-0.5 border-[#E3DBD4] text-[#051F34] focus:ring-[#051F34]"
                />
                <span className="text-xs text-[#69727D] font-sans leading-tight">
                  Keep me informed with private atelier invitations and bespoke diamond releases. (Optional)
                </span>
              </label>
            </div>
          </div>

          {/* Right Column: Order Review (5 cols) */}
          <div className="lg:col-span-5">
            <div className="bg-white p-6 sm:p-8 border border-[#E3DBD4] space-y-6 sticky top-28 shadow-sm">
              <h3 className="font-serif text-lg font-normal text-[#051F34] pb-4 border-b border-[#E3DBD4]">
                Review Your Order
              </h3>

              {/* Line items mini-list */}
              <div className="divide-y divide-[#E3DBD4] max-h-72 overflow-y-auto">
                {items.map((it) => (
                  <div key={it.id} className="py-3 flex gap-3 text-xs">
                    <div className="w-14 h-14 bg-[#F6F4F2] border border-[#E3DBD4] overflow-hidden shrink-0">
                      {it.photoUrl ? (
                        <img src={it.photoUrl} alt={it.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center font-serif text-stone-300 text-[9px]">
                          SHEWAH
                        </div>
                      )}
                    </div>
                    <div className="flex-1 font-sans">
                      <div className="font-medium text-[#051F34] line-clamp-1">{it.name}</div>
                      <div className="text-[10px] text-[#69727D]">Qty: {it.quantity}</div>
                      <div className="text-[10px] text-[#69727D]">
                        {it.config?.metalTone && `${it.config.metalTone} gold`}
                        {it.config?.diamondType && ` • ${it.config.diamondType}`}
                        {it.config?.ringSize && ` • Size ${it.config.ringSize}`}
                      </div>
                    </div>
                    <div className="font-semibold text-[#051F34] font-sans">{it.formattedLineTotal}</div>
                  </div>
                ))}
              </div>

              {/* Financial calculations */}
              <div className="space-y-2.5 pt-4 border-t border-[#E3DBD4] text-xs font-sans">
                <div className="flex items-center justify-between text-[#69727D]">
                  <span>Subtotal</span>
                  <span className="font-medium text-[#051F34]">{formattedSubtotal}</span>
                </div>

                <div className="flex items-center justify-between text-[#69727D]">
                  <span>Shipping ({market.countryName})</span>
                  <span className="font-medium text-[#5C7F5F]">Complimentary Express</span>
                </div>

                <div className="flex items-center justify-between text-[#69727D]">
                  <span>Estimated Taxes & Duties</span>
                  <span className="font-medium text-[#051F34]">
                    {market.taxModel === 'inclusive' ? market.taxLabel : 'Included in Total'}
                  </span>
                </div>

                <div className="pt-3 border-t border-[#E3DBD4]">
                  <div className="flex items-center justify-between font-serif text-lg text-[#051F34]">
                    <span>Total Amount</span>
                    <span className="font-sans font-semibold text-[#051F34]">{formattedSubtotal}</span>
                  </div>
                  <p className="text-[11px] text-[#69727D] mt-1 font-sans">
                    Billed in {market.currency}. Direct insured delivery guaranteed.
                  </p>
                </div>
              </div>

              {/* Pay button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-4 px-6 bg-[#051F34] hover:bg-[#CB9274] text-white text-[11px] uppercase tracking-[0.2em] font-sans font-medium transition-colors shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {submitting ? (
                    <span>Securing Order...</span>
                  ) : paymentMethod === 'concierge_wire' ? (
                    <>
                      <span>Confirm Atelier Reservation</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  ) : (
                    <>
                      <span>Authorize Payment</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>

              <div className="text-[11px] text-[#69727D] text-center flex items-center justify-center gap-1.5 pt-1 font-sans">
                <ShieldCheck className="w-4 h-4 text-[#CB9274]" />
                <span>256-bit encrypted checkout with buyer protection</span>
              </div>
            </div>
          </div>
        </form>
      </div>
    </StoreLayout>
  )
}
