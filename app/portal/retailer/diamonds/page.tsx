'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/app/components/Toast'
import { useRouter } from 'next/navigation'
import { ShoppingCart, MessageCircle, AlertCircle, Sparkles, Loader2, Check } from 'lucide-react'

type Shape = { id: string; name: string }
type Size = { id: string; shape_id: string; label: string; approx_carats: number }
type QualityBucket = { id: string; label: string }
type ColorBucket = { id: string; label: string }

export default function BrowseDiamondsPage() {
  const { toast } = useToast()
  const router = useRouter()

  // Master lists
  const [shapes, setShapes] = useState<Shape[]>([])
  const [allSizes, setAllSizes] = useState<Size[]>([])
  const [qualities, setQualities] = useState<QualityBucket[]>([])
  const [colors, setColors] = useState<ColorBucket[]>([])

  // UI Selection State
  const [type, setType] = useState<'lgd' | 'natural'>('lgd')
  const [selectedShape, setSelectedShape] = useState<string>('')
  const [sieve, setSieve] = useState<string>('all')
  const [selectedSize, setSelectedSize] = useState<string>('')
  const [selectedQuality, setSelectedQuality] = useState<string>('')
  const [selectedColor, setSelectedColor] = useState<string>('')

  // Pricing & Loading States
  const [loading, setLoading] = useState(false)
  const [priceData, setPriceData] = useState<{
    price_per_piece: number | null
    price_per_carat: number | null
    approx_carats: number
    size_label: string
  } | null>(null)
  const [queried, setQueried] = useState(false)

  // Ask Modal State
  const [showAskModal, setShowAskModal] = useState(false)
  const [askPrice, setAskPrice] = useState('')
  const [askUnit, setAskUnit] = useState<'per_pc' | 'per_ct'>('per_pc')
  const [askQty, setAskQty] = useState('10')
  const [askReason, setAskReason] = useState('')
  const [submittingAsk, setSubmittingAsk] = useState(false)
  const [purchasingInstant, setPurchasingInstant] = useState(false)

  // Fetch dimensions on mount
  useEffect(() => {
    Promise.all([
      fetch('/api/diamonds/shapes').then(r => r.json()),
      fetch('/api/diamonds/sizes').then(r => r.json()),
      fetch('/api/diamonds/quality-buckets').then(r => r.json()),
      fetch('/api/diamonds/color-buckets').then(r => r.json())
    ]).then(([shData, szData, qbData, cbData]) => {
      setShapes(shData.shapes || [])
      setAllSizes(szData.sizes || [])
      setQualities(qbData.buckets || [])
      setColors(cbData.buckets || [])
    })
  }, [])

  // Filter sizes based on shape and sieve group
  const matchesSieve = (label: string, activeSieve: string) => {
    if (activeSieve === 'all') return true
    const mm = parseFloat(label)
    if (isNaN(mm)) return false
    if (activeSieve === '+000-2') return mm >= 0.8 && mm <= 1.1
    if (activeSieve === '+2-8') return mm > 1.1 && mm <= 1.45
    if (activeSieve === '+8-11') return mm >= 1.45 && mm <= 1.75
    if (activeSieve === '+11-12') return mm > 1.75 && mm <= 1.95
    if (activeSieve === '+12-14') return mm >= 1.95 && mm <= 2.25
    return false
  }

  const filteredSizes = allSizes.filter(
    s => s.shape_id === selectedShape && matchesSieve(s.label, sieve)
  )

  // Reset dependent selections when shape changes
  const handleShapeChange = (shapeId: string) => {
    setSelectedShape(shapeId)
    setSelectedSize('')
    setPriceData(null)
    setQueried(false)
  }

  // Check if selection is fully complete
  const selectionComplete =
    selectedShape && selectedSize && selectedQuality && selectedColor

  const handleGetPrice = async () => {
    if (!selectionComplete) return
    setLoading(true)
    setPriceData(null)
    setQueried(false)

    try {
      const res = await fetch(
        `/api/portal/retailer/diamonds/price?type=${type}&shapeId=${selectedShape}&sizeId=${selectedSize}&qualityId=${selectedQuality}&colorId=${selectedColor}`
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to fetch price')
      setPriceData(data)
    } catch (e: any) {
      toast({ title: 'Error', message: e.message, type: 'error' })
    } finally {
      setLoading(false)
      setQueried(true)
    }
  }

  // Instant Buy (0% discount auto-approved Ask + Order Conversion)
  const handleInstantBuy = async () => {
    if (!priceData || !priceData.price_per_piece) return
    setPurchasingInstant(true)
    try {
      // 1. Submit auto-approved Ask (askedPrice = originalPrice)
      const askRes = await fetch('/api/portal/retailer/diamonds/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          shapeId: selectedShape,
          sizeId: selectedSize,
          qualityId: selectedQuality,
          colorId: selectedColor,
          originalPricePerPc: priceData.price_per_piece,
          originalPricePerCt: priceData.price_per_carat,
          askedPrice: priceData.price_per_piece,
          askedUnit: 'per_pc',
          quantity: 10, // default minimum purchase
          reason: 'Instant Buy'
        })
      })
      const askData = await askRes.json()
      if (!askRes.ok) throw new Error(askData.error || 'Failed to initialize purchase')

      const askId = askData.ask?.id
      if (!askId) throw new Error('Failed to acquire ask identifier')

      // 2. Concurrently purchase order
      const orderRes = await fetch(`/api/portal/retailer/diamonds/asks/${askId}/purchase`, {
        method: 'POST'
      })
      const orderData = await orderRes.json()
      if (!orderRes.ok) throw new Error(orderData.error || 'Failed to convert order')

      toast({ title: 'Success', message: 'Diamond purchase completed!', type: 'success' })
      router.push(`/portal/retailer/diamonds/orders`)
    } catch (e: any) {
      toast({ title: 'Purchase Failed', message: e.message, type: 'error' })
    } finally {
      setPurchasingInstant(false)
    }
  }

  const handleOpenAskModal = () => {
    if (!priceData) return
    setAskPrice(String(priceData.price_per_piece))
    setAskUnit('per_pc')
    setAskQty('10')
    setAskReason('')
    setShowAskModal(true)
  }

  const handleSubmitAsk = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!priceData || !priceData.price_per_piece) return

    const qtyVal = parseInt(askQty)
    const askVal = parseFloat(askPrice)

    if (isNaN(qtyVal) || qtyVal <= 0) {
      toast({ title: 'Validation Error', message: 'Quantity must be greater than zero', type: 'error' })
      return
    }
    if (isNaN(askVal) || askVal <= 0) {
      toast({ title: 'Validation Error', message: 'Ask price must be greater than zero', type: 'error' })
      return
    }

    setSubmittingAsk(true)
    try {
      const res = await fetch('/api/portal/retailer/diamonds/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          shapeId: selectedShape,
          sizeId: selectedSize,
          qualityId: selectedQuality,
          colorId: selectedColor,
          originalPricePerPc: priceData.price_per_piece,
          originalPricePerCt: priceData.price_per_carat,
          askedPrice: askVal,
          askedUnit: askUnit,
          quantity: qtyVal,
          reason: askReason
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to submit ask')

      toast({ title: 'Ask Placed', message: 'Your price ask has been submitted for review!', type: 'success' })
      setShowAskModal(false)
      router.push('/portal/retailer/diamonds/asks')
    } catch (e: any) {
      toast({ title: 'Submission Failed', message: e.message, type: 'error' })
    } finally {
      setSubmittingAsk(false)
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Left panel: Progressive selectors */}
      <div className="md:col-span-2 space-y-6">
        {/* Step 1: Type */}
        <div className="bg-white p-5 border border-stone-200 rounded-xl space-y-3">
          <label className="text-xs font-bold text-stone-400 uppercase tracking-wider">Step 1: Choose Diamond Type</label>
          <div className="flex gap-2">
            {(['lgd', 'natural'] as const).map(t => (
              <button key={t} onClick={() => { setType(t); setPriceData(null); setQueried(false) }}
                className={`flex-1 py-3 px-4 rounded-xl border font-semibold text-sm transition-all ${
                  type === t
                    ? 'border-[#1E3A5F] bg-[#1E3A5F]/5 text-[#1E3A5F]'
                    : 'border-stone-200 text-stone-500 hover:border-stone-300'
                }`}>
                {t === 'lgd' ? 'Lab Grown (LGD)' : 'Natural Diamond'}
              </button>
            ))}
          </div>
        </div>

        {/* Step 2: Shape */}
        <div className="bg-white p-5 border border-stone-200 rounded-xl space-y-3">
          <label className="text-xs font-bold text-stone-400 uppercase tracking-wider">Step 2: Choose Shape</label>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2.5">
            {shapes.map(s => (
              <button key={s.id} onClick={() => handleShapeChange(s.id)}
                className={`py-3 px-2 rounded-xl border text-center font-medium text-xs transition-all flex flex-col items-center justify-center gap-1.5 ${
                  selectedShape === s.id
                    ? 'border-[#1E3A5F] bg-[#1E3A5F]/5 text-[#1E3A5F] font-bold'
                    : 'border-stone-150 text-stone-600 hover:border-stone-250'
                }`}>
                <span className="capitalize">{s.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Step 3: Size */}
        {selectedShape && (
          <div className="bg-white p-5 border border-stone-200 rounded-xl space-y-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-stone-400 uppercase tracking-wider">Step 3: Choose Size Range</label>
              <p className="text-[10px] text-stone-400">Filter list by melee sieve group or select directly</p>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {['all', '+000-2', '+2-8', '+8-11', '+11-12', '+12-14'].map(g => (
                <button key={g} onClick={() => { setSieve(g); setSelectedSize('') }}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                    sieve === g
                      ? 'border-[#1E3A5F] bg-[#1E3A5F]/8 text-[#1E3A5F]'
                      : 'border-stone-200 text-stone-500 hover:border-stone-300'
                  }`}>
                  {g === 'all' ? 'All Sizes' : g}
                </button>
              ))}
            </div>

            <select className="w-full bg-stone-50 border border-stone-200 text-stone-800 text-xs px-3 py-2.5 rounded-lg font-medium"
              value={selectedSize} onChange={e => { setSelectedSize(e.target.value); setPriceData(null); setQueried(false) }}>
              <option value="">Select specific MM size...</option>
              {filteredSizes.map(s => (
                <option key={s.id} value={s.id}>
                  {s.label} {s.approx_carats ? `(${s.approx_carats.toFixed(3)} ct)` : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Step 4: Quality */}
        {selectedShape && selectedSize && (
          <div className="bg-white p-5 border border-stone-200 rounded-xl space-y-4">
            <label className="text-xs font-bold text-stone-400 uppercase tracking-wider block">Step 4: Choose Quality &amp; Color Grade</label>

            <div className="space-y-3">
              <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Clarity Bucket</p>
              <div className="flex flex-wrap gap-1.5">
                {qualities.map(q => (
                  <button key={q.id} onClick={() => { setSelectedQuality(q.id); setPriceData(null); setQueried(false) }}
                    className={`px-4 py-2 rounded-lg border text-xs font-semibold transition-all ${
                      selectedQuality === q.id
                        ? 'border-[#1E3A5F] bg-[#1E3A5F]/8 text-[#1E3A5F]'
                        : 'border-stone-200 text-stone-500 hover:border-stone-300'
                    }`}>
                    {q.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Color Range</p>
              <div className="flex flex-wrap gap-1.5">
                {colors.map(c => (
                  <button key={c.id} onClick={() => { setSelectedColor(c.id); setPriceData(null); setQueried(false) }}
                    className={`px-4 py-2 rounded-lg border text-xs font-semibold transition-all ${
                      selectedColor === c.id
                        ? 'border-[#1E3A5F] bg-[#1E3A5F]/8 text-[#1E3A5F]'
                        : 'border-stone-200 text-stone-500 hover:border-stone-300'
                    }`}>
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Right panel: Pricing Display */}
      <div className="space-y-6">
        <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm space-y-5 sticky top-6">
          <h2 className="font-bold text-stone-900 text-sm pb-2 border-b border-stone-100 uppercase tracking-wide">Quoted Estimate</h2>

          {!selectionComplete ? (
            <div className="text-center py-10 text-stone-400 space-y-2">
              <AlertCircle className="w-8 h-8 mx-auto text-stone-350" />
              <p className="text-xs">Complete all progressive selections to fetch pricing.</p>
            </div>
          ) : (
            <div className="space-y-5">
              <button onClick={handleGetPrice} disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-[#1E3A5F] hover:bg-[#162B47] text-white py-3 rounded-lg text-xs font-bold transition-colors disabled:opacity-50">
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'FETCH QUOTED RATE'}
              </button>

              {queried && priceData && (
                <div className="space-y-5">
                  {priceData.price_per_piece === null ? (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 space-y-2">
                      <p className="font-semibold">Pricing Not Configured</p>
                      <p className="leading-relaxed">Shewah has not configured a default wholesale rate for this specific bucket. You can still negotiate a rate by placing a custom price ask.</p>
                      <button onClick={handleOpenAskModal}
                        className="w-full mt-1 bg-amber-600 hover:bg-amber-700 text-white py-2 rounded-md font-semibold text-[11px] transition-colors">
                        PLACE ASK FOR REVIEW
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-5">
                      <div className="bg-stone-50 border border-stone-150 rounded-xl p-4 space-y-3">
                        <div className="flex justify-between items-baseline">
                          <span className="text-xs text-stone-400">Rate per Piece</span>
                          <span className="text-xl font-bold text-stone-900">₹{priceData.price_per_piece.toLocaleString('en-IN')}</span>
                        </div>
                        <div className="flex justify-between items-baseline pt-2 border-t border-stone-200/60">
                          <span className="text-xs text-stone-400">Rate per Carat</span>
                          <span className="text-sm font-semibold text-stone-700">₹{priceData.price_per_carat?.toLocaleString('en-IN') || '—'} / ct</span>
                        </div>
                        <p className="text-[10px] text-stone-400 leading-relaxed pt-1">
                          Calculated for reference size {priceData.size_label} ({priceData.approx_carats.toFixed(3)} ct/pc).
                        </p>
                      </div>

                      <div className="space-y-2">
                        <button onClick={handleInstantBuy} disabled={purchasingInstant}
                          className="w-full flex items-center justify-center gap-2 bg-[#1E3A5F] hover:bg-[#162B47] text-white py-3 rounded-lg text-xs font-bold transition-colors disabled:opacity-50">
                          {purchasingInstant ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              PROCESSING ORDER...
                            </>
                          ) : (
                            <>
                              <ShoppingCart className="w-3.5 h-3.5" />
                              BUY AT QUOTED RATE (min 10)
                            </>
                          )}
                        </button>
                        <button onClick={handleOpenAskModal} disabled={purchasingInstant}
                          className="w-full flex items-center justify-center gap-2 bg-stone-100 hover:bg-stone-200 text-stone-850 py-3 rounded-lg text-xs font-bold transition-colors">
                          <MessageCircle className="w-3.5 h-3.5 text-stone-500" />
                          NEGOTIATE ASK PRICE
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Ask Modal */}
      {showAskModal && priceData && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <form onSubmit={handleSubmitAsk} className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl flex flex-col">
            <div className="px-5 py-4 border-b border-stone-100">
              <h3 className="font-bold text-stone-900 text-sm">Place Diamond Price Ask</h3>
              <p className="text-[11px] text-stone-400 mt-0.5">Submit price negotiation proposal to admin</p>
            </div>

            <div className="p-5 space-y-4">
              <div className="bg-stone-50 p-3 rounded-lg text-xs text-stone-600 space-y-1">
                <p><span className="font-medium text-stone-400">Specs:</span> <span className="capitalize">{type === 'lgd' ? 'Lab Grown' : 'Natural'}</span> · {shapes.find(s => s.id === selectedShape)?.name} · {allSizes.find(s => s.id === selectedSize)?.label} · {qualities.find(q => q.id === selectedQuality)?.label}-{colors.find(c => c.id === selectedColor)?.label}</p>
                {priceData.price_per_piece !== null && (
                  <p><span className="font-medium text-stone-400">Orig. Quote:</span> ₹{priceData.price_per_piece.toLocaleString('en-IN')}/pc (₹{priceData.price_per_carat?.toLocaleString('en-IN')}/ct)</p>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2 items-end">
                <div className="col-span-2">
                  <label className="block text-[11px] font-bold text-stone-400 uppercase tracking-wide mb-1">Your Price Ask *</label>
                  <input type="number" step="any" min="0.01" className="w-full bg-stone-50 border border-stone-200 text-stone-800 text-xs px-3 py-2 rounded-lg font-semibold"
                    required value={askPrice} onChange={e => setAskPrice(e.target.value)} />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-stone-400 uppercase tracking-wide mb-1">Unit *</label>
                  <select className="w-full bg-stone-50 border border-stone-200 text-stone-850 text-xs px-2 py-2 rounded-lg font-semibold"
                    value={askUnit} onChange={e => setAskUnit(e.target.value as any)}>
                    <option value="per_pc">/ pc</option>
                    <option value="per_ct">/ ct</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-stone-400 uppercase tracking-wide mb-1">Quantity Requested (Pcs) *</label>
                <input type="number" min="1" className="w-full bg-stone-50 border border-stone-200 text-stone-800 text-xs px-3 py-2 rounded-lg font-semibold"
                  required value={askQty} onChange={e => setAskQty(e.target.value)} />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-stone-400 uppercase tracking-wide mb-1">Reason (Optional)</label>
                <textarea rows={3} className="w-full bg-stone-50 border border-stone-200 text-stone-800 text-xs px-3 py-2 rounded-lg font-medium resize-none"
                  placeholder="e.g. bulk purchase, matching competitor quote..."
                  value={askReason} onChange={e => setAskReason(e.target.value)} />
              </div>
            </div>

            <div className="px-5 py-3.5 bg-stone-50 border-t border-stone-100 flex justify-end gap-2 shrink-0">
              <button type="button" onClick={() => setShowAskModal(false)} disabled={submittingAsk}
                className="px-4 py-2 text-xs font-semibold text-stone-500 hover:text-stone-700 transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={submittingAsk}
                className="bg-[#1E3A5F] hover:bg-[#162B47] text-white px-5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 disabled:opacity-50">
                {submittingAsk && <Loader2 className="w-3 h-3 animate-spin" />}
                Submit Ask
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
