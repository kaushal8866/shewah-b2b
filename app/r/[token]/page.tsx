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
  AlertTriangle,
  Sparkles,
  Award,
  ShieldCheck,
  Scale
} from 'lucide-react'
import Link from 'next/link'

function hexToRgba(hex: string, alpha: number): string {
  if (!hex) return `rgba(255, 255, 255, ${alpha})`
  let cleanHex = hex.replace('#', '')
  if (cleanHex.length === 3) {
    cleanHex = cleanHex.split('').map(char => char + char).join('')
  }
  if (cleanHex.length !== 6) return `rgba(255, 255, 255, ${alpha})`
  const r = parseInt(cleanHex.substring(0, 2), 16)
  const g = parseInt(cleanHex.substring(2, 4), 16)
  const b = parseInt(cleanHex.substring(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

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
    // Load luxury web fonts dynamically
    const fontLink = document.createElement('link')
    fontLink.rel = 'stylesheet'
    fontLink.href = 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300..700;1,300..700&family=Plus+Jakarta+Sans:ital,wght@0,200..800;1,200..800&display=swap'
    document.head.appendChild(fontLink)
  }, [])

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
        <div className="text-center space-y-4">
          <div className="w-10 h-10 rounded-full border-2 border-stone-200 border-t-stone-800 animate-spin mx-auto"></div>
          <p className="text-stone-400 text-xs font-semibold tracking-widest uppercase">Loading collection...</p>
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
  const typography = theme?.typography || { heading: 'Cormorant Garamond', body: 'Plus Jakarta Sans' }
  const btnShape = theme?.buttons?.shape || 'rounded-xl'
  const btnStyle = theme?.buttons?.style || 'fill'
  const btnShadow = theme?.buttons?.shadow || 'sm'

  const bgRgba = hexToRgba(c.background, 0.85)

  return (
    <div
      className="min-h-screen flex flex-col justify-between"
      style={{
        backgroundColor: c.background,
        color: c.text,
        fontFamily: `'Plus Jakarta Sans', sans-serif`
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
          font-family: 'Plus Jakarta Sans', sans-serif !important;
        }
        h1, h2, h3, h4, h5, h6, .brand-font {
          font-family: 'Cormorant Garamond', serif !important;
        }
        .header-blur {
          background-color: ${bgRgba} !important;
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
        }
        .btn-theme-fill {
          background-color: var(--primary-color) !important;
          color: #ffffff !important;
          border-radius: ${
            btnShape === 'rounded-none' ? '0px' :
            btnShape === 'rounded-md' ? '8px' :
            btnShape === 'rounded-xl' ? '16px' : '9999px'
          } !important;
          box-shadow: ${
            btnShadow === 'none' ? 'none' :
            btnShadow === 'sm' ? '0 1px 2px 0 rgba(0,0,0,0.05)' :
            btnShadow === 'md' ? '0 4px 12px -1px rgba(0,0,0,0.08)' : '0 10px 20px -3px rgba(0,0,0,0.1)'
          } !important;
          transition: all 0.2s ease-in-out;
        }
        .btn-theme-fill:hover {
          opacity: 0.95;
          transform: translateY(-0.5px);
        }
        .btn-theme-outline {
          border: 1px solid var(--primary-color) !important;
          background-color: transparent !important;
          color: var(--primary-color) !important;
          border-radius: ${
            btnShape === 'rounded-none' ? '0px' :
            btnShape === 'rounded-md' ? '8px' :
            btnShape === 'rounded-xl' ? '16px' : '9999px'
          } !important;
          transition: all 0.2s ease-in-out;
        }
        .btn-theme-outline:hover {
          background-color: var(--surface-color) !important;
        }
        /* Custom scrollbar */
        .scrollbar-none::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-none {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        `
      }} />

      {/* Header */}
      <header
        className="px-6 py-4 flex items-center justify-between sticky top-0 z-35 border-b header-blur transition-all duration-300"
        style={{ borderColor: c.borders }}
      >
        <div className="flex items-center gap-3">
          {theme?.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={theme.logo_url} alt="" className="h-8 max-w-[120px] object-contain" />
          ) : (
            <div className="w-8 h-8 rounded-full flex items-center justify-center bg-stone-50 border border-stone-200" style={{ backgroundColor: c.surface, borderColor: c.borders }}>
              <Sparkles className="w-4 h-4" style={{ color: c.secondary }} />
            </div>
          )}
          <span className="font-bold text-xl tracking-wide brand-font" style={{ color: c.primary }}>
            {theme?.store_name || reseller.store_name}
          </span>
        </div>

        <button
          onClick={() => {
            setSelectedProduct(null)
            setShowCallbackModal(true)
          }}
          className="text-[10px] font-bold uppercase tracking-[0.15em] px-4 py-2.5 btn-theme-fill text-white"
        >
          Request Callback
        </button>
      </header>

      {/* Hero Banner Area */}
      <section
        className="relative px-6 py-20 text-center space-y-4 overflow-hidden border-b"
        style={{
          background: `linear-gradient(180deg, ${c.surface} 0%, ${c.background} 100%)`,
          borderColor: c.borders
        }}
      >
        {/* Decorative elements */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-80 h-80 rounded-full bg-gradient-to-tr from-amber-500/5 to-transparent blur-3xl pointer-events-none" />
        
        <div className="space-y-1">
          <span className="text-[10px] uppercase tracking-[0.3em] font-bold" style={{ color: c.secondary }}>
            The Fine Collection
          </span>
          <h1 className="text-3xl md:text-4xl font-extralight tracking-wide italic brand-font mt-2" style={{ color: c.primary }}>
            Bespoke Luxury Jewelry
          </h1>
        </div>
        
        <div className="w-12 h-[1px] mx-auto bg-stone-300" style={{ backgroundColor: c.secondary }} />
        
        <p className="text-xs opacity-75 max-w-sm mx-auto leading-relaxed font-light">
          Discover a curation of hand-crafted masterworks designed for life's precious moments. Tap any piece to customize or chat on WhatsApp.
        </p>
      </section>

      {/* Filters & Search */}
      <div className="px-6 py-4 space-y-4">
        <div className="relative">
          <Search className="absolute left-3.5 top-3 w-4 h-4 opacity-40" />
          <input
            type="text"
            className="w-full pl-10 pr-4 py-3 text-xs border rounded-2xl focus:outline-none focus:ring-1 transition-all shadow-[0_2px_8px_rgba(0,0,0,0.01)]"
            style={{
              backgroundColor: c.background,
              borderColor: c.borders,
              color: c.text
            }}
            placeholder="Search our catalog..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Categories sliders list */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none snap-x snap-mandatory">
          {categories.map(cat => {
            const active = categoryFilter === cat
            return (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-4.5 py-2 rounded-full text-[9px] font-bold uppercase tracking-[0.15em] transition-all shrink-0 snap-start border ${
                  active
                    ? 'text-white'
                    : 'bg-stone-50 border-stone-200 text-stone-500 hover:bg-stone-100'
                }`}
                style={{
                  backgroundColor: active ? c.primary : c.background,
                  borderColor: active ? c.primary : c.borders
                }}
              >
                {cat === 'all' ? 'All Collections' : cat}
              </button>
            )
          })}
        </div>
      </div>

      {/* Products Grid */}
      <div className="px-6 py-2 flex-1">
        {filteredProducts.length === 0 ? (
          <div className="text-center py-20 space-y-3 opacity-40">
            <Package className="w-10 h-10 mx-auto stroke-1" />
            <p className="text-xs font-semibold tracking-wider uppercase">No jewelry items found</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {filteredProducts.map(p => {
              const coverImg = p.photo_urls?.[0]
              return (
                <div
                  key={p.id}
                  className="group rounded-3xl overflow-hidden border bg-white flex flex-col justify-between shadow-[0_8px_30px_rgb(0,0,0,0.015)] hover:shadow-[0_20px_40px_rgba(0,0,0,0.06)] hover:-translate-y-1 transition-all duration-300"
                  style={{ backgroundColor: c.background, borderColor: c.borders }}
                >
                  {/* Aspect image */}
                  <div
                    className="relative aspect-[4/5] bg-stone-50 flex items-center justify-center overflow-hidden cursor-pointer"
                    onClick={() => setSelectedProduct(p)}
                  >
                    {coverImg ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={coverImg}
                        alt={p.name}
                        className="w-full h-full object-cover group-hover:scale-103 transition-all duration-500"
                      />
                    ) : (
                      <Package className="w-10 h-10 opacity-20 stroke-1" />
                    )}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/[0.02] transition-colors duration-300" />
                  </div>

                  {/* Body details */}
                  <div className="p-4.5 space-y-3 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-center text-[9px] font-bold font-mono opacity-50 tracking-wider">
                        <span>{p.code}</span>
                        {p.category && (
                          <span className="uppercase text-[8px] bg-stone-50 px-1.5 py-0.5 rounded-full border" style={{ backgroundColor: c.surface, borderColor: c.borders }}>
                            {p.category}
                          </span>
                        )}
                      </div>
                      <h4 className="text-xs font-bold leading-relaxed line-clamp-2 mt-1.5" style={{ color: c.text }}>
                        {p.name}
                      </h4>
                    </div>

                    <div className="flex justify-between items-center pt-3 border-t" style={{ borderColor: c.borders }}>
                      <div className="flex flex-col">
                        <span className="text-[8px] font-bold opacity-45 uppercase tracking-wider">Estimated Price</span>
                        <span className="text-base font-black tracking-tight" style={{ color: c.primary }}>
                          ₹{p.selling_price_rupees.toLocaleString('en-IN')}
                        </span>
                      </div>
                      <button
                        onClick={() => handleEnquiryClick(p)}
                        className="p-3 rounded-xl btn-theme-fill text-white shrink-0 shadow-sm flex items-center justify-center"
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
        className="mt-12 px-6 py-10 border-t text-center space-y-4 text-xs"
        style={{ borderColor: c.borders, backgroundColor: c.surface }}
      >
        <div className="max-w-md mx-auto space-y-2">
          <p className="font-extrabold text-sm brand-font" style={{ color: c.primary }}>
            {theme?.store_name || reseller.store_name}
          </p>
          <p className="opacity-60 text-stone-500 font-light leading-relaxed">
            A premium white-labeled digital boutique partner. Discover high-end, customizable, and authentic jewelry masterworks.
          </p>
        </div>
        <div className="w-8 h-[1px] bg-stone-200 mx-auto" />
        <p className="opacity-40 text-[9px] tracking-wider uppercase">
          © {new Date().getFullYear()} {reseller.owner_name}. All rights reserved.
        </p>
      </footer>

      {/* Product Detail Popup Drawer/Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 transition-all duration-300">
          <div
            className="w-full sm:max-w-lg rounded-t-[2.5rem] sm:rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[85vh] transition-transform duration-300"
            style={{ backgroundColor: c.background }}
          >
            {/* Grab bar for mobile */}
            <div className="w-12 h-1 bg-stone-300 rounded-full mx-auto my-3.5 sm:hidden shrink-0" />

            {/* Header popup */}
            <div className="px-6 py-4 border-b flex items-center justify-between shrink-0" style={{ borderColor: c.borders }}>
              <div>
                <span className="text-[9px] font-bold font-mono opacity-50 tracking-wider">{selectedProduct.code}</span>
                <h4 className="font-bold text-sm tracking-wide mt-0.5">{selectedProduct.name}</h4>
              </div>
              <button
                onClick={() => setSelectedProduct(null)}
                className="p-1.5 border rounded-xl hover:bg-stone-50 text-stone-500 transition-colors"
                style={{ borderColor: c.borders }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content popup */}
            <div className="p-6 overflow-y-auto space-y-6 scrollbar-none flex-1">
              {/* Product Cover image */}
              <div className="aspect-[4/5] bg-stone-50 rounded-2xl overflow-hidden flex items-center justify-center border" style={{ borderColor: c.borders }}>
                {selectedProduct.photo_urls?.[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={selectedProduct.photo_urls[0]} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Package className="w-12 h-12 opacity-20 stroke-1" />
                )}
              </div>

              {/* Description */}
              {selectedProduct.description && (
                <div className="space-y-1.5">
                  <p className="text-[9px] font-bold uppercase tracking-widest opacity-40">Description</p>
                  <p className="text-xs leading-relaxed opacity-85 font-light">{selectedProduct.description}</p>
                </div>
              )}

              {/* Specifications */}
              {selectedProduct.attributes && Object.keys(selectedProduct.attributes).length > 0 && (
                <div className="space-y-3 pt-4 border-t" style={{ borderColor: c.borders }}>
                  <p className="text-[9px] font-bold uppercase tracking-widest opacity-40">Specifications</p>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
                    {Object.entries(selectedProduct.attributes).map(([k, v]) => (
                      <div key={k} className="border-b pb-1.5" style={{ borderColor: c.borders }}>
                        <dt className="opacity-45 text-[9px] uppercase tracking-wider">{k.replace(/_/g, ' ')}</dt>
                        <dd className="font-bold text-stone-900 mt-1">{String(v)}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}

              {/* Premium Guarantees */}
              <div className="grid grid-cols-3 gap-2.5 pt-4 border-t text-[9px] text-center" style={{ borderColor: c.borders }}>
                <div className="p-2.5 bg-stone-50 rounded-2xl border flex flex-col items-center justify-center space-y-1" style={{ backgroundColor: c.surface, borderColor: c.borders }}>
                  <Award className="w-4 h-4 text-stone-600" style={{ color: c.secondary }} />
                  <span className="font-bold opacity-75">IGI Certified</span>
                </div>
                <div className="p-2.5 bg-stone-50 rounded-2xl border flex flex-col items-center justify-center space-y-1" style={{ backgroundColor: c.surface, borderColor: c.borders }}>
                  <ShieldCheck className="w-4 h-4 text-stone-600" style={{ color: c.secondary }} />
                  <span className="font-bold opacity-75">Pure Gold</span>
                </div>
                <div className="p-2.5 bg-stone-50 rounded-2xl border flex flex-col items-center justify-center space-y-1" style={{ backgroundColor: c.surface, borderColor: c.borders }}>
                  <Scale className="w-4 h-4 text-stone-600" style={{ color: c.secondary }} />
                  <span className="font-bold opacity-75">Secure Insured</span>
                </div>
              </div>
            </div>

            {/* Pricing & CTA */}
            <div className="p-6 border-t flex items-center justify-between bg-stone-50/10 shrink-0" style={{ borderColor: c.borders }}>
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest opacity-40">Price Estimate</p>
                <p className="text-lg font-black tracking-tight" style={{ color: c.primary }}>
                  ₹{selectedProduct.selling_price_rupees.toLocaleString('en-IN')}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowCallbackModal(true)
                  }}
                  className="px-4 py-2.5 text-xs font-bold btn-theme-outline"
                >
                  Callback
                </button>
                <button
                  onClick={() => handleEnquiryClick(selectedProduct)}
                  className="px-4.5 py-2.5 btn-theme-fill text-white text-xs font-bold flex items-center gap-1.5"
                >
                  <MessageCircle className="w-4 h-4" /> Enquire
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Request Callback Modal */}
      {showCallbackModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <form
            onSubmit={handleCallbackSubmit}
            className="w-full sm:max-w-md rounded-t-[2.5rem] sm:rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
            style={{ backgroundColor: c.background }}
          >
            {/* Grab bar for mobile */}
            <div className="w-12 h-1 bg-stone-300 rounded-full mx-auto my-3.5 sm:hidden shrink-0" />

            {/* Header callback */}
            <div className="px-6 py-4 border-b flex items-center justify-between shrink-0" style={{ borderColor: c.borders }}>
              <div>
                <h4 className="font-bold text-sm tracking-wide">Request Callback</h4>
                <p className="text-[9px] opacity-60 mt-0.5">We will contact you on WhatsApp to discuss details.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowCallbackModal(false)}
                className="p-1.5 border rounded-xl text-stone-500 transition-colors"
                style={{ borderColor: c.borders }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content Callback */}
            <div className="p-6 space-y-4 overflow-y-auto">
              {callbackSuccess ? (
                <div
                  className="p-5 rounded-2xl text-xs font-bold flex items-center gap-2 border"
                  style={{
                    backgroundColor: c.surface,
                    borderColor: c.borders,
                    color: c.primary
                  }}
                >
                  <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
                  <span>Thank you! We will reach out to you shortly.</span>
                </div>
              ) : (
                <>
                  {selectedProduct && (
                    <div className="p-3 bg-stone-50 rounded-xl border flex items-center justify-between text-xs" style={{ backgroundColor: c.surface, borderColor: c.borders }}>
                      <span className="opacity-50">Inquiry Target SKU:</span>
                      <span className="font-bold">{selectedProduct.code}</span>
                    </div>
                  )}
                  <div>
                    <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1.5">Your Full Name *</label>
                    <input
                      type="text"
                      className="w-full border rounded-xl px-3.5 py-3 text-xs focus:outline-none focus:ring-1"
                      style={{ backgroundColor: c.background, borderColor: c.borders }}
                      placeholder="e.g. Ramesh Kumar"
                      value={customerName}
                      onChange={e => setCustomerName(e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1.5">WhatsApp Phone Number *</label>
                    <input
                      type="tel"
                      className="w-full border rounded-xl px-3.5 py-3 text-xs focus:outline-none focus:ring-1"
                      style={{ backgroundColor: c.background, borderColor: c.borders }}
                      placeholder="e.g. +91 98765 43210"
                      value={customerPhone}
                      onChange={e => setCustomerPhone(e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1.5">Your Message (Optional)</label>
                    <textarea
                      className="w-full border rounded-xl px-3.5 py-3 text-xs focus:outline-none focus:ring-1 h-24 resize-none"
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
              <div className="p-6 border-t bg-stone-50/10 flex justify-end gap-2 shrink-0" style={{ borderColor: c.borders }}>
                <button
                  type="button"
                  onClick={() => setShowCallbackModal(false)}
                  className="px-4 py-2.5 border text-xs font-bold btn-theme-outline"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingCallback}
                  className="px-5 py-2.5 btn-theme-fill text-white text-xs font-bold disabled:opacity-50"
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
