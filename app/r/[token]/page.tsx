'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import {
  Package,
  Search,
  MessageCircle,
  Phone,
  Mail,
  MapPin,
  X,
  CheckCircle,
  SlidersHorizontal,
  ChevronRight,
  Info,
  AlertTriangle
} from 'lucide-react'

export default function PublicStorefront() {
  const { token } = useParams() as { token: string }

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reseller, setReseller] = useState<any>(null)
  const [theme, setTheme] = useState<any>(null)
  const [products, setProducts] = useState<any[]>([])

  // Filters state
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')

  // Selected Product details modal
  const [selectedProduct, setSelectedProduct] = useState<any>(null)

  // Callback request form state
  const [showCallbackModal, setShowCallbackModal] = useState(false)
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerMsg, setCustomerMsg] = useState('')
  const [callbackSuccess, setCallbackSuccess] = useState(false)
  const [submittingCallback, setSubmittingCallback] = useState(false)

  useEffect(() => {
    if (token) {
      loadStorefront()
    }
  }, [token])

  async function loadStorefront() {
    try {
      setLoading(true)
      const res = await fetch(`/api/r/${token}`)
      const data = await res.json()

      if (data.error) {
        setError(data.error)
      } else {
        setReseller(data.reseller)
        setTheme(data.theme)
        setProducts(data.products || [])

        // Set document title and favicon dynamically for brand erasure
        if (data.theme?.store_name) {
          document.title = data.theme.store_name
        } else if (data.reseller?.store_name) {
          document.title = data.reseller.store_name
        }

        if (data.theme?.favicon_url) {
          const icon: any = document.querySelector("link[rel*='icon']") || document.createElement('link')
          icon.type = 'image/x-icon'
          icon.rel = 'shortcut icon'
          icon.href = data.theme.favicon_url
          document.getElementsByTagName('head')[0].appendChild(icon)
        }
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleEnquiryClick(product: any) {
    // 1. Log click analytics in background
    fetch(`/api/r/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'enquiry_click' })
    }).catch(() => {})

    // 2. Open WhatsApp chat
    const message = `Hi! I'm interested in: *${product.name}* (SKU: ${product.code}) listed on your online store. Please share pricing and options!`
    const cleanPhone = reseller.phone.replace(/\D/g, '')
    const url = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`
    window.open(url, '_blank')
  }

  async function handleCallbackSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmittingCallback(true)
    setCallbackSuccess(false)

    try {
      const res = await fetch(`/api/r/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: customerName,
          customer_phone: customerPhone,
          customer_message: customerMsg,
          product_id: selectedProduct?.id || null
        })
      })

      const data = await res.json()
      if (data.error) {
        alert(data.error)
      } else {
        setCallbackSuccess(true)
        setCustomerName('')
        setCustomerPhone('')
        setCustomerMsg('')
        setTimeout(() => {
          setShowCallbackModal(false)
          setCallbackSuccess(false)
        }, 3500)
      }
    } catch (err: any) {
      alert('Error submitting callback request: ' + err.message)
    } finally {
      setSubmittingCallback(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 rounded-full border-4 border-amber-600/20 border-t-amber-600 animate-spin mx-auto"></div>
          <p className="text-stone-400 text-xs font-semibold">Loading collection storefront...</p>
        </div>
      </div>
    )
  }

  if (error || !reseller) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
        <div className="bg-white border border-stone-200 rounded-3xl p-8 max-w-sm w-full text-center space-y-4 shadow-md">
          <AlertTriangle className="w-10 h-10 text-red-500 mx-auto" />
          <h2 className="font-bold text-stone-900 text-sm">Storefront Not Found</h2>
          <p className="text-stone-500 text-xs leading-relaxed">{error || 'Storefront does not exist.'}</p>
        </div>
      </div>
    )
  }

  // Categories extraction
  const categories = products ? ['all', ...Array.from(new Set(products.map(p => p.category)))] : []

  const filteredProducts = products.filter(p => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.code.toLowerCase().includes(search.toLowerCase())
    const matchesCategory = categoryFilter === 'all' || p.category === categoryFilter
    return matchesSearch && matchesCategory
  })

  // Format theme colors default fallback
  const c = theme?.colors || {
    primary: '#1E3A5F',
    secondary: '#C9A86A',
    background: '#FFFFFF',
    surface: '#F5F5F5',
    text: '#1C1917',
    borders: '#E7E5E4',
    accent: '#F59E0B'
  }
  const typography = theme?.typography || { heading: 'Inter', body: 'Inter' }
  const btnShape = theme?.buttons?.shape || 'rounded-xl'
  const btnStyle = theme?.buttons?.style || 'fill'
  const btnShadow = theme?.buttons?.shadow || 'sm'

  return (
    <div
      className="min-h-screen flex flex-col justify-between"
      style={{
        backgroundColor: c.background,
        color: c.text,
        fontFamily: `${typography.body}, sans-serif`
      }}
    >
      {/* Inject custom variables directly on style tag */}
      <style dangerouslySetInnerHTML={{
        __html: `
        :root {
          --primary-color: ${c.primary};
          --secondary-color: ${c.secondary};
          --bg-color: ${c.background};
          --surface-color: ${c.surface};
          --text-color: ${c.text};
          --borders-color: ${c.borders};
          --accent-color: ${c.accent};
        }
        body {
          background-color: var(--bg-color) !important;
          color: var(--text-color) !important;
        }
        h1, h2, h3, h4, h5, h6 {
          font-family: ${typography.heading}, sans-serif !important;
        }
        .btn-theme-fill {
          background-color: var(--primary-color) !important;
          color: #ffffff !important;
          border-radius: ${
            btnShape === 'rounded-none' ? '0px' :
            btnShape === 'rounded-md' ? '6px' :
            btnShape === 'rounded-xl' ? '12px' : '9999px'
          } !important;
          box-shadow: ${
            btnShadow === 'none' ? 'none' :
            btnShadow === 'sm' ? '0 1px 2px 0 rgba(0,0,0,0.05)' :
            btnShadow === 'md' ? '0 4px 6px -1px rgba(0,0,0,0.1)' : '0 10px 15px -3px rgba(0,0,0,0.1)'
          } !important;
        }
        .btn-theme-outline {
          border: 2px solid var(--primary-color) !important;
          background-color: transparent !important;
          color: var(--primary-color) !important;
          border-radius: ${
            btnShape === 'rounded-none' ? '0px' :
            btnShape === 'rounded-md' ? '6px' :
            btnShape === 'rounded-xl' ? '12px' : '9999px'
          } !important;
        }
        `
      }} />

      {/* Header */}
      <header
        className="px-4 py-3 flex items-center justify-between sticky top-0 z-30 shadow-sm border-b"
        style={{ backgroundColor: c.background, borderColor: c.borders }}
      >
        <div className="flex items-center gap-2">
          {theme?.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={theme.logo_url} alt="" className="h-6 object-contain" />
          ) : (
            <Package className="w-5 h-5" style={{ color: c.accent }} />
          )}
          <span className="font-extrabold text-sm tracking-tight" style={{ color: c.primary }}>
            {theme?.store_name || reseller.store_name}
          </span>
        </div>

        <button
          onClick={() => {
            setSelectedProduct(null)
            setShowCallbackModal(true)
          }}
          className="text-[10px] font-bold uppercase tracking-wider px-3.5 py-2 btn-theme-fill text-white shadow"
        >
          Request Callback
        </button>
      </header>

      {/* Hero Banner Area */}
      <section
        className="px-4 py-8 text-center space-y-2 border-b"
        style={{ backgroundColor: c.surface, borderColor: c.borders }}
      >
        <h2 className="text-lg font-black uppercase tracking-tight" style={{ color: c.primary }}>
          Curated Fine Jewelry
        </h2>
        <p className="text-xs opacity-75 max-w-md mx-auto leading-relaxed">
          Discover handpicked bespoke designs. Connect directly on WhatsApp to customize and place orders.
        </p>
      </section>

      {/* Filters & Search */}
      <div className="p-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 opacity-40" />
          <input
            type="text"
            className="w-full pl-9 pr-4 py-2 text-xs border rounded-xl focus:outline-none focus:ring-1"
            style={{
              backgroundColor: c.background,
              borderColor: c.borders,
              color: c.text
            }}
            placeholder="Search items by name or SKU..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Categories sliders list */}
        <div className="flex gap-1.5 overflow-x-auto pb-1.5 scrollbar-thin">
          {categories.map(cat => {
            const active = categoryFilter === cat
            return (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-colors shrink-0 ${
                  active
                    ? 'text-white'
                    : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
                }`}
                style={{
                  backgroundColor: active ? c.primary : undefined,
                  borderColor: active ? c.primary : undefined
                }}
              >
                {cat === 'all' ? 'All Collections' : cat}
              </button>
            )
          })}
        </div>
      </div>

      {/* Products Grid */}
      <div className="p-4 flex-1">
        {filteredProducts.length === 0 ? (
          <div className="text-center py-12 space-y-2 opacity-50">
            <Package className="w-8 h-8 mx-auto" />
            <p className="text-xs font-semibold">No jewelry items found</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {filteredProducts.map(p => {
              const coverImg = p.photo_urls?.[0]
              return (
                <div
                  key={p.id}
                  className="rounded-2xl overflow-hidden border flex flex-col justify-between"
                  style={{ backgroundColor: c.surface, borderColor: c.borders }}
                >
                  {/* Aspect image */}
                  <div
                    className="relative aspect-square bg-stone-100 flex items-center justify-center overflow-hidden border-b cursor-pointer"
                    style={{ borderColor: c.borders }}
                    onClick={() => setSelectedProduct(p)}
                  >
                    {coverImg ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={coverImg}
                        alt={p.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Package className="w-8 h-8 opacity-20" />
                    )}
                  </div>

                  {/* Body details */}
                  <div className="p-3 space-y-2.5 flex-1 flex flex-col justify-between">
                    <div>
                      <span className="text-[8px] font-bold font-mono opacity-50">{p.code}</span>
                      <h4 className="text-xs font-bold leading-tight line-clamp-1 mt-0.5">{p.name}</h4>
                    </div>

                    <div className="flex justify-between items-center pt-2 border-t" style={{ borderColor: c.borders }}>
                      <div className="flex flex-col">
                        <span className="text-[8px] font-semibold opacity-40 uppercase">Price</span>
                        <span className="text-sm font-black" style={{ color: c.primary }}>
                          ₹{p.selling_price_rupees.toLocaleString('en-IN')}
                        </span>
                      </div>
                      <button
                        onClick={() => handleEnquiryClick(p)}
                        className="p-2 btn-theme-fill text-white shrink-0"
                        title="Enquire on WhatsApp"
                      >
                        <MessageCircle className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer
        className="px-4 py-6 border-t text-center space-y-2 text-xs"
        style={{ borderColor: c.borders, backgroundColor: c.surface }}
      >
        <p className="font-semibold">{theme?.store_name || reseller.store_name}</p>
        <p className="opacity-50 text-[10px]">
          © {new Date().getFullYear()} {reseller.owner_name}. All rights reserved. White-Label Dropship Store.
        </p>
      </footer>

      {/* Product Detail Popup Drawer/Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div
            className="rounded-3xl max-w-md w-full overflow-hidden shadow-2xl flex flex-col max-h-[85vh]"
            style={{ backgroundColor: c.background }}
          >
            {/* Header popup */}
            <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: c.borders }}>
              <div>
                <span className="text-[9px] font-bold font-mono opacity-50">{selectedProduct.code}</span>
                <h4 className="font-bold text-sm mt-0.5">{selectedProduct.name}</h4>
              </div>
              <button
                onClick={() => setSelectedProduct(null)}
                className="p-1 border rounded-lg hover:bg-stone-50/10 text-stone-500"
                style={{ borderColor: c.borders }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content popup */}
            <div className="p-5 overflow-y-auto space-y-4">
              {/* Product Cover image */}
              <div className="aspect-square bg-stone-150 rounded-2xl overflow-hidden flex items-center justify-center border" style={{ borderColor: c.borders }}>
                {selectedProduct.photo_urls?.[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={selectedProduct.photo_urls[0]} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Package className="w-12 h-12 opacity-20" />
                )}
              </div>

              {/* Description */}
              {selectedProduct.description && (
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase opacity-45">Description</p>
                  <p className="text-xs leading-relaxed opacity-75">{selectedProduct.description}</p>
                </div>
              )}

              {/* Specifications */}
              {Object.keys(selectedProduct.attributes || {}).length > 0 && (
                <div className="space-y-2 pt-2 border-t" style={{ borderColor: c.borders }}>
                  <p className="text-[10px] font-bold uppercase opacity-45">Specifications</p>
                  <dl className="grid grid-cols-2 gap-3 text-xs">
                    {Object.entries(selectedProduct.attributes).map(([k, v]) => (
                      <div key={k} className="border-b pb-1" style={{ borderColor: c.borders }}>
                        <dt className="opacity-50">{k.replace(/_/g, ' ')}</dt>
                        <dd className="font-bold mt-0.5">{String(v)}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}

              {/* Pricing & CTA */}
              <div className="pt-3 border-t flex items-center justify-between" style={{ borderColor: c.borders }}>
                <div>
                  <p className="text-[9px] font-bold uppercase opacity-40">Retail Price</p>
                  <p className="text-lg font-black" style={{ color: c.primary }}>
                    ₹{selectedProduct.selling_price_rupees.toLocaleString('en-IN')}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setShowCallbackModal(true)
                    }}
                    className="px-4 py-2 border text-xs font-bold btn-theme-outline"
                  >
                    Callback
                  </button>
                  <button
                    onClick={() => handleEnquiryClick(selectedProduct)}
                    className="px-4 py-2 btn-theme-fill text-white text-xs font-bold flex items-center gap-1"
                  >
                    <MessageCircle className="w-4 h-4" /> Enquire
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Request Callback Modal */}
      {showCallbackModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleCallbackSubmit}
            className="rounded-3xl max-w-md w-full overflow-hidden shadow-2xl flex flex-col"
            style={{ backgroundColor: c.background }}
          >
            {/* Header callback */}
            <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: c.borders }}>
              <div>
                <h4 className="font-bold text-sm">Request Callback</h4>
                <p className="text-[10px] opacity-50 mt-0.5">We will contact you on WhatsApp to discuss your options.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowCallbackModal(false)}
                className="p-1 border rounded-lg text-stone-500"
                style={{ borderColor: c.borders }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content Callback */}
            <div className="p-5 space-y-4">
              {callbackSuccess ? (
                <div
                  className="p-4 rounded-2xl text-xs font-bold flex items-center gap-2 border"
                  style={{
                    backgroundColor: c.surface,
                    borderColor: c.borders,
                    color: c.primary
                  }}
                >
                  <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
                  <span>Your enquiry has been submitted! We will reach out to you shortly.</span>
                </div>
              ) : (
                <>
                  {selectedProduct && (
                    <div className="p-3 bg-stone-50 rounded-xl border flex items-center justify-between text-xs">
                      <span className="opacity-50">Inquiry Target SKU:</span>
                      <span className="font-bold">{selectedProduct.code}</span>
                    </div>
                  )}
                  <div>
                    <label className="block text-[11px] font-bold text-stone-500 mb-1.5">Your Full Name *</label>
                    <input
                      type="text"
                      className="w-full border rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:ring-1"
                      style={{ backgroundColor: c.background, borderColor: c.borders }}
                      placeholder="e.g. Ramesh Kumar"
                      value={customerName}
                      onChange={e => setCustomerName(e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-stone-500 mb-1.5">WhatsApp Phone Number *</label>
                    <input
                      type="tel"
                      className="w-full border rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:ring-1"
                      style={{ backgroundColor: c.background, borderColor: c.borders }}
                      placeholder="e.g. +91 98765 43210"
                      value={customerPhone}
                      onChange={e => setCustomerPhone(e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-stone-500 mb-1.5">Your Message (Optional)</label>
                    <textarea
                      className="w-full border rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 h-20 resize-none"
                      style={{ backgroundColor: c.background, borderColor: c.borders }}
                      placeholder="Specify customizing requests or preferences..."
                      value={customerMsg}
                      onChange={e => setCustomerMsg(e.target.value)}
                    />
                  </div>
                </>
              )}
            </div>

            {!callbackSuccess && (
              <div className="p-4 border-t bg-stone-50/20 flex justify-end gap-2" style={{ borderColor: c.borders }}>
                <button
                  type="button"
                  onClick={() => setShowCallbackModal(false)}
                  className="px-4 py-2 border text-xs font-bold btn-theme-outline"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingCallback}
                  className="px-5 py-2 btn-theme-fill text-white text-xs font-bold disabled:opacity-50"
                >
                  {submittingCallback ? 'Submitting...' : 'Request Callback'}
                </button>
              </div>
            )}
          </form>
        </div>
      )}
    </div>
  )
}
