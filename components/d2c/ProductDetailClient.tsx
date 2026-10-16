'use client'

import React, { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import StoreLayout from '@/components/d2c/StoreLayout'
import { useCart } from '@/components/d2c/CartContext'
import { useWishlist } from '@/lib/wishlistStore'
import type { D2CProductDetail } from '@/lib/d2cProductDetail'
import {
  Diamond,
  Truck,
  Sparkles,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Check,
  Heart,
} from 'lucide-react'

interface ProductDetailClientProps {
  initialProduct: D2CProductDetail
}

export default function ProductDetailClient({ initialProduct }: ProductDetailClientProps) {
  const { market, addItem } = useCart()
  const { isInWishlist, toggleWishlist } = useWishlist()

  const [product, setProduct] = useState<D2CProductDetail>(initialProduct)
  const [loading, setLoading] = useState(false)
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(
    initialProduct.primaryPhotoUrl || initialProduct.photoUrls?.[0] || null
  )

  // Configuration state
  const [selectedMetalTone, setSelectedMetalTone] = useState<string>('yellow')
  const [selectedDiamondType, setSelectedDiamondType] = useState<'lab_grown' | 'natural'>('lab_grown')
  const [selectedRingSize, setSelectedRingSize] = useState<string>(
    initialProduct.configurationSchema?.sizes?.[2] || 'US 6'
  )
  const [selectedSuiteOption, setSelectedSuiteOption] = useState<'full_suite' | string>('full_suite')
  const [dynamicPrice, setDynamicPrice] = useState<{ amount: number; formatted: string | null }>({
    amount: initialProduct.price.amount,
    formatted: initialProduct.price.formatted,
  })
  const [calculatingPrice, setCalculatingPrice] = useState(false)
  const [addedNotice, setAddedNotice] = useState(false)
  const [addedNoticeMsg, setAddedNoticeMsg] = useState('Added to shopping bag')

  // Accordion open states
  const [openSection, setOpenSection] = useState<'specs' | 'shipping' | 'warranty' | 'care' | null>('specs')

  // When user market changes, reload market-specific pricing and delivery window
  useEffect(() => {
    if (market.code === product.market) return
    let cancelled = false
    async function reloadForMarket() {
      setLoading(true)
      try {
        const res = await fetch(`/api/d2c/products/${encodeURIComponent(product.slug)}?market=${market.code}`)
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled && data) {
          setProduct(data)
          setDynamicPrice({ amount: data.price.amount, formatted: data.price.formatted })
        }
      } catch (err) {
        console.warn('[ProductDetailClient] Market reload error:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    reloadForMarket()
    return () => { cancelled = true }
  }, [market.code, product.slug, product.market])

  const activeComponent = useMemo(() => {
    if (!product.setInfo || selectedSuiteOption === 'full_suite') return null
    return product.setInfo.components.find((c) => c.code === selectedSuiteOption) || null
  }, [product, selectedSuiteOption])

  const handleSelectSuiteOption = (optionCode: string) => {
    setSelectedSuiteOption(optionCode)
    if (optionCode === 'full_suite') {
      setSelectedPhoto(product.primaryPhotoUrl || product.photoUrls?.[0] || null)
      setDynamicPrice({ amount: product.price.amount, formatted: product.price.formatted })
    } else {
      const comp = product.setInfo?.components.find((c) => c.code === optionCode)
      if (comp) {
        setSelectedPhoto(comp.primaryPhotoUrl || comp.photoUrls?.[0] || null)
        setDynamicPrice({ amount: comp.price.amount, formatted: comp.price.formatted })
      }
    }
  }

  // Recalculate server price when variant configuration changes
  useEffect(() => {
    const isRing = Boolean(product.configurationSchema?.isRing)
    const targetProdId = activeComponent ? activeComponent.id : product.id

    let cancelled = false
    async function recomputePrice() {
      if (product.price.isAvailable === false && !product.price.formatted) {
        setDynamicPrice({ amount: 0, formatted: null })
        return
      }
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
              karat: selectedMetalTone === 'platinum' ? 'Platinum' : 18,
            },
          }),
        })
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled && data.formattedPrice) {
          setDynamicPrice({ amount: data.unitPrice, formatted: data.formattedPrice })
        } else if (!cancelled && (!data.formattedPrice || data.isAvailable === false)) {
          setDynamicPrice({ amount: 0, formatted: null })
        }
      } catch (e) {
        console.warn('[recomputePrice] Error:', e)
      } finally {
        if (!cancelled) setCalculatingPrice(false)
      }
    }
    recomputePrice()
    return () => { cancelled = true }
  }, [product.id, activeComponent, market.code, selectedMetalTone, selectedDiamondType, selectedRingSize, product.configurationSchema?.isRing])

  // Dynamic specs derived from live variant choices
  const dynamicSpecs = useMemo(() => {
    const baseSpecs = product.specifications
    const isPlat = selectedMetalTone === 'platinum'
    const isNatural = selectedDiamondType === 'natural'
    const toneCap = selectedMetalTone.charAt(0).toUpperCase() + selectedMetalTone.slice(1)

    const metalLabel = isPlat ? '950 Platinum' : `Solid 18K ${toneCap} Gold`

    const hallmarkLabel = isPlat
      ? 'Certified Assay Pt950 Hallmark'
      : (market.code === 'IN'
          ? 'Certified Assay 750 / BIS Hallmark with HUID'
          : 'Certified Assay 750 / Solid 18K Gold')

    const certificationLabel = isNatural
      ? 'GIA Certified Natural Diamonds (Geological Origin)'
      : 'IGI Certified Lab-Grown Diamonds'

    const qualityLabel = isNatural
      ? 'Color F-G, Clarity VS'
      : (baseSpecs.diamondColor ? `Color ${baseSpecs.diamondColor}, Clarity ${baseSpecs.diamondClarity || 'VVS-VS'}` : 'Color EF, Clarity VVS-VS')

    const rawGold = activeComponent?.approxGoldWeight || baseSpecs.approxGoldWeight
    const weightLabel = rawGold
      ? (isPlat
          ? `~${(rawGold * 1.3).toFixed(1)}g 950 Platinum`
          : `~${rawGold}g Solid 18K Gold`)
      : null

    const rawCarats = activeComponent?.diamondWeightCarats || baseSpecs.diamondWeightCarats
    const caratsLabel = rawCarats
      ? `~${rawCarats}ct Total (${isNatural ? 'Natural Mined' : 'Lab-Grown'})`
      : null

    return {
      metal: metalLabel,
      hallmark: hallmarkLabel,
      certification: certificationLabel,
      quality: qualityLabel,
      weight: weightLabel,
      diamonds: caratsLabel,
    }
  }, [product.specifications, selectedMetalTone, selectedDiamondType, activeComponent, market.code])

  const availableMetals = useMemo(() => {
    const schemaMetals = product.configurationSchema?.metals || []
    if (schemaMetals.length > 0) {
      return schemaMetals.map((m) => ({
        id: m.tone || m.id,
        name: m.name,
        hex: m.colorHex,
      }))
    }
    return [
      { id: 'yellow', name: '18K Yellow Gold', hex: '#E5C483' },
      { id: 'white',  name: '18K White Gold',  hex: '#E8E8E8' },
      { id: 'rose',   name: '18K Rose Gold',   hex: '#E8B4B8' },
      { id: 'platinum', name: '950 Platinum',  hex: '#D8D8D8' },
    ]
  }, [product.configurationSchema?.metals])

  const availableStones = useMemo(() => {
    const schemaStones = product.configurationSchema?.stones || []
    if (schemaStones.length > 0) {
      return schemaStones.map((s) => ({
        type: (s.type === 'lgd' ? 'lab_grown' : s.type) as 'lab_grown' | 'natural',
        name: s.type === 'natural' ? 'Natural Mined Diamond' : 'Lab-Grown Diamond',
        sub: s.type === 'natural' ? 'GIA Certified • Geological Origin' : 'IGI Certified • D-F / VS+',
      }))
    }
    return [
      { type: 'lab_grown' as const, name: 'Lab-Grown Diamond', sub: 'IGI Certified • D-F / VS+' },
      { type: 'natural' as const, name: 'Natural Mined Diamond', sub: 'GIA Certified • Geological Origin' },
    ]
  }, [product.configurationSchema?.stones])

  const isUnpricedProduct = product.price.isAvailable === false || (!dynamicPrice.formatted && !product.price.formatted)

  const handleAddToBag = () => {
    if (isUnpricedProduct) return
    const isPlat = selectedMetalTone === 'platinum'
    const targetProduct = activeComponent || product
    addItem(
      {
        id: targetProduct.id,
        code: targetProduct.code,
        name: targetProduct.name,
        category: targetProduct.category,
        photoUrl: selectedPhoto || targetProduct.primaryPhotoUrl,
        unitPrice: dynamicPrice?.amount || targetProduct.price.amount,
        currency: market.currency as any,
        config: {
          metalTone: selectedMetalTone,
          diamondType: selectedDiamondType,
          ringSize: product.configurationSchema?.isRing && !activeComponent ? selectedRingSize : undefined,
          karat: isPlat ? 'Platinum' : 18,
        },
      },
      1
    )
    setAddedNoticeMsg(`Added ${targetProduct.name} to shopping bag`)
    setAddedNotice(true)
    setTimeout(() => setAddedNotice(false), 3500)
  }

  const handleAddIndividualComponent = (comp: NonNullable<NonNullable<D2CProductDetail['setInfo']>['components']>[number]) => {
    const isPlat = selectedMetalTone === 'platinum'
    addItem(
      {
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
          karat: isPlat ? 'Platinum' : 18,
        },
      },
      1
    )
    setAddedNoticeMsg(`Added ${comp.name} to shopping bag`)
    setAddedNotice(true)
    setTimeout(() => setAddedNotice(false), 3500)
  }

  const handleAddParentSuite = (parentSet: NonNullable<D2CProductDetail['parentSetInfo']>) => {
    const isPlat = selectedMetalTone === 'platinum'
    addItem(
      {
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
          karat: isPlat ? 'Platinum' : 18,
        },
      },
      1
    )
    setAddedNoticeMsg(`Added ${parentSet.parentName} to shopping bag`)
    setAddedNotice(true)
    setTimeout(() => setAddedNotice(false), 3500)
  }

  const handleAddSiblingComponent = (sibling: NonNullable<NonNullable<D2CProductDetail['parentSetInfo']>['siblings']>[number]) => {
    const isPlat = selectedMetalTone === 'platinum'
    addItem(
      {
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
          karat: isPlat ? 'Platinum' : 18,
        },
      },
      1
    )
    setAddedNoticeMsg(`Added ${sibling.name} to shopping bag`)
    setAddedNotice(true)
    setTimeout(() => setAddedNotice(false), 3500)
  }

  return (
    <StoreLayout>
      <div className="max-w-[1440px] mx-auto px-6 lg:px-12 py-10 lg:py-16">
        {/* Breadcrumbs */}
        <nav
          aria-label="Breadcrumb"
          className="text-[11px] uppercase tracking-[0.2em] text-[#69727D] mb-8 flex items-center flex-wrap gap-x-2 gap-y-1 font-medium"
        >
          <Link href="/" className="hover:text-[#051F34] transition-colors shrink-0 inline-flex items-center leading-none">
            HOME
          </Link>
          <span className="text-[#E3DBD4] select-none shrink-0 inline-flex items-center leading-none" aria-hidden="true">
            /
          </span>
          <Link href="/jewellery" className="hover:text-[#051F34] transition-colors shrink-0 inline-flex items-center leading-none">
            JEWELLERY
          </Link>
          <span className="text-[#E3DBD4] select-none shrink-0 inline-flex items-center leading-none" aria-hidden="true">
            /
          </span>
          <span className="text-[#051F34] font-semibold shrink-0 inline-flex items-center leading-none uppercase" aria-current="page">
            {product.category}
          </span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16">
          {/* Left: Gallery Column (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            {/* Main high-res view */}
            <div className="aspect-square bg-white rounded-none border border-[#E3DBD4] overflow-hidden relative">
              {selectedPhoto ? (
                <img
                  src={selectedPhoto}
                  alt={activeComponent ? activeComponent.name : product.name}
                  className="w-full h-full object-cover transition-opacity duration-300"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center font-serif text-[#69727D] text-lg">
                  SHEWAH ATELIER
                </div>
              )}

              {/* Status Badge */}
              <div className="absolute top-4 left-4">
                {activeComponent ? (
                  <span className="bg-[#051F34] text-white px-3 py-1 text-[10px] uppercase tracking-[0.2em] font-medium border border-white/20 flex items-center gap-1.5">
                    <span>{activeComponent.roleLabel} • Individual Piece</span>
                  </span>
                ) : product.setInfo ? (
                  <span className="bg-[#051F34] text-[#CB9274] px-3 py-1 text-[10px] uppercase tracking-[0.2em] font-semibold border border-[#CB9274]/30 flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3 text-[#CB9274]" />
                    <span>Complete Suite Ensemble</span>
                  </span>
                ) : (
                  <span className="bg-white/95 backdrop-blur-sm px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-[#051F34] font-semibold border border-[#E3DBD4]">
                    Made to Order
                  </span>
                )}
              </div>
            </div>

            {/* Thumbnail selector */}
            {(() => {
              const displayPhotos =
                activeComponent?.photoUrls && activeComponent.photoUrls.length > 0
                  ? activeComponent.photoUrls
                  : product.photoUrls

              return displayPhotos && displayPhotos.length > 1 ? (
                <div className="flex items-center gap-3 overflow-x-auto pb-2">
                  {displayPhotos.map((url, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedPhoto(url)}
                      className={`w-20 h-20 rounded-none overflow-hidden border-2 transition-all shrink-0 ${
                        selectedPhoto === url
                          ? 'border-[#051F34] scale-[1.02]'
                          : 'border-[#E3DBD4] opacity-70 hover:opacity-100 hover:border-[#051F34]'
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
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[11px] uppercase tracking-[0.25em] text-[#CB9274] font-medium">
                  {activeComponent ? `${product.name} • ${activeComponent.roleLabel}` : product.category}
                </span>
                {product.setInfo && !activeComponent && (
                  <span className="bg-[#051F34] text-[#CB9274] px-2.5 py-0.5 text-[9px] uppercase tracking-[0.2em] font-semibold">
                    Jewellery Suite
                  </span>
                )}
                {activeComponent && (
                  <span className="bg-[#F6F4F2] text-[#051F34] px-2.5 py-0.5 text-[9px] uppercase tracking-[0.2em] font-semibold border border-[#E3DBD4]">
                    Individual Piece
                  </span>
                )}
              </div>
              <h1 className="font-serif text-3xl sm:text-4xl text-[#051F34] font-normal leading-snug">
                {activeComponent ? activeComponent.name : product.name}
              </h1>
              <p className="text-sm text-[#69727D] font-light mt-2 leading-relaxed">
                {activeComponent
                  ? activeComponent.subtitle || `Handcrafted individual piece from the ${product.name}.`
                  : product.subtitle}
              </p>
            </div>

            {/* Price block */}
            <div className="py-4 border-y border-[#E3DBD4] flex items-baseline justify-between">
              <div>
                <div className="text-3xl font-serif font-normal text-[#051F34] flex items-center gap-2">
                  <span>
                    {dynamicPrice.formatted || product.price.formatted || product.price.label || 'Price on request'}
                  </span>
                  {calculatingPrice && (
                    <span className="text-[10px] font-sans text-[#CB9274] animate-pulse">
                      Updating...
                    </span>
                  )}
                </div>
                <div className="text-xs text-[#69727D] mt-1 font-light">
                  {dynamicPrice.formatted || product.price.formatted ? (
                    `${product.price.taxLabel} • Complimentary worldwide insured delivery`
                  ) : (
                    'Contact atelier for custom quote • Complimentary worldwide delivery'
                  )}
                </div>
              </div>

              <div className="text-right">
                <span className="text-[11px] font-mono text-[#69727D] uppercase tracking-widest">
                  SKU: {activeComponent ? activeComponent.code : product.code}
                </span>
              </div>
            </div>

            {/* Suite Purchase Option Selector */}
            {product.setInfo && product.setInfo.components.length > 0 && (
              <div className="p-5 bg-[#F6F4F2] rounded-none border border-[#E3DBD4] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#CB9274]" />
                    <span className="text-xs uppercase tracking-[0.2em] font-semibold text-[#051F34]">
                      Order Together or Separately
                    </span>
                  </div>
                  {product.setInfo.suiteSavingsAmount > 0 && (
                    <span className="bg-[#051F34] text-[#CB9274] px-2.5 py-0.5 text-[10px] uppercase tracking-[0.2em] font-semibold">
                      Save {product.setInfo.formattedSavings} on Suite
                    </span>
                  )}
                </div>

                <div className="space-y-2">
                  {/* Option 1: Complete Suite */}
                  <button
                    type="button"
                    onClick={() => handleSelectSuiteOption('full_suite')}
                    className={`w-full text-left p-4 rounded-none border transition-all flex items-center justify-between ${
                      selectedSuiteOption === 'full_suite'
                        ? 'border-[#051F34] bg-white shadow-sm'
                        : 'border-[#E3DBD4] bg-transparent hover:border-[#051F34]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-3.5 h-3.5 border flex items-center justify-center ${
                          selectedSuiteOption === 'full_suite' ? 'border-[#051F34] bg-[#051F34]' : 'border-[#E3DBD4]'
                        }`}
                      >
                        {selectedSuiteOption === 'full_suite' && <div className="w-1.5 h-1.5 bg-white" />}
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-[#051F34] flex items-center gap-2">
                          <span>Complete Suite ({product.setInfo.components.length} Pieces)</span>
                          <span className="text-[10px] text-[#CB9274] font-medium uppercase tracking-wider">
                            Recommended
                          </span>
                        </div>
                        <div className="text-xs text-[#69727D] font-light mt-0.5">
                          Includes {product.setInfo.components.map((c) => c.roleLabel).join(' + ')}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-xs font-serif font-medium text-[#051F34]">
                        {product.price.formatted}
                      </div>
                      {product.setInfo.formattedSavings && (
                        <div className="text-[10px] text-[#CB9274] font-medium">
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
                      className={`w-full text-left p-4 rounded-none border transition-all flex items-center justify-between ${
                        selectedSuiteOption === comp.code
                          ? 'border-[#051F34] bg-white shadow-sm'
                          : 'border-[#E3DBD4] bg-transparent hover:border-[#051F34]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-3.5 h-3.5 border flex items-center justify-center ${
                            selectedSuiteOption === comp.code ? 'border-[#051F34] bg-[#051F34]' : 'border-[#E3DBD4]'
                          }`}
                        >
                          {selectedSuiteOption === comp.code && <div className="w-1.5 h-1.5 bg-white" />}
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-[#051F34]">
                            {comp.roleLabel} Only
                          </div>
                          <div className="text-xs text-[#69727D] font-light mt-0.5">
                            {comp.name} {comp.approxGoldWeight ? `• ~${comp.approxGoldWeight}g 18K Solid Gold` : ''}
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-xs font-serif font-medium text-[#051F34]">
                          {comp.price.formatted}
                        </div>
                        <div className="text-[10px] text-[#69727D]">
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
              <label className="text-xs uppercase tracking-[0.2em] font-semibold text-[#051F34] flex items-center justify-between">
                <span>Metal Purity &amp; Tone</span>
                <span className="text-[#CB9274] capitalize">
                  {selectedMetalTone === 'platinum' ? '950 Platinum' : `${selectedMetalTone} Gold`}
                </span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                {availableMetals.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setSelectedMetalTone(m.id)}
                    className={`flex items-center gap-2.5 px-3 py-3 rounded-none border text-xs text-left transition-all ${
                      selectedMetalTone === m.id
                        ? 'border-[#051F34] bg-white shadow-sm'
                        : 'border-[#E3DBD4] bg-[#F6F4F2] hover:border-[#051F34]'
                    }`}
                  >
                    <span className="w-3.5 h-3.5 rounded-none border border-[#E3DBD4]" style={{ backgroundColor: m.hex }} />
                    <span className="font-medium text-[#051F34]">{m.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Configurator: Diamond Choice */}
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wider font-semibold text-[#2A241B] flex items-center justify-between">
                <span>Diamond Origin &amp; Certification</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                {availableStones.map((s) => (
                  <button
                    key={s.type}
                    onClick={() => setSelectedDiamondType(s.type)}
                    className={`p-3 rounded-none border text-xs text-left transition-all ${
                      selectedDiamondType === s.type
                        ? 'border-[#051F34] bg-white shadow-sm'
                        : 'border-[#E3DBD4] bg-[#F6F4F2] hover:border-[#051F34]'
                    }`}
                  >
                    <div className="font-semibold text-[#051F34]">{s.name}</div>
                    <div className="text-[10px] text-[#69727D] mt-0.5">{s.sub}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Configurator: Ring Size */}
            {product.configurationSchema?.isRing && !activeComponent && product.configurationSchema?.sizes?.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="uppercase tracking-[0.2em] font-semibold text-[#051F34]">
                    Ring Size (US)
                  </span>
                  <Link
                    href="/ring-size-guide"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#CB9274] text-[11px] uppercase tracking-wider hover:text-[#051F34] transition-colors"
                  >
                    Size Guide
                  </Link>
                </div>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
                  {product.configurationSchema.sizes.map((sz) => (
                    <button
                      key={sz}
                      onClick={() => setSelectedRingSize(sz)}
                      className={`py-2 text-xs rounded-none border text-center transition-all ${
                        selectedRingSize === sz
                          ? 'bg-[#051F34] text-white font-medium border-[#051F34]'
                          : 'bg-white border-[#E3DBD4] text-[#69727D] hover:border-[#051F34]'
                      }`}
                    >
                      {sz}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Made-to-Order Timeline Box */}
            <div className="bg-[#F6F4F2] p-4 rounded-none border border-[#E3DBD4] text-xs text-[#69727D] space-y-1.5">
              <div className="flex items-center gap-2 font-medium text-[#051F34]">
                <Truck className="w-4 h-4 text-[#CB9274]" />
                <span className="uppercase tracking-wider text-[11px]">Made to Order Delivery Window:</span>
              </div>
              <p className="text-[11px] font-light">
                Crafted especially for you in approximately {product.craftingLeadDays} business days.{' '}
                Estimated arrival in {market.name}: <strong className="text-[#051F34] font-medium">{product.estimatedDeliveryWindow}</strong>.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center gap-3">
                {isUnpricedProduct ? (
                  <a
                    href={`https://wa.me/919662266360?text=${encodeURIComponent(`Hi, I want a quote for ${activeComponent ? activeComponent.name : product.name} (${activeComponent ? activeComponent.code : product.code})`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-4 px-8 bg-[#051F34] text-white hover:bg-[#CB9274] text-xs uppercase tracking-[0.2em] font-semibold rounded-none transition-all duration-300 flex items-center justify-center gap-2"
                  >
                    <span>Enquire via WhatsApp</span>
                    <ArrowRight className="w-4 h-4" />
                  </a>
                ) : (
                  <button
                    onClick={handleAddToBag}
                    className="flex-1 py-4 px-8 bg-[#051F34] text-white text-xs uppercase tracking-[0.2em] font-semibold rounded-none hover:bg-[#CB9274] transition-all duration-300 flex items-center justify-center gap-2"
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
                )}

                <button
                  type="button"
                  onClick={() => {
                    toggleWishlist({
                      id: activeComponent ? activeComponent.id : product.id,
                      slug: activeComponent ? activeComponent.slug : product.slug,
                      name: activeComponent ? activeComponent.name : product.name,
                      category: activeComponent ? activeComponent.category : product.category,
                      priceFormatted: dynamicPrice.formatted,
                      photoUrl: selectedPhoto || product.primaryPhotoUrl,
                      subtitle: activeComponent ? activeComponent.subtitle : product.subtitle,
                    })
                  }}
                  className={`p-4 rounded-none border transition-all flex items-center justify-center ${
                    isInWishlist(activeComponent ? activeComponent.id : product.id)
                      ? 'border-[#051F34] bg-[#051F34] text-[#CB9274]'
                      : 'border-[#E3DBD4] bg-white text-[#051F34] hover:border-[#051F34]'
                  }`}
                  aria-label="Save to Wishlist"
                >
                  <Heart
                    className={`w-4 h-4 ${
                      isInWishlist(activeComponent ? activeComponent.id : product.id) ? 'fill-[#CB9274]' : ''
                    }`}
                  />
                </button>
              </div>

              {addedNotice && (
                <div className="text-center text-xs text-[#051F34] font-medium flex items-center justify-center gap-1.5 pt-1 animate-in fade-in">
                  <Check className="w-4 h-4 text-[#CB9274]" />
                  <span>{addedNoticeMsg}! Click the bag icon above to view bag.</span>
                </div>
              )}
            </div>

            {/* Accordions: Specifications, Shipping, Warranty */}
            <div className="pt-6 border-t border-[#E3DBD4] divide-y divide-[#E3DBD4]">
              {/* Accordion 1: Specifications (Dynamic based on selected variant) */}
              <div className="py-4">
                <button
                  onClick={() => setOpenSection(openSection === 'specs' ? null : 'specs')}
                  className="w-full flex items-center justify-between text-xs uppercase tracking-[0.2em] font-semibold text-[#051F34]"
                >
                  <span>Specifications &amp; Provenance</span>
                  {openSection === 'specs' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {openSection === 'specs' && (
                  <div className="pt-4 text-xs text-[#69727D] space-y-3 animate-in fade-in font-light">
                    <p>{activeComponent ? activeComponent.subtitle : product.description}</p>
                    <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
                      <div>
                        <strong className="text-[#051F34] font-medium">Metal:</strong> {dynamicSpecs.metal}
                      </div>
                      <div>
                        <strong className="text-[#051F34] font-medium">Hallmark:</strong> {dynamicSpecs.hallmark}
                      </div>
                      <div>
                        <strong className="text-[#051F34] font-medium">Certification:</strong> {dynamicSpecs.certification}
                      </div>
                      <div>
                        <strong className="text-[#051F34] font-medium">Diamond Quality:</strong> {dynamicSpecs.quality}
                      </div>
                      {dynamicSpecs.weight && (
                        <div>
                          <strong className="text-[#051F34] font-medium">Weight:</strong> {dynamicSpecs.weight}
                        </div>
                      )}
                      {dynamicSpecs.diamonds && (
                        <div>
                          <strong className="text-[#051F34] font-medium">Diamonds:</strong> {dynamicSpecs.diamonds}
                        </div>
                      )}
                      <div className="col-span-2 pt-2 border-t border-[#E3DBD4] flex flex-wrap items-center gap-3 text-[11px]">
                        <span className="text-[#051F34] font-medium">Laboratory Grading &amp; Provenance:</span>
                        <Link
                          href="/diamonds"
                          className="text-[#051F34] hover:text-[#CB9274] underline font-medium inline-flex items-center gap-1"
                        >
                          IGI &amp; GIA Diamond Certification Guide &rarr;
                        </Link>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Accordion 2: Shipping & Returns */}
              <div className="py-4">
                <button
                  onClick={() => setOpenSection(openSection === 'shipping' ? null : 'shipping')}
                  className="w-full flex items-center justify-between text-xs uppercase tracking-[0.2em] font-semibold text-[#051F34]"
                >
                  <span>Insured Delivery &amp; 14-Day Returns</span>
                  {openSection === 'shipping' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {openSection === 'shipping' && (
                  <div className="pt-4 text-xs text-[#69727D] space-y-2 animate-in fade-in font-light">
                    <p>
                      Each creation is dispatched via fully insured air courier with signature verification upon delivery.
                    </p>
                    <p>
                      <strong className="text-[#051F34] font-medium">Return Policy:</strong> We offer a 14-day inspection window on standard catalogue creations with intact security tags. Bespoke creations include complimentary ring sizing and dedicated atelier adjustments.
                    </p>
                  </div>
                )}
              </div>

              {/* Accordion 3: Care & Services */}
              <div className="py-4">
                <button
                  onClick={() => setOpenSection(openSection === 'warranty' ? null : 'warranty')}
                  className="w-full flex items-center justify-between text-xs uppercase tracking-[0.2em] font-semibold text-[#051F34]"
                >
                  <span>Atelier Care &amp; Services</span>
                  {openSection === 'warranty' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {openSection === 'warranty' && (
                  <div className="pt-4 text-xs text-[#69727D] space-y-2 animate-in fade-in font-light">
                    <p>
                      Every Shewah creation is crafted to endure. We provide ongoing support including complimentary prong inspection, ultrasonic cleansing guidance, and expert sizing assistance.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Part of Suite Banner */}
        {product.parentSetInfo && (
          <div className="mt-14 p-6 sm:p-8 bg-[#F6F4F2] rounded-none border border-[#E3DBD4] space-y-5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
              <div className="flex items-center gap-5">
                {product.parentSetInfo.parentPhotoUrl && (
                  <div className="w-20 h-20 rounded-none overflow-hidden bg-white border border-[#E3DBD4] shrink-0">
                    <img
                      src={product.parentSetInfo.parentPhotoUrl}
                      alt={product.parentSetInfo.parentName}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#CB9274]" />
                    <span className="text-[10px] uppercase tracking-[0.2em] font-semibold text-[#CB9274]">
                      Designed as Part of a Matched Suite
                    </span>
                  </div>
                  <h4 className="font-serif text-xl font-normal text-[#051F34]">
                    {product.parentSetInfo.parentName}
                  </h4>
                  <p className="text-xs text-[#69727D]">
                    Available as a complete ensemble for{' '}
                    <strong className="text-[#051F34] font-medium">{product.parentSetInfo.parentPrice.formatted}</strong>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => handleAddParentSuite(product.parentSetInfo!)}
                  className="flex-1 sm:flex-initial py-3.5 px-6 bg-[#051F34] text-white text-xs uppercase tracking-[0.2em] font-semibold rounded-none hover:bg-[#CB9274] transition-all duration-300 whitespace-nowrap"
                >
                  Order Complete Suite
                </button>
                <Link
                  href={`/jewellery/${product.parentSetInfo.parentSlug}`}
                  className="py-3.5 px-6 border border-[#051F34] text-[#051F34] text-xs uppercase tracking-[0.2em] font-semibold rounded-none hover:bg-[#051F34] hover:text-white transition-all duration-300 whitespace-nowrap"
                >
                  View Suite &rarr;
                </Link>
              </div>
            </div>

            {/* Sibling matching piece quick add */}
            {product.parentSetInfo.siblings.length > 0 && (
              <div className="pt-4 border-t border-[#E3DBD4] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3">
                  {product.parentSetInfo.siblings[0].photoUrl && (
                    <img
                      src={product.parentSetInfo.siblings[0].photoUrl}
                      alt={product.parentSetInfo.siblings[0].name}
                      className="w-10 h-10 rounded-none object-cover border border-[#E3DBD4]"
                    />
                  )}
                  <div className="text-[#69727D]">
                    <span>Matching companion piece: </span>
                    <strong className="text-[#051F34] font-medium">{product.parentSetInfo.siblings[0].name}</strong>
                    <span className="text-[#69727D] ml-1.5 font-medium">
                      ({product.parentSetInfo.siblings[0].price.formatted})
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleAddSiblingComponent(product.parentSetInfo!.siblings[0])}
                  className="py-2.5 px-5 bg-white text-[#051F34] hover:bg-[#051F34] hover:text-white text-xs uppercase tracking-wider font-semibold rounded-none border border-[#E3DBD4] transition-all duration-300"
                >
                  + Add Matching Piece to Bag
                </button>
              </div>
            )}
          </div>
        )}

        {/* Full Suite Ensemble Showcase */}
        {product.setInfo && product.setInfo.components.length > 0 && (
          <section className="mt-16 sm:mt-24 pt-14 border-t border-[#E3DBD4]">
            <div className="text-center max-w-2xl mx-auto mb-12 space-y-2">
              <span className="text-[11px] uppercase tracking-[0.25em] text-[#CB9274] font-medium block">
                Curated Ensemble
              </span>
              <h2 className="font-serif text-3xl sm:text-4xl text-[#051F34] font-normal tracking-tight">
                Pieces in this Suite
              </h2>
              <p className="text-sm text-[#69727D] font-light">
                Order all creations together as a unified ensemble, or acquire individual pieces separately.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {product.setInfo.components.map((comp) => (
                <div
                  key={comp.code}
                  className="bg-white rounded-none border border-[#E3DBD4] p-6 sm:p-8 flex flex-col justify-between transition-colors hover:border-[#051F34]"
                >
                  <div className="flex flex-col sm:flex-row gap-6">
                    <div className="w-full sm:w-44 aspect-square rounded-none overflow-hidden bg-[#F6F4F2] border border-[#E3DBD4] shrink-0">
                      {comp.primaryPhotoUrl ? (
                        <img src={comp.primaryPhotoUrl} alt={comp.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center font-serif text-[#69727D] text-xs">
                          SHEWAH
                        </div>
                      )}
                    </div>

                    <div className="flex-1 space-y-2">
                      <span className="text-[10px] uppercase tracking-[0.2em] text-[#CB9274] font-semibold">
                        {comp.roleLabel}
                      </span>
                      <h3 className="font-serif text-xl font-normal text-[#051F34] leading-snug">
                        {comp.name}
                      </h3>
                      <p className="text-xs text-[#69727D] font-light">
                        {comp.subtitle}
                      </p>

                      <div className="grid grid-cols-2 gap-2 pt-2 text-[11px] text-[#69727D]">
                        {comp.approxGoldWeight && (
                          <div>
                            <span>Gold:</span> <strong className="text-[#051F34]">~{comp.approxGoldWeight}g 18K</strong>
                          </div>
                        )}
                        {comp.diamondWeightCarats && (
                          <div>
                            <span>Diamonds:</span> <strong className="text-[#051F34]">~{comp.diamondWeightCarats}ct</strong>
                          </div>
                        )}
                        <div>
                          <span>Crafting:</span> <strong className="text-[#051F34]">Made to Order</strong>
                        </div>
                        <div>
                          <span>Assay:</span> <strong className="text-[#051F34]">Solid 18K Gold</strong>
                        </div>
                      </div>

                      <div className="pt-3 flex items-baseline gap-2">
                        <span className="text-xl font-serif font-medium text-[#051F34]">
                          {comp.price.formatted}
                        </span>
                        <span className="text-[11px] text-[#69727D]">
                          Individual piece
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-6 mt-6 border-t border-[#E3DBD4] flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => handleAddIndividualComponent(comp)}
                      className="flex-1 py-3 px-4 bg-[#051F34] text-white text-xs uppercase tracking-[0.2em] font-semibold rounded-none hover:bg-[#CB9274] transition-all duration-300 flex items-center justify-center gap-2"
                    >
                      <span>Add {comp.roleLabel} Only</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>

                    <Link
                      href={`/jewellery/${comp.slug}`}
                      className="py-3 px-4 border border-[#051F34] text-[#051F34] text-xs uppercase tracking-[0.2em] font-semibold rounded-none hover:bg-[#051F34] hover:text-white transition-all duration-300 whitespace-nowrap"
                    >
                      View Piece
                    </Link>
                  </div>
                </div>
              ))}
            </div>

            {/* Complete Suite Callout Banner */}
            <div className="mt-8 p-8 sm:p-10 bg-[#051F34] text-white rounded-none flex flex-col sm:flex-row items-center justify-between gap-6 border border-[#051F34]">
              <div className="space-y-2 text-center sm:text-left">
                <div className="flex items-center justify-center sm:justify-start gap-2">
                  <Sparkles className="w-4 h-4 text-[#CB9274]" />
                  <span className="text-xs uppercase tracking-[0.2em] text-[#CB9274] font-semibold">
                    Complete Suite Privilege
                  </span>
                </div>
                <h3 className="font-serif text-2xl sm:text-3xl text-white font-normal">
                  Acquire the Complete {product.name}
                </h3>
                <p className="text-xs sm:text-sm text-stone-300 font-light max-w-xl">
                  Order all pieces together in a custom presentation suite case.
                  {product.setInfo.formattedSavings && (
                    <span className="text-[#CB9274] font-medium ml-1">
                      Enjoy {product.setInfo.formattedSavings} savings compared to individual pieces.
                    </span>
                  )}
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-4 shrink-0">
                <div className="text-center sm:text-right">
                  <div className="text-3xl font-serif font-normal text-white">
                    {product.price.formatted}
                  </div>
                  {product.setInfo.formattedSavings && (
                    <div className="text-[10px] uppercase tracking-wider text-[#CB9274] font-semibold">
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
                  className="py-4 px-8 bg-[#CB9274] text-white text-xs uppercase tracking-[0.2em] font-semibold rounded-none hover:bg-white hover:text-[#051F34] transition-all duration-300 whitespace-nowrap"
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
