'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Sparkles, Image as ImageIcon, X, Loader2, Calculator, ChevronDown, ChevronUp, Trash2, Plus } from 'lucide-react'
import { uploadToCloudinary } from '@/lib/cloudinaryUpload'

const KARATS = [22, 18, 14, 10, 9] as const
const QUALITIES = ['VVS', 'VS', 'SI']
const COLORS = ['DEF', 'GH', 'IJ']

type DiamondRow = {
  id: string
  shape_id: string
  size_id: string
  size_label: string
  quality: string
  color: string
  pieces: string
  cost: string
  // Inline cost suggestions fetched from /api/diamonds/latest-cost
  matrix?: Array<{ quality_label: string; color_label: string; price: number }>
  history?: { cost: number; source_label: string } | null
}

type Shape = { id: string; name: string }
type Size = { id: string; shape_id: string; label: string; approx_carats: number | null }

type Quote = {
  karat: number
  gold_weight_g: number
  rate_24k: number
  diamond_cost_total: number
  making_charges: number
  igi_cost: number
  quote: { karat: number; weight: number; goldCost: number; labourCost: number; cogs: number; trade: number; mrp: number } | null
}

function newDiamondRow(): DiamondRow {
  return {
    id: crypto.randomUUID(), shape_id: '', size_id: '', size_label: '',
    quality: 'VS', color: 'GH', pieces: '1', cost: '',
  }
}

