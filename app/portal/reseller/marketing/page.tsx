'use client'

import { useEffect, useState } from 'react'
import {
  Tag,
  Star,
  ShoppingBag,
  Plus,
  Calendar,
  Percent,
  TrendingUp,
  MessageCircle,
  Check,
  X,
  AlertTriangle,
  Send,
  MessageSquare
} from 'lucide-react'

type Coupon = {
  id: string
  code: string
  discount_type: 'percent' | 'amount'
  discount_value: number
  is_active: boolean
  expires_at?: string
  created_at: string
}

type Review = {
  id: string
  rating: number
  review_text?: string
  photo_urls?: string[]
  reseller_reply?: string
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
  products?: {
    code: string
    name: string
  }
}

type AbandonedCart = {
  id: string
  guest_phone?: string
  guest_name?: string
  items: any[]
  status: string
  updated_at: string
  customer?: {
    name: string
    phone: string
  }
}

export default function ResellerMarketingPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [abandonedCarts, setAbandonedCarts] = useState<AbandonedCart[]>([])

  const [activeTab, setActiveTab] = useState<'coupons' | 'reviews' | 'abandoned'>('coupons')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // New Coupon Form
  const [newCode, setNewCode] = useState('')
  const [discountType, setDiscountType] = useState<'percent' | 'amount'>('percent')
  const [discountValue, setDiscountValue] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [submittingCoupon, setSubmittingCoupon] = useState(false)

  // Review reply input mapping
  const [replyInputs, setReplyInputs] = useState<Record<string, string>>({})
  const [submittingReply, setSubmittingReply] = useState<Record<string, boolean>>({})

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    setError('')
    try {
      const [cRes, rRes, aRes] = await Promise.all([
        fetch('/api/portal/reseller/coupons').then(r => r.json()),
        fetch('/api/portal/reseller/reviews').then(r => r.json()),
        fetch('/api/portal/reseller/abandoned-carts').then(r => r.json())
      ])

      if (cRes.error) throw new Error(cRes.error)
      if (rRes.error) throw new Error(rRes.error)
      if (aRes.error) throw new Error(aRes.error)

      setCoupons(cRes.coupons || [])
      setReviews(rRes.reviews || [])
      setAbandonedCarts(aRes.abandonedCarts || [])
    } catch (e: any) {
      setError(e.message || 'Failed to load marketing dashboard.')
    } finally {
      setLoading(false)
    }
  }

  // Coupon actions
  async function handleCreateCoupon(e: React.FormEvent) {
    e.preventDefault()
    if (!newCode.trim() || !discountValue) return

    setSubmittingCoupon(true)
    try {
      const res = await fetch('/api/portal/reseller/coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: newCode,
          discount_type: discountType,
          discount_value: Number(discountValue),
          expires_at: expiryDate ? new Date(expiryDate).toISOString() : null
        })
      })
      const data = await res.json()
      if (data.error) {
        alert(data.error)
      } else {
        setCoupons(prev => [data.coupon, ...prev])
        setNewCode('')
        setDiscountValue('')
        setExpiryDate('')
      }
    } catch (err: any) {
      alert(err.message)
    } finally {
      setSubmittingCoupon(false)
    }
  }

  async function toggleCouponStatus(id: string, currentActive: boolean) {
    try {
      const res = await fetch('/api/portal/reseller/coupons', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_active: !currentActive })
      })
      const data = await res.json()
      if (!data.error) {
        setCoupons(prev =>
          prev.map(c => (c.id === id ? { ...c, is_active: !currentActive } : c))
        )
      }
    } catch {}
  }

  // Review actions
  async function handleReviewStatusUpdate(id: string, newStatus: 'approved' | 'rejected') {
    try {
      const res = await fetch('/api/portal/reseller/reviews', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus })
      })
      const data = await res.json()
      if (!data.error) {
        setReviews(prev =>
          prev.map(r => (r.id === id ? { ...r, status: newStatus } : r))
        )
      }
    } catch {}
  }

  async function handlePostReviewReply(reviewId: string) {
    const text = replyInputs[reviewId]?.trim()
    if (!text) return

    setSubmittingReply(prev => ({ ...prev, [reviewId]: true }))
    try {
      const res = await fetch('/api/portal/reseller/reviews', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: reviewId, reseller_reply: text })
      })
      const data = await res.json()
      if (!data.error) {
        setReviews(prev =>
          prev.map(r => (r.id === reviewId ? { ...r, reseller_reply: text } : r))
        )
        setReplyInputs(prev => ({ ...prev, [reviewId]: '' }))
      }
    } catch (err: any) {
      alert(err.message)
    } finally {
      setSubmittingReply(prev => ({ ...prev, [reviewId]: false }))
    }
  }

  // Generate WhatsApp recovery template link
  function getWhatsAppRecoveryLink(cart: AbandonedCart) {
    const phone = cart.customer?.phone || cart.guest_phone || ''
    const name = cart.customer?.name || cart.guest_name || 'there'
    
    // Format cart summary list
    const itemsList = cart.items
      .map((i: any) => `· ${i.quantity}x ${i.name || 'Jewelry Piece'}${i.ring_size ? ` (Size: ${i.ring_size})` : ''}`)
      .join('\n')

    const message = `Hi ${name}! We noticed you left some beautiful items in your shopping cart:\n\n${itemsList}\n\nWould you like us to help complete your checkout or customize these designs? Let us know here! ✨`
    
    const cleanPhone = phone.replace(/\D/g, '')
    return `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`
  }

  if (loading) return <div className="p-4 lg:p-7 text-stone-400 text-sm">Loading marketing manager...</div>
  if (error) return <div className="p-4 lg:p-7 max-w-4xl mx-auto"><div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div></div>

  const inputStyle = "w-full border border-stone-200 rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 bg-white font-semibold text-stone-850"
  const labelStyle = "block text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1"

  return (
    <div className="p-4 lg:p-7 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-stone-900 tracking-tight flex items-center gap-2">
          <Tag className="w-5.5 h-5.5 text-amber-600" />
          Marketing &amp; Moderation
        </h1>
        <p className="text-xs text-stone-500 mt-0.5">
          Moderate review listings, issue promo coupon codes, and recover abandoned storefront carts.
        </p>
      </div>

      {/* Tabs list */}
      <div className="bg-white border border-stone-200 rounded-2xl p-2 shadow-sm flex gap-2 shrink-0">
        {[
          { id: 'coupons', label: 'Promo Coupons', icon: Tag },
          { id: 'reviews', label: 'Reviews Moderation', icon: Star },
          { id: 'abandoned', label: 'Abandoned Carts', icon: ShoppingBag }
        ].map(t => {
          const Icon = t.icon
          const active = activeTab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                active ? 'bg-stone-900 text-white shadow-sm' : 'text-stone-500 hover:bg-stone-50'
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          )
        })}
      </div>

      {/* 1. Coupons Tab */}
      {activeTab === 'coupons' && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Create Coupon Form */}
          <div className="md:col-span-4 bg-white border border-stone-200 rounded-2xl p-5 shadow-sm space-y-4 h-fit">
            <h3 className="font-bold text-stone-900 text-sm pb-2 border-b border-stone-100 flex items-center gap-1.5">
              <Plus className="w-4.5 h-4.5 text-amber-600" /> Create Coupon Code
            </h3>
            <form onSubmit={handleCreateCoupon} className="space-y-4">
              <div>
                <label className={labelStyle}>Promo Code *</label>
                <input
                  type="text"
                  placeholder="e.g. WELCOME10, SPARKLE"
                  value={newCode}
                  onChange={e => setNewCode(e.target.value)}
                  className={inputStyle}
                  required
                />
              </div>

              <div>
                <label className={labelStyle}>Discount Type</label>
                <select
                  value={discountType}
                  onChange={e => setDiscountType(e.target.value as any)}
                  className={inputStyle}
                >
                  <option value="percent">Percentage (%)</option>
                  <option value="amount">Fixed Amount (₹)</option>
                </select>
              </div>

              <div>
                <label className={labelStyle}>
                  {discountType === 'percent' ? 'Discount Value (%) *' : 'Discount Amount (₹) *'}
                </label>
                <input
                  type="number"
                  placeholder={discountType === 'percent' ? 'e.g. 10' : 'e.g. 500'}
                  value={discountValue}
                  onChange={e => setDiscountValue(e.target.value)}
                  className={inputStyle}
                  required
                />
              </div>

              <div>
                <label className={labelStyle}>Expiration Date</label>
                <input
                  type="date"
                  value={expiryDate}
                  onChange={e => setExpiryDate(e.target.value)}
                  className={inputStyle}
                />
              </div>

              <button
                type="submit"
                disabled={submittingCoupon}
                className="w-full bg-stone-900 hover:bg-stone-850 text-white font-bold py-2.5 rounded-xl text-xs transition-colors"
              >
                {submittingCoupon ? 'Generating Coupon...' : 'Create Promo Code'}
              </button>
            </form>
          </div>

          {/* Coupons List */}
          <div className="md:col-span-8 bg-white border border-stone-200 rounded-2xl p-5 shadow-sm space-y-4">
            <h3 className="font-bold text-stone-900 text-sm pb-2 border-b border-stone-100">
              Active Promo Coupons
            </h3>
            {coupons.length === 0 ? (
              <p className="text-stone-400 text-xs py-4 text-center">No coupon codes generated yet.</p>
            ) : (
              <div className="space-y-3">
                {coupons.map(c => {
                  const isExpired = c.expires_at && new Date(c.expires_at) < new Date()
                  return (
                    <div
                      key={c.id}
                      className={`p-4 border rounded-xl flex items-center justify-between text-xs transition-all ${
                        c.is_active && !isExpired
                          ? 'border-stone-200 bg-stone-50/20'
                          : 'border-stone-150 bg-stone-100/50 opacity-60'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-sm text-[#1E3A5F]">{c.code}</span>
                          <span className="text-[9px] bg-amber-50 border border-amber-200 text-amber-700 font-bold px-2 py-0.5 rounded">
                            {c.discount_type === 'percent' ? `${c.discount_value}% OFF` : `₹${c.discount_value} OFF`}
                          </span>
                        </div>
                        <p className="text-[10px] text-stone-400">
                          Expires: {c.expires_at ? new Date(c.expires_at).toLocaleDateString('en-IN') : 'Never'}
                          {isExpired && ' (Expired)'}
                        </p>
                      </div>

                      <button
                        onClick={() => toggleCouponStatus(c.id, c.is_active)}
                        className={`font-bold px-3 py-1.5 rounded-xl border text-[10px] transition-colors ${
                          c.is_active
                            ? 'bg-red-50 border-red-200 text-red-650 hover:bg-red-100'
                            : 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100'
                        }`}
                      >
                        {c.is_active ? 'Disable' : 'Enable'}
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. Reviews Tab */}
      {activeTab === 'reviews' && (
        <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm space-y-4">
          <h3 className="font-bold text-stone-900 text-sm pb-2 border-b border-stone-100">
            Customer Reviews Moderation Queue
          </h3>
          {reviews.length === 0 ? (
            <p className="text-stone-400 text-xs py-8 text-center">No reviews submitted on your storefront yet.</p>
          ) : (
            <div className="space-y-4">
              {reviews.map(r => {
                const statusColors = {
                  pending: 'bg-yellow-50 text-yellow-750 border-yellow-200',
                  approved: 'bg-green-50 text-green-750 border-green-200',
                  rejected: 'bg-red-50 text-red-750 border-red-200'
                }

                return (
                  <div key={r.id} className="p-4 border border-stone-150 rounded-xl space-y-3.5 bg-stone-50/20">
                    <div className="flex items-start justify-between flex-wrap gap-2">
                      <div>
                        <span className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase border ${statusColors[r.status]}`}>
                          {r.status}
                        </span>
                        <p className="text-xs font-bold text-stone-900 mt-1.5">
                          {r.products?.code} · {r.products?.name}
                        </p>
                      </div>
                      <div className="flex items-center gap-0.5 text-amber-500">
                        {Array.from({ length: 5 }).map((_, idx) => (
                          <Star
                            key={idx}
                            className={`w-3.5 h-3.5 ${
                              idx < r.rating ? 'fill-amber-500' : 'text-stone-200'
                            }`}
                          />
                        ))}
                      </div>
                    </div>

                    <p className="text-xs text-stone-650 leading-relaxed font-semibold italic bg-white p-3 rounded-xl border border-stone-100">
                      "{r.review_text || 'No review comments.'}"
                    </p>

                    {/* Review photos */}
                    {r.photo_urls && r.photo_urls.length > 0 && (
                      <div className="flex gap-1.5">
                        {r.photo_urls.map((url, idx) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            key={idx}
                            src={url}
                            alt=""
                            className="w-12 h-12 object-cover rounded-lg border border-stone-200"
                          />
                        ))}
                      </div>
                    )}

                    {/* Reply Section */}
                    {r.reseller_reply ? (
                      <div className="bg-amber-50/30 border border-amber-100/50 p-3 rounded-xl text-xs space-y-0.5">
                        <p className="font-bold text-amber-800 text-[10px] uppercase">Your Reply</p>
                        <p className="text-stone-700 font-medium">{r.reseller_reply}</p>
                      </div>
                    ) : (
                      <div className="flex gap-2 items-center">
                        <input
                          type="text"
                          placeholder="Type reply to customer..."
                          value={replyInputs[r.id] || ''}
                          onChange={e => setReplyInputs(prev => ({ ...prev, [r.id]: e.target.value }))}
                          className="flex-1 border border-stone-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 bg-white"
                        />
                        <button
                          onClick={() => handlePostReviewReply(r.id)}
                          disabled={submittingReply[r.id] || !replyInputs[r.id]?.trim()}
                          className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-3.5 py-2 rounded-xl text-xs transition-colors disabled:opacity-40 shrink-0"
                        >
                          {submittingReply[r.id] ? 'Posting...' : 'Reply'}
                        </button>
                      </div>
                    )}

                    {/* Action buttons for pending reviews */}
                    {r.status === 'pending' && (
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => handleReviewStatusUpdate(r.id, 'approved')}
                          className="flex items-center gap-1 bg-green-50 hover:bg-green-100 border border-green-200 text-green-700 font-bold px-3 py-1.5 rounded-lg text-[10px] transition-colors"
                        >
                          <Check className="w-3.5 h-3.5" /> Approve Review
                        </button>
                        <button
                          onClick={() => handleReviewStatusUpdate(r.id, 'rejected')}
                          className="flex items-center gap-1 bg-red-50 hover:bg-red-100 border border-red-200 text-red-650 font-bold px-3 py-1.5 rounded-lg text-[10px] transition-colors"
                        >
                          <X className="w-3.5 h-3.5" /> Reject
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* 3. Abandoned Carts Tab */}
      {activeTab === 'abandoned' && (
        <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm space-y-4">
          <h3 className="font-bold text-stone-900 text-sm pb-2 border-b border-stone-100">
            Storefront Abandoned Carts Ledger
          </h3>
          {abandonedCarts.length === 0 ? (
            <p className="text-stone-400 text-xs py-8 text-center">No abandoned storefront carts logged.</p>
          ) : (
            <div className="space-y-3">
              {abandonedCarts.map(cart => {
                const name = cart.customer?.name || cart.guest_name || 'Guest shopper'
                const phone = cart.customer?.phone || cart.guest_phone || '—'
                
                const statusColors: Record<string, string> = {
                  active: 'bg-yellow-50 border-yellow-200 text-yellow-750',
                  recovered: 'bg-green-50 border-green-200 text-green-750',
                  abandoned: 'bg-stone-100 border-stone-250 text-stone-550'
                }

                return (
                  <div key={cart.id} className="p-4 border border-stone-150 rounded-xl space-y-3.5 bg-stone-50/20">
                    <div className="flex justify-between items-start flex-wrap gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold text-stone-900">{name}</h4>
                          <span className={`text-[9px] px-2 py-0.5 rounded font-black uppercase border ${statusColors[cart.status] || 'bg-stone-50'}`}>
                            {cart.status}
                          </span>
                        </div>
                        <p className="text-[10px] text-stone-500 mt-1">Phone: {phone}</p>
                      </div>
                      <p className="text-[9px] text-stone-400 font-semibold">
                        Last Active: {new Date(cart.updated_at).toLocaleString('en-IN')}
                      </p>
                    </div>

                    {/* Cart Items list */}
                    <div className="bg-white border border-stone-100 rounded-xl p-3 space-y-1.5">
                      <p className="text-[9px] text-stone-400 font-bold uppercase tracking-wider mb-1">Leftover items</p>
                      {cart.items.map((item: any, idx: number) => (
                        <div key={idx} className="flex justify-between text-xs text-stone-700">
                          <span className="font-semibold">{item.quantity}x {item.name || 'Jewelry Piece'}</span>
                          {item.ring_size && <span className="text-[10px] text-stone-400">Ring Size: {item.ring_size}</span>}
                        </div>
                      ))}
                    </div>

                    {/* Recovery Quick Message button */}
                    {cart.status === 'active' && (
                      <a
                        href={getWhatsAppRecoveryLink(cart)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 bg-[#25D366] hover:bg-[#20ba59] text-white text-xs font-bold py-2 px-4 rounded-xl transition-all shadow-sm"
                      >
                        <MessageCircle className="w-4 h-4" /> Send Recovery WhatsApp Text
                      </a>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
