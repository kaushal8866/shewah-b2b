'use client'

import React, { useEffect, useState, useMemo } from 'react'
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
  setInfo?: {
    isSet: boolean
    setName: string
    savingsLabel?: string
    sumComponentPrices: number
    suiteSavingsAmount: number
    formattedSavings: string | null
    components: Array<{
      id: string
      code: string
      name: string
      slug: string
      subtitle: string
      category: string
      role: string
      roleLabel: string
      photoUrls: string[]
      primaryPhotoUrl: string | null
      approxGoldWeight: number | null
      diamondWeightCarats: number | null
      price: {
        amount: number
        compareAt: number | null
        currency: string
        formatted: string
      }
    }>
  } | null
  parentSetInfo?: {
    parentId?: string
    parentCode: string
    parentName: string
    parentSlug: string
    parentPhotoUrl: string | null
    parentPrice: {
      amount: number
      formatted: string
    }
    siblings: Array<{
      id: string
      code: string
      name: string
      slug: string
      roleLabel: string
      photoUrl: string | null
      approxGoldWeight: number | null
      price: {
        amount: number
        formatted: string
      }
    }>
  } | null
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
  const [selectedSuiteOption, setSelectedSuiteOption] = useState<'full_suite' | string>('full_suite')
  const [dynamicPrice, setDynamicPrice] = useState<{ amount: number; formatted: string } | null>(null)
  const [calculatingPrice, setCalculatingPrice] = useState(false)
  const [addedNotice, setAddedNotice] = useState(false)
  const [addedNoticeMsg, setAddedNoticeMsg] = useState('Added to shopping bag')

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

  const activeComponent = useMemo(() => {
    if (!product?.setInfo || selectedSuiteOption === 'full_suite') return null
    return product.setInfo.components.find((c) => c.code === selectedSuiteOption) || null
  }, [product, selectedSuiteOption])

  const handleSelectSuiteOption = (optionCode: string) => {
    setSelectedSuiteOption(optionCode)
    if (optionCode === 'full_suite') {
      if (product) {
        setSelectedPhoto(product.primaryPhotoUrl || product.photoUrls?.[0] || null)
        setDynamicPrice({ amount: product.price.amount, formatted: product.price.formatted })
      }
    } else {
      const comp = product?.setInfo?.components.find((c) => c.code === optionCode)
      if (comp) {
        setSelectedPhoto(comp.primaryPhotoUrl || comp.photoUrls?.[0] || null)
        setDynamicPrice({ amount: comp.price.amount, formatted: comp.price.formatted })
      }
    }
  }

  // Recalculate server price when configuration changes
  useEffect(() => {
    const prod = product
    if (!prod) return
    const isRing = Boolean(prod.configurationSchema?.isRing)
    const targetProdId = activeComponent ? activeComponent.id : prod.id

    let cancelled = false
    async function recomputePrice() {
      setCalculatingPrice(true)
      try {
        const res = await fetch('/api/d2c/price', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            productId: targetProdId,
            marketCode: market.code,
            config: {
              metalTone: selectedMetalTone,
              diamondType: selectedDiamondType,
              ringSize: isRing && !activeComponent ? selectedRingSize : undefined,
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
  }, [product, activeComponent, market.code, selectedMetalTone, selectedDiamondType, selectedRingSize])

  const handleAddToBag = () => {
    if (!product) return
    if (activeComponent) {
      addItem({
        id: activeComponent.id,
        code: activeComponent.code,
        name: activeComponent.name,
        category: activeComponent.category,
        photoUrl: activeComponent.primaryPhotoUrl,
        unitPrice: dynamicPrice?.amount || activeComponent.price.amount,
        currency: market.currency as any,
        config: {
          metalTone: selectedMetalTone,
          diamondType: selectedDiamondType,
          karat: 18,
        },
      }, 1)
      setAddedNoticeMsg(`Added ${activeComponent.name} to shopping bag`)
    } else {
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
          ringSize: product.configurationSchema?.isRing ? selectedRingSize : undefined,
          karat: 18,
        },
      }, 1)
      setAddedNoticeMsg(`Added ${product.name} to shopping bag`)
    }
    setAddedNotice(true)
    setTimeout(() => setAddedNotice(false), 3500)
  }

  const handleAddIndividualComponent = (comp: NonNullable<NonNullable<ProductDetail['setInfo']>['components']>[number]) => {
    addItem({
      id: comp.id,
      code: comp.code,
      name: comp.name,
      category: comp.category,
      photoUrl: comp.primaryPhotoUrl,
      unitPrice: comp.price.amount,
      currency: market.currency as any,
      config: {
        metalTone: selectedMetalTone,
        diamondType: selectedDiamondType,
        karat: 18,
      },
    }, 1)
    setAddedNoticeMsg(`Added ${comp.name} to shopping bag`)
    setAddedNotice(true)
    setTimeout(() => setAddedNotice(false), 3500)
  }

  const handleAddParentSuite = (parentSet: NonNullable<ProductDetail['parentSetInfo']>) => {
    addItem({
      id: parentSet.parentId || parentSet.parentCode,
      code: parentSet.parentCode,
      name: parentSet.parentName,
      category: 'necklaces',
      photoUrl: parentSet.parentPhotoUrl,
      unitPrice: parentSet.parentPrice.amount,
      currency: market.currency as any,
      config: {
        metalTone: selectedMetalTone,
        diamondType: selectedDiamondType,
        karat: 18,
      },
    }, 1)
    setAddedNoticeMsg(`Added ${parentSet.parentName} to shopping bag`)
    setAddedNotice(true)
    setTimeout(() => setAddedNotice(false), 3500)
  }

  const handleAddSiblingComponent = (sibling: NonNullable<NonNullable<ProductDetail['parentSetInfo']>['siblings']>[number]) => {
    addItem({
      id: sibling.id,
      code: sibling.code,
      name: sibling.name,
      category: 'earrings',
      photoUrl: sibling.photoUrl,
      unitPrice: sibling.price.amount,
      currency: market.currency as any,
      config: {
        metalTone: selectedMetalTone,
        diamondType: selectedDiamondType,
        karat: 18,
      },
    }, 1)
    setAddedNoticeMsg(`Added ${sibling.name} to shopping bag`)
    setAddedNotice(true)
    setTimeout(() => setAddedNotice(false), 3500)
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
                  alt={activeComponent ? activeComponent.name : product.name}
                  className="w-full h-full object-cover transition-opacity duration-300"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center font-serif text-stone-300 text-lg">
                  SHEWAH ATELIER
                </div>
              )}

              {/* Status Badge */}
              <div className="absolute top-4 left-4">
                {activeComponent ? (
                  <span className="bg-[#2A241B] text-white px-3 py-1 rounded-full text-[10px] uppercase tracking-wider font-medium border border-white/20 shadow-sm flex items-center gap-1.5">
                    <span>{activeComponent.roleLabel} • Individual Piece</span>
                  </span>
                ) : product.setInfo ? (
                  <span className="bg-[#2A241B] text-[#D4AF37] px-3 py-1 rounded-full text-[10px] uppercase tracking-widest font-semibold border border-[#D4AF37]/30 shadow-sm flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3 text-[#D4AF37]" />
                    <span>Complete Suite Ensemble</span>
                  </span>
                ) : (
                  <span className="bg-white/95 backdrop-blur-sm px-3 py-1 rounded-full text-[10px] uppercase tracking-wider text-[#2A241B] font-medium border border-[#E8DFC9]">
                    Made to Order
                  </span>
                )}
              </div>
            </div>

            {/* Thumbnail selector */}
            {(() => {
              const displayPhotos = (activeComponent?.photoUrls && activeComponent.photoUrls.length > 0)
                ? activeComponent.photoUrls
                : product.photoUrls

              return displayPhotos && displayPhotos.length > 1 ? (
                <div className="flex items-center gap-3 overflow-x-auto pb-2">
                  {displayPhotos.map((url, idx) => (
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
              ) : null
            })()}
          </div>

          {/* Right: Commerce & Configuration Column (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            {/* Title & Brand Header */}
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[10px] uppercase tracking-[0.25em] text-[#A88A4F] font-semibold">
                  {activeComponent ? `${product.name} • ${activeComponent.roleLabel}` : product.category}
                </span>
                {product.setInfo && !activeComponent && (
                  <span className="bg-[#2A241B] text-[#D4AF37] px-2.5 py-0.5 rounded-full text-[9px] uppercase tracking-widest font-semibold border border-[#D4AF37]/30">
                    Jewellery Suite
                  </span>
                )}
                {activeComponent && (
                  <span className="bg-[#F4ECDD] text-[#2A241B] px-2.5 py-0.5 rounded-full text-[9px] uppercase tracking-widest font-semibold border border-[#E8DFC9]">
                    Individual Piece
                  </span>
                )}
              </div>
              <h1 className="font-serif text-2xl sm:text-3xl text-[#2A241B] font-medium leading-snug">
                {activeComponent ? activeComponent.name : product.name}
              </h1>
              <p className="text-xs text-[#5C5347] font-light mt-1.5 leading-relaxed">
                {activeComponent ? (activeComponent.subtitle || `Handcrafted individual piece from the ${product.name}.`) : product.subtitle}
              </p>
            </div>

            {/* Price block */}
            <div className="py-3 border-y border-[#E8DFC9] flex items-baseline justify-between">
              <div>
                <div className="text-2xl font-serif font-medium text-[#2A241B] flex items-center gap-2">
                  <span>
                    {dynamicPrice?.formatted || (activeComponent ? activeComponent.price.formatted : product.price.formatted)}
                  </span>
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
                  SKU: {activeComponent ? activeComponent.code : product.code}
                </span>
              </div>
            </div>

            {/* Suite Purchase Option Selector (Order Together or Separately) */}
            {product.setInfo && product.setInfo.components.length > 0 && (
              <div className="p-4 bg-white rounded-2xl border-2 border-[#A88A4F]/30 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#A88A4F]" />
                    <span className="text-xs uppercase tracking-wider font-semibold text-[#2A241B]">
                      Order Together or Separately
                    </span>
                  </div>
                  {product.setInfo.suiteSavingsAmount > 0 && (
                    <span className="bg-[#2A241B] text-[#D4AF37] px-2.5 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-semibold">
                      Save {product.setInfo.formattedSavings} on Suite
                    </span>
                  )}
                </div>

                <div className="space-y-2">
                  {/* Option 1: Complete Suite */}
                  <button
                    type="button"
                    onClick={() => handleSelectSuiteOption('full_suite')}
                    className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-center justify-between ${
                      selectedSuiteOption === 'full_suite'
                        ? 'border-[#2A241B] bg-[#FBF7F0] ring-1 ring-[#2A241B] shadow-sm'
                        : 'border-[#E8DFC9] bg-white hover:border-stone-400'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                        selectedSuiteOption === 'full_suite' ? 'border-[#2A241B]' : 'border-stone-300'
                      }`}>
                        {selectedSuiteOption === 'full_suite' && <div className="w-2 h-2 rounded-full bg-[#2A241B]" />}
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-[#2A241B] flex items-center gap-2">
                          <span>Complete Suite ({product.setInfo.components.length} Pieces)</span>
                          <span className="text-[10px] text-[#A88A4F] font-normal uppercase tracking-wider">Recommended</span>
                        </div>
                        <div className="text-[11px] text-[#5C5347] mt-0.5">
                          Includes {product.setInfo.components.map(c => c.roleLabel).join(' + ')}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-xs font-serif font-bold text-[#2A241B]">
                        {product.price.formatted}
                      </div>
                      {product.setInfo.formattedSavings && (
                        <div className="text-[10px] text-[#5C7F5F] font-medium">
                          Save {product.setInfo.formattedSavings}
                        </div>
                      )}
                    </div>
                  </button>

                  {/* Option 2..N: Individual Components */}
                  {product.setInfo.components.map((comp) => (
                    <button
                      key={comp.code}
                      type="button"
                      onClick={() => handleSelectSuiteOption(comp.code)}
                      className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-center justify-between ${
                        selectedSuiteOption === comp.code
                          ? 'border-[#2A241B] bg-[#FBF7F0] ring-1 ring-[#2A241B] shadow-sm'
                          : 'border-[#E8DFC9] bg-white hover:border-stone-400'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                          selectedSuiteOption === comp.code ? 'border-[#2A241B]' : 'border-stone-300'
                        }`}>
                          {selectedSuiteOption === comp.code && <div className="w-2 h-2 rounded-full bg-[#2A241B]" />}
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-[#2A241B]">
                            {comp.roleLabel} Only
                          </div>
                          <div className="text-[11px] text-[#5C5347] mt-0.5">
                            {comp.name} {comp.approxGoldWeight ? `• ~${comp.approxGoldWeight}g 18K Solid Gold` : ''}
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-xs font-serif font-bold text-[#2A241B]">
                          {comp.price.formatted}
                        </div>
                        <div className="text-[10px] text-stone-400">
                          Individual Piece
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

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

            {/* Configurator: Ring Size (Only if product is a Ring and not a suite piece) */}
            {product.configurationSchema?.isRing && !activeComponent && product.configurationSchema?.sizes?.length > 0 && (
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
                  <span>
                    {activeComponent
                      ? `Add ${activeComponent.roleLabel} to Bag`
                      : product.setInfo
                      ? 'Add Complete Suite to Bag'
                      : 'Add to Shopping Bag'}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (!product) return
                    toggleWishlist({
                      id: activeComponent ? activeComponent.id : product.id,
                      slug: activeComponent ? activeComponent.slug : product.slug,
                      name: activeComponent ? activeComponent.name : product.name,
                      category: activeComponent ? activeComponent.category : product.category,
                      priceFormatted: dynamicPrice?.formatted || (activeComponent ? activeComponent.price.formatted : product.price.formatted),
                      photoUrl: selectedPhoto || product.primaryPhotoUrl,
                      subtitle: activeComponent ? activeComponent.subtitle : product.subtitle,
                    })
                  }}
                  className={`p-4 rounded-xl border transition-all shadow-sm flex items-center justify-center ${
                    isInWishlist(activeComponent ? activeComponent.id : product.id)
                      ? 'border-[#A88A4F] bg-[#2A241B] text-[#D4AF37]'
                      : 'border-[#E8DFC9] bg-white text-[#5C5347] hover:border-[#A88A4F] hover:text-[#2A241B]'
                  }`}
                  aria-label="Save to Wishlist"
                >
                  <Heart className={`w-4 h-4 ${isInWishlist(activeComponent ? activeComponent.id : product.id) ? 'fill-[#D4AF37]' : ''}`} />
                </button>
              </div>

              {addedNotice && (
                <div className="text-center text-xs text-[#5C7F5F] font-medium flex items-center justify-center gap-1.5 pt-1 animate-in fade-in">
                  <Check className="w-4 h-4" />
                  <span>{addedNoticeMsg}! Click the bag icon above to checkout.</span>
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
                    <p>{activeComponent ? activeComponent.subtitle : product.description}</p>
                    <div className="grid grid-cols-2 gap-2 pt-2 text-[11px]">
                      <div><strong>Metal:</strong> Solid 18K Gold / 950 Platinum</div>
                      <div><strong>Hallmark:</strong> {product.specifications.hallmark}</div>
                      <div><strong>Stone Certification:</strong> {product.specifications.certification}</div>
                      <div><strong>Diamond Quality:</strong> Color {product.specifications.diamondColor}, Clarity {product.specifications.diamondClarity}</div>
                      {activeComponent?.approxGoldWeight ? (
                        <div><strong>Gold Weight:</strong> ~{activeComponent.approxGoldWeight}g 18K Solid Gold</div>
                      ) : product.specifications.approxGoldWeight ? (
                        <div><strong>Gold Weight:</strong> ~{product.specifications.approxGoldWeight}g 18K Solid Gold</div>
                      ) : null}
                      {activeComponent?.diamondWeightCarats ? (
                        <div><strong>Solitaire:</strong> ~{activeComponent.diamondWeightCarats}ct Total</div>
                      ) : product.specifications.diamondWeightCarats ? (
                        <div><strong>Solitaire:</strong> ~{product.specifications.diamondWeightCarats}ct Total</div>
                      ) : null}
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

        {/* Part of Suite Banner (When viewing an individual piece belonging to a suite) */}
        {product.parentSetInfo && (
          <div className="mt-12 p-6 sm:p-8 bg-[#FBF7F0] rounded-2xl border border-[#A88A4F]/40 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
              <div className="flex items-center gap-5">
                {product.parentSetInfo.parentPhotoUrl && (
                  <div className="w-20 h-20 rounded-xl overflow-hidden bg-white border border-[#E8DFC9] shrink-0 shadow-sm">
                    <img
                      src={product.parentSetInfo.parentPhotoUrl}
                      alt={product.parentSetInfo.parentName}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#A88A4F]" />
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-[#A88A4F]">
                      Designed as Part of a Matched Suite
                    </span>
                  </div>
                  <h4 className="font-serif text-lg font-medium text-[#2A241B]">
                    {product.parentSetInfo.parentName}
                  </h4>
                  <p className="text-xs text-[#5C5347]">
                    Available as a complete ensemble for <strong className="text-[#2A241B]">{product.parentSetInfo.parentPrice.formatted}</strong>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => handleAddParentSuite(product.parentSetInfo!)}
                  className="flex-1 sm:flex-initial py-3 px-5 bg-[#2A241B] text-white text-xs uppercase tracking-wider font-medium rounded-xl hover:bg-stone-800 transition-all whitespace-nowrap shadow-sm"
                >
                  Order Complete Suite
                </button>
                <Link
                  href={`/jewellery/${product.parentSetInfo.parentSlug}`}
                  className="py-3 px-5 border border-[#E8DFC9] text-[#2A241B] text-xs uppercase tracking-wider font-medium rounded-xl hover:bg-white transition-all whitespace-nowrap"
                >
                  View Suite →
                </Link>
              </div>
            </div>

            {/* Sibling matching piece quick add */}
            {product.parentSetInfo.siblings.length > 0 && (
              <div className="pt-4 border-t border-[#E8DFC9] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3">
                  {product.parentSetInfo.siblings[0].photoUrl && (
                    <img
                      src={product.parentSetInfo.siblings[0].photoUrl}
                      alt={product.parentSetInfo.siblings[0].name}
                      className="w-10 h-10 rounded-lg object-cover border border-[#E8DFC9]"
                    />
                  )}
                  <div className="text-[#5C5347]">
                    <span>Matching companion piece: </span>
                    <strong className="text-[#2A241B]">{product.parentSetInfo.siblings[0].name}</strong>
                    <span className="text-[#8C8275] ml-1.5 font-medium">({product.parentSetInfo.siblings[0].price.formatted})</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleAddSiblingComponent(product.parentSetInfo!.siblings[0])}
                  className="py-2 px-4 bg-[#F4ECDD] text-[#2A241B] hover:bg-[#E8DFC9] text-xs font-semibold rounded-lg border border-[#E8DFC9] transition-all"
                >
                  + Add Matching Piece to Bag
                </button>
              </div>
            )}
          </div>
        )}

        {/* Full Suite Ensemble Showcase (Order Together or Individually) */}
        {product.setInfo && product.setInfo.components.length > 0 && (
          <section className="mt-16 sm:mt-24 pt-12 border-t border-[#E8DFC9]">
            <div className="text-center max-w-2xl mx-auto mb-10 space-y-2">
              <span className="text-[10px] uppercase tracking-[0.3em] text-[#A88A4F] font-medium">
                Curated Ensemble
              </span>
              <h2 className="font-serif text-2xl sm:text-3xl font-light text-[#2A241B]">
                Pieces in this Suite
              </h2>
              <p className="text-xs sm:text-sm text-[#5C5347] font-light">
                Order all creations together as a unified ensemble, or acquire individual pieces separately.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {product.setInfo.components.map((comp) => (
                <div
                  key={comp.code}
                  className="bg-white rounded-2xl border border-[#E8DFC9] p-6 sm:p-8 flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex flex-col sm:flex-row gap-6">
                    <div className="w-full sm:w-44 aspect-square rounded-xl overflow-hidden bg-[#FBF7F0] border border-[#E8DFC9] shrink-0">
                      {comp.primaryPhotoUrl ? (
                        <img
                          src={comp.primaryPhotoUrl}
                          alt={comp.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center font-serif text-stone-300 text-xs">
                          SHEWAH
                        </div>
                      )}
                    </div>

                    <div className="flex-1 space-y-2.5">
                      <span className="text-[10px] uppercase tracking-wider text-[#A88A4F] font-semibold">
                        {comp.roleLabel}
                      </span>
                      <h3 className="font-serif text-lg font-medium text-[#2A241B] leading-snug">
                        {comp.name}
                      </h3>
                      <p className="text-xs text-[#5C5347] font-light">
                        {comp.subtitle}
                      </p>

                      <div className="grid grid-cols-2 gap-2 pt-2 text-[11px] text-[#5C5347]">
                        {comp.approxGoldWeight && (
                          <div>
                            <span className="text-stone-400">Gold:</span> <strong>~{comp.approxGoldWeight}g 18K</strong>
                          </div>
                        )}
                        {comp.diamondWeightCarats && (
                          <div>
                            <span className="text-stone-400">Solitaire:</span> <strong>~{comp.diamondWeightCarats}ct</strong>
                          </div>
                        )}
                        <div>
                          <span className="text-stone-400">Crafting:</span> <strong>Made to Order</strong>
                        </div>
                        <div>
                          <span className="text-stone-400">Assay:</span> <strong>Solid 750 Gold</strong>
                        </div>
                      </div>

                      <div className="pt-3 flex items-baseline gap-2">
                        <span className="text-lg font-serif font-bold text-[#2A241B]">
                          {comp.price.formatted}
                        </span>
                        <span className="text-[11px] text-[#8C8275]">
                          Individual piece price
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-6 mt-6 border-t border-[#E8DFC9] flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => handleAddIndividualComponent(comp)}
                      className="flex-1 py-3 px-4 bg-[#2A241B] text-white text-xs uppercase tracking-wider font-medium rounded-xl hover:bg-stone-800 transition-all shadow-sm flex items-center justify-center gap-2"
                    >
                      <span>Add {comp.roleLabel} Only</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>

                    <Link
                      href={`/jewellery/${comp.slug}`}
                      className="py-3 px-4 border border-[#E8DFC9] text-[#2A241B] text-xs uppercase tracking-wider font-medium rounded-xl hover:border-[#2A241B] hover:bg-[#FBF7F0] transition-all whitespace-nowrap"
                    >
                      View Piece Details
                    </Link>
                  </div>
                </div>
              ))}
            </div>

            {/* Complete Suite Callout Banner */}
            <div className="mt-8 p-6 sm:p-8 bg-[#2A241B] text-white rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-6 shadow-xl">
              <div className="space-y-1.5 text-center sm:text-left">
                <div className="flex items-center justify-center sm:justify-start gap-2">
                  <Sparkles className="w-4 h-4 text-[#D4AF37]" />
                  <span className="text-xs uppercase tracking-[0.2em] text-[#D4AF37] font-semibold">
                    Complete Suite Privilege
                  </span>
                </div>
                <h3 className="font-serif text-xl sm:text-2xl text-white font-normal">
                  Acquire the Complete {product.name}
                </h3>
                <p className="text-xs text-stone-300 font-light max-w-xl">
                  Order all pieces together in a custom presentation suite case.
                  {product.setInfo.formattedSavings && (
                    <span className="text-[#D4AF37] font-medium ml-1">
                      Enjoy {product.setInfo.formattedSavings} bundle privilege compared to acquiring pieces individually.
                    </span>
                  )}
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-4 shrink-0">
                <div className="text-center sm:text-right">
                  <div className="text-2xl font-serif font-semibold text-white">
                    {product.price.formatted}
                  </div>
                  {product.setInfo.formattedSavings && (
                    <div className="text-[10px] text-[#D4AF37]">
                      Saves {product.setInfo.formattedSavings}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    handleSelectSuiteOption('full_suite')
                    handleAddToBag()
                  }}
                  className="py-3.5 px-6 bg-[#D4AF37] text-[#2A241B] text-xs uppercase tracking-widest font-semibold rounded-xl hover:bg-[#c49f2e] transition-all shadow-lg whitespace-nowrap"
                >
                  Add Complete Suite to Bag
                </button>
              </div>
            </div>
          </section>
        )}
      </div>
    </StoreLayout>
  )
}