export default function RetailerCustomOrderPage() {
  const router = useRouter()
  const [brief, setBrief] = useState('')
  const [qty, setQty] = useState('1')
  const [size, setSize] = useState('')
  const [notes, setNotes] = useState('')
  const [images, setImages] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // ----- Comparison panel state -----
  const [compareOpen, setCompareOpen] = useState(false)
  const [goldWeight, setGoldWeight] = useState('')
  const [karat, setKarat] = useState<number>(22)
  const [diamonds, setDiamonds] = useState<DiamondRow[]>([newDiamondRow()])
  const [shapes, setShapes] = useState<Shape[]>([])
  const [sizes, setSizes] = useState<Size[]>([])
  const [quote, setQuote] = useState<Quote | null>(null)
  const [quoting, setQuoting] = useState(false)
  const [quoteErr, setQuoteErr] = useState('')

  // Lazily load shapes + sizes only when the operator opens the panel — keeps
  // the page snappy for retailers who never use the comparison feature.
  useEffect(() => {
    if (!compareOpen || shapes.length > 0) return
    ;(async () => {
      try {
        const [rs, rz] = await Promise.all([
          fetch('/api/diamonds/shapes'),
          fetch('/api/diamonds/sizes'),
        ])
        if (rs.ok) {
          const j = await rs.json()
          setShapes(j.shapes || j.items || [])
        }
        if (rz.ok) {
          const j = await rz.json()
          setSizes(j.sizes || j.items || [])
        }
      } catch { /* silent — manual entry still works */ }
    })()
  }, [compareOpen, shapes.length])

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return
    setUploading(true)
    try {
      const urls: string[] = []
      for (const f of Array.from(files)) {
        const u = await uploadToCloudinary(f, 'retailer-custom')
        urls.push(u)
      }
      setImages(prev => [...prev, ...urls])
    } catch (e: any) {
      setError(e.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  function remove(url: string) { setImages(prev => prev.filter(u => u !== url)) }

  // --- Diamond row helpers (comparison panel) ---
  function addDiamond() { setDiamonds(prev => [...prev, newDiamondRow()]) }
  function rmDiamond(id: string) {
    setDiamonds(prev => prev.length > 1 ? prev.filter(d => d.id !== id) : prev)
  }
  function updateDiamond(id: string, patch: Partial<DiamondRow>) {
    setDiamonds(prev => prev.map(d => d.id === id ? { ...d, ...patch } : d))
  }
  // Fetch matrix + history for the row whenever its shape/size/type changes,
  // and auto-fill cost when the cost field is blank. Operator can still type
  // a custom number for verbal-deal closing.
  async function fetchSuggestions(rowId: string, shape_id: string, size_id: string) {
    if (!shape_id || !size_id) return
    try {
      const url = new URL('/api/diamonds/latest-cost', window.location.origin)
      url.searchParams.set('shape_id', shape_id)
      url.searchParams.set('size_id', size_id)
      url.searchParams.set('type', 'lgd')
      const r = await fetch(url.toString())
      if (!r.ok) return
      const d = await r.json()
      const matrix = Array.isArray(d.matrix_options) ? d.matrix_options.map((m: any) => ({
        quality_label: m.quality_label, color_label: m.color_label, price: Number(m.price) || 0,
      })) : []
      const history = (d.cost != null && Number.isFinite(Number(d.cost)))
        ? { cost: Number(d.cost), source_label: String(d.source_label || 'History') }
        : null
      setDiamonds(prev => prev.map(row => {
        if (row.id !== rowId) return row
        const next = { ...row, matrix, history }
        if (!next.cost || next.cost === '') {
          const qMatch = matrix.find((m: any) => m.quality_label.toLowerCase().includes(row.quality.toLowerCase().slice(0, 2)))
          const cMatch = qMatch && matrix.find((m: any) => m.quality_label === qMatch.quality_label && m.color_label.toLowerCase().includes(row.color.toLowerCase().slice(0, 1)))
          const pick = cMatch?.price ?? qMatch?.price ?? matrix[0]?.price ?? history?.cost
          if (pick != null) {
            if (pick === history?.cost) {
              next.cost = String(pick)
            } else {
              const sz = sizes.find(s => s.id === row.size_id)
              const wt = sz?.approx_carats || 0
              next.cost = String(wt * pick)
            }
          }
        }
        return next
      }))
    } catch { /* silent */ }
  }

  async function recomputeQuote() {
    setQuoteErr('')
    const w = Number(goldWeight) || 0
    if (w <= 0) { setQuote(null); return }
    setQuoting(true)
    try {
      const r = await fetch('/api/portal/retailer/quote-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gold_weight_g: w,
          karat,
          diamonds: diamonds.map(d => ({ pieces: parseInt(d.pieces) || 1, cost: parseFloat(d.cost) || 0 })),
        }),
      })
      const j = await r.json()
      if (!r.ok) { setQuoteErr(j.error || 'Could not compute quote'); setQuote(null) }
      else setQuote(j)
    } finally { setQuoting(false) }
  }
  // Live-recompute whenever any pricing input changes.
  useEffect(() => {
    if (!compareOpen) return
    const t = setTimeout(() => { recomputeQuote() }, 350)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compareOpen, goldWeight, karat, JSON.stringify(diamonds.map(d => [d.pieces, d.cost]))])

  async function submit() {
    if (!brief.trim()) { setError('Describe what you would like Shewah to make.'); return }
    setSubmitting(true)
    setError('')

    // Snapshot the comparison panel into the order so Shewah admin can see
    // exactly what the retailer was comparing against. Only included when
    // the panel was opened and gold weight is set.
    let comparison_payload: any = null
    if (compareOpen && Number(goldWeight) > 0) {
      comparison_payload = {
        gold_weight_g: Number(goldWeight),
        karat,
        diamonds: diamonds.map(d => ({
          shape_id: d.shape_id || null,
          size_id: d.size_id || null,
          size_label: d.size_label || null,
          quality: d.quality, color: d.color,
          pieces: parseInt(d.pieces) || 1,
          cost: parseFloat(d.cost) || 0,
        })),
        computed_quote: quote,
        captured_at: new Date().toISOString(),
      }
    }

    const res = await fetch('/api/portal/retailer/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'custom',
        quantity: parseInt(qty) || 1,
        ring_size: size || null,
        special_notes: notes || null,
        brief_text: brief,
        brief_images: images,
        comparison_payload,
      }),
    })
    const data = await res.json()
    setSubmitting(false)
    if (!res.ok) { setError(data.error || 'Could not submit order'); return }
    router.push(`/portal/retailer/orders/${data.order.id}`)
  }

  const inp = "w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:border-stone-800 outline-none bg-white"
  const lbl = "block text-xs font-medium text-stone-500 mb-1"

  const sizesForShape = (shape_id: string) => sizes.filter(s => s.shape_id === shape_id)

  return (
    <div className="p-4 lg:p-7 max-w-3xl mx-auto">
      <Link href="/portal/retailer" className="text-stone-400 hover:text-stone-600 inline-flex items-center gap-1.5 text-sm mb-4">
        <ArrowLeft className="w-4 h-4" /> Catalog
      </Link>

      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-stone-800/15 text-stone-800 flex items-center justify-center">
          <Sparkles className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Custom design order</h1>
          <p className="text-stone-500 text-sm">Describe the piece you want and attach reference images.</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 p-5 space-y-4">
        <div>
          <label className={lbl}>Design brief *</label>
          <textarea rows={5} className={`${inp} resize-none`}
            placeholder="Describe the style, occasion, customer preference, diamond size, gold karat, budget..."
            value={brief} onChange={e => setBrief(e.target.value)} />
        </div>

        <div>
          <label className={lbl}>Reference images</label>
          {images.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-3">
              {images.map(u => (
                <div key={u} className="relative aspect-square rounded-lg overflow-hidden border border-stone-200 group">
                  <img src={u} alt="" className="w-full h-full object-cover" />
                  <button type="button" onClick={() => remove(u)}
                    className="absolute top-1 right-1 bg-black/60 hover:bg-black/80 text-white rounded-full p-1 opacity-0 group-hover:opacity-100">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <label className="inline-flex items-center gap-2 px-4 py-2 border border-stone-200 rounded-lg text-sm text-stone-600 hover:bg-stone-50 cursor-pointer">
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
            {uploading ? 'Uploading...' : 'Add images'}
            <input type="file" accept="image/*" multiple className="hidden"
              onChange={e => handleUpload(e.target.files)} disabled={uploading} />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lbl}>Quantity</label>
            <input type="number" inputMode="numeric" min="1" className={inp}
              value={qty} onChange={e => setQty(e.target.value)} />
          </div>
          <div>
            <label className={lbl}>Ring size (if known)</label>
            <input className={inp} placeholder="e.g. 16, 17, 18"
              value={size} onChange={e => setSize(e.target.value)} />
          </div>
        </div>

        <div>
          <label className={lbl}>Notes for Shewah</label>
          <textarea rows={3} className={`${inp} resize-none`}
            placeholder="Anything else we should know..."
            value={notes} onChange={e => setNotes(e.target.value)} />
        </div>

        {/* ───── Comparison panel ───── */}
        <div className="border border-stone-200 rounded-xl overflow-hidden">
          <button type="button" onClick={() => setCompareOpen(o => !o)}
            className="w-full flex items-center justify-between px-4 py-3 bg-stone-50 hover:bg-stone-100 text-left">
            <div className="flex items-center gap-2.5">
              <Calculator className="w-4 h-4 text-stone-800" />
              <div>
                <p className="text-sm font-medium text-stone-900">Already have a piece? Get a Shewah comparison quote</p>
                <p className="text-[11px] text-stone-500">Enter the gold weight, karat and diamonds and see what Shewah would charge.</p>
              </div>
            </div>
            {compareOpen ? <ChevronUp className="w-4 h-4 text-stone-400" /> : <ChevronDown className="w-4 h-4 text-stone-400" />}
          </button>

          {compareOpen && (
            <div className="p-4 space-y-4 bg-white">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className={lbl}>Gold weight (g, net)</label>
                  <input type="number" inputMode="decimal" step="0.01" className={inp}
                    placeholder="e.g. 8.50" value={goldWeight} onChange={e => setGoldWeight(e.target.value)} />
                </div>
                <div>
                  <label className={lbl}>Karat</label>
                  <select className={inp} value={karat} onChange={e => setKarat(parseInt(e.target.value))}>
                    {KARATS.map(k => <option key={k} value={k}>{k}kt</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-stone-500">Diamonds</p>
                  <button type="button" onClick={addDiamond}
                    className="text-xs text-stone-800 hover:underline inline-flex items-center gap-1">
                    <Plus className="w-3 h-3" /> Add row
                  </button>
                </div>
                {diamonds.map((d, idx) => (
                  <div key={d.id} className="border border-stone-100 rounded-lg p-2.5 bg-stone-50">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] text-stone-400">Stone {idx + 1}</span>
                      {diamonds.length > 1 && (
                        <button type="button" onClick={() => rmDiamond(d.id)} className="text-red-400 hover:text-red-600">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                      <div>
                        <label className={lbl}>Shape</label>
                        <select className={inp} value={d.shape_id}
                          onChange={e => {
                            const sid = e.target.value
                            updateDiamond(d.id, { shape_id: sid, size_id: '', size_label: '' })
                          }}>
                          <option value="">—</option>
                          {shapes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className={lbl}>Size</label>
                        <select className={inp} value={d.size_id} disabled={!d.shape_id}
                          onChange={e => {
                            const sz = sizesForShape(d.shape_id).find(s => s.id === e.target.value)
                            updateDiamond(d.id, { size_id: e.target.value, size_label: sz?.label || '' })
                            fetchSuggestions(d.id, d.shape_id, e.target.value)
                          }}>
                          <option value="">—</option>
                          {sizesForShape(d.shape_id).map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className={lbl}>Quality</label>
                        <select className={inp} value={d.quality} onChange={e => updateDiamond(d.id, { quality: e.target.value })}>
                          {QUALITIES.map(q => <option key={q} value={q}>{q}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className={lbl}>Color</label>
                        <select className={inp} value={d.color} onChange={e => updateDiamond(d.id, { color: e.target.value })}>
                          {COLORS.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className={lbl}>Pieces</label>
                        <input type="number" min="1" className={inp} value={d.pieces} onChange={e => updateDiamond(d.id, { pieces: e.target.value })} />
                      </div>
                      <div>
                        <label className={lbl}>Cost/pc (₹)</label>
                        <input type="number" inputMode="decimal" className={inp} value={d.cost} onChange={e => updateDiamond(d.id, { cost: e.target.value })} placeholder="auto" />
                      </div>
                    </div>
                    {((d.matrix && d.matrix.length > 0) || d.history) && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                         {(d.matrix || []).map((m, i) => {
                           const sz = sizes.find(s => s.id === d.size_id)
                           const wt = sz?.approx_carats || 0
                           const pcCost = Math.round(wt * m.price)
                           const active = Math.abs((parseFloat(d.cost) || 0) - pcCost) < 0.01
                           return (
                             <button key={i} type="button"
                               onClick={() => updateDiamond(d.id, { cost: String(pcCost) })}
                               className={'text-[11px] px-2 py-0.5 rounded border ' +
                                 (active ? 'border-stone-800 bg-stone-800/5 text-stone-800'
                                         : 'border-stone-200 bg-white text-stone-600 hover:border-stone-800/40')}
                               title={`Matrix · ${m.quality_label} · ${m.color_label} · Rate: ₹${m.price.toLocaleString('en-IN')}/ct`}>
                               <span className="text-stone-400 mr-1">{m.quality_label}·{m.color_label}</span>
                               ₹{pcCost.toLocaleString('en-IN')}
                               <span className="text-[10px] text-stone-400 ml-1">({m.price.toLocaleString('en-IN')}/ct)</span>
                             </button>
                           )
                         })}
                        {d.history && (
                          <button type="button"
                            onClick={() => updateDiamond(d.id, { cost: String(d.history!.cost) })}
                            className={'text-[11px] px-2 py-0.5 rounded border ' +
                              (parseFloat(d.cost) === d.history.cost
                                ? 'border-amber-500 bg-amber-50 text-amber-800'
                                : 'border-stone-200 bg-white text-stone-600 hover:border-amber-400')}>
                            <span className="text-stone-400 mr-1">Last</span>
                            ₹{d.history.cost.toLocaleString('en-IN')}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Quote read-out */}
              <div className="bg-stone-800/5 border border-stone-800/15 rounded-lg p-3.5">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-stone-600">
                    Shewah quote {quote ? `at ${quote.karat}kt` : ''}
                  </p>
                  {quoting && <Loader2 className="w-3.5 h-3.5 animate-spin text-stone-400" />}
                </div>
                {quoteErr ? (
                  <p className="text-xs text-red-600">{quoteErr}</p>
                ) : !quote || !quote.quote ? (
                  <p className="text-xs text-stone-400">Enter gold weight to see the quote.</p>
                ) : (
                  <div className="space-y-1.5 text-sm">
                    <Row label={`Gold (${quote.quote.weight.toFixed(3)} g · 24kt-pure @ ₹${quote.rate_24k.toLocaleString('en-IN')}/g)`} value={quote.quote.goldCost} />
                    <Row label="Labour" value={quote.quote.labourCost} />
                    <Row label="Diamonds" value={quote.diamond_cost_total} />
                    <div className="border-t border-stone-800/15 pt-1.5 mt-1.5">
                      <Row label="COGS" value={quote.quote.cogs} bold />
                      <Row label="Trade price" value={quote.quote.trade} bold accent />
                    </div>
                  </div>
                )}
                <p className="text-[10px] text-stone-400 mt-2">
                  Indicative only — locked-in pricing happens when Shewah confirms the order.
                </p>
              </div>
            </div>
          )}
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <div className="flex justify-end">
          <button onClick={submit} disabled={submitting || uploading}
            className="flex items-center gap-2 bg-stone-800 hover:bg-stone-900 text-white px-5 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50">
            <Sparkles className="w-4 h-4" />
            {submitting ? 'Submitting...' : 'Submit custom request'}
          </button>
        </div>
        <p className="text-[11px] text-stone-400">
          Shewah will respond with a CAD draft and pricing based on your brief.
        </p>
      </div>
    </div>
  )
}

function Row({ label, value, bold, accent }: { label: string; value: number; bold?: boolean; accent?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className={'text-stone-600 ' + (bold ? 'font-medium' : '')}>{label}</span>
      <span className={(accent ? 'text-stone-800 ' : 'text-stone-900 ') + (bold ? 'font-semibold' : '')}>
        ₹{(value || 0).toLocaleString('en-IN')}
      </span>
    </div>
  )
}
