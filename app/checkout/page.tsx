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
          <Diamond className="w-10 h-10 text-[#A88A4F] mx-auto" />
          <h2 className="font-serif text-2xl text-[#2A241B]">Your Bag is Empty</h2>
          <p className="text-xs text-[#5C5347]">
            Please add items to your shopping bag before proceeding to checkout.
          </p>
          <div className="pt-2">
            <Link
              href="/jewellery"
              className="inline-block px-6 py-2.5 bg-[#2A241B] text-white text-xs uppercase tracking-widest font-medium rounded-full"
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
        <div className="pb-8 border-b border-[#E8DFC9] mb-10">
          <span className="text-[10px] uppercase tracking-[0.3em] text-[#A88A4F] font-semibold">
            Secure Checkout
          </span>
          <h1 className="font-serif text-3xl sm:text-4xl text-[#2A241B] font-light mt-1">
            Complete Your Commission
          </h1>
          <p className="text-xs text-[#5C5347] mt-1">
            Complimentary insured air courier delivery to {market.name}
          </p>
        </div>

        {/* Market shift notification banner */}
        {marketShiftNotice && (
          <div className="mb-6 p-4 bg-[#F4ECDD] border border-[#C9A86A] rounded-xl text-xs text-[#2A241B] flex items-center gap-3 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-[#A88A4F] shrink-0" />
            <span>{marketShiftNotice}</span>
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-3">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          {/* Left Column: Guest info & Address (7 cols) */}
          <div className="lg:col-span-7 space-y-8">
            {/* 1. Contact Information */}
            <div className="bg-white p-6 sm:p-8 rounded-2xl border border-[#E8DFC9] space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#E8DFC9]">
                <h3 className="font-serif text-lg font-medium text-[#2A241B]">
                  1. Contact Details
                </h3>
                <span className="text-[11px] text-[#8C8275]">Guest Checkout Enabled</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[#2A241B]">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Eleanor Vance"
                    className="w-full px-3.5 py-2.5 text-xs bg-[#FBF7F0] border border-[#E8DFC9] rounded-lg outline-none focus:border-[#2A241B]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[#2A241B]">Email Address *</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="eleanor@example.com"
                    className="w-full px-3.5 py-2.5 text-xs bg-[#FBF7F0] border border-[#E8DFC9] rounded-lg outline-none focus:border-[#2A241B]"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#2A241B]">Phone / WhatsApp (for courier dispatch)</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 (555) 019-2834"
                  className="w-full px-3.5 py-2.5 text-xs bg-[#FBF7F0] border border-[#E8DFC9] rounded-lg outline-none focus:border-[#2A241B]"
                />
              </div>
            </div>

            {/* 2. Delivery Address */}
            <div className="bg-white p-6 sm:p-8 rounded-2xl border border-[#E8DFC9] space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#E8DFC9]">
                <h3 className="font-serif text-lg font-medium text-[#2A241B]">
                  2. Shipping Address
                </h3>
                <span className="text-[11px] text-[#A88A4F] flex items-center gap-1 font-medium">
                  <Lock className="w-3 h-3" /> Insured Delivery
                </span>
              </div>

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[#2A241B]">Destination Country *</label>
                  <select
                    value={country}
                    onChange={(e) => handleCountryChange(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs bg-[#FBF7F0] border border-[#E8DFC9] rounded-lg outline-none focus:border-[#2A241B] cursor-pointer"
                  >
                    <option value="US">United States (USD $)</option>
                    <option value="GB">United Kingdom (GBP £)</option>
                    <option value="AU">Australia (AUD A$)</option>
                    <option value="DE">Germany (EUR €)</option>
                    <option value="FR">France (EUR €)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[#2A241B]">Street Address *</label>
                  <input
                    type="text"
                    required
                    value={line1}
                    onChange={(e) => setLine1(e.target.value)}
                    placeholder="742 Evergreen Terrace"
                    className="w-full px-3.5 py-2.5 text-xs bg-[#FBF7F0] border border-[#E8DFC9] rounded-lg outline-none focus:border-[#2A241B]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[#2A241B]">Apartment, Suite, Unit (optional)</label>
                  <input
                    type="text"
                    value={line2}
                    onChange={(e) => setLine2(e.target.value)}
                    placeholder="Apt 4B"
                    className="w-full px-3.5 py-2.5 text-xs bg-[#FBF7F0] border border-[#E8DFC9] rounded-lg outline-none focus:border-[#2A241B]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-[#2A241B]">City *</label>
                    <input
                      type="text"
                      required
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="Springfield"
                      className="w-full px-3.5 py-2.5 text-xs bg-[#FBF7F0] border border-[#E8DFC9] rounded-lg outline-none focus:border-[#2A241B]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-[#2A241B]">State / Region</label>
                    <input
                      type="text"
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      placeholder="Oregon"
                      className="w-full px-3.5 py-2.5 text-xs bg-[#FBF7F0] border border-[#E8DFC9] rounded-lg outline-none focus:border-[#2A241B]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-[#2A241B]">Postal Code *</label>
                    <input
                      type="text"
                      required
                      value={postalCode}
                      onChange={(e) => setPostalCode(e.target.value)}
                      placeholder="97477"
                      className="w-full px-3.5 py-2.5 text-xs bg-[#FBF7F0] border border-[#E8DFC9] rounded-lg outline-none focus:border-[#2A241B]"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[#2A241B]">Order Notes / Custom Requests</label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Include gift packaging, discrete delivery, or specific engraving notes..."
                    className="w-full px-3.5 py-2.5 text-xs bg-[#FBF7F0] border border-[#E8DFC9] rounded-lg outline-none focus:border-[#2A241B]"
                  />
                </div>
              </div>
            </div>

            {/* 3. Consent & Privacy Checkboxes */}
            <div className="bg-white p-6 rounded-2xl border border-[#E8DFC9] space-y-3">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  required
                  checked={privacyPolicyAgreed}
                  onChange={(e) => setPrivacyPolicyAgreed(e.target.checked)}
                  className="mt-0.5 rounded border-stone-300 text-[#2A241B] focus:ring-[#2A241B]"
                />
                <span className="text-xs text-[#5C5347] leading-tight">
                  I agree to the <Link href="/shipping" className="underline text-[#2A241B]">Terms of Service</Link> and acknowledge the <Link href="/returns" className="underline text-[#2A241B]">Privacy Policy</Link>. *
                </span>
              </label>

              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={marketingConsent}
                  onChange={(e) => setMarketingConsent(e.target.checked)}
                  className="mt-0.5 rounded border-stone-300 text-[#2A241B] focus:ring-[#2A241B]"
                />
                <span className="text-xs text-[#5C5347] leading-tight">
                  Keep me informed with private atelier invitations and bespoke diamond releases. (Optional)
                </span>
              </label>
            </div>
          </div>

          {/* Right Column: Order Review (5 cols) */}
          <div className="lg:col-span-5">
            <div className="bg-white p-6 sm:p-8 rounded-2xl border border-[#E8DFC9] space-y-6 sticky top-28 shadow-sm">
              <h3 className="font-serif text-lg font-medium text-[#2A241B] pb-4 border-b border-[#E8DFC9]">
                Review Your Order
              </h3>

              {/* Line items mini-list */}
              <div className="divide-y divide-[#E8DFC9] max-h-72 overflow-y-auto">
                {items.map((it) => (
                  <div key={it.id} className="py-3 flex gap-3 text-xs">
                    <div className="w-14 h-14 bg-[#FBF7F0] rounded-lg border border-[#E8DFC9] overflow-hidden shrink-0">
                      {it.photoUrl ? (
                        <img src={it.photoUrl} alt={it.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center font-serif text-stone-300 text-[9px]">
                          SHEWAH
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-[#2A241B] line-clamp-1">{it.name}</div>
                      <div className="text-[10px] text-[#5C5347]">Qty: {it.quantity}</div>
                      <div className="text-[10px] text-[#8C8275]">
                        {it.config?.metalTone && `${it.config.metalTone} gold`}
                        {it.config?.diamondType && ` • ${it.config.diamondType}`}
                        {it.config?.ringSize && ` • Size ${it.config.ringSize}`}
                      </div>
                    </div>
                    <div className="font-semibold text-[#2A241B]">{it.formattedLineTotal}</div>
                  </div>
                ))}
              </div>

              {/* Financial calculations */}
              <div className="space-y-2.5 pt-4 border-t border-[#E8DFC9] text-xs">
                <div className="flex items-center justify-between text-[#5C5347]">
                  <span>Subtotal</span>
                  <span className="font-medium text-[#2A241B]">{formattedSubtotal}</span>
                </div>

                <div className="flex items-center justify-between text-[#5C5347]">
                  <span>Shipping ({market.countryName})</span>
                  <span className="font-medium text-[#5C7F5F]">Complimentary Express</span>
                </div>

                <div className="flex items-center justify-between text-[#5C5347]">
                  <span>Estimated Taxes & Duties</span>
                  <span className="font-medium text-[#2A241B]">
                    {market.taxModel === 'inclusive' ? market.taxLabel : 'Included in Total'}
                  </span>
                </div>

                <div className="pt-3 border-t border-[#E8DFC9]">
                  <div className="flex items-center justify-between font-serif text-lg text-[#2A241B]">
                    <span>Total Amount</span>
                    <span className="font-semibold">{formattedSubtotal}</span>
                  </div>
                  <p className="text-[11px] text-[#8C8275] mt-1">
                    Billed in {market.currency}. Direct insured delivery guaranteed.
                  </p>
                </div>
              </div>

              {/* Pay button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-4 px-6 bg-[#2A241B] text-white text-xs uppercase tracking-[0.2em] font-medium rounded-xl hover:bg-stone-800 transition-all shadow-lg active:scale-[0.99] flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {submitting ? (
                    <span>Securing Order...</span>
                  ) : (
                    <>
                      <span>Authorize Payment</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>

              <div className="text-[11px] text-[#8C8275] text-center flex items-center justify-center gap-1.5 pt-1">
                <ShieldCheck className="w-4 h-4 text-[#A88A4F]" />
                <span>256-bit encrypted checkout with buyer protection</span>
              </div>
            </div>
          </div>
        </form>
      </div>
    </StoreLayout>
  )
}
