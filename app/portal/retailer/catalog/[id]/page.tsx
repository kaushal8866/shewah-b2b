'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ShoppingBag } from 'lucide-react'
import { SELLABLE_KARATS, KARAT_FACTORS } from '@/lib/karat'

type KaratPriceRow = {
  karat: number
  weight: number
  goldCost: number
  labourCost: number
  cogs: number
  trade: number
  mrp: number
}

type Product = {
  id: string
  code: string
  name: string
  category: string
  description?: string
  diamond_weight?: number
  diamond_shape?: string
  diamond_quality?: string
  diamond_color?: string
  diamond_type?: string
  gold_karat?: number
  gold_weight_g?: number
  gold_weight_22k?: number
  gold_weight_18k?: number
  gold_weight_14k?: number
  gold_weight_10k?: number
  gold_weight_9k?: number
  karat_pricing?: Record<string, KaratPriceRow>
  trade_price?: number
  photo_urls?: string[]
  delivery_days?: number
  models_available?: string[]
  attributes?: Record<string, any>
  making_charges?: number
  igi_cert_cost?: number
  diamond_cost?: number
  diamond_specs?: any[]
}

const RING_SIZES = ['5','6','7','8','9','10','11','12','13','14','15','16','17','18','19','20','21','22']

export default function RetailerProductDetail() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const [product, setProduct] = useState<Product | null>(null)
  const [categorySchema, setCategorySchema] = useState<any[]>([])
  const [error, setError] = useState('')
  const [activeImg, setActiveImg] = useState(0)
  const [qty, setQty] = useState('1')
  const [size, setSize] = useState('')
  const [notes, setNotes] = useState('')
  const [selectedKarat, setSelectedKarat] = useState<number>(22)
  const [submitting, setSubmitting] = useState(false)
  const [components, setComponents] = useState<any[]>([])
  const [selectedComponents, setSelectedComponents] = useState<Record<string, boolean>>({})
  const [isBreakupOpen, setIsBreakupOpen] = useState(false)

  useEffect(() => {
    fetch(`/api/portal/retailer/catalog/${id}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error)
        else {
          setProduct(d.product)
          setCategorySchema(d.category_schema || [])
          setComponents(d.components || [])
          
          const initSelected: Record<string, boolean> = {}
          if (d.components) {
            d.components.forEach((c: any) => {
              initSelected[c.id] = true
            })
          }
          setSelectedComponents(initSelected)
        }
      })
      .catch(e => setError(e.message))
  }, [id])

  const diamondRows = useMemo(() => {
    if (!product || !Array.isArray(product.diamond_specs)) return []
    return product.diamond_specs.map(d => {
      const pieces = Number(d.pieces) || 1
      const wtPerPc = Number(d.weight) || 0
      const costPerPc = Number(d.cost) || 0
      const ratePerCarat = wtPerPc > 0 ? (costPerPc / wtPerPc) : 0
      return {
        shape: d.shape || '',
        type: d.type || 'natural',
        quality: d.quality || '',
        color: d.color || '',
        pieces,
        weight: wtPerPc * pieces,
        cost: costPerPc,
        ratePerCarat
      }
    }).filter(d => d.weight > 0)
  }, [product])

  const totalDiamondWeight = useMemo(() => {
    if (diamondRows.length > 0) {
      return diamondRows.reduce((sum, d) => sum + d.weight, 0)
    }
    return Number(product?.diamond_weight) || 0
  }, [diamondRows, product])

  const totalDiamondValue = useMemo(() => {
    if (diamondRows.length > 0) {
      return Math.round(diamondRows.reduce((sum, d) => sum + (d.pieces * d.cost * 1.28), 0))
    }
    return Math.round((Number(product?.diamond_cost) || 0) * 1.28)
  }, [diamondRows, product])

  const categoryOption = useMemo(() => {
    const cat = (product?.category || '').toLowerCase()
    if (cat === 'ring') {
      return {
        label: 'Ring size',
        placeholder: 'Select size...',
        options: RING_SIZES
      }
    } else if (cat === 'necklace') {
      return {
        label: 'Chain length',
        placeholder: 'Select length...',
        options: ['14"', '16"', '18"', '20"', '22"', '24"', '26"', '28"', '30"']
      }
    } else if (cat === 'earring') {
      return {
        label: 'Earring back',
        placeholder: 'Select type...',
        options: ['Push Back', 'Screw Back', 'Lever Back', 'Hinge', 'Hook']
      }
    } else if (cat === 'bracelet') {
      return {
        label: 'Wrist size',
        placeholder: 'Select size...',
        options: ['6"', '6.5"', '7"', '7.5"', '8"', '8.5"', '9"']
      }
    }
    return null
  }, [product])

  // Per-karat options that actually have a priced row in the cache.
  // Legacy fallback: pre-migration products that haven't been re-priced yet
  // still need to be orderable, so synthesize a single row from the canonical
  // gold_karat + gold_weight_g + trade_price.
  const karatRows = useMemo<KaratPriceRow[]>(() => {
    if (!product) return []
    const fromCache = product.karat_pricing
      ? SELLABLE_KARATS
          .map(k => product.karat_pricing?.[String(k)])
          .filter((r): r is KaratPriceRow => !!r && r.trade > 0)
      : []
    if (fromCache.length > 0) return fromCache
    if (product.trade_price) {
      return [{
        karat: product.gold_karat || 22,
        weight: Number(product.gold_weight_g) || 0,
        goldCost: 0, labourCost: 0, cogs: 0,
        trade: Number(product.trade_price) || 0,
        mrp: 0,
      }]
    }
    return []
  }, [product])

  const selectedRow = useMemo(() => {
    if (!product) return null
    if (components.length > 0) {
      const allSelected = components.every(c => selectedComponents[c.id])
      const noneSelected = !components.some(c => selectedComponents[c.id])
      if (noneSelected) return null

      if (allSelected && product.sell_mode !== 'individual_only') {
        return karatRows.find(r => r.karat === selectedKarat) || karatRows[0] || null
      }
      
      let weightSum = 0
      let goldCostSum = 0
      let labourCostSum = 0
      let cogsSum = 0
      let tradeSum = 0
      let mrpSum = 0

      components.forEach(comp => {
        if (!selectedComponents[comp.id]) return
        const compPricing = comp.karat_pricing || {}
        const match = compPricing[String(selectedKarat)] || compPricing['Silver']
        if (match) {
          weightSum += match.weight || 0
          goldCostSum += match.goldCost || 0
          labourCostSum += match.labourCost || 0
          cogsSum += match.cogs || 0
          tradeSum += match.trade || 0
          mrpSum += match.mrp || 0
        }
      })
      return {
        karat: selectedKarat,
        weight: weightSum,
        goldCost: goldCostSum,
        labourCost: labourCostSum,
        cogs: cogsSum,
        trade: tradeSum,
        mrp: mrpSum
      }
    }
    return karatRows.find(r => r.karat === selectedKarat) || karatRows[0] || null
  }, [product, karatRows, selectedKarat, components, selectedComponents])

  const priceBreakup = useMemo(() => {
    if (!product || !selectedRow) return null

    const goldColorFormatted = product.ref_color ? product.ref_color.charAt(0).toUpperCase() + product.ref_color.slice(1).toLowerCase() : 'Yellow'
    const gold_component = `${selectedKarat}KT Gold ${goldColorFormatted}`
    const gold_value = Math.round(selectedRow.goldCost || 0)
    const goldRateFactor = KARAT_FACTORS[selectedKarat] || 1
    const gold_rate = selectedRow.weight > 0 ? Math.round(gold_value / (selectedRow.weight * goldRateFactor)) : 0

    const diamond_component = product.diamond_quality && product.diamond_color ? `${product.diamond_quality}-${product.diamond_color}` : 'VVS/VS-EF'
    const diamond_count = diamondRows.reduce((sum, d) => sum + d.pieces, 0)

    const making_charges = Math.round((selectedRow.labourCost || 0) + (product.making_charges || 0) + (product.igi_cert_cost || 0))
    const sub_total = gold_value + totalDiamondValue + making_charges
    const gst = Math.round(sub_total * 0.03)
    const final_value = sub_total + gst

    const mappedDiamondSpecs = diamondRows.map(spec => {
      const totalWeight = spec.weight
      const pieces = spec.pieces
      const wtPerPc = pieces > 0 ? (totalWeight / pieces) : 0
      const ratePerCarat = spec.ratePerCarat
      const markedUpRate = Math.round(ratePerCarat * 1.28)
      const markedUpValue = Math.round(pieces * spec.cost * 1.28)

      const origSpec = product.diamond_specs?.find(
        o => o.shape === spec.shape && o.quality === spec.quality && o.color === spec.color && Number(o.pieces) === pieces
      )
      const size_label = origSpec?.size_label || '—'

      return {
        size_label,
        color: spec.color || '—',
        clarity: spec.quality || '—',
        shape: spec.shape || '—',
        count: pieces,
        price: markedUpRate,
        weight: totalWeight,
        value: markedUpValue
      }
    })

    return {
      gold_component,
      gold_rate,
      gold_weight: selectedRow.weight,
      gold_value,

      diamond_component,
      diamond_count,
      diamond_weight: totalDiamondWeight,
      diamond_value: totalDiamondValue,

      making_charges,
      total: sub_total,
      diamond_discount: 0,
      sub_total,
      gst,
      final_value,

      diamond_specs: mappedDiamondSpecs
    }
  }, [product, selectedRow, diamondRows, totalDiamondWeight, totalDiamondValue, selectedKarat])

  // Default to reference karat the first time pricing data lands.
  useEffect(() => {
    if (karatRows.length === 0 || !product) return
    const refK = product.ref_karat ? parseInt(product.ref_karat.replace(/[^\d]/g, '')) : null
    if (refK && karatRows.find(r => r.karat === refK)) {
      setSelectedKarat(refK)
    } else if (karatRows.find(r => r.karat === 22)) {
      setSelectedKarat(22)
    } else {
      setSelectedKarat(karatRows[0].karat)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id, karatRows.length])

  async function placeOrder() {
    setSubmitting(true)
    setError('')
    const res = await fetch('/api/portal/retailer/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'catalog',
        product_id: id,
        quantity: parseInt(qty) || 1,
        ring_size: size || null,
        special_notes: notes || null,
        selected_karat: selectedRow?.karat || null,
        components: components.map(c => ({
          id: c.id,
          selected: !!selectedComponents[c.id]
        }))
      }),
    })
    const data = await res.json()
    setSubmitting(false)
    if (!res.ok) { setError(data.error || 'Order failed'); return }
    router.push(`/portal/retailer/orders/${data.order.id}`)
  }

  if (error && !product) {
    return (
      <div className="p-4 lg:p-7 max-w-4xl mx-auto">
        <Link href="/portal/retailer" className="text-stone-400 hover:text-stone-600 inline-flex items-center gap-1.5 text-sm mb-4">
          <ArrowLeft className="w-4 h-4" /> Catalog
        </Link>
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div>
      </div>
    )
  }

  if (!product) return <div className="p-4 lg:p-7 text-stone-400 text-sm">Loading...</div>

  const photos = product.photo_urls && product.photo_urls.length > 0 ? product.photo_urls : []
  const unitPrice = selectedRow?.trade || Number(product.trade_price) || 0
  const total = unitPrice * (parseInt(qty) || 1)
  const inp = "w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:border-stone-800 outline-none bg-white"
  const lbl = "block text-xs font-medium text-stone-500 mb-1"

  return (
    <div className="p-4 lg:p-7 max-w-5xl mx-auto">
      <Link href="/portal/retailer" className="text-stone-400 hover:text-stone-600 inline-flex items-center gap-1.5 text-sm mb-4">
        <ArrowLeft className="w-4 h-4" /> Catalog
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Photos */}
        <div>
          <div className="aspect-square bg-gradient-to-br from-stone-50 to-yellow-50 rounded-xl border border-stone-200 overflow-hidden flex items-center justify-center">
            {photos.length > 0 ? (
              <img src={photos[activeImg]} alt={product.name} className="w-full h-full object-cover" />
            ) : (
              <div className="text-center text-stone-300"><div className="text-6xl mb-2">◆</div><p className="text-sm">{product.code}</p></div>
            )}
          </div>
          {photos.length > 1 && (
            <div className="grid grid-cols-5 gap-2 mt-3">
              {photos.map((u, i) => (
                <button key={u} onClick={() => setActiveImg(i)}
                  className={`aspect-square rounded-lg overflow-hidden border-2 transition-colors ${i === activeImg ? 'border-stone-800' : 'border-stone-200'}`}>
                  <img src={u} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info + order form */}
        <div>
          <p className="text-xs text-stone-400 font-medium mb-1">{product.code}</p>
          <h1 className="text-2xl font-semibold text-stone-900 mb-2">{product.name}</h1>
          {product.description && (
            <p className="text-sm text-stone-600 mb-4 whitespace-pre-wrap">{product.description}</p>
          )}

          {/* SET COMPONENTS SELECTOR */}
          {components.length > 0 && (
            <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 mb-5">
              <h3 className="text-xs font-bold text-stone-800 uppercase tracking-wider mb-2">
                Set Components Curation
              </h3>
              <p className="text-xs text-stone-400 mb-3">
                {product.sell_mode === 'set_only'
                  ? 'This product is only sold as a complete set.'
                  : 'Select which components you want to include in this order:'}
              </p>
              <div className="space-y-2">
                {components.map(comp => {
                  const isChecked = !!selectedComponents[comp.id]
                  const isDisabled = product.sell_mode === 'set_only'
                  return (
                    <label key={comp.id} className="flex items-center gap-3 bg-white border border-stone-200/60 rounded-lg p-2.5 hover:bg-stone-50/50 cursor-pointer select-none transition-colors">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        disabled={isDisabled}
                        onChange={() => {
                          if (isDisabled) return
                          setSelectedComponents(prev => {
                            const next = { ...prev, [comp.id]: !prev[comp.id] }
                            if (product.sell_mode === 'individual_only' && !Object.values(next).some(Boolean)) {
                              return prev
                            }
                            return next
                          })
                        }}
                        className="rounded text-stone-800 focus:ring-stone-800 w-4 h-4 border-stone-300"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-stone-800 flex items-center gap-2">
                          <span>{comp.component_label || comp.category}</span>
                          <span className="text-[10px] bg-stone-100 text-stone-500 px-1.5 py-0.5 rounded font-normal">
                            {comp.code}
                          </span>
                        </p>
                        <p className="text-[10px] text-stone-400 mt-0.5">
                          {comp.category}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-stone-900">
                          ₹{((comp.karat_pricing?.[String(selectedKarat)] || comp.karat_pricing?.['Silver'])?.trade || comp.trade_price || 0).toLocaleString('en-IN')}
                        </p>
                      </div>
                    </label>
                  )
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-y-3 gap-x-4 mb-5 text-sm">
            {[
              ['Diamond', totalDiamondWeight ? `${totalDiamondWeight.toFixed(3)}ct ${product.diamond_shape || ''}` : '—'],
              ['Quality', product.diamond_quality ? `${product.diamond_quality}/${product.diamond_color || ''}` : '—'],
              ['Type', product.diamond_type === 'natural' ? 'Natural diamond' : 'Lab-grown (LGD)'],
              ['Delivery', `${product.delivery_days || 14} days`],
            ].map(([k, v]) => (
              <div key={String(k)}>
                <p className="text-xs text-stone-400">{k}</p>
                <p className="text-stone-800 mt-0.5">{String(v)}</p>
              </div>
            ))}
          </div>

          {/* Specifications section */}
          {(() => {
            const activeAttributes = Object.entries(product.attributes || {}).filter(
              ([_, val]) => val !== null && val !== undefined && val !== ''
            )
            if (activeAttributes.length === 0) return null
            return (
              <div className="border-t border-stone-200 pt-4 mb-5">
                <h3 className="text-xs font-semibold text-stone-900 uppercase tracking-wider mb-3">Specifications</h3>
                <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-sm">
                  {activeAttributes.map(([key, val]) => {
                    const field = categorySchema.find(f => f.key === key)
                    const label = field ? field.label : key
                    const unit = field?.unit ? ` ${field.unit}` : ''
                    let displayVal = String(val)
                    if (typeof val === 'boolean') {
                      displayVal = val ? 'Yes' : 'No'
                    } else if (Array.isArray(val)) {
                      displayVal = val.join(', ')
                    }
                    return (
                      <div key={key}>
                        <p className="text-xs text-stone-400">{label}</p>
                        <p className="text-stone-800 mt-0.5 font-medium">{displayVal}{unit}</p>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })()}

          <div className="bg-white rounded-xl border border-stone-200 p-5 mb-4">
            {/* Karat selector */}
            {karatRows.length > 0 && (
              <div className="mb-4">
                <label className={lbl}>Choose karat</label>
                <div className="grid grid-cols-5 gap-1.5">
                  {karatRows.map(r => {
                    const active = selectedKarat === r.karat
                    return (
                      <button key={r.karat}
                        onClick={() => setSelectedKarat(r.karat)}
                        className={`rounded-lg border px-1 py-2 text-center transition-colors ${
                          active
                            ? 'border-stone-800 bg-stone-800 text-white'
                            : 'border-stone-200 bg-white text-stone-700 hover:border-stone-800'
                        }`}>
                        <p className="text-xs font-semibold">{r.karat}kt</p>
                        <p className={`text-[10px] mt-0.5 ${active ? 'text-white/80' : 'text-stone-400'}`}>
                          {r.weight.toFixed(2)}g
                        </p>
                        <p className={`text-[11px] font-medium mt-0.5 ${active ? 'text-white' : 'text-stone-800'}`}>
                          ₹{(r.trade / 1000).toFixed(0)}K
                        </p>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            <div className="flex items-end justify-between mb-4">
              <div>
                <p className="text-xs text-stone-400">
                  Trade price (per piece{selectedRow ? `, ${selectedRow.karat}kt` : ''})
                </p>
                <p className="text-2xl font-semibold text-stone-900">
                  {unitPrice ? `₹${(unitPrice || 0).toLocaleString('en-IN')}` : '—'}
                </p>
                {selectedRow && (
                  <p className="text-[11px] text-stone-400 mt-0.5">
                    Gross weight {selectedRow.weight?.toFixed(3) || '0.000'}g · MRP ₹{(selectedRow.mrp || 0).toLocaleString('en-IN')}
                  </p>
                )}
              </div>
            </div>

            {selectedRow && (
              <div className="border-t border-stone-100 pt-4">
                <button
                  onClick={() => setIsBreakupOpen(true)}
                  className="w-full py-2.5 px-4 rounded-xl border text-xs font-semibold hover:bg-stone-150 transition-colors flex items-center justify-between text-stone-700 bg-stone-50"
                  style={{ borderColor: '#e5e8ee' }}
                >
                  <span className="flex items-center gap-1.5 uppercase font-bold text-[10px] tracking-wider opacity-75">
                    View Price Breakup
                  </span>
                  <span>→</span>
                </button>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className={categoryOption ? "" : "col-span-2"}>
                <label className={lbl}>Quantity</label>
                <input type="number" inputMode="numeric" min="1" className={inp}
                  value={qty} onChange={e => setQty(e.target.value)} />
              </div>
              {categoryOption && (
                <div>
                  <label className={lbl}>{categoryOption.label}</label>
                  <select className={inp} value={size} onChange={e => setSize(e.target.value)}>
                    <option value="">{categoryOption.placeholder}</option>
                    {categoryOption.options.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              )}
            </div>
            <div className="mb-4">
              <label className={lbl}>Notes (optional)</label>
              <textarea rows={3} className={`${inp} resize-none`} placeholder="Engraving, packaging, special instructions..."
                value={notes} onChange={e => setNotes(e.target.value)} />
            </div>

            <div className="flex items-center justify-between mb-4 px-3 py-2 bg-stone-50 rounded-lg">
              <span className="text-sm text-stone-500">Order total</span>
              <span className="text-lg font-semibold text-stone-900">₹{(total || 0).toLocaleString('en-IN')}</span>
            </div>

            {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

            <button onClick={placeOrder} disabled={submitting || !selectedRow}
              className="w-full flex items-center justify-center gap-2 bg-stone-800 hover:bg-stone-900 text-white px-5 py-3 rounded-lg text-sm font-medium disabled:opacity-50">
              <ShoppingBag className="w-4 h-4" />
              {submitting ? 'Placing order...' : 'Place order'}
            </button>
            <p className="text-[11px] text-stone-400 text-center mt-2">
              Final pricing and gold rate are confirmed by Shewah after the order is received.
            </p>
          </div>
        </div>
      </div>

      {/* Price Breakup Overlay and Drawer */}
      <div 
        className={`rkkpb-overlay ${isBreakupOpen ? 'active' : ''}`}
        onClick={() => setIsBreakupOpen(false)}
      ></div>
      <aside 
        className="rkkpb-drawer" 
        data-rkkpb-drawer="" 
        aria-hidden={!isBreakupOpen}
        style={{ display: 'flex', transform: isBreakupOpen ? 'translateX(0px)' : 'translateX(100%)' }}
      >
        <header className="rkkpb-header">
          <h3 className="rkkpb-title">Price Breakup</h3>
          <button 
            className="rkkpb-close" 
            data-rkkpb-close="" 
            aria-label="Close"
            onClick={() => setIsBreakupOpen(false)}
          >
            ×
          </button>
        </header>

        <div className="rkkpb-content">
          {priceBreakup ? (
            <>
              {/* GOLD */}
              <div className="rkkpb-block">
                <div className="rkkpb-heading rkkpb-heading--gold">Gold</div>
                <div className="rkkpb-table">
                  <div className="rkkpb-row rkkpb-row--head">
                    <div>Component</div><div>Rate</div><div>Weight</div><div>Value</div>
                  </div>
                  <div className="rkkpb-row" data-row="gold">
                    <div data-field="rkk_gold_component">{priceBreakup.gold_component || 'Gold'}</div>
                    <div data-field="rkk_gold_rate">{priceBreakup.gold_rate || '—'}</div>
                    <div data-field="rkk_gold_weight">{priceBreakup.gold_weight ? Number(priceBreakup.gold_weight).toFixed(2) : '—'}</div>
                    <div data-field="rkk_gold_value">{priceBreakup.gold_value || '—'}</div>
                  </div>
                </div>
              </div>

              {/* DIAMOND (summary) */}
              {priceBreakup.diamond_weight > 0 && (
                <div className="rkkpb-block">
                  <div className="rkkpb-heading rkkpb-heading--gold">Diamond</div>
                  <div className="rkkpb-table">
                    <div className="rkkpb-row rkkpb-row--head">
                      <div>Component</div><div>Count</div><div>Weight</div><div>Value</div>
                    </div>
                    <div className="rkkpb-row" data-row="diamond">
                      <div>{priceBreakup.diamond_component || 'Diamond'}</div>
                      <div data-field="rkk_diamond_count">{priceBreakup.diamond_count || '0'}</div>
                      <div data-field="rkk_diamond_weight">{priceBreakup.diamond_weight ? Number(priceBreakup.diamond_weight).toFixed(2) : '0'}</div>
                      <div data-field="rkk_diamond_value">{priceBreakup.diamond_value || '0'}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* GEMSTONES 1..4 (auto-hide if fully empty) */}
              <div className="rkkpb-block" data-hide-if-empty="" style={{ display: 'none' }}>
                <div className="rkkpb-heading rkkpb-heading--gold">Gemstone</div>
                <div className="rkkpb-table">
                  <div className="rkkpb-row rkkpb-row--head">
                    <div>Component</div><div>Count</div><div>Weight</div><div>Value</div>
                  </div>
                  <div className="rkkpb-row" data-row="gem1" style={{ display: 'none' }}>
                    <div data-field="rkk_gem_component"></div>
                    <div data-field="rkk_gem_rate"></div>
                    <div data-field="rkk_gem_weight"></div>
                    <div data-field="rkk_gem_value"></div>
                  </div>
                  <div className="rkkpb-row" data-row="gem2" style={{ display: 'none' }}>
                    <div data-field="rkk_gem2_component"></div>
                    <div data-field="rkk_gem2_rate"></div>
                    <div data-field="rkk_gem2_weight"></div>
                    <div data-field="rkk_gem2_value"></div>
                  </div>
                  <div className="rkkpb-row" data-row="gem3" style={{ display: 'none' }}>
                    <div data-field="rkk_gem3_component"></div>
                    <div data-field="rkk_gem3_rate"></div>
                    <div data-field="rkk_gem3_weight"></div>
                    <div data-field="rkk_gem3_value"></div>
                  </div>
                  <div className="rkkpb-row" data-row="gem4" style={{ display: 'none' }}>
                    <div data-field="rkk_gem4_component"></div>
                    <div data-field="rkk_gem4_rate"></div>
                    <div data-field="rkk_gem4_weight"></div>
                    <div data-field="rkk_gem4_value"></div>
                  </div>
                </div>
              </div>

              {/* TOTALS */}
              <div className="rkkpb-block">
                <div className="rkkpb-table rkkpb-table--totals">
                  <div className="rkkpb-row">
                    <div>Making Charges</div>
                    <div data-field="rkk_making_charges">{priceBreakup.making_charges || '0'}</div>
                  </div>
                  <div className="rkkpb-row">
                    <div>Total</div>
                    <div data-field="rkk_total">{priceBreakup.total || '0'}</div>
                  </div>
                  {priceBreakup.diamond_discount > 0 && (
                    <div className="rkkpb-row">
                      <div>Diamond Discount</div>
                      <div data-field="rkk_discount">{priceBreakup.diamond_discount}</div>
                    </div>
                  )}
                  <div className="rkkpb-row">
                    <div>Sub-total</div>
                    <div data-field="rkk_sub_total">{priceBreakup.sub_total || '0'}</div>
                  </div>
                  <div className="rkkpb-row">
                    <div>GST</div>
                    <div data-field="rkk_gst">{priceBreakup.gst || '0'}</div>
                  </div>
                  <div className="rkkpb-row rkkpb-row--final">
                    <div>Final Value</div>
                    <div data-field="rkk_final_value">{priceBreakup.final_value || '0'}</div>
                  </div>
                </div>
              </div>

              {/* DIAMOND BREAK-UP */}
              {priceBreakup.diamond_specs && priceBreakup.diamond_specs.length > 0 && (
                <div className="rkkpb-block" data-hide-if-empty="">
                  <div className="rkkpb-heading rkkpb-heading--gold rkkpb-heading-clean">
                    <span>Diamond Break-up</span>
                    <span className="rkkpb-arrow-btn">→</span>
                  </div>
                  <div className="rkkpb-diamond-scroll">
                    <div className="rkkpb-table rkkpb-table--diamond" data-dia-table="">
                      <div className="rkkpb-row rkkpb-row--head rkkpb-row--dia" style={{ gridTemplateColumns: 'repeat(7, minmax(120px, 1fr))' }}>
                        <div>Size</div><div>Color</div><div>Clarity</div><div>Shape</div><div>Count</div><div>Price</div><div>Weight</div>
                      </div>
                      
                      {priceBreakup.diamond_specs.map((spec: any, sIdx: number) => (
                        <div key={sIdx} className="rkkpb-row rkkpb-row--dia" style={{ gridTemplateColumns: 'repeat(7, minmax(120px, 1fr))' }}>
                          <div data-field="rkk_dia_size">{spec.size_label || '—'}</div>
                          <div data-field="rkk_dia_color">{spec.color || '—'}</div>
                          <div data-field="rkk_dia_clarity">{spec.clarity || '—'}</div>
                          <div data-field="rkk_dia_shape" className="capitalize">{spec.shape || '—'}</div>
                          <div data-field="rkk_dia_count">{spec.count || '0'}</div>
                          <div data-field="rkk_dia_price">{spec.price || '0'}</div>
                          <div data-field="rkk_dia_weight">{spec.weight ? Number(spec.weight).toFixed(2) : '0'}</div>
                        </div>
                      ))}

                      <div className="rkkpb-row rkkpb-row--dia rkkpb-row--total" style={{ gridTemplateColumns: 'repeat(7, minmax(120px, 1fr))' }}>
                        <div><strong>Total</strong></div>
                        <div></div>
                        <div></div>
                        <div></div>
                        <div><strong>Count</strong> <span data-dia-total="count">{priceBreakup.diamond_count}</span></div>
                        <div></div>
                        <div><strong>Weight</strong> <span data-dia-total="weight">{priceBreakup.diamond_weight ? Number(priceBreakup.diamond_weight).toFixed(2) : '0'}</span></div>
                      </div>
                    </div>
                  </div>

                  {/* Disclaimer */}
                  <div className="rkkpb-disclaimer" style={{ marginTop: '8px', fontSize: '.88rem', opacity: '.9' }}>
                    <b>Product Disclaimer: </b>Weight and prices are subject to minor changes.
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="text-stone-500 text-xs text-center py-8">Calculating live price breakup...</p>
          )}
        </div>
      </aside>
    </div>
  )
}
