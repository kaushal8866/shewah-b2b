'use client'

import React, { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import StoreLayout from '@/components/d2c/StoreLayout'
import { useCart } from '@/components/d2c/CartContext'
import { useWishlist } from '@/lib/wishlistStore'
import {
  Diamond,
  ShieldCheck,
  Truck,
  Sparkles,
  Award,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Check,
  HelpCircle,
  Heart,
} from 'lucide-react'

interface ProductDetail {
  id: string
  code: string
  name: string
  slug: string
  subtitle: string
  description: string
  category: string
  photoUrls: string[]
  primaryPhotoUrl: string | null
  craftingLeadDays: number
  estimatedDeliveryWindow: string
  returnPolicy: {
    type: string
    windowDays: number
    eligible: boolean
  }
  specifications: {
    approxGoldWeight: number | null
    diamondWeightCarats: number | null
    diamondShape: string
    diamondColor: string
    diamondClarity: string
    hallmark: string
    certification: string
  }
  configurationSchema: {
    isConfigurable: boolean
    metals: Array<{ id: string; name: string; tone: string; karat: any; colorHex: string }>
    stones: Array<{ id: string; name: string; type: string }>
    sizes: string[]
    isRing: boolean
  }
  price: {
    amount: number
    compareAt: number | null
    currency: string
    formatted: string
    taxLabel: string
    isAvailable: boolean
  }
}

export default function ProductDetailPage() {
  const params = useParams()
  const router = useRouter()
  const slug = (params?.slug as string) || ''
  const { market, addItem } = useCart()
  const { isInWishlist, toggleWishlist } = useWishlist()

  const [product, setProduct] = useState<ProductDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null)

  // Configuration state (Product-Specific)
  const [selectedMetalTone, setSelectedMetalTone] = useState<string>('yellow')
  const [selectedDiamondType, setSelectedDiamondType] = useState<'lab_grown' | 'natural'>('lab_grown')
  const [selectedRingSize, setSelectedRingSize] = useState<string>('US 6')
  const [dynamicPrice, setDynamicPrice] = useState<{ amount: number; formatted: string } | null>(null)
  const [calculatingPrice, setCalculatingPrice] = useState(false)
  const [addedNotice, setAddedNotice] = useState(false)

  // Accordion open states
  const [openSection, setOpenSection] = useState<'specs' | 'shipping' | 'warranty' | 'care' | null>('specs')

  useEffect(() => {
    let cancelled = false
    async function fetchProduct() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/d2c/products/${encodeURIComponent(slug)}?market=${market.code}`)
        if (!res.ok) {
          if (res.status === 404) setError('Product not found or unavailable in your selected market.')
          else setError('Failed to load product details.')
          return
        }
        const data = await res.json()
        if (!cancelled) {
          setProduct(data)
          setSelectedPhoto(data.primaryPhotoUrl || data.photoUrls?.[0] || null)
          setDynamicPrice({ amount: data.price.amount, formatted: data.price.formatted })
          if (data.configurationSchema?.sizes?.length > 0) {
            setSelectedRingSize(data.configurationSchema.sizes[2] || 'US 6')
          }
        }
      } catch (err: any) {
        if (!cancelled) setError(err?.message || 'Failed to load piece.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchProduct()
    return () => { cancelled = true }
  }, [slug, market.code])

  // Recalculate server price when configuration changes
  useEffect(() => {
    const prod = product
    if (!prod) return
    const prodId = prod.id
    const isRing = Boolean(prod.configurationSchema?.isRing)
    let cancelled = false
    async function recomputePrice() {
      setCalculatingPrice(true)
      try {
        const res = await fetch('/api/d2c/price', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            productId: prodId,
            marketCode: market.code,
            config: {
              metalTone: selectedMetalTone,
              diamondType: selectedDiamondType,
              ringSize: isRing ? selectedRingSize : undefined,
            },
          }),
        })
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled && data.formattedPrice) {
          setDynamicPrice({ amount: data.unitPrice, formatted: data.formattedPrice })
        }
      } catch (e) {
        console.warn('[recomputePrice] Error:', e)
      } finally {
        if (!cancelled) setCalculatingPrice(false)
      }
    }
    recomputePrice()
    return () => { cancelled = true }
  }, [product, market.code, selectedMetalTone, selectedDiamondType, selectedRingSize])

  const handleAddToBag = () => {
    if (!product) return
    addItem({
      id: product.id,
      code: product.code,
      name: product.name,
      category: product.category,
      photoUrl: product.primaryPhotoUrl,
      unitPrice: dynamicPrice?.amount || product.price.amount,
      currency: market.currency as any,
      config: {
        metalTone: selectedMetalTone,
        diamondType: selectedDiamondType,
        ringSize: product.configurationSchema.isRing ? selectedRingSize : undefined,
        karat: 18,
      },
    }, 1)
    setAddedNotice(true)
    setTimeout(() => setAddedNotice(false), 3000)
  }

  if (loading) {
    return (
      <StoreLayout>
        <div className="max-w-7xl mx-auto px-6 py-20 animate-pulse grid grid-cols-1 lg:grid-cols-2 gap-12">
          <div className="aspect-square bg-stone-200 rounded-2xl" />
          <div className="space-y-4 py-8">
            <div className="h-4 bg-stone-200 rounded w-1/4" />
            <div className="h-8 bg-stone-200 rounded w-3/4" />
            <div className="h-6 bg-stone-200 rounded w-1/3" />
            <div className="h-32 bg-stone-200 rounded" />
          </div>
        </div>
      </StoreLayout>
    )
  }

  if (error || !product) {
    return (
      <StoreLayout>
        <div className="max-w-xl mx-auto px-6 py-24 text-center space-y-4">
          <Diamond className="w-12 h-12 text-[#A88A4F] mx-auto" />
          <h2 className="font-serif text-2xl text-[#2A241B]">Piece Unavailable</h2>
          <p className="text-xs text-[#5C5347]">{error || 'This piece could not be retrieved.'}</p>
          <div className="pt-4">
            <Link
              href="/jewellery"
              className="px-6 py-2.5 bg-[#2A241B] text-white text-xs uppercase tracking-widest font-medium rounded-full"
            >
              Return to Catalog
            </Link>
          </div>
        </div>
      </StoreLayout>
    )
  }

  return (
    <StoreLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-16">
        {/* Breadcrumbs */}
        <div className="text-[11px] uppercase tracking-wider text-[#8C8275] mb-6 sm:mb-8 flex items-center gap-2 whitespace-nowrap overflow-x-auto no-scrollbar">
          <Link href="/" className="hover:text-[#2A241B] transition-colors shrink-0">Home</Link>
          <span className="text-stone-300 select-none shrink-0">/</span>
          <Link href="/jewellery" className="hover:text-[#2A241B] transition-colors shrink-0">Jewellery</Link>
          <span className="text-stone-300 select-none shrink-0">/</span>
          <span className="text-[#2A241B] font-medium shrink-0">{product.category}</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16">
          {/* Left: Gallery Column (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            {/* Main high-res view */}
            <div className="aspect-square bg-white rounded-2xl border border-[#E8DFC9] overflow-hidden shadow-sm relative">
              {selectedPhoto ? (
                <img
                  src={selectedPhoto}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center font-serif text-stone-300 text-lg">
                  SHEWAH ATELIER
                </div>
              )}

              <div className="absolute top-4 left-4 bg-white/95 backdrop-blur-sm px-3 py-1 rounded-full text-[10px] uppercase tracking-wider text-[#2A241B] font-medium border border-[#E8DFC9]">
                Made to Order
              </div>
            </div>

            {/* Thumbnail selector */}
            {product.photoUrls && product.photoUrls.length > 1 && (
              <div className="flex items-center gap-3 overflow-x-auto pb-2">
                {product.photoUrls.map((url, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedPhoto(url)}
                    className={`w-20 h-20 rounded-xl overflow-hidden border-2 transition-all shrink-0 ${
                      selectedPhoto === url
                        ? 'border-[#A88A4F] ring-2 ring-[#A88A4F] ring-offset-2 ring-offset-[#FBF7F0] shadow-md scale-[1.02]'
                        : 'border-[#E8DFC9] opacity-70 hover:opacity-100 hover:border-stone-400'
                    }`}
                  >
                    <img src={url} alt={`${product.name} ${idx + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right: Commerce & Configuration Column (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            {/* Title & Brand Header */}
            <div>
              <span className="text-[10px] uppercase tracking-[0.25em] text-[#A88A4F] font-semibold block mb-1">
                {product.category}
              </span>
              <h1 className="font-serif text-2xl sm:text-3xl text-[#2A241B] font-medium leading-snug">
                {product.name}
              </h1>
              <p className="text-xs text-[#5C5347] font-light mt-1.5 leading-relaxed">
                {product.subtitle}
              </p>
            </div>

            {/* Price block */}
            <div className="py-3 border-y border-[#E8DFC9] flex items-baseline justify-between">
              <div>
                <div className="text-2xl font-serif font-medium text-[#2A241B] flex items-center gap-2">
                  <span>{dynamicPrice?.formatted || product.price.formatted}</span>
                  {calculatingPrice && (
                    <span className="text-[10px] font-sans text-[#A88A4F] animate-pulse">
                      Updating...
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-[#8C8275] mt-0.5">
                  {product.price.taxLabel} • Complimentary worldwide shipping
                </div>
              </div>

              <div className="text-right">
                <span className="text-[11px] font-mono text-stone-500 uppercase tracking-widest">
                  SKU: {product.code}
                </span>
              </div>
            </div>

            {/* Configurator: Metal Tone */}
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wider font-semibold text-[#2A241B] flex items-center justify-between">
                <span>Metal: Solid 18K Gold / Platinum</span>
                <span className="text-[#A88A4F] capitalize">{selectedMetalTone} Gold</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'yellow', name: '18K Yellow Gold', hex: '#E5C483' },
                  { id: 'white',  name: '18K White Gold',  hex: '#E8E8E8' },
                  { id: 'rose',   name: '18K Rose Gold',   hex: '#E8B4B8' },
                  { id: 'platinum', name: '950 Platinum',  hex: '#D8D8D8' },
                ].map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setSelectedMetalTone(m.id)}
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-xs text-left transition-all ${
                      selectedMetalTone === m.id
                        ? 'border-[#2A241B] bg-white shadow-sm ring-1 ring-[#2A241B]'
                        : 'border-[#E8DFC9] bg-[#FBF7F0] hover:border-stone-400'
                    }`}
                  >
                    <span className="w-3.5 h-3.5 rounded-full border border-stone-300 shadow-inner" style={{ backgroundColor: m.hex }} />
                    <span className="font-medium text-[#2A241B]">{m.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Configurator: Diamond Choice */}
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wider font-semibold text-[#2A241B] flex items-center justify-between">
                <span>Diamond Certification</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setSelectedDiamondType('lab_grown')}
                  className={`p-3 rounded-xl border text-xs text-left transition-all ${
                    selectedDiamondType === 'lab_grown'
                      ? 'border-[#2A241B] bg-white shadow-sm ring-1 ring-[#2A241B]'
                      : 'border-[#E8DFC9] bg-[#FBF7F0] hover:border-stone-400'
                  }`}
                >
                  <div className="font-semibold text-[#2A241B]">Lab-Grown Diamond</div>
                  <div className="text-[10px] text-[#5C5347] mt-0.5">IGI Certified • D-F / VS+</div>
                </button>
                <button
                  onClick={() => setSelectedDiamondType('natural')}
                  className={`p-3 rounded-xl border text-xs text-left transition-all ${
                    selectedDiamondType === 'natural'
                      ? 'border-[#2A241B] bg-white shadow-sm ring-1 ring-[#2A241B]'
                      : 'border-[#E8DFC9] bg-[#FBF7F0] hover:border-stone-400'
                  }`}
                >
                  <div className="font-semibold text-[#2A241B]">Natural Mined Diamond</div>
                  <div className="text-[10px] text-[#5C5347] mt-0.5">GIA Certified • Rare Heirloom</div>
                </button>
              </div>
            </div>

            {/* Configurator: Ring Size (Only if product is a Ring) */}
            {product.configurationSchema?.isRing && product.configurationSchema?.sizes?.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="uppercase tracking-wider font-semibold text-[#2A241B]">
                    Ring Size (US)
                  </span>
                  <Link
                    href="/ring-size-guide"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#A88A4F] text-[11px] underline hover:text-[#2A241B] transition-colors"
                  >
                    Complimentary Sizer & Guide
                  </Link>
                </div>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
                  {product.configurationSchema.sizes.map((sz) => (
                    <button
                      key={sz}
                      onClick={() => setSelectedRingSize(sz)}
                      className={`py-2 text-xs rounded-lg border text-center transition-all ${
                        selectedRingSize === sz
                          ? 'bg-[#2A241B] text-white font-medium shadow-sm'
                          : 'bg-white border-[#E8DFC9] text-[#5C5347] hover:border-stone-400'
                      }`}
                    >
                      {sz}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Made-to-Order Timeline Box */}
            <div className="bg-[#F4ECDD] p-4 rounded-xl border border-[#E8DFC9] text-xs text-[#5C5347] space-y-1.5">
              <div className="flex items-center gap-2 font-medium text-[#2A241B]">
                <Truck className="w-4 h-4 text-[#A88A4F]" />
                <span>Made to Order Delivery Window:</span>
              </div>
              <p className="text-[11px]">
                Crafted especially for you in approximately {product.craftingLeadDays} business days.
                Estimated arrival in {market.name}: <strong className="text-[#2A241B]">{product.estimatedDeliveryWindow}</strong>.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center gap-3">
                <button
                  onClick={handleAddToBag}
                  className="flex-1 py-4 px-6 bg-[#2A241B] text-white text-xs uppercase tracking-[0.2em] font-medium rounded-xl hover:bg-stone-800 transition-all shadow-lg active:scale-[0.99] flex items-center justify-center gap-2"
                >
                  <span>Add to Shopping Bag</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (!product) return
                    toggleWishlist({
                      id: product.id,
                      slug: product.slug,
                      name: product.name,
                      category: product.category,
                      priceFormatted: dynamicPrice?.formatted || product.price.formatted,
                      photoUrl: selectedPhoto || product.primaryPhotoUrl,
                      subtitle: product.subtitle,
                    })
                  }}
                  className={`p-4 rounded-xl border transition-all shadow-sm flex items-center justify-center ${
                    isInWishlist(product.id)
                      ? 'border-[#A88A4F] bg-[#2A241B] text-[#D4AF37]'
                      : 'border-[#E8DFC9] bg-white text-[#5C5347] hover:border-[#A88A4F] hover:text-[#2A241B]'
                  }`}
                  aria-label={isInWishlist(product.id) ? 'Remove from Saved Pieces' : 'Save to Wishlist'}
                >
                  <Heart className={`w-4 h-4 ${isInWishlist(product.id) ? 'fill-[#D4AF37]' : ''}`} />
                </button>
              </div>

              {addedNotice && (
                <div className="text-center text-xs text-[#5C7F5F] font-medium flex items-center justify-center gap-1.5 pt-1 animate-in fade-in">
                  <Check className="w-4 h-4" />
                  <span>Added to bag! Click the bag icon above to checkout.</span>
                </div>
              )}
            </div>

            {/* Accordions: Specifications, Shipping, Warranty */}
            <div className="pt-6 border-t border-[#E8DFC9] divide-y divide-[#E8DFC9]">
              {/* Accordion 1: Specifications */}
              <div className="py-3">
                <button
                  onClick={() => setOpenSection(openSection === 'specs' ? null : 'specs')}
                  className="w-full flex items-center justify-between text-xs uppercase tracking-wider font-semibold text-[#2A241B]"
                >
                  <span>The Specifications & Provenance</span>
                  {openSection === 'specs' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {openSection === 'specs' && (
                  <div className="pt-3 text-xs text-[#5C5347] space-y-2 animate-in fade-in">
                    <p>{product.description}</p>
                    <div className="grid grid-cols-2 gap-2 pt-2 text-[11px]">
                      <div><strong>Metal:</strong> Solid 18K Gold / 950 Platinum</div>
                      <div><strong>Hallmark:</strong> {product.specifications.hallmark}</div>
                      <div><strong>Stone Certification:</strong> {product.specifications.certification}</div>
                      <div><strong>Diamond Quality:</strong> Color {product.specifications.diamondColor}, Clarity {product.specifications.diamondClarity}</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Accordion 2: Shipping & Returns */}
              <div className="py-3">
                <button
                  onClick={() => setOpenSection(openSection === 'shipping' ? null : 'shipping')}
                  className="w-full flex items-center justify-between text-xs uppercase tracking-wider font-semibold text-[#2A241B]"
                >
                  <span>Insured Courier & Return Policy</span>
                  {openSection === 'shipping' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {openSection === 'shipping' && (
                  <div className="pt-3 text-xs text-[#5C5347] space-y-2 animate-in fade-in">
                    <p>
                      Each order is dispatched via direct, fully insured air courier with signature verification upon delivery.
                    </p>
                    <p>
                      <strong>Return Policy:</strong> {product.returnPolicy.type === 'made_to_order' ? 'Made-to-order creations are eligible for complimentary 30-day resizing and inspection. Inquire for return eligibility.' : 'Standard 30-day return policy applies.'}
                    </p>
                  </div>
                )}
              </div>

              {/* Accordion 3: Lifetime Care */}
              <div className="py-3">
                <button
                  onClick={() => setOpenSection(openSection === 'warranty' ? null : 'warranty')}
                  className="w-full flex items-center justify-between text-xs uppercase tracking-wider font-semibold text-[#2A241B]"
                >
                  <span>Lifetime Atelier Warranty</span>
                  {openSection === 'warranty' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {openSection === 'warranty' && (
                  <div className="pt-3 text-xs text-[#5C5347] space-y-2 animate-in fade-in">
                    <p>
                      Every Shewah piece is accompanied by our lifetime craftsmanship guarantee, including complimentary annual prong tightening, ultrasonic cleaning, and rhodium re-plating.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </StoreLayout>
  )
}
